import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CAPTAIN_BASE_URL, BASE_URL, API_HOST, DRIVER_BASE_URL } from './api';
import LocationService from './locationService';
import { clearActiveOrder } from './localDriverData';
import { navigate } from '../navigations/navigationRef';
import { OfflineQueue } from './offlineQueue';

let isLoggingOut = false;

// ✅ FIRST define interceptor
const setupInterceptors = (clientInstance, name = 'API') => {
  clientInstance.interceptors.request.use(
    async config => {
      const token = await AsyncStorage.getItem('userToken');

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      return config;
    },
    error => Promise.reject(error),
  );

  clientInstance.interceptors.response.use(
    response => response,
    async error => {
      const status = error?.response?.status;
      const message =
        error?.response?.data?.message || error?.response?.data?.error || '';

      const isTokenExpired =
        status === 401 ||
        message.toLowerCase().includes('token expired') ||
        message.toLowerCase().includes('jwt expired') ||
        message.toLowerCase().includes('unauthorized');

      if (isTokenExpired && !isLoggingOut) {
        isLoggingOut = true;

        await AsyncStorage.multiRemove(['userToken', 'userData', 'driverId']);

        navigate('Login');

        setTimeout(() => {
          isLoggingOut = false;
        }, 1000);
      }

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
  // console.log("token", token);

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

    //

    if (pending.length > 0) {
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
    const coords = LocationService.getLastCoords();

    if (isOnline && !coords) {
      throw new Error('location unavailable');
    }

    const locationPayload = coords
      ? {
          latitude: coords.latitude,
          longitude: coords.longitude,
        }
      : {};

    const response = await main_client.post(
      '/driver/toggle-online',
      {
        isOnline,
        online: isOnline,
        status: isOnline ? 'online' : 'offline',
        ...locationPayload,
      },
      config,
    );

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
    console.log('check data', orderId);

    const coords = LocationService.getLastCoords();
    const payload = {
      rideId: orderId,
      driverLocation: coords
        ? {
            latitude: coords.latitude,
            longitude: coords.longitude,
          }
        : null,
    };
    console.log('check data', payload);

    try {
      const response = await main_client.post(
        '/rides/accept-with-socket',
        payload,
        config,
      );
      return response.data?.data;
    } catch (error) {
      // Enqueue if it's a network error or server (5xx) error
      if (!error.response || error.response.status >= 500) {
        await OfflineQueue.enqueue({
          method: 'post',
          url: '/rides/accept-with-socket',
          data: payload,
        });
      }
      throw error;
    }
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
    
    const payload = { reason, rideId: orderId };
    try {
      const response = await main_client.post(
        `/rides/${orderId}/cancel`,
        payload,
        config,
      );
      return response.data?.data;
    } catch (error) {
      if (!error.response || error.response.status >= 500) {
        await OfflineQueue.enqueue({
          method: 'post',
          url: `/rides/${orderId}/cancel`,
          data: payload,
        });
      }
      throw error;
    }
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

  /**
   * Complete ride via the rides API (spec-compliant endpoint).
   * POST /api/rides/complete { rideId, fare, paymentMethod }
   */
  async completeRide(rideId, fare, paymentMethod = 'cash') {
    const config = await withAuth();
    const payload = { rideId, fare, paymentMethod };
    try {
      const response = await main_client.post(
        '/rides/complete',
        payload,
        config,
      );
      return response.data?.data;
    } catch (error) {
      if (!error.response || error.response.status >= 500) {
        await OfflineQueue.enqueue({
          method: 'post',
          url: '/rides/complete',
          data: payload,
        });
      }
      throw error;
    }
  },

  /**
   * Notify backend that driver has arrived at pickup.
   * POST /api/rides/arrived { rideId }
   */
  async arrivedAtPickup(rideId) {
    const config = await withAuth();
    const payload = { rideId };
    try {
      const response = await main_client.post(
        '/rides/arrived',
        payload,
        config,
      );
      return response.data?.data;
    } catch (error) {
      if (!error.response || error.response.status >= 500) {
        await OfflineQueue.enqueue({
          method: 'post',
          url: '/rides/arrived',
          data: payload,
        });
      }
      throw error;
    }
  },

  /**
   * Notify backend that the ride trip has started (pickup confirmed, heading to drop).
   * POST /api/rides/start { rideId }
   */
  async startRide(rideId) {
    const config = await withAuth();
    const payload = { rideId };
    try {
      const response = await main_client.post('/rides/start', payload, config);
      return response.data?.data;
    } catch (error) {
      if (!error.response || error.response.status >= 500) {
        await OfflineQueue.enqueue({
          method: 'post',
          url: '/rides/start',
          data: payload,
        });
      }
      throw error;
    }
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

  async createWalletOrder(amount) {
    const config = await withAuth();
    const response = await main_client.post(
      '/wallet/driver/create-order',
      { amount },
      config,
    );
    return response.data?.data;
  },

  async verifyWalletPayment(paymentData) {
    const config = await withAuth();
    const response = await main_client.post(
      '/wallet/driver/verify',
      paymentData,
      config,
    );
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
