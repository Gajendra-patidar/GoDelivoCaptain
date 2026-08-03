import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const API_HOST = 'https://godelivo.com/';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.isConnecting = false; // Mutex lock to prevent duplicate concurrent connects
    this.driverId = null;
    this.listeners = {};
    this.currentRideId = null;
    this.networkSubscription = null;
    this.reconnectDebounceTimer = null;
    this.heartbeatTimer = null;
    this.initNetworkMonitoring();
  }

  initNetworkMonitoring() {
    if (this.networkSubscription) return;

    this.networkSubscription = NetInfo.addEventListener(state => {
      if (state.isConnected && !this.isSocketConnected() && this.driverId) {
        console.log('📶 Network available. Reconnecting socket with debounce...');
        if (this.reconnectDebounceTimer) {
          clearTimeout(this.reconnectDebounceTimer);
        }
        this.reconnectDebounceTimer = setTimeout(() => {
          this.reconnect();
        }, 3000);
      }
    });
  }

  setActiveRide(rideId) {
    this.currentRideId = rideId;
    if (rideId && this.socket && this.isSocketConnected()) {
      this.joinRideTracking(rideId).catch(error => {
        console.error('Failed to join ride tracking on setActiveRide:', error);
      });
    }
  }

  clearActiveRide() {
    this.currentRideId = null;
  }

  getBaseHost() {
    try {
      const url = new URL(API_HOST);
      return `${url.protocol}//${url.hostname}${
        url.port ? ':' + url.port : ''
      }`;
    } catch {
      return API_HOST.replace(/\/api$/, '');
    }
  }

  async connect() {
    if (this.socket?.connected) {
      this.isConnected = true;
      this.isConnecting = false;
      return this.socket;
    }

    if (this.isConnecting) {
      console.log('⏳ Socket connection attempt already in progress...');
      return null;
    }

    this.isConnecting = true;

    try {
      const token = await AsyncStorage.getItem('userToken');
      this.driverId = await AsyncStorage.getItem('driverId');

      if (!this.driverId || !token) {
        this.isConnecting = false;
        return null;
      }

      const socketUrl = this.getBaseHost();

      this.socket = io(socketUrl, {
        path: '/socket.io/',
        transports: ['websocket'], // Force websocket for fast handshake & lower battery overhead
        auth: {
          token: token,
          userId: this.driverId,
          userType: 'driver',
        },
        query: {
          driverId: this.driverId,
          userType: 'driver',
        },
        reconnection: true,
        reconnectionAttempts: Infinity, // Ensure persistent reconnects during driver transit
        reconnectionDelay: 2000,
        reconnectionDelayMax: 10000,
        timeout: 15000,
        forceNew: false,
      });

      this.socket.on('connect', () => {
        this.isConnected = true;
        this.isConnecting = false;
        console.log('⚡ Socket connected to server:', this.socket.id);
        
        // Authenticate with backend
        // this.socket.emit('authenticate', {
        //   token: token,
        //   driverId: this.driverId,
        //   userType: 'driver',
        // });

        // Notify backend that driver is online
        // this.socket.emit('driver_online', {
        //   driverId: this.driverId,
        //   timestamp: Date.now(),
        // });

        // Join the general driver pool - emit both formats to ensure backend compatibility
        this.socket.emit('driver:join', { driverId: this.driverId });
        this.socket.emit('driver:join', this.driverId);

        // Start heartbeat
        if (this.heartbeatTimer) {
          clearInterval(this.heartbeatTimer);
        }
        this.heartbeatTimer = setInterval(() => {
          if (this.socket && this.socket.connected) {
            this.socket.emit('driver:heartbeat', { driverId: this.driverId });
          }
        }, 120000);

        // Emit driver status as online & available
        this.socket.emit('driver:status-change', {
          driverId: this.driverId,
          isOnline: true,
          isAvailable: !this.currentRideId,
        });

        // Join ride tracking if there's an active ride
        if (this.currentRideId) {
          this.joinRideTracking(this.currentRideId).catch(error => {
            console.error('Failed to join ride tracking on reconnect:', error);
          });
        }
      });

      // this.socket.on('disconnect', reason => {
      //   this.isConnected = false;
      //   this.isConnecting = false;
      //   console.log('🔌 Socket disconnected. Reason:', reason);
      //   if (reason === 'io server disconnect') {
      //     // Reconnect if the server dropped the connection
      //     this.connect();
      //   }
      // });

      // this.socket.on('connect_error', error => {
      //   this.isConnected = false;
      //   this.isConnecting = false;
      //   console.warn('❌ Socket connection error:', error.message);
      // });

      this.socket.on('reconnect', attemptNumber => {
        this.isConnected = true;
        this.isConnecting = false;
        console.log(`🔄 Socket reconnected successfully (attempt ${attemptNumber})`);

        if (this.currentRideId) {
          this.joinRideTracking(this.currentRideId).catch(error => {
            console.error('Failed to rejoin ride tracking after reconnect:', error);
          });
        }
      });

      this.socket.on('unauthorized', data => {
        console.error('❌ Socket unauthorized. Disconnecting...', data);
        this.disconnect();
      });

      // Re-apply any registered listeners to the new socket instance
      Object.keys(this.listeners).forEach(event => {
        this.listeners[event].forEach(cb => {
          this.socket.on(event, cb);
        });
      });

      return this.socket;
    } catch (e) {
      console.error('❌ Socket connect exception:', e);
      this.isConnected = false;
      this.isConnecting = false;
      return null;
    }
  }

  disconnect() {
    if (this.socket) {
      if (this.driverId && this.socket.connected) {
        this.socket.emit('driver:offline', { driverId: this.driverId });
        this.socket.emit('driver_offline', { driverId: this.driverId }); // keep legacy
      }
      this.socket.disconnect();
      this.socket = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.isConnected = false;
    this.isConnecting = false;
  }

  cleanup() {
    if (this.networkSubscription) {
      this.networkSubscription();
      this.networkSubscription = null;
    }
    if (this.reconnectDebounceTimer) {
      clearTimeout(this.reconnectDebounceTimer);
      this.reconnectDebounceTimer = null;
    }
    this.disconnect();
  }

  isSocketConnected() {
    return this.socket?.connected && this.isConnected;
  }

  getConnectionStatus() {
    return {
      isConnected: this.isSocketConnected(),
      socketId: this.socket?.id || null,
      driverId: this.driverId,
    };
  }

  async reconnect() {
    this.disconnect();
    await this.connect();
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);

    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event) {
    delete this.listeners[event];
    if (this.socket) {
      this.socket.off(event);
    }
  }

  emitLocation(latitude, longitude, heading = 0, speed = 0) {
    if (!this.socket || !this.isConnected || !this.driverId) {
      return;
    }

    if (this.currentRideId) {
      // Use volatile so stale location updates are dropped under network congestion
      this.socket.volatile.emit('driver:location-update', {
        driverId: this.driverId,
        rideId: this.currentRideId,
        socketId: this.socket?.id,
        latitude,
        longitude,
        bearing: heading || 0,
        speed: speed ? (speed * 3.6) : 0, // Convert m/s to km/h
      });
    }
  }

  async joinRideTracking(rideId) {
    if (!this.socket || !this.isConnected) {
      await this.connect();
    }

    if (!this.socket || !this.isConnected) {
      console.warn('Cannot join tracking, socket offline');
      return false;
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.socket) {
          this.socket.off('tracking:joined', handler);
        }
        reject(new Error('Join tracking timeout'));
      }, 10000);

      const handler = data => {
        if (data.success && data.rideId === rideId) {
          clearTimeout(timeout);
          this.currentRideId = rideId;
          resolve(data);
        }
      };

      this.socket.once('tracking:joined', handler);

      this.socket.emit('driver:join-tracking', {
        driverId: this.driverId,
        rideId,
      });
    });
  }

  emitStatusChange(isOnline, isAvailable = true) {
    if (!this.socket || !this.isConnected || !this.driverId) {
      return;
    }

    this.socket.emit('driver:status-change', {
      driverId: this.driverId,
      isOnline,
      isAvailable,
    });
  }

  emitDriverArrived(rideId, location) {
    if (!this.socket || !this.isConnected || !this.driverId) {
      return;
    }

    this.socket.emit('driver:arrived', {
      rideId: rideId || this.currentRideId,
      driverId: this.driverId,
      location: location || {},
    });
  }

  emitRideStarted(rideId) {
    if (!this.socket || !this.isConnected || !this.driverId) {
      return;
    }

    this.socket.emit('ride:started', {
      rideId: rideId || this.currentRideId,
      driverId: this.driverId,
    });
  }

  emitRideCompleted(rideId, fare, paymentMethod = 'cash') {
    if (!this.socket || !this.isConnected || !this.driverId) {
      return;
    }

    this.socket.emit('ride:completed', {
      rideId: rideId || this.currentRideId,
      driverId: this.driverId,
      fare,
      paymentMethod,
    });
    
    this.emitStatusChange(true, true);
  }
}

export default new SocketService();
