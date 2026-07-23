/**
 * FloatingBubbleService.js
 *
 * JavaScript wrapper around the native FloatingBubble Android module.
 * Provides helpers to check/request the SYSTEM_ALERT_WINDOW permission
 * and to start / stop the system-level overlay bubble.
 *
 * Android-only — all calls are no-ops on iOS.
 */
import { NativeModules, Platform, Alert, Linking } from 'react-native';

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
 * Resolves false — caller should re-check after the user returns to the app.
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
 * Starts the floating bubble overlay service.
 * If permission is not yet granted it shows an alert and opens Settings.
 *
 * @returns {Promise<boolean>} true if the service started successfully.
 */
export async function startOverlayBubble() {
  if (!isAndroid || !FloatingBubble) return false;

  try {
    const granted = await FloatingBubble.checkPermission();

    if (!granted) {
      Alert.alert(
        '⚡ Enable Floating Bubble',
        'To show the GoDelivo bubble while you use other apps, please grant "Draw over other apps" permission.',
        [
          { text: 'Not Now', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: () => FloatingBubble.requestPermission(),
          },
        ],
      );
      return false;
    }

    return await FloatingBubble.startBubble();
  } catch (err) {
    console.warn('[FloatingBubble] startOverlayBubble error:', err);
    return false;
  }
}

/**
 * Stops the floating bubble overlay service.
 */
export async function stopOverlayBubble() {
  if (!isAndroid || !FloatingBubble) return false;
  try {
    return await FloatingBubble.stopBubble();
  } catch (err) {
    console.warn('[FloatingBubble] stopOverlayBubble error:', err);
    return false;
  }
}
