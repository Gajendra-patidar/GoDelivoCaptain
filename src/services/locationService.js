import Geolocation from '@react-native-community/geolocation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from './api';

const REPORT_INTERVAL_MS = 30000; // 30 seconds

class LocationService {
  constructor() {
    this.intervalId = null;
    this.watchId = null;
    this.lastCoords = null;
    this.isRunning = false;
  }

  async start() {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;

    // Get initial position
    Geolocation.getCurrentPosition(
      position => {
        this.lastCoords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        this.reportLocation();
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
    );

    // Watch position changes
    this.watchId = Geolocation.watchPosition(
      position => {
        this.lastCoords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
      },
      () => {},
      { enableHighAccuracy: true, distanceFilter: 20, interval: 10000, fastestInterval: 5000 },
    );

    // Report location to backend on interval
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

      await fetch(`${BASE_URL}/update-location`, {
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
}

export default new LocationService();
