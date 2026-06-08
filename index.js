import { AppRegistry, Platform } from 'react-native';
import { EventType } from '@notifee/react-native';
import messaging from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';
import App from './App';
import { name as appName } from './app.json';

notifee.registerForegroundService(notification => {
  return new Promise(() => {
    console.log('GoDelivo foreground service running:', notification.id);
  });
});

messaging().setBackgroundMessageHandler(async remoteMessage => {
  const { notification, data } = remoteMessage;
  const type = String(data?.type || 'general').toUpperCase();

  let channelId = 'general';
  if (type.includes('DOCUMENT') || type === 'VERIFIED' || type === 'REJECT') {
    channelId = 'documents';
  } else if (type.includes('ORDER')) {
    channelId = 'orders';
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

notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type === EventType.PRESS) {
    console.log('Notification pressed in background:', detail?.notification?.id);
  }

  if (type === EventType.ACTION_PRESS) {
    const actionId = detail?.pressAction?.id;
    console.log('Notification action pressed:', actionId);
  }
});

AppRegistry.registerComponent(appName, () => App);

