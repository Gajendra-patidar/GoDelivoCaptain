import notifee, {
  AndroidImportance,
  AndroidColor,
  AndroidCategory,
  AndroidForegroundServiceType,
} from '@notifee/react-native';
import { Platform } from 'react-native';

const CHANNEL_ID = 'godelivo_driver_foreground';
const NOTIFICATION_ID = 'godelivo_foreground_notif';

let isServiceRunning = false;

/**
 * Creates a dedicated notification channel with yellow/gold GoDelivo theme.
 */
const ensureChannel = async () => {
  if (Platform.OS !== 'android') return CHANNEL_ID;

  // Request permissions (critical for Android 13+ to avoid silently suppressed notifications)
  await notifee.requestPermission();

  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'GoDelivo Driver Active',
    description: 'Shows when you are online and receiving ride requests',
    importance: AndroidImportance.LOW, // LOW = no sound, stays persistent
    lights: true,
    lightColor: AndroidColor.DEFAULT,
    vibration: false,
  });

  return CHANNEL_ID;
};

/**
 * Start the foreground service with a yellow-themed persistent notification.
 * @param {'online' | 'on_trip'} mode
 * @param {object} [tripInfo] - optional trip details { orderId, pickup, drop }
 */
export const startService = async (mode = 'online', tripInfo = null) => {
  try {
    const channelId = await ensureChannel();

    let title = '🟡 GoDelivo — You are Online';
    let body = 'Waiting for ride requests…';

    if (mode === 'on_trip' && tripInfo) {
      title = '🚗 GoDelivo — Trip in Progress';
      body = `Order #${String(tripInfo.orderId || '')
        .slice(-6)
        .toUpperCase()}`;
      if (tripInfo.pickup) {
        body += `\n📍 ${tripInfo.pickup}`;
      }
      if (tripInfo.drop) {
        body += `\n🏁 ${tripInfo.drop}`;
      }
    }

    await notifee.displayNotification({
      id: NOTIFICATION_ID,
      title,
      body,
      android: {
        channelId,
        asForegroundService: true,
        foregroundServiceTypes: [
          AndroidForegroundServiceType.LOCATION,
          AndroidForegroundServiceType.DATA_SYNC,
        ],
        color: '#FFD700', // Yellow/Gold accent
        colorized: true, // Fills the notification background tint
        smallIcon: 'ic_notif_driver', // Our custom drawable
        ongoing: true, // Cannot be swiped away
        pressAction: { id: 'default' }, // Tapping opens the app
        category: AndroidCategory.SERVICE,
        timestamp: Date.now(),
        showTimestamp: true,
        style: {
          type: 0, // BigTextStyle
          text: body,
        },
        actions:
          mode === 'online'
            ? [
              {
                title: '🔴 Go Offline',
                pressAction: { id: 'go_offline' },
              },
            ]
            : [
              {
                title: '📞 Call Customer',
                pressAction: { id: 'call_customer' },
              },
              {
                title: '📍 Navigate',
                pressAction: { id: 'navigate' },
              },
            ],
      },
    });

    isServiceRunning = true;
    console.log(`✅ ForegroundService started [${mode}]`);
  } catch (error) {
    console.log('❌ ForegroundService start error:', error);
  }
};

/**
 * Update the notification content without restarting the service.
 * Useful for changing from "online" → "on_trip" or updating trip stage.
 * @param {'online' | 'on_trip'} mode
 * @param {object} [tripInfo]
 */
export const updateService = async (mode = 'online', tripInfo = null) => {
  if (!isServiceRunning) {
    return startService(mode, tripInfo);
  }
  // Displaying a notification with the same ID updates it in-place
  return startService(mode, tripInfo);
};

/**
 * Update only the body text of the notification (lightweight update).
 */
export const updateServiceBody = async body => {
  if (!isServiceRunning) return;

  try {
    await notifee.displayNotification({
      id: NOTIFICATION_ID,
      title: '🚗 GoDelivo — Trip in Progress',
      body,
      android: {
        channelId: CHANNEL_ID,
        asForegroundService: true,
        foregroundServiceTypes: [
          AndroidForegroundServiceType.LOCATION,
          AndroidForegroundServiceType.DATA_SYNC,
        ],
        color: '#FFD700',
        colorized: true,
        smallIcon: 'ic_notif_driver',
        ongoing: true,
        pressAction: { id: 'default' },
      },
    });
  } catch (error) {
    console.log('❌ ForegroundService update error:', error);
  }
};

/**
 * Stop the foreground service and cancel the notification.
 */
export const stopService = async () => {
  try {
    await notifee.stopForegroundService();
    await notifee.cancelNotification(NOTIFICATION_ID);
    isServiceRunning = false;
    console.log('🛑 ForegroundService stopped');
  } catch (error) {
    console.log('❌ ForegroundService stop error:', error);
  }
};

/**
 * Check if the foreground service is currently running.
 */
export const isRunning = () => isServiceRunning;
