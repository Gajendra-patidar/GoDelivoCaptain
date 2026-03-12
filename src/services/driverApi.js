import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from './api';

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

const getToken = async () => AsyncStorage.getItem('userToken');

const withAuth = async () => {
  const token = await getToken();
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
  return error?.response?.data?.message || error?.message || 'Something went wrong';
};

export const driverApi = {
  async getProfile() {
    const config = await withAuth();
    const response = await client.get('/me', config);
    return response.data?.data;
  },

  async getNearbyOrder() {
    const config = await withAuth();
    const response = await client.get('/orders/nearby', config);
    return response.data?.data;
  },

  async updateOnlineStatus(isOnline) {
    const driverId = await getDriverId();
    if (!driverId) {
      throw new Error('Driver ID not found. Please login again.');
    }

    const response = await client.post('/update-status', {
      driverId,
      isOnline,
    });

    return response.data?.data;
  },

  async acceptOrder(orderId) {
    const config = await withAuth();
    const response = await client.post(`/orders/${orderId}/accept`, {}, config);
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
    const response = await client.post(
      `/orders/${orderId}/cancel`,
      { reason },
      config,
    );
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
