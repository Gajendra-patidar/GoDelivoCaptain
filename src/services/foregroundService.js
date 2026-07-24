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
const APP_NAME = 'now';
const ONLINE_TITLE = 'GoDelivo Partner';
const ONLINE_BODY = 'You are online and ready to receive orders';
const OFFLINE_BODY = 'You are offline and go online for orders';
const TRIP_TITLE = 'GoDelivo Partner - Trip in progress';
const NOTIFICATION_SMALL_ICON = 'ic_launcher';
const NOTIFICATION_LARGE_ICON = require('../assets/godelivo_notification_logo.png');

let isServiceRunning = false;
let currentMode = 'offline';
let currentTripInfo = null;
let appStateSubscription = null;
let serviceRevision = 0;

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
  name: 'GoDelivo Partner Status',
  description: 'Persistent status notification for partner online/offline state',
  importance: AndroidImportance.LOW,
  lights: false,
  vibration: false,
  sound: undefined,
});

  return CHANNEL_ID;
};

const getForegroundServiceTypes = mode => {
  if (mode === 'offline') {
    return [];
  }

  return [AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_LOCATION];
};
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

  const isOffline = mode === 'offline';
  const isTrip = mode === 'on_trip';

  const title = isOffline
    ? 'GoDelivo Partner'
    : isTrip
    ? 'GoDelivo Partner - Trip in progress'
    : 'GoDelivo Partner';

  const body = isOffline
    ? 'You are OFFLINE'
    : isTrip
    ? buildBody(mode, tripInfo)
    : 'You are ONLINE';

  const android = {
    channelId,
    asForegroundService: true,
    smallIcon: NOTIFICATION_SMALL_ICON,
    // largeIcon: NOTIFICATION_LARGE_ICON,

    ongoing: true,
    autoCancel: false,
    onlyAlertOnce: true,
    showTimestamp: false,
    // timestamp: Date.now(),

    category: AndroidCategory.SERVICE,
    importance: AndroidImportance.LOW,

    color: BRAND_YELLOW,
    colorized: false,

    pressAction: {
      id: 'default',
    },

    style: {
      type: AndroidStyle.BIGTEXT,
      text: body,
    },
  };

  if (!isOffline) {
    android.foregroundServiceTypes = [
      AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_LOCATION,
    ];
  }
  

  return {
    id: NOTIFICATION_ID,
    title,
    body,
    android,
  };
};

const displayForegroundNotification = async (
  mode = 'online',
  tripInfo = null,
  revision = serviceRevision,
) => {
  if (Platform.OS !== 'android') {
    return;
  }

  // console.log('displayForegroundNotification called');
  // console.trace();

  const notification = await buildNotification(mode, tripInfo);

  if (revision !== serviceRevision) {
    return;
  }

  await notifee.displayNotification(notification);
};

const ensureAppStateListener = () => {
  // if (appStateSubscription || Platform.OS !== 'android') {
  //   return;
  // }

  // appStateSubscription = AppState.addEventListener('change', nextState => {
  //   console.log('AppState Changed:', nextState);
  //   if (nextState === 'active' && isServiceRunning) {
  //     displayForegroundNotification(currentMode, currentTripInfo).catch(
  //       error => {
  //         console.log('Foreground notification refresh error:', error);
  //       },
  //     );
  //   }
  // });
  return;
};

export const startService = async (mode = 'online', tripInfo = null) => {
  if (Platform.OS !== 'android') {
    return;
  }

  const revision = ++serviceRevision;
  currentMode = mode;
  currentTripInfo = tripInfo;

  await displayForegroundNotification(mode, tripInfo, revision);

  if (revision !== serviceRevision) {
    return;
  }

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
      foregroundServiceTypes: getForegroundServiceTypes('on_trip'),
      smallIcon: NOTIFICATION_SMALL_ICON,
      // largeIcon: NOTIFICATION_LARGE_ICON,
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

  const revision = ++serviceRevision;
  currentMode = 'offline';
  currentTripInfo = null;

  try {
    await displayForegroundNotification('offline', null, revision);

    if (revision !== serviceRevision) {
      return;
    }

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
