import Geolocation from '@react-native-community/geolocation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from './api';
import SocketService from './socketService';

const REPORT_INTERVAL_MS = 60000; // Increased to 60s because Socket.IO handles real-time updates now.
const INITIAL_LOCATION_TIMEOUT_MS = 12000;
const LOCATION_MAX_AGE_MS = 5000;

const buildCoords = position => ({
  latitude: position.coords.latitude,
  longitude: position.coords.longitude,
  heading: position.coords.heading || 0,
  speed: position.coords.speed || 0,
  timestamp: position.timestamp || Date.now(),
});

const getLocationErrorMessage = error => {
  const message = error?.message || '';

  if (error?.code === 2 || message.toLowerCase().includes('provider')) {
    return 'device location is off or unavailable';
  }

  if (error?.code === 3) {
    return 'location request timed out';
  }

  return message || 'location unavailable';
};

class LocationService {
  constructor() {
    this.intervalId = null;
    this.watchId = null;
    this.lastCoords = null;
    this.lastLocationAt = null;
    this.lastError = null;
    this.isRunning = false;
  }

  async start() {
    if (this.isRunning && this.lastCoords) {
      return this.lastCoords;
    }

    this.isRunning = true;

    try {
      const coords = await this.requestCurrentPosition();

      // Instantiate high-perf socket connection only after location is verified.
      await SocketService.connect();

      this.emitCurrentLocation();
      this.reportLocation(); // Execute HTTP as an initial redundant guarantee

      // Watch position changes aggressively for Live Mapping with high performance
      this.watchId = Geolocation.watchPosition(
        position => {
          this.setLastPosition(position);
          this.emitCurrentLocation();
        },
        error => {
          this.lastError = error;
        },
        {
          enableHighAccuracy: true,
          distanceFilter: 10,
          interval: 3000,
          fastestInterval: 2000,
        },
      );

      // Report location to backend on interval (fallback HTTP strategy)
      this.intervalId = setInterval(() => {
        this.reportLocation();
      }, REPORT_INTERVAL_MS);

      return coords;
    } catch (error) {
      this.stop();
      throw error;
    }
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
    this.lastLocationAt = null;
  }

  requestCurrentPosition() {
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        position => {
          resolve(this.setLastPosition(position));
        },
        error => {
          this.lastError = error;
          reject(new Error(getLocationErrorMessage(error)));
        },
        {
          enableHighAccuracy: true,
          timeout: INITIAL_LOCATION_TIMEOUT_MS,
          maximumAge: LOCATION_MAX_AGE_MS,
        },
      );
    });
  }

  setLastPosition(position) {
    this.lastCoords = buildCoords(position);
    this.lastLocationAt = Date.now();
    this.lastError = null;
    return this.lastCoords;
  }

  emitCurrentLocation() {
    if (!this.lastCoords) {
      return;
    }

    SocketService.emitLocation(
      this.lastCoords.latitude,
      this.lastCoords.longitude,
      this.lastCoords.heading,
      this.lastCoords.speed,
    );
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
      // Silent failure - location reporting is best-effort
    }
  }

  getLastCoords() {
    return this.lastCoords;
  }

  getConnectionStatus() {
    const lastLocationAge = this.lastLocationAt
      ? Date.now() - this.lastLocationAt
      : null;

    return {
      isConnected: SocketService.isConnected,
      isRunning: this.isRunning,
      hasLocation: Boolean(this.lastCoords),
      lastLocationAge,
      lastError: this.lastError,
    };
  }
}

export default new LocationService();
