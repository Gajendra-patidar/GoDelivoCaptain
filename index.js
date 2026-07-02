import { AppRegistry, Platform } from 'react-native';
import { EventType } from '@notifee/react-native';
import messaging from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';
import App from './App';
import { name as appName } from './app.json';
import {
  createRideRequestChannels,
  showRideRequestNotification,
} from './src/services/rideRequestNotification';
import { handleBackgroundEvent } from './src/services/rideRequestHandler';

// ── Foreground Service (persistent online status notification) ──────────────
notifee.registerForegroundService(notification => {
  return new Promise(() => {
    console.log('GoDelivo foreground service running:', notification.id);
  });
});

// ── Create ride request channels at app start ───────────────────────────────
createRideRequestChannels().catch(error => {
  console.log('Ride request channel creation error:', error);
});

// ── FCM Background Message Handler ──────────────────────────────────────────
messaging().setBackgroundMessageHandler(async remoteMessage => {
  const { notification, data } = remoteMessage;
  const type = String(data?.type || 'general').toUpperCase();

  console.log("Index file data ", type, data);
  

  // Handle ride request FCM messages
  if (
    type === 'RIDE_REQUEST' ||
    type === 'NEW_RIDE' ||
    type === 'NEW_ORDER' ||
    type === 'ORDER'
  ) {
    try {
      await showRideRequestNotification(data);
    } catch (error) {
      console.log('Ride request notification error:', error);
    }
    return;
  }

  // Handle other notification types
  let channelId = 'general';
  if (type.includes('DOCUMENT') || type === 'VERIFIED' || type === 'REJECT') {
    channelId = 'documents';
  } else if (type.includes('EMERGENCY')) {
    channelId = 'emergency';
  }

  try {
    if (Platform.OS === 'android') {
      await notifee.createChannel({
        id: channelId,
        name: channelId.charAt(0).toUpperCase() + channelId.slice(1),
        importance: 4,
      });
    }

    await notifee.displayNotification({
      title: notification?.title || data?.title || 'New Notification',
      body: notification?.body || data?.body || '',
      data,
      android: {
        channelId,
        pressAction: {
          id: 'default',
        },
      },
    });
  } catch (error) {
    console.log('Background handler error:', error);
  }
});

// ── Notifee Background Event Handler (for Accept/Reject actions) ────────────
notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type === EventType.PRESS) {
    console.log('Notification pressed in background:', detail?.notification?.id);
  }

  if (type === EventType.ACTION_PRESS) {
    // Delegate to ride request handler for accept/reject
    await handleBackgroundEvent({ type, detail });
  }
});

AppRegistry.registerComponent(appName, () => App);
