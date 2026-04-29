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
            if (state.isConnected && !this.isSocketConnected() && this.driverId) {
                this.reconnect();
      } else if (!state.isConnected) {
              }
    });
  }

  setActiveRide(rideId) {
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
            return;
    }

    try {
      const token = await AsyncStorage.getItem('userToken');
      this.driverId = await AsyncStorage.getItem('driverId');

      
      if (!this.driverId) {
                return;
      }

      if (!token) {
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

        // Join the general driver pool
        this.socket.emit('driver:join', this.driverId);

        // Emit driver status as online & available
        this.socket.emit('driver:status-change', {
          driverId: this.driverId,
          isOnline: true,
          isAvailable: !this.currentRideId, // Not available if already on a ride
        });

        // Join ride tracking if there's an active ride
        if (this.currentRideId) {
                    this.joinRideTracking(this.currentRideId).catch(error => {
            console.error('Failed to join ride tracking on reconnect:', error);
          });
        }
      });

      this.socket.on('disconnect', reason => {
        this.isConnected = false;
              });

      this.socket.on('connect_error', error => {
        this.isConnected = false;
                      });

      this.socket.on('connect_timeout', timeout => {
              });

      this.socket.on('reconnect', attemptNumber => {
                this.isConnected = true;

        // Join ride tracking if there's an active ride after reconnection
        if (this.currentRideId) {
                    this.joinRideTracking(this.currentRideId).catch(error => {
            console.error('Failed to rejoin ride tracking after reconnect:', error);
          });
        }
      });

      this.socket.on('reconnect_error', error => {
              });

      this.socket.on('authenticated', data => {
              });

      this.socket.on('unauthorized', data => {
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
        bearing: heading || 0,
        speed: speed ? (speed * 3.6) : 0, // Convert m/s to km/h
      });
          }
  }

  async joinRideTracking(rideId) {
    if (!this.socket || !this.isConnected) {
      console.error('Socket not connected');
      return false;
    }

    return new Promise((resolve, reject) => {
      
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

  // ─── RIDE STATUS EMISSION METHODS ───────────────────────────────────────

  /**
   * Emit driver:status-change to update online/available status.
   * Call this when going online, offline, or becoming available after a ride.
   */
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

  /**
   * Emit driver:arrived when driver reaches the pickup location.
   */
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

  /**
   * Emit ride:started when the driver confirms pickup and starts trip to destination.
   */
  emitRideStarted(rideId) {
    if (!this.socket || !this.isConnected || !this.driverId) {
            return;
    }

    this.socket.emit('ride:started', {
      rideId: rideId || this.currentRideId,
      driverId: this.driverId,
    });
      }

  /**
   * Emit ride:completed when the driver finishes the trip.
   * Also re-emits driver:status-change to mark driver as available again.
   */
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
    
    // Mark driver as available again
    this.emitStatusChange(true, true);
  }
}

export default new SocketService();
