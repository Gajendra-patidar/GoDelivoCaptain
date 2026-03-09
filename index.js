import { AppRegistry, Platform } from 'react-native';
import { EventType } from '@notifee/react-native';
import messaging from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';
import App from './App';
import { name as appName } from './app.json';

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

notifee.onBackgroundEvent(async ({ type }) => {
  if (type === EventType.PRESS) {
    console.log('Notification pressed in background');
  }
});

AppRegistry.registerComponent(appName, () => App);
