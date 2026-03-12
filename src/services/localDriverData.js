import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  ACTIVE_ORDER: 'activeOrder',
  ORDER_HISTORY: 'orderHistory',
  WALLET_DATA: 'walletData',
  IN_APP_NOTIFICATIONS: 'inAppNotifications',
};

const DEFAULT_WALLET = {
  balance: 23.25,
  todayEarnings: 0,
  totalEarnings: 0,
  totalDeliveries: 0,
  lastUpdatedAt: null,
};

const safeParse = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const saveJSON = async (key, value) => {
  await AsyncStorage.setItem(key, JSON.stringify(value));
};

export const getWalletData = async () => {
  const raw = await AsyncStorage.getItem(KEYS.WALLET_DATA);
  const wallet = safeParse(raw, null);
  return wallet ? { ...DEFAULT_WALLET, ...wallet } : DEFAULT_WALLET;
};

export const setWalletData = async wallet => {
  const merged = {
    ...DEFAULT_WALLET,
    ...(wallet || {}),
    lastUpdatedAt: new Date().toISOString(),
  };
  await saveJSON(KEYS.WALLET_DATA, merged);
  return merged;
};

export const addWalletAmount = async amount => {
  const numericAmount = Number(amount) || 0;
  const wallet = await getWalletData();
  const updated = {
    ...wallet,
    balance: Number((wallet.balance + numericAmount).toFixed(2)),
    lastUpdatedAt: new Date().toISOString(),
  };
  await saveJSON(KEYS.WALLET_DATA, updated);
  return updated;
};

export const creditOnDelivery = async amount => {
  const earning = Number(amount) || 0;
  const wallet = await getWalletData();
  const updated = {
    ...wallet,
    balance: Number((wallet.balance + earning).toFixed(2)),
    todayEarnings: Number((wallet.todayEarnings + earning).toFixed(2)),
    totalEarnings: Number((wallet.totalEarnings + earning).toFixed(2)),
    totalDeliveries: wallet.totalDeliveries + 1,
    lastUpdatedAt: new Date().toISOString(),
  };
  await saveJSON(KEYS.WALLET_DATA, updated);
  return updated;
};

export const getActiveOrder = async () => {
  const raw = await AsyncStorage.getItem(KEYS.ACTIVE_ORDER);
  return safeParse(raw, null);
};

export const setActiveOrder = async order => {
  await saveJSON(KEYS.ACTIVE_ORDER, {
    ...order,
    acceptedAt: order?.acceptedAt || new Date().toISOString(),
    status: order?.status || 'accepted',
  });
};

export const clearActiveOrder = async () => {
  await AsyncStorage.removeItem(KEYS.ACTIVE_ORDER);
};

export const getOrderHistory = async () => {
  const raw = await AsyncStorage.getItem(KEYS.ORDER_HISTORY);
  return safeParse(raw, []);
};

export const setOrderHistory = async history => {
  const normalized = Array.isArray(history) ? history : [];
  await saveJSON(KEYS.ORDER_HISTORY, normalized);
  return normalized;
};

export const addOrderToHistory = async order => {
  const history = await getOrderHistory();
  const updated = [order, ...history];
  await saveJSON(KEYS.ORDER_HISTORY, updated);
  return updated;
};

export const completeOrder = async completedOrder => {
  const now = new Date().toISOString();
  const earning = Number(completedOrder?.amount) || 0;

  const orderForHistory = {
    ...completedOrder,
    status: 'completed',
    completedAt: now,
    amount: earning,
  };

  await addOrderToHistory(orderForHistory);
  await clearActiveOrder();
  await creditOnDelivery(earning);

  return orderForHistory;
};

export const getNotifications = async () => {
  const raw = await AsyncStorage.getItem(KEYS.IN_APP_NOTIFICATIONS);
  return safeParse(raw, []);
};

export const setNotifications = async notifications => {
  const normalized = Array.isArray(notifications) ? notifications : [];
  await saveJSON(KEYS.IN_APP_NOTIFICATIONS, normalized);
  return normalized;
};

export const addNotification = async notification => {
  const notifications = await getNotifications();
  const next = [
    {
      id: notification?.id || `${Date.now()}`,
      title: notification?.title || 'Notification',
      body: notification?.body || '',
      type: notification?.type || 'general',
      data: notification?.data || {},
      read: false,
      createdAt: notification?.createdAt || new Date().toISOString(),
    },
    ...notifications,
  ];

  await saveJSON(KEYS.IN_APP_NOTIFICATIONS, next);
  return next;
};

export const markAllNotificationsRead = async () => {
  const notifications = await getNotifications();
  const updated = notifications.map(item => ({ ...item, read: true }));
  await saveJSON(KEYS.IN_APP_NOTIFICATIONS, updated);
  return updated;
};

export const createMockNearbyOrder = () => {
  const orderId = `ORD-${Date.now()}`;
  const baseAmount = 80 + Math.floor(Math.random() * 120);

  return {
    id: orderId,
    amount: baseAmount,
    pickupDistanceKm: Number((Math.random() * 1.8 + 0.3).toFixed(1)),
    pickupAddress: 'Navneet Darshan Building, Greater Kailash Road, indore',
    dropAddress: 'Bangali Square, Indore',
    pickup: {
      latitude: 22.72592, //22.725926779392378, 75.89294618232778
      longitude: 75.89294,
    },
    drop: {
      latitude: 22.72044,//22.72044391492633, 75.90601025591981
      longitude: 75.90601,
    },
    createdAt: new Date().toISOString(),
  };
};

export const resetDriverLocalData = async () => {
  await AsyncStorage.multiRemove([
    KEYS.ACTIVE_ORDER,
    KEYS.ORDER_HISTORY,
    KEYS.WALLET_DATA,
    KEYS.IN_APP_NOTIFICATIONS,
  ]);
};
