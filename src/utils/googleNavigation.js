/**
 * googleNavigation.js
 *
 * A reusable, production-ready utility to launch Google Maps (or a browser
 * fallback) in Turn-by-Turn navigation mode.
 *
 * Usage:
 *   import { openGoogleNavigation } from '../utils/googleNavigation';
 *
 *   const result = await openGoogleNavigation(
 *     { latitude: 22.71, longitude: 75.85 },   // origin  (driver's current location)
 *     { latitude: 22.75, longitude: 75.89 },   // destination
 *   );
 *   // result → { success: true, method: 'google_maps' | 'browser' }
 *   //        → { success: false, error: 'INVALID_COORDINATES' | ... }
 */

import { Linking, Platform } from 'react-native';

// ─── Error codes returned in the result object ────────────────────────────────
export const NAV_ERRORS = {
  INVALID_ORIGIN: 'INVALID_ORIGIN',
  INVALID_DESTINATION: 'INVALID_DESTINATION',
  MISSING_DESTINATION: 'MISSING_DESTINATION',
  LAUNCH_FAILED: 'LAUNCH_FAILED',
};

// ─── Coordinate Validation ────────────────────────────────────────────────────

/**
 * Validates that a coordinate object has valid latitude and longitude values.
 * @param {object|null|undefined} coords
 * @returns {boolean}
 */
export const isValidCoordinate = coords => {
  if (!coords || typeof coords !== 'object') return false;
  const { latitude, longitude } = coords;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return false;
  if (isNaN(latitude) || isNaN(longitude)) return false;
  if (latitude < -90 || latitude > 90) return false;
  if (longitude < -180 || longitude > 180) return false;
  return true;
};

// ─── URL Builders ─────────────────────────────────────────────────────────────

/**
 * Builds the native Google Maps deep-link URI for Android.
 * Opens directly in Navigation mode (mode=d = driving).
 */
const buildAndroidNavUri = (origin, destination) => {
  // google.navigation: scheme opens GMaps directly in turn-by-turn mode
  // If origin is provided it sets the starting point; otherwise GMaps uses GPS.
  const dest = `${destination.latitude},${destination.longitude}`;
  const orig = `${origin.latitude},${origin.longitude}`;
  return `google.navigation:q=${dest}&origin=${orig}&mode=d`;
};

/**
 * Builds the native Google Maps deep-link URI for iOS.
 * Opens comgooglemaps:// directly in driving navigation mode.
 */
const buildIOSNavUri = (origin, destination) => {
  const daddr = `${destination.latitude},${destination.longitude}`;
  const saddr = `${origin.latitude},${origin.longitude}`;
  return `comgooglemaps://?saddr=${saddr}&daddr=${daddr}&directionsmode=driving`;
};

/**
 * Builds a universal Google Maps web URL used as a browser fallback when
 * the Google Maps app is not installed on the device.
 */
const buildFallbackUrl = (origin, destination) => {
  const orig = `${origin.latitude},${origin.longitude}`;
  const dest = `${destination.latitude},${destination.longitude}`;
  return (
    `https://www.google.com/maps/dir/?api=1` +
    `&origin=${orig}` +
    `&destination=${dest}` +
    `&travelmode=driving`
  );
};

// ─── Main API ─────────────────────────────────────────────────────────────────

/**
 * Opens Google Maps in Turn-by-Turn navigation mode.
 *
 * Steps:
 * 1. Validate origin & destination coordinates.
 * 2. Build the platform-appropriate native deep-link URI.
 * 3. Check if the Google Maps app is installed (Linking.canOpenURL).
 * 4. If installed  → open native GMaps (3D nav, voice, traffic, lane guidance).
 * 5. If NOT installed → open browser fallback URL.
 *
 * @param {{ latitude: number, longitude: number }} origin       Driver's current location.
 * @param {{ latitude: number, longitude: number }} destination  Pickup or Drop coordinates.
 * @param {{ label?: string }} [options]                         Optional label for destination.
 * @returns {Promise<{ success: boolean, method?: string, error?: string }>}
 */
export const openGoogleNavigation = async (origin, destination, options = {}) => {
  // ── 1. Validate destination (required) ──────────────────────────────────────
  if (!destination) {
    console.warn('[googleNavigation] No destination provided.');
    return { success: false, error: NAV_ERRORS.MISSING_DESTINATION };
  }

  if (!isValidCoordinate(destination)) {
    console.warn('[googleNavigation] Invalid destination coordinates:', destination);
    return { success: false, error: NAV_ERRORS.INVALID_DESTINATION };
  }

  // ── 2. Validate origin (required — driver's live GPS) ───────────────────────
  if (!isValidCoordinate(origin)) {
    console.warn('[googleNavigation] Invalid origin coordinates:', origin);
    return { success: false, error: NAV_ERRORS.INVALID_ORIGIN };
  }

  try {
    // ── 3. Build platform-specific native URI ────────────────────────────────
    const nativeUri =
      Platform.OS === 'android'
        ? buildAndroidNavUri(origin, destination)
        : buildIOSNavUri(origin, destination);

    // ── 4. Attempt to open Google Maps native app ────────────────────────────
    const canOpenNative = await Linking.canOpenURL(nativeUri);

    if (canOpenNative) {
      await Linking.openURL(nativeUri);
      console.log('[googleNavigation] Launched native Google Maps:', nativeUri);
      return { success: true, method: 'google_maps' };
    }

    // ── 5. Fallback: browser URL ─────────────────────────────────────────────
    const browserUrl = buildFallbackUrl(origin, destination);
    const canOpenBrowser = await Linking.canOpenURL(browserUrl);

    if (canOpenBrowser) {
      await Linking.openURL(browserUrl);
      console.log('[googleNavigation] Launched browser fallback:', browserUrl);
      return { success: true, method: 'browser' };
    }

    // Both failed
    console.error('[googleNavigation] Neither native GMaps nor browser could be opened.');
    return { success: false, error: NAV_ERRORS.LAUNCH_FAILED };
  } catch (error) {
    console.error('[googleNavigation] Error launching navigation:', error);
    return { success: false, error: NAV_ERRORS.LAUNCH_FAILED };
  }
};
