import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const API_HOST = 'https://godelivo.com/';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.driverId = null;
    this.listeners = {};
    this.currentRideId = null;
    this.pendingRideRequests = [];
    this.networkSubscription = null;
    this.initNetworkMonitoring();
  }

  initNetworkMonitoring() {
    this.networkSubscription = NetInfo.addEventListener(state => {
      console.log('🌐 Network state changed:', state.isConnected);
      if (state.isConnected && !this.isSocketConnected() && this.driverId) {
        console.log('🌐 Network restored, attempting to reconnect socket...');
        this.reconnect();
      } else if (!state.isConnected) {
        console.log(
          '🌐 Network lost, socket will reconnect when network is restored',
        );
      }
    });
  }

  setActiveRide(rideId) {
    console.log('Setting active ride ID for tracking:', rideId);
    this.currentRideId = rideId;
    if (rideId && this.socket && this.isConnected) {
      this.joinRideTracking(rideId);
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
      console.log('🔌 Socket already connected');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('userToken');
      this.driverId = await AsyncStorage.getItem('driverId');

      console.log('🔌 Socket connecting...', {
        hasToken: !!token,
        driverId: this.driverId,
        socketUrl: this.getBaseHost(),
      });

      if (!this.driverId) {
        console.log('⚠️ Socket connection skipped: missing driverId');
        return;
      }

      if (!token) {
        console.log('⚠️ Socket connection skipped: missing token');
        return;
      }

      const socketUrl = this.getBaseHost();

      this.socket = io(socketUrl, {
        path: '/socket.io/',
        transports: ['websocket', 'polling'],
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
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 5000,
        timeout: 15000,
        forceNew: true,
      });

      this.socket.on('connect', () => {
        this.isConnected = true;
        console.log('✅ Socket.IO connected with ID:', this.socket.id);

        // Authenticate with backend
        this.socket.emit('authenticate', {
          token: token,
          driverId: this.driverId,
          userType: 'driver',
        });

        // Notify backend that driver is online
        this.socket.emit('driver_online', {
          driverId: this.driverId,
          timestamp: Date.now(),
        });

        // Join ride tracking if there's an active ride
        if (this.currentRideId) {
          console.log('🔗 Socket connected, joining tracking for active ride:', this.currentRideId);
          this.joinRideTracking(this.currentRideId).catch(error => {
            console.error('Failed to join ride tracking on reconnect:', error);
          });
        }
      });

      this.socket.on('disconnect', reason => {
        this.isConnected = false;
        console.log('⚠️ Socket.IO disconnected:', reason);
      });

      this.socket.on('connect_error', error => {
        this.isConnected = false;
        console.log('❌ Socket.IO connection error:', error.message);
        console.log('❌ Connection details:', {
          url: socketUrl,
          error: error.message,
          type: error.type,
          description: error.description,
        });
      });

      this.socket.on('connect_timeout', timeout => {
        console.log('⏰ Socket.IO connection timeout:', timeout);
      });

      this.socket.on('reconnect', attemptNumber => {
        console.log(
          '🔄 Socket.IO reconnected after',
          attemptNumber,
          'attempts',
        );
        this.isConnected = true;

        // Join ride tracking if there's an active ride after reconnection
        if (this.currentRideId) {
          console.log('🔄 Reconnected, re-joining tracking for ride:', this.currentRideId);
          this.joinRideTracking(this.currentRideId).catch(error => {
            console.error('Failed to rejoin ride tracking after reconnect:', error);
          });
        }
      });

      this.socket.on('reconnect_error', error => {
        console.log('❌ Socket.IO reconnection error:', error.message);
      });

      this.socket.on('authenticated', data => {
        console.log('🔐 Socket authenticated successfully:', data);
      });

      this.socket.on('unauthorized', data => {
        console.log('🚫 Socket authentication failed:', data);
        this.disconnect();
      });

      // Apply any queued listeners
      Object.keys(this.listeners).forEach(event => {
        this.listeners[event].forEach(cb => {
          this.socket.on(event, cb);
        });
      });
    } catch (e) {
      console.error('❌ Socket connect exception:', e);
      this.isConnected = false;
    }
  }

  disconnect() {
    if (this.socket) {
      if (this.driverId) {
        this.socket.emit('driver_offline', { driverId: this.driverId });
      }
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
  }

  cleanup() {
    if (this.networkSubscription) {
      this.networkSubscription();
      this.networkSubscription = null;
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
    console.log('🔄 Manually reconnecting socket...');
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
    if (this.listeners[event]) {
      delete this.listeners[event];
    }
    if (this.socket) {
      this.socket.off(event);
    }
  }

  emitLocation(latitude, longitude, heading = 0, speed = 0) {
    if (!this.socket || !this.isConnected || !this.driverId) {
      console.log('📍 Location emission skipped: socket not ready', {
        hasSocket: !!this.socket,
        isConnected: this.isConnected,
        hasDriverId: !!this.driverId,
      });
      return;
    }

    const payload = {
      driverId: this.driverId,
      latitude,
      longitude,
      heading,
      speed,
      timestamp: Date.now(),
    };

    console.log('📡 Emitting live location to socket', {
      lat: latitude,
      lng: longitude,
      heading: heading.toFixed(0),
      speed: speed.toFixed(2),
      rideId: this.currentRideId,
    });

    // volatile.emit ensures that if the packet gets dropped or connection lags,
    // Socket.io won't buffer stale locations. (Perfect for fast-moving targets)
    // this.socket.volatile.emit('driver_location_update', payload);

    if (this.currentRideId) {
      this.socket.volatile.emit('driver:location-update', {
        driverId: this.driverId,
        rideId: this.currentRideId,
        socketId: this.socket?.id,
        latitude,
        longitude,
      });
      console.log(
        '🎯 Location update sent for active ride:',
        this.socket?.id,
        this.currentRideId,
        this.driverId,
        latitude,
        longitude,
      );
    }
  }

  async joinRideTracking(rideId) {
    if (!this.socket || !this.isConnected) {
      console.error('Socket not connected');
      return false;
    }

    return new Promise((resolve, reject) => {
      console.log(`Joining tracking for ride ${rideId}...`);

      // Set up one-time listener for confirmation
      const timeout = setTimeout(() => {
        this.socket.off('tracking:joined', handler);
        reject(new Error('Join tracking timeout'));
      }, 10000);

      const handler = data => {
        if (data.success && data.rideId === rideId) {
          clearTimeout(timeout);
          this.currentRideId = rideId;
          this.hasJoinedTracking = true;
          console.log('✅ Successfully joined tracking');
          resolve(data);
        }
      };

      this.socket.once('tracking:joined', handler);

      // Send join request
      this.socket.emit('driver:join-tracking', {
        driverId: this.driverId,
        rideId,
      });
    });
  }
}

export default new SocketService();
