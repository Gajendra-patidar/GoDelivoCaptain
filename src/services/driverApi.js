import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CAPTAIN_BASE_URL, BASE_URL, API_HOST, DRIVER_BASE_URL } from './api';
import LocationService from './locationService';
import { clearActiveOrder } from './localDriverData';

// ✅ FIRST define interceptor
const setupInterceptors = (clientInstance, name = 'API') => {
  clientInstance.interceptors.request.use(
    async config => {
      const token = await AsyncStorage.getItem('userToken');

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      console.log(`🚀 [${name}] Request:`, {
        url: config.url,
        method: config.method,
        data: config.data,
        token,
      });

      return config;
    },
    error => {
      console.log(`❌ [${name}] Request Error:`, error);
      return Promise.reject(error);
    },
  );

  clientInstance.interceptors.response.use(
    response => {
      console.log(`✅ [${name}] Response:`, {
        url: response.config.url,
        status: response.status,
        data: response.data,
      });

      return response;
    },
    error => {
      console.log(`🔥 [${name}] Response Error:`, {
        url: error?.config?.url,
        status: error?.response?.status,
        message: JSON.stringify(error?.response?.data || error.message),
      });

      return Promise.reject(error);
    },
  );
};

const client = axios.create({
  baseURL: DRIVER_BASE_URL,
  timeout: 15000,
});

const client_2 = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

setupInterceptors(client, 'CAPTAIN_API');
setupInterceptors(client_2, 'AUTH_API');

const main_client = axios.create({
  baseURL: API_HOST,
  timeout: 15000,
});
setupInterceptors(main_client, 'MAIN_API');

const getToken = async () => AsyncStorage.getItem('userToken');

const withAuth = async () => {
  const token = await getToken();
  console.log('check token fg:', token);
  return token
    ? {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
    : {};
};

const getDriverId = async () => {
  const direct = await AsyncStorage.getItem('driverId');
  if (direct) {
    return direct;
  }

  const userDataRaw = await AsyncStorage.getItem('userData');
  if (!userDataRaw) {
    return null;
  }

  try {
    const userData = JSON.parse(userDataRaw);
    return userData?._id || userData?.id || null;
  } catch {
    return null;
  }
};

const safeErrorMessage = error => {
  return (
    error?.response?.data?.message || error?.message || 'Something went wrong'
  );
};

export const driverApi = {
  async getProfile() {
    const config = await withAuth();
    const response = await client_2.get('/profile', config);
    await AsyncStorage.setItem('userData', JSON.stringify(response.data?.data));
    await AsyncStorage.setItem('driverId', response.data?.data?._id);
    return response.data?.data;
  },

  async getNearbyOrder() {
    const config = await withAuth();
    const coords = LocationService.getLastCoords();

    // Pass coordinates via query params, or as fallback
    let url = '/rides/driver/pending-requests';
    if (coords) {
      url += `?lat=${coords.latitude}&lng=${coords.longitude}&latitude=${coords.latitude}&longitude=${coords.longitude}`;
    }

    const response = await main_client.get(url, config);
    const pending = response.data?.data?.pendingRequests || [];

    console.log("order data data", response.data);


    if (pending.length > 0) {
      console.log("ride request data", pending[0]);
    }

    if (pending.length > 0) {
      return pending[0];
    }
    return null;
  },

  async updateOnlineStatus(isOnline) {
    const driverId = await getDriverId();
    if (!driverId) {
      throw new Error('Driver ID not found. Please login again.');
    }

    const config = await withAuth();
    const coords = LocationService.getLastCoords() || {
      latitude: 22.720315604395946,
      longitude: 75.90453599431497
    };

    const response = await main_client.post('/driver/toggle-online', {
      latitude: coords.latitude,
      longitude: coords.longitude
    }, config);

    console.log("toggle response data afdaya ha j", response.data);


    return response?.data?.data;
  },

  async updateHomeArea(data) {
    const config = await withAuth();
    const response = await client.patch('/home-area', data, config);
    return response.data?.data;
  },

  async requestPayout(amount) {
    const config = await withAuth();
    const response = await client.post('/wallet/payout', { amount }, config);
    return response.data?.data;
  },

  async acceptOrder(orderId) {
    const config = await withAuth();
    const response = await main_client.post('/rides/accept', { rideId: orderId }, config);
    return response.data?.data;
  },

  async rejectOrder(orderId, reason = 'Rejected by driver') {
    const config = await withAuth();
    const response = await client.post(
      `/orders/${orderId}/reject`,
      { reason },
      config,
    );
    return response.data?.data;
  },

  async cancelOrder(orderId, reason = 'Cancelled by driver') {
    const config = await withAuth();
    await clearActiveOrder();
    const response = await main_client.post(
      `/rides/${orderId}/cancel`,
      { reason, rideId: orderId },
      config,
    );

    console.log("cancel data", response.data);

    return response.data?.data;
  },

  async confirmPickup(orderId) {
    const config = await withAuth();
    const response = await client.post(`/orders/${orderId}/pickup`, {}, config);
    return response.data?.data;
  },

  async completeOrder(orderId, deliveredDistanceKm) {
    const config = await withAuth();
    const response = await client.post(
      `/orders/${orderId}/complete`,
      {
        deliveredDistanceKm,
      },
      config,
    );
    return response.data?.data;
  },

  async addTollCharge(orderId, amount) {
    const config = await withAuth();
    const response = await client.post(
      `/orders/${orderId}/toll`,
      { amount },
      config,
    );
    return response.data?.data;
  },

  async getEarnings() {
    const config = await withAuth();
    const response = await client.get('/earnings', config);
    return response.data?.data;
  },

  async rechargeWallet(amount) {
    const config = await withAuth();
    const response = await client.post('/wallet/recharge', { amount }, config);
    return response.data?.data;
  },

  async getIncentives() {
    const config = await withAuth();
    const response = await client.get('/incentives', config);
    return response.data?.data;
  },

  async getOrderHistory() {
    const config = await withAuth();
    const response = await client.get('/order-history', config);
    return response.data?.data || [];
  },

  async getNotifications() {
    const config = await withAuth();
    const response = await client.get('/notifications', config);
    return response.data?.data || [];
  },

  async markAllNotificationsRead() {
    const config = await withAuth();
    await client.post('/notifications/mark-all-read', {}, config);
    return true;
  },

  safeErrorMessage,
};
