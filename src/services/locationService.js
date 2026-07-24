import Geolocation from 'react-native-geolocation-service'; // Keeping for foreground requests if needed
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from './api';
import SocketService from './socketService';

const REPORT_INTERVAL_MS = 45000; // Low frequency backup HTTP sync (Sockets do real-time tracking now)
const INITIAL_LOCATION_TIMEOUT_MS = 7000;   // Reduced: fast GPS request; fallback handles slow devices
const FALLBACK_LOCATION_TIMEOUT_MS = 8000;  // Reduced: low-accuracy fallback (uses cached OS fix)
const LOCATION_MAX_AGE_MS = 30000;          // Increased: reuse recent GPS cache so startup is instant
const FALLBACK_LOCATION_MAX_AGE_MS = 120000; // Extended: accept older cached position for fallback

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
    this.listeners = [];
  }

  subscribe(callback) {
    if (typeof callback === 'function') {
      this.listeners.push(callback);
      if (this.lastCoords) {
        callback(this.lastCoords);
      }
    }
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  async start() {
    if (this.isRunning && this.lastCoords) {
      return this.lastCoords;
    }

    this.isRunning = true;

    try {
      // Run GPS request and socket connect IN PARALLEL — they are independent
      const [coords] = await Promise.all([
        this.requestStartupPosition(),
        SocketService.connect(),
      ]);

      this.emitCurrentLocation();
      this.reportLocation(); // Initial HTTP sync guarantee

      // Configure and start Geolocation watcher
      this.watchId = Geolocation.watchPosition(
        position => {
          const newCoords = this.setLastPosition(position);
          this.emitCurrentLocation();
          
          this.listeners.forEach(cb => {
            try {
              cb(newCoords);
            } catch (err) {
              console.error('[LocationService] Subscriber notification error:', err);
            }
          });
        },
        error => {
          console.warn('[LocationService] Background location error:', error);
          this.lastError = error;
        },
        {
          enableHighAccuracy: true,
          distanceFilter: 5,
          interval: 3000,
          fastestInterval: 2000,
          showsBackgroundLocationIndicator: true,
        }
      );

      // Low-frequency database reporting fallback
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

    // NOTE: intentionally keep lastCoords so a restart can use stale coords
    // as a Stage-3 fallback without requiring a brand-new GPS fix.
    this.lastLocationAt = null;
  }

  requestCurrentPosition() {
    return this.requestPosition({
      enableHighAccuracy: true,
      timeout: INITIAL_LOCATION_TIMEOUT_MS,
      maximumAge: LOCATION_MAX_AGE_MS,
    });
  }

  async requestStartupPosition() {
    // Stage 1: High-accuracy GPS with short timeout (uses OS cache if fresh)
    try {
      return await this.requestPosition({
        enableHighAccuracy: true,
        timeout: INITIAL_LOCATION_TIMEOUT_MS,
        maximumAge: LOCATION_MAX_AGE_MS,
      });
    } catch (stage1Error) {
      const msg = String(stage1Error?.message || '').toLowerCase();
      // Non-timeout errors (e.g. permission denied) bubble up immediately
      if (!msg.includes('timed out') && !msg.includes('unavailable')) {
        throw stage1Error;
      }
      console.warn('[LocationService] Stage 1 GPS timed out, trying low-accuracy fallback...');
    }

    // Stage 2: Low-accuracy fallback — accepts much older OS cache
    try {
      return await this.requestPosition({
        enableHighAccuracy: false,
        timeout: FALLBACK_LOCATION_TIMEOUT_MS,
        maximumAge: FALLBACK_LOCATION_MAX_AGE_MS,
      });
    } catch (stage2Error) {
      console.warn('[LocationService] Stage 2 GPS timed out, checking stale coords...');
    }

    // Stage 3: Use the last known coords (preserved across stop/start cycles)
    if (this.lastCoords) {
      console.warn('[LocationService] Using stale last coords as Stage-3 fallback.');
      return this.lastCoords;
    }

    // All stages exhausted — GPS is completely unavailable
    throw new Error('location request timed out');
  }

  requestPosition(options) {
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        position => {
          resolve(this.setLastPosition(position));
        },
        error => {
          this.lastError = error;
          reject(new Error(getLocationErrorMessage(error)));
        },
        options,
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
      const token = await AsyncStorage.getItem('userToken');
      if (!driverId || !token) {
        return;
      }

      await fetch(`${BASE_URL}/location`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          driverId,
          latitude: this.lastCoords.latitude,
          longitude: this.lastCoords.longitude,
        }),
      });
    } catch {
      // Silent failure - location reporting fallback is best-effort
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
