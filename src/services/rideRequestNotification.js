import notifee, {
  AndroidCategory,
  AndroidImportance,
  AndroidStyle,
  EventType,
} from '@notifee/react-native';
import { Platform } from 'react-native';
import { BRAND_YELLOW } from '../theme';

const RIDE_REQUEST_CHANNEL_ID = 'godelivo_ride_requests';
const RIDE_REQUEST_SOUND_CHANNEL_ID = 'godelivo_ride_requests_sound';
const RIDE_REQUEST_PREFIX = 'godelivo_ride_request_';
const NOTIFICATION_SMALL_ICON = 'ic_notif_driver';

let rideRequestRevision = 0;

/**
 * Create the ride request notification channels with sound.
 * Called once during initialization.
 */
export const createRideRequestChannels = async () => {
  if (Platform.OS !== 'android') {
    return;
  }

  // High importance channel with sound for ride requests
  await notifee.createChannel({
    id: RIDE_REQUEST_SOUND_CHANNEL_ID,
    name: 'Ride Requests (Sound)',
    description: 'New ride request alerts with sound',
    importance: AndroidImportance.HIGH,
    sound: 'order_sound.mp3',
    vibration: true,
    lights: true,
  });

  // Normal importance channel for silent/action notifications
  await notifee.createChannel({
    id: RIDE_REQUEST_CHANNEL_ID,
    name: 'Ride Requests',
    description: 'Ride request status updates',
    importance: AndroidImportance.DEFAULT,
    sound: undefined,
    vibration: false,
    lights: false,
  });
};

/**
 * Build the ride request notification payload with action buttons.
 *
 * @param {Object} rideData - The ride request data from FCM or socket
 * @param {Object} options
 * @param {boolean} options.highPriority - Use sound channel if true
 * @returns {Object} Notifee notification object
 */
const buildRideRequestNotification = (rideData, options = {}) => {
  const { highPriority = false } = options;
  const channelId = highPriority
    ? RIDE_REQUEST_SOUND_CHANNEL_ID
    : RIDE_REQUEST_CHANNEL_ID;

  const rideId =
    rideData?.rideId ||
    rideData?.id ||
    rideData?._id ||
    rideData?.orderId ||
    '';

  const pickupAddress =
    rideData?.pickupLocation?.address ||
    rideData?.pickupAddress ||
    rideData?.pickup_address ||
    rideData?.pickup?.address ||
    rideData?.sourceAddress ||
    'Unknown pickup';

  const dropAddress =
    rideData?.dropLocation?.address ||
    rideData?.dropAddress ||
    rideData?.drop_address ||
    rideData?.drop?.address ||
    rideData?.destinationAddress ||
    'Unknown drop';

  const distance = rideData?.rideDetails?.distance || rideData?.distance || 0;

  const fare =
    rideData?.rideDetails?.estimatedFare ||
    rideData?.fare ||
    rideData?.amount ||
    0;

  const formattedFare = Number(fare).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  const body = [
    `From: ${pickupAddress}`,
    `To: ${dropAddress}`,
    `Distance: ${distance} km`,
    `Fare: ₹${formattedFare}`,
  ].join('\n');

  return {
    id: `${RIDE_REQUEST_PREFIX}${rideId}`,
    title: '🚗 New Ride Request',
    body,
    data: {
      type: 'RIDE_REQUEST',
      rideId,
      pickupAddress,
      dropAddress,
      distance: String(distance),
      fare: String(fare),
      ...rideData,
    },
    android: {
      channelId,
      smallIcon: NOTIFICATION_SMALL_ICON,
      color: BRAND_YELLOW,
      colorized: false,
      ongoing: false,
      autoCancel: false,
      onlyAlertOnce: false,
      showTimestamp: true,
      category: AndroidCategory.ALARM,
      importance: highPriority
        ? AndroidImportance.HIGH
        : AndroidImportance.DEFAULT,
      sound: highPriority ? 'order_sound.mp3' : undefined,
      pressAction: {
        id: 'default',
      },
      actions: [
        {
          title: '✅ Accept Ride',
          pressAction: {
            id: 'accept_ride',
          },
          input: false,
        },
        {
          title: '❌ Reject Ride',
          pressAction: {
            id: 'reject_ride',
          },
          input: false,
        },
      ],
      style: {
        type: AndroidStyle.BIGTEXT,
        text: body,
      },
      fullScreenAction: highPriority
        ? {
            id: 'default',
          }
        : undefined,
      timeoutAfter: 30000,
    },
  };
};

/**
 * Show a ride request notification (high priority with sound).
 * Used when a new ride request arrives via FCM while app is in background
 * or from Socket.io when app is in foreground.
 *
 * @param {Object} rideData - Ride request data
 * @returns {Promise<void>}
 */
export const showRideRequestNotification = async rideData => {
  if (Platform.OS !== 'android') {
    return;
  }

  const revision = ++rideRequestRevision;
  const notification = buildRideRequestNotification(rideData, {
    highPriority: true,
  });

  if (revision !== rideRequestRevision) {
    return;
  }

  try {
    await notifee.displayNotification(notification);
  } catch (error) {
    console.error('[RideRequestNotification] Display error:', error);
  }
};

/**
 * Show a silent ride request notification (no sound).
 * Used for status updates like "Ride accepted" confirmations.
 *
 * @param {Object} rideData - Ride request data
 * @returns {Promise<void>}
 */
export const showRideRequestSilentNotification = async rideData => {
  if (Platform.OS !== 'android') {
    return;
  }

  const notification = buildRideRequestNotification(rideData, {
    highPriority: false,
  });

  try {
    await notifee.displayNotification(notification);
  } catch (error) {
    console.error('[RideRequestNotification] Silent display error:', error);
  }
};

/**
 * Remove a specific ride request notification by ride ID.
 *
 * @param {string} rideId
 * @returns {Promise<void>}
 */
export const cancelRideRequestNotification = async rideId => {
  if (Platform.OS !== 'android' || !rideId) {
    return;
  }

  try {
    await notifee.cancelNotification(`${RIDE_REQUEST_PREFIX}${rideId}`);
  } catch (error) {
    console.error('[RideRequestNotification] Cancel error:', error);
  }
};

/**
 * Cancel all ride request notifications.
 * Used when going offline or clearing state.
 *
 * @returns {Promise<void>}
 */
export const cancelAllRideRequestNotifications = async () => {
  if (Platform.OS !== 'android') {
    return;
  }

  try {
    await notifee.cancelAllNotifications();
  } catch (error) {
    console.error('[RideRequestNotification] Cancel all error:', error);
  }
};

/**
 * Get the notification ID for a given ride ID.
 *
 * @param {string} rideId
 * @returns {string}
 */
export const getRideRequestNotificationId = rideId => {
  return `${RIDE_REQUEST_PREFIX}${rideId}`;
};

export const RIDE_REQUEST_ACTION_ACCEPT = 'accept_ride';
export const RIDE_REQUEST_ACTION_REJECT = 'reject_ride';
