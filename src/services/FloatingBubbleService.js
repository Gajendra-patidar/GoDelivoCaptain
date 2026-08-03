/**
 * FloatingBubbleService.js
 *
 * JavaScript wrapper around the native FloatingBubble Android module.
 * Provides helpers to check/request the SYSTEM_ALERT_WINDOW permission
 * and to start / stop the system-level overlay bubble.
 *
 * Android-only — all calls are no-ops on iOS.
 *
 * Usage:
 *   import { startOverlayBubble, stopOverlayBubble } from './FloatingBubbleService';
 *   // Call startOverlayBubble() when driver goes online
 *   // Call stopOverlayBubble()  when driver goes offline / logs out
 */
import { NativeModules, Platform, Alert } from 'react-native';

const { FloatingBubble } = NativeModules;

const isAndroid = Platform.OS === 'android';

/**
 * Returns true if the "Draw over other apps" permission is already granted.
 */
export async function hasOverlayPermission() {
  if (!isAndroid || !FloatingBubble) return false;
  try {
    return await FloatingBubble.checkPermission();
  } catch {
    return false;
  }
}

/**
 * Opens the system settings page for the user to grant overlay permission.
 */
export async function requestOverlayPermission() {
  if (!isAndroid || !FloatingBubble) return false;
  try {
    return await FloatingBubble.requestPermission();
  } catch {
    return false;
  }
}

/**
 * Starts the native floating bubble overlay service.
 *
 * • If the native module is unavailable (iOS / module not linked) → silently returns false.
 * • If permission is not granted → shows a permission dialog once, then returns false.
 * • Otherwise starts the foreground service and returns true.
 *
 * @returns {Promise<boolean>}
 */
export async function startOverlayBubble() {
  if (!isAndroid || !FloatingBubble) return false;

  try {
    const granted = await FloatingBubble.checkPermission();

    if (!granted) {
      Alert.alert(
        'Bubble Permission Required',
        'To show the GoDelivo bubble while using other apps, please grant "Display over other apps" permission.',
        [
          { text: 'Not Now', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: () => {
              FloatingBubble.requestPermission().catch(() => {});
            },
          },
        ],
        { cancelable: true },
      );
      return false;
    }

    const result = await FloatingBubble.startBubble();
    return !!result;
  } catch (err) {
    // Do not crash — bubble is a non-critical feature
    console.warn('[FloatingBubble] startOverlayBubble error:', err?.message || err);
    return false;
  }
}

/**
 * Stops the native floating bubble overlay service.
 * Call this when driver goes offline or logs out.
 *
 * @returns {Promise<boolean>}
 */
export async function stopOverlayBubble() {
  if (!isAndroid || !FloatingBubble) return false;
  try {
    const result = await FloatingBubble.stopBubble();
    return !!result;
  } catch (err) {
    console.warn('[FloatingBubble] stopOverlayBubble error:', err?.message || err);
    return false;
  }
}

/**
 * Alias for hasOverlayPermission — checks permission without prompting.
 * @returns {Promise<boolean>}
 */
export async function checkBubblePermission() {
  return hasOverlayPermission();
}
