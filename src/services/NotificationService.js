import messaging from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { BASE_URL } from './api';

class NotificationService {
  constructor() {
    this.driverId = null;
    this.deviceType = Platform.OS;
    this.listeners = {
      message: [],
      tokenRefresh: [],
      press: [],
      action: [],
      open: [],
      initial: [],
    };
    this.unsubscribeFns = [];
    this.initialized = false;
  }

  async initialize(driverId) {
    try {
      if (driverId) {
        this.driverId = driverId;
      }

      await this.requestPermissions();
      await this.createNotificationChannels();

      if (!this.initialized) {
        this.setupListeners();
        this.initialized = true;
      }

      const token = await this.getFCMToken();
      if (token && this.driverId) {
        await this.saveTokenToBackend(this.driverId, token);
      }
    } catch (error) {
          }
  }

  async requestPermissions() {
    try {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (Platform.OS === 'ios') {
        await notifee.requestPermission();
      }

      return enabled;
    } catch (error) {
            return false;
    }
  }

  async createNotificationChannels() {
    if (Platform.OS !== 'android') {
      return;
    }

    const channels = [
      { id: 'documents', name: 'Document Verification', importance: 4 },
      { id: 'orders', name: 'Orders', importance: 4 },
      { id: 'general', name: 'General Notifications', importance: 3 },
      { id: 'emergency', name: 'Emergency Alerts', importance: 4 },
    ];

    await Promise.all(channels.map(channel => notifee.createChannel(channel)));
  }

  setupListeners() {
    const unsubscribeOnMessage = messaging().onMessage(async remoteMessage => {
      this.notifyListeners('message', remoteMessage);
      await this.displayNotification(remoteMessage);
    });

    const unsubscribeTokenRefresh = messaging().onTokenRefresh(async token => {
      await this.saveToken(token);
      if (this.driverId) {
        await this.saveTokenToBackend(this.driverId, token);
      }
      this.notifyListeners('tokenRefresh', token);
    });

    const unsubscribeOnOpened = messaging().onNotificationOpenedApp(remoteMessage => {
      this.notifyListeners('open', remoteMessage);
      this.notifyListeners('press', remoteMessage);
    });

    const unsubscribeForegroundEvent = notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS) {
        this.notifyListeners('press', detail.notification);
      }
      if (type === EventType.ACTION_PRESS) {
        this.notifyListeners('action', detail);
      }
    });

    notifee.onBackgroundEvent(async ({ type, detail }) => {
      if (type === EventType.PRESS) {
        this.notifyListeners('press', detail.notification);
      }
      if (type === EventType.ACTION_PRESS) {
        this.notifyListeners('action', detail);
      }
    });

    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage) {
          this.notifyListeners('initial', remoteMessage);
          this.notifyListeners('press', remoteMessage);
        }
      });

    this.unsubscribeFns = [
      unsubscribeOnMessage,
      unsubscribeTokenRefresh,
      unsubscribeOnOpened,
      unsubscribeForegroundEvent,
    ];
  }

  getChannelId(notificationType) {
    const type = String(notificationType || 'general').toUpperCase();
    if (type.includes('DOCUMENT') || type === 'VERIFIED' || type === 'REJECT') {
      return 'documents';
    }
    if (type.includes('ORDER')) {
      return 'orders';
    }
    if (type.includes('EMERGENCY')) {
      return 'emergency';
    }
    return 'general';
  }

  async displayNotification(remoteMessage) {
    try {
      const { notification, data } = remoteMessage;
      const channelId = this.getChannelId(data?.type);

      if (data?.silent === 'true') {
        return;
      }

      await notifee.displayNotification({
        title: notification?.title || data?.title || 'New Notification',
        body: notification?.body || data?.body || '',
        data: {
          ...data,
          driverId: this.driverId,
        },
        android: {
          channelId,
          pressAction: {
            id: 'default',
          },
        },
        ios: {
          foregroundPresentationOptions: {
            alert: true,
            badge: true,
            sound: true,
          },
        },
      });
    } catch (error) {
          }
  }

  async getFCMToken() {
    try {
      const token = await messaging().getToken();
      await this.saveToken(token);
      return token;
    } catch (error) {
            return null;
    }
  }

  async saveToken(token) {
    await AsyncStorage.setItem('fcmToken', token);
    await AsyncStorage.setItem('deviceType', this.deviceType);
  }

  async saveTokenToBackend(driverId, token) {
    try {
      await fetch(`${BASE_URL}/save-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          driverId,
          token,
          deviceType: this.deviceType,
        }),
      });
    } catch (error) {
          }
  }

  async updateOnlineStatus(isOnline) {
    if (!this.driverId) {
      return;
    }

    try {
      await fetch(`${BASE_URL}/update-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          driverId: this.driverId,
          isOnline,
        }),
      });
    } catch (error) {
          }
  }

  async removeToken() {
    try {
      if (this.driverId) {
        await fetch(`${BASE_URL}/remove-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ driverId: this.driverId }),
        });
      }

      await AsyncStorage.removeItem('fcmToken');
      this.driverId = null;
    } catch (error) {
          }
  }

  addListener(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  removeListener(event, callback) {
    if (!this.listeners[event]) {
      return;
    }
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  notifyListeners(event, data) {
    const callbacks = this.listeners[event] || [];
    callbacks.forEach(callback => callback(data));
  }
}

export default new NotificationService();
