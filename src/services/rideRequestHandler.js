import notifee, { EventType } from '@notifee/react-native';
import { Platform } from 'react-native';
import { driverApi } from './driverApi';
import { startService, updateService } from './foregroundService';
import {
  cancelRideRequestNotification,
  showRideRequestSilentNotification,
  RIDE_REQUEST_ACTION_ACCEPT,
  RIDE_REQUEST_ACTION_REJECT,
} from './rideRequestNotification';
import { setActiveOrder } from './localDriverData';
import SocketService from './socketService';

/**
 * Maximum retries for accept/reject API calls
 */
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Sleep utility for retry delay
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Extract ride ID from various response shapes.
 */
const extractRideId = (data) => {
  return (
    data?.rideId ||
    data?.id ||
    data?._id ||
    data?.orderId ||
    data?.data?.rideId ||
    data?.data?.id ||
    ''
  );
};

/**
 * Extract ride data with accept API response merged in.
 */
const extractAcceptedRideData = (rideData, acceptResponse) => {
  // Accept response may be the ride object itself or contain it in .data
  const acceptedRide = acceptResponse?.rideId
    ? acceptResponse
    : acceptResponse?.data?.rideId
      ? acceptResponse.data
      : acceptResponse;

  return {
    ...(rideData || {}),
    ...(acceptedRide || {}),
    rideId: extractRideId(acceptedRide) || extractRideId(rideData),
  };
};

/**
 * Execute an API call with retry logic.
 */
const apiWithRetry = async (apiCall, maxRetries = MAX_RETRIES) => {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      lastError = error;
      console.error(
        `[RideRequestHandler] API attempt ${attempt}/${maxRetries} failed:`,
        error?.message,
      );

      if (attempt < maxRetries) {
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  throw lastError;
};

/**
 * Process accept ride action from notification.
 *
 * @param {Object} rideData - The ride request data from notification
 * @returns {Promise<Object|null>} Accepted ride data or null
 */
export const processAcceptRide = async (rideData) => {
  if (!rideData) {
    console.error('[RideRequestHandler] No ride data to accept');
    return null;
  }

  const rideId = extractRideId(rideData);

  if (!rideId) {
    console.error('[RideRequestHandler] No ride ID in data:', rideData);
    return null;
  }

  console.log('[RideRequestHandler] Accepting ride:', rideId);

  try {
    // Step 1: Call accept API with retry
    const acceptResponse = await apiWithRetry(() =>
      driverApi.acceptOrder(rideId),
    );

    console.log('[RideRequestHandler] Accept response:', acceptResponse);

    // Step 2: Merge ride data with accept response
    const finalOrder = extractAcceptedRideData(rideData, acceptResponse);

    // Step 3: Save as active order locally
    await setActiveOrder(finalOrder);

    // Step 4: Join socket tracking for this ride
    const finalRideId = extractRideId(finalOrder);
    if (finalRideId) {
      SocketService.setActiveRide(finalRideId);
      SocketService.joinRideTracking(finalRideId).catch((err) =>
        console.error('[RideRequestHandler] joinRideTracking error:', err),
      );
    }

    // Step 5: Mark driver as unavailable (on a ride now)
    SocketService.emitStatusChange(true, false);

    // Step 6: Cancel the ride request notification
    await cancelRideRequestNotification(rideId);

    // Step 7: Update foreground service to "Trip in Progress"
    await updateService('on_trip', {
      orderId: finalRideId || rideId,
      pickup:
        rideData?.pickupAddress ||
        rideData?.pickupLocation?.address ||
        rideData?.sourceAddress,
      drop:
        rideData?.dropAddress ||
        rideData?.dropLocation?.address ||
        rideData?.destinationAddress,
    });

    console.log('[RideRequestHandler] Ride accepted successfully:', finalRideId);

    return finalOrder;
  } catch (error) {
    console.error('[RideRequestHandler] Accept ride failed:', error?.message);

    // Show failure notification so driver knows something went wrong
    try {
      await showRideRequestSilentNotification({
        ...rideData,
        rideId,
      });
    } catch (notifError) {
      console.error(
        '[RideRequestHandler] Failed notification error:',
        notifError,
      );
    }

    return null;
  }
};

/**
 * Process reject ride action from notification.
 *
 * @param {Object} rideData - The ride request data from notification
 * @returns {Promise<boolean>} True if rejected successfully
 */
export const processRejectRide = async (rideData) => {
  if (!rideData) {
    console.error('[RideRequestHandler] No ride data to reject');
    return false;
  }

  const rideId = extractRideId(rideData);

  if (!rideId) {
    console.error('[RideRequestHandler] No ride ID in data:', rideData);
    return false;
  }

  console.log('[RideRequestHandler] Rejecting ride:', rideId);

  try {
    // Step 1: Call reject API with retry
    await apiWithRetry(() => driverApi.rejectOrder(rideId));

    // Step 2: Cancel the ride request notification
    await cancelRideRequestNotification(rideId);

    console.log('[RideRequestHandler] Ride rejected successfully:', rideId);
    return true;
  } catch (error) {
    console.error('[RideRequestHandler] Reject ride failed:', error?.message);

    // Still cancel the notification even if API fails
    try {
      await cancelRideRequestNotification(rideId);
    } catch (cancelError) {
      console.error(
        '[RideRequestHandler] Cancel notification error:',
        cancelError,
      );
    }

    return false;
  }
};

/**
 * Handle a notifee background event for ride request actions.
 * This is called from the index.js background event handler.
 *
 * @param {EventType} type - The event type
 * @param {Object} detail - The event detail containing notification and press action
 */
export const handleBackgroundEvent = async ({ type, detail }) => {
  if (type !== EventType.ACTION_PRESS) {
    return;
  }

  const pressAction = detail?.pressAction;
  const notification = detail?.notification;
  const data = notification?.data || {};

  if (!pressAction || !data) {
    return;
  }

  const actionId = pressAction.id;

  // Only handle ride request actions
  if (actionId !== RIDE_REQUEST_ACTION_ACCEPT && actionId !== RIDE_REQUEST_ACTION_REJECT) {
    return;
  }

  console.log('[RideRequestHandler] Background action:', actionId, 'data:', data);

  if (actionId === RIDE_REQUEST_ACTION_ACCEPT) {
    await processAcceptRide(data);
  } else if (actionId === RIDE_REQUEST_ACTION_REJECT) {
    await processRejectRide(data);
  }
};

/**
 * Handle a notifee foreground event for ride request actions.
 * This is called from the App component or NotificationService.
 *
 * @param {EventType} type - The event type
 * @param {Object} detail - The event detail
 * @returns {Object|null} Processed ride data if accepted, or null
 */
export const handleForegroundEvent = ({ type, detail }) => {
  if (type !== EventType.ACTION_PRESS) {
    return null;
  }

  const pressAction = detail?.pressAction;
  const notification = detail?.notification;
  const data = notification?.data || {};

  if (!pressAction || !data) {
    return null;
  }

  const actionId = pressAction.id;

  if (actionId !== RIDE_REQUEST_ACTION_ACCEPT && actionId !== RIDE_REQUEST_ACTION_REJECT) {
    return null;
  }

  return {
    action: actionId,
    data,
  };
};
