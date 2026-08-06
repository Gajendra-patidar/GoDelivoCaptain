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
 * If permission is not yet granted it shows a premium alert and opens Settings.
 * Silent if FloatingBubble native module is unavailable (e.g. iOS build).
 *
 * @returns {Promise<boolean>} true if the service started successfully.
 */
export async function startOverlayBubble() {
  if (!isAndroid || !FloatingBubble) return false;

  try {
    const granted = await FloatingBubble.checkPermission();

    if (!granted) {
      Alert.alert(
        'Floating Bubble Permission',
        'To show the GoDelivo bubble while using other apps, please grant "Display over other apps" permission.',
        [
          { text: 'Not Now', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: () => FloatingBubble.requestPermission(),
          },
        ],
        { cancelable: true },
      );
      return false;
    }

    const result = await FloatingBubble.startBubble();
    return result;
  } catch (err) {
    console.warn('[FloatingBubble] startOverlayBubble error:', err);
    return false;
  }
}

/**
 * Stops the floating bubble overlay service.
 * Call this on logout or when user disables the feature.
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

/**
 * Checks permission status without prompting.
 * @returns {Promise<boolean>}
 */
export async function checkBubblePermission() {
  return hasOverlayPermission();
}
