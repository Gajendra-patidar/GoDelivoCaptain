import notifee, {
  AndroidCategory,
  AndroidForegroundServiceType,
  AndroidImportance,
  AndroidStyle,
  AuthorizationStatus,
} from '@notifee/react-native';
import { AppState, Platform } from 'react-native';
import { BRAND_YELLOW } from '../theme';

const CHANNEL_ID = 'godelivo_partner_online';
const NOTIFICATION_ID = 'godelivo_partner_foreground_service';
const APP_NAME = 'GoDelivo Partner';
const ONLINE_TITLE = 'GoDelivo Partner';
const ONLINE_BODY = 'You are online and ready to receive orders';
const OFFLINE_BODY = 'You are offline and go online for orders';
const TRIP_TITLE = 'GoDelivo Partner - Trip in progress';
const NOTIFICATION_SMALL_ICON = 'ic_notif_driver';
const NOTIFICATION_LARGE_ICON = require('../assets/godelivo_notification_logo.png');

let isServiceRunning = false;
let currentMode = 'offline';
let currentTripInfo = null;
let appStateSubscription = null;

export const requestForegroundNotificationPermission = async () => {
  if (Platform.OS !== 'android') {
    return true;
  }

  const settings = await notifee.requestPermission();
  return (
    settings.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
    settings.authorizationStatus === AuthorizationStatus.PROVISIONAL
  );
};

const ensureChannel = async () => {
  if (Platform.OS !== 'android') {
    return CHANNEL_ID;
  }

  await requestForegroundNotificationPermission();

  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Online Status',
    description: 'Persistent status shown while you are online',
    importance: AndroidImportance.LOW,
    lights: false,
    vibration: false,
    sound: undefined,
  });

  return CHANNEL_ID;
};

const getForegroundServiceTypes = () => [
  AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_LOCATION,
];

const buildBody = (mode, tripInfo) => {
  if (mode === 'offline') {
    return OFFLINE_BODY;
  }

  if (mode !== 'on_trip') {
    return ONLINE_BODY;
  }

  const orderId = String(tripInfo?.orderId || '').slice(-6).toUpperCase();
  const lines = ['You are online and completing an order'];

  if (orderId) {
    lines.push(`Order #${orderId}`);
  }

  if (tripInfo?.pickup) {
    lines.push(`Pickup: ${tripInfo.pickup}`);
  }

  if (tripInfo?.drop) {
    lines.push(`Drop: ${tripInfo.drop}`);
  }

  return lines.join('\n');
};

const buildNotification = async (mode = 'online', tripInfo = null) => {
  const channelId = await ensureChannel();
  const isTrip = mode === 'on_trip';
  const body = buildBody(mode, tripInfo);

  return {
    id: NOTIFICATION_ID,
    title: isTrip ? TRIP_TITLE : ONLINE_TITLE,
    subtitle: APP_NAME,
    body,
    android: {
      channelId,
      asForegroundService: true,
      foregroundServiceTypes: getForegroundServiceTypes(),
      smallIcon: NOTIFICATION_SMALL_ICON,
      largeIcon: NOTIFICATION_LARGE_ICON,
      color: BRAND_YELLOW,
      colorized: false,
      ongoing: true,
      autoCancel: false,
      onlyAlertOnce: true,
      showTimestamp: true,
      timestamp: Date.now(),
      category: AndroidCategory.SERVICE,
      pressAction: {
        id: 'default',
      },
      style: {
        type: AndroidStyle.BIGTEXT,
        text: body,
      },
    },
  };
};

const displayForegroundNotification = async (mode = 'online', tripInfo = null) => {
  if (Platform.OS !== 'android') {
    return;
  }

  const notification = await buildNotification(mode, tripInfo);
  await notifee.displayNotification(notification);
};

const ensureAppStateListener = () => {
  if (appStateSubscription || Platform.OS !== 'android') {
    return;
  }

  appStateSubscription = AppState.addEventListener('change', nextState => {
    if (nextState === 'active' && isServiceRunning) {
      displayForegroundNotification(currentMode, currentTripInfo).catch(
        error => {
          console.log('Foreground notification refresh error:', error);
        },
      );
    }
  });
};

export const startService = async (mode = 'online', tripInfo = null) => {
  if (Platform.OS !== 'android') {
    return;
  }

  currentMode = mode;
  currentTripInfo = tripInfo;

  await displayForegroundNotification(mode, tripInfo);
  isServiceRunning = true;
  ensureAppStateListener();
};

export const updateService = async (mode = 'online', tripInfo = null) => {
  return startService(mode, tripInfo);
};

export const updateServiceBody = async body => {
  if (!isServiceRunning || Platform.OS !== 'android') {
    return;
  }

  const channelId = await ensureChannel();

  await notifee.displayNotification({
    id: NOTIFICATION_ID,
    title: TRIP_TITLE,
    subtitle: APP_NAME,
    body,
    android: {
      channelId,
      asForegroundService: true,
      foregroundServiceTypes: getForegroundServiceTypes(),
      smallIcon: NOTIFICATION_SMALL_ICON,
      largeIcon: NOTIFICATION_LARGE_ICON,
      color: BRAND_YELLOW,
      ongoing: true,
      autoCancel: false,
      onlyAlertOnce: true,
      category: AndroidCategory.SERVICE,
      pressAction: {
        id: 'default',
      },
      style: {
        type: AndroidStyle.BIGTEXT,
        text: body,
      },
    },
  });
};

export const stopService = async () => {
  if (Platform.OS !== 'android') {
    return;
  }

  currentMode = 'offline';
  currentTripInfo = null;

  try {
    await displayForegroundNotification('offline');
    isServiceRunning = true;
    ensureAppStateListener();
  } catch (error) {
    console.log('Foreground offline notification error:', error);
  }
};

export const isRunning = () => isServiceRunning;

export const getForegroundNotificationIds = () => ({
  channelId: CHANNEL_ID,
  notificationId: NOTIFICATION_ID,
});
