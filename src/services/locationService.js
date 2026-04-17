import Geolocation from '@react-native-community/geolocation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from './api';
import SocketService from './socketService';

const REPORT_INTERVAL_MS = 60000; // Increased to 60s because Socket.IO handles real-time updates now.

class LocationService {
  constructor() {
    this.intervalId = null;
    this.watchId = null;
    this.lastCoords = null;
    this.isRunning = false;
  }

  async start() {
    if (this.isRunning) {
      console.log("start location services 1");
      return;
    }
    this.isRunning = true;

    console.log("start location services 2");


    // Instantiate high-perf socket connection
    await SocketService.connect();

    // Get initial position
    Geolocation.getCurrentPosition(
      position => {
        this.lastCoords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          heading: position.coords.heading || 0,
          speed: position.coords.speed || 0,
        };
        SocketService.emitLocation(
          this.lastCoords.latitude,
          this.lastCoords.longitude,
          this.lastCoords.heading,
          this.lastCoords.speed
        );
        this.reportLocation(); // Execute HTTP as an initial redundant guarantee
      },
      () => { },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
    );

    // Watch position changes aggressively for Live Mapping with high performance
    this.watchId = Geolocation.watchPosition(
      position => {
        this.lastCoords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          heading: position.coords.heading || 0,
          speed: position.coords.speed || 0,
        };

        // Push continuously to the WebSocket pipeline unconditionally for immediate real-time maps!
        SocketService.emitLocation(
          this.lastCoords.latitude,
          this.lastCoords.longitude,
          this.lastCoords.heading,
          this.lastCoords.speed
        );
      },
      () => { },
      // Aggressive tracking specifically targeting socket updates:
      { enableHighAccuracy: true, distanceFilter: 10, interval: 3000, fastestInterval: 2000 },
    );

    // Report location to backend on interval (fallback HTTP strategy)
    this.intervalId = setInterval(() => {
      this.reportLocation();
    }, REPORT_INTERVAL_MS);
  }

  stop() {
    this.isRunning = false;

    if (this.watchId !== null) {
      Geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Drop the TCP persistent connection to save server resources and driver battery 
    SocketService.disconnect();

    this.lastCoords = null;
  }

  async reportLocation() {
    if (!this.lastCoords) {
      return;
    }

    try {
      const driverId = await AsyncStorage.getItem('driverId');
      if (!driverId) {
        return;
      }

      await fetch(`${BASE_URL}/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId,
          latitude: this.lastCoords.latitude,
          longitude: this.lastCoords.longitude,
        }),
      });
    } catch {
      // Silent failure — location reporting is best-effort
    }
  }

  getLastCoords() {
    return this.lastCoords;
  }

  getConnectionStatus() {
    return { isConnected: SocketService.isConnected };
  }
}

export default new LocationService();