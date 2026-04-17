// import Pusher from 'pusher-js';
// import AsyncStorage from '@react-native-async-storage/async-storage';

// class PusherService {
//     constructor() {
//         this.pusher = null;
//         this.channel = null;
//         this.isConnected = false;
//         this.driverId = null;
//         this.locationChannel = null;
//         this.listeners = new Map();
//         this.reconnectAttempts = 0;
//         this.maxReconnectAttempts = 10;
//     }

//     /**
//      * Initialize and connect to Pusher
//      */
//     async connect() {
//         if (this.pusher?.connection?.state === 'connected') {
//             console.log('Pusher already connected');
//             return;
//         }

//         try {
//             const token = await AsyncStorage.getItem('userToken');
//             const driverId = await AsyncStorage.getItem('driverId');

//             console.log('Pusher driverId:', driverId);

//             if (!driverId) {
//                 console.log('Pusher connection skipped: missing driverId');
//                 return;
//             }

//             this.driverId = driverId;

//             // Initialize Pusher with your credentials
//             // Get these from your backend or environment variables
//             const PUSHER_KEY = 'your_pusher_key'; // Replace with your actual key
//             const PUSHER_CLUSTER = 'ap1'; // Replace with your cluster (e.g., 'ap1', 'eu', 'us2', etc.)

//             this.pusher = new Pusher(PUSHER_KEY, {
//                 cluster: PUSHER_CLUSTER,
//                 authEndpoint: 'https://godelivo.com/api/pusher/auth', // Your auth endpoint
//                 auth: {
//                     headers: {
//                         Authorization: `Bearer ${token}`,
//                     },
//                 },
//                 forceTLS: true,
//                 enabledTransports: ['ws', 'wss'],
//                 disabledTransports: ['xhr_streaming', 'xhr_polling'],
//             });

//             // Connection event handlers
//             this.pusher.connection.bind('connected', () => {
//                 this.isConnected = true;
//                 this.reconnectAttempts = 0;
//                 console.log('✅ Pusher connected with socket ID:', this.pusher.connection.socket_id);

//                 // Subscribe to driver channel
//                 this.subscribeToDriverChannel();

//                 // Notify backend driver is online
//                 this.notifyDriverOnline();
//             });

//             this.pusher.connection.bind('disconnected', () => {
//                 this.isConnected = false;
//                 console.log('⚠️ Pusher disconnected');
//             });

//             this.pusher.connection.bind('state_change', (states) => {
//                 console.log('Pusher state change:', states.current);
//             });

//             this.pusher.connection.bind('error', (error) => {
//                 console.error('❌ Pusher connection error:', error);
//                 this.isConnected = false;

//                 // Attempt reconnection with backoff
//                 if (this.reconnectAttempts < this.maxReconnectAttempts) {
//                     setTimeout(() => {
//                         this.reconnectAttempts++;
//                         this.connect();
//                     }, Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000));
//                 }
//             });

//         } catch (error) {
//             console.error('Pusher connect exception:', error);
//         }
//     }

//     /**
//      * Subscribe to driver's private channel
//      */
//     subscribeToDriverChannel() {
//         if (!this.pusher || !this.driverId) return;

//         // Private channel for driver-specific events
//         const channelName = `private-driver-${this.driverId}`;
//         this.channel = this.pusher.subscribe(channelName);

//         this.channel.bind('pusher:subscription_succeeded', () => {
//             console.log(`Subscribed to ${channelName}`);

//             // Bind to ride assignment events
//             this.channel.bind('new-ride-request', (data) => {
//                 console.log('New ride request received:', data);
//                 this.triggerListener('new_ride', data);
//             });

//             this.channel.bind('ride-cancelled', (data) => {
//                 console.log('Ride cancelled:', data);
//                 this.triggerListener('ride_cancelled', data);
//             });

//             this.channel.bind('ride-updated', (data) => {
//                 console.log('Ride updated:', data);
//                 this.triggerListener('ride_updated', data);
//             });

//             this.channel.bind('customer-message', (data) => {
//                 console.log('Customer message:', data);
//                 this.triggerListener('customer_message', data);
//             });
//         });

//         this.channel.bind('pusher:subscription_error', (error) => {
//             console.error('Channel subscription error:', error);
//         });
//     }

//     /**
//      * Subscribe to location updates channel
//      */
//     subscribeToLocationChannel() {
//         if (!this.pusher || !this.driverId) return;

//         // Public channel for location updates
//         const locationChannelName = `location-updates`;
//         this.locationChannel = this.pusher.subscribe(locationChannelName);

//         this.locationChannel.bind('pusher:subscription_succeeded', () => {
//             console.log(`Subscribed to ${locationChannelName}`);
//         });
//     }

//     /**
//      * Notify backend that driver is online
//      */
//     async notifyDriverOnline() {
//         try {
//             const token = await AsyncStorage.getItem('userToken');
//             const response = await fetch('https://godelivo.com/api/driver/online', {
//                 method: 'POST',
//                 headers: {
//                     'Content-Type': 'application/json',
//                     'Authorization': `Bearer ${token}`,
//                 },
//                 body: JSON.stringify({
//                     driverId: this.driverId,
//                     socketId: this.pusher?.connection?.socket_id,
//                 }),
//             });

//             if (!response.ok) {
//                 throw new Error('Failed to notify driver online');
//             }

//             console.log('Driver online notification sent');
//         } catch (error) {
//             console.error('Error notifying driver online:', error);
//         }
//     }

//     /**
//      * Notify backend that driver is offline
//      */
//     async notifyDriverOffline() {
//         try {
//             const token = await AsyncStorage.getItem('userToken');
//             await fetch('https://godelivo.com/api/driver/offline', {
//                 method: 'POST',
//                 headers: {
//                     'Content-Type': 'application/json',
//                     'Authorization': `Bearer ${token}`,
//                 },
//                 body: JSON.stringify({
//                     driverId: this.driverId,
//                 }),
//             });
//             console.log('Driver offline notification sent');
//         } catch (error) {
//             console.error('Error notifying driver offline:', error);
//         }
//     }

//     /**
//      * Emit location update via HTTP (not Pusher)
//      * Pusher is primarily for receiving, not sending
//      */
//     async emitLocation(latitude, longitude, heading = 0, speed = 0) {
//         if (!this.driverId) return;

//         try {
//             const token = await AsyncStorage.getItem('userToken');

//             // Use HTTP POST for location updates
//             // This is more reliable than trying to send via Pusher
//             const response = await fetch('https://godelivo.com/api/driver/location', {
//                 method: 'POST',
//                 headers: {
//                     'Content-Type': 'application/json',
//                     'Authorization': `Bearer ${token}`,
//                 },
//                 body: JSON.stringify({
//                     driverId: this.driverId,
//                     latitude,
//                     longitude,
//                     heading,
//                     speed,
//                     timestamp: Date.now(),
//                 }),
//             });

//             // Fire and forget - don't wait for response
//             if (!response.ok) {
//                 console.warn('Location update failed:', response.status);
//             }
//         } catch (error) {
//             // Silent fail for location updates to not spam console
//             if (__DEV__) {
//                 console.debug('Location update error:', error);
//             }
//         }
//     }

//     /**
//      * Alternative: Use Pusher to trigger events (if backend supports it)
//      */
//     triggerLocationUpdate(latitude, longitude, heading = 0, speed = 0) {
//         if (!this.pusher || !this.isConnected || !this.driverId) return;

//         // This requires backend to have event handlers configured
//         // Not all Pusher setups allow client triggers
//         const channel = this.pusher.channel(`private-driver-${this.driverId}`);
//         if (channel) {
//             channel.trigger('client-location-update', {
//                 driverId: this.driverId,
//                 latitude,
//                 longitude,
//                 heading,
//                 speed,
//                 timestamp: Date.now(),
//             });
//         }
//     }

//     /**
//      * Register event listener
//      */
//     on(eventName, callback) {
//         if (!this.listeners.has(eventName)) {
//             this.listeners.set(eventName, []);
//         }
//         this.listeners.get(eventName).push(callback);
//     }

//     /**
//      * Remove event listener
//      */
//     off(eventName, callback) {
//         if (!this.listeners.has(eventName)) return;

//         const callbacks = this.listeners.get(eventName);
//         const index = callbacks.indexOf(callback);
//         if (index !== -1) {
//             callbacks.splice(index, 1);
//         }
//     }

//     /**
//      * Trigger all listeners for an event
//      */
//     triggerListener(eventName, data) {
//         if (!this.listeners.has(eventName)) return;

//         this.listeners.get(eventName).forEach(callback => {
//             try {
//                 callback(data);
//             } catch (error) {
//                 console.error(`Error in ${eventName} listener:`, error);
//             }
//         });
//     }

//     /**
//      * Disconnect from Pusher
//      */
//     async disconnect() {
//         if (this.driverId) {
//             await this.notifyDriverOffline();
//         }

//         if (this.channel) {
//             this.channel.unbind();
//             this.pusher?.unsubscribe(`private-driver-${this.driverId}`);
//         }

//         if (this.locationChannel) {
//             this.locationChannel.unbind();
//             this.pusher?.unsubscribe('location-updates');
//         }

//         if (this.pusher) {
//             this.pusher.disconnect();
//             this.pusher = null;
//         }

//         this.isConnected = false;
//         this.driverId = null;
//         this.listeners.clear();
//         console.log('Pusher disconnected');
//     }

//     /**
//      * Get connection status
//      */
//     getConnectionStatus() {
//         return {
//             isConnected: this.isConnected,
//             state: this.pusher?.connection?.state,
//             socketId: this.pusher?.connection?.socket_id,
//         };
//     }
// }

// export default new PusherService();