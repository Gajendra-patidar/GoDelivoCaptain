import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Switch,
  Alert,
  AppState,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import NotificationService from '../../services/NotificationService';
import RechargeNowModal from '../../modals/RechargeNowModal';
import EmergencyModal from '../../modals/EmergencyModal';
import StatusModal from '../../modals/StatusModal';
import { OrderModal } from '../../modals/OrderModal';
import {
  selectIsOnline,
  setOffline,
  setOnline,
} from '../../store/slices/onlineStatusSlice';
import {
  addNotification,
  addWalletAmount,
  clearActiveOrder,
  getActiveOrder,
  getWalletData,
  setActiveOrder,
  setWalletData,
} from '../../services/localDriverData';
import { driverApi } from '../../services/driverApi';

const HomeScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const isOnline = useSelector(selectIsOnline);

  const [verifyStatus, setVerifyStatus] = useState('VERIFIED');
  const [modalVisible, setModalVisible] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [docDes, setDocDes] = useState('');
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [orderComing, setOrderComing] = useState(false);
  const [notificationData, setNotificationData] = useState(null);
  const [walletBalance, setWalletBalance] = useState(0);

  const pollRef = useRef(null);
  const appState = useRef(AppState.currentState);

  const syncWallet = useCallback(async () => {
    try {
      const earnings = await driverApi.getEarnings();
      const wallet = earnings?.wallet;
      if (wallet) {
        const local = await setWalletData(wallet);
        setWalletBalance(local.balance);
        return;
      }
    } catch {}

    const fallbackWallet = await getWalletData();
    setWalletBalance(fallbackWallet.balance);
  }, []);

  const checkNearbyOrders = useCallback(async () => {
    if (!isOnline || orderComing) {
      return;
    }

    try {
      const order = await driverApi.getNearbyOrder();
      if (!order) {
        return;
      }

      if (order.status === 'accepted' || order.status === 'picked_up') {
        await setActiveOrder(order);
        navigation.navigate('Map', { order });
        return;
      }

      if (order.status === 'new') {
        setNotificationData(order);
        setOrderComing(true);
      }
    } catch {
      // keep silent for polling
    }
  }, [isOnline, navigation, orderComing]);

  const loadHomeData = useCallback(async () => {
    await syncWallet();

    const activeOrder = await getActiveOrder();
    if (activeOrder) {
      navigation.navigate('Map', { order: activeOrder });
      return;
    }

    await checkNearbyOrders();
  }, [checkNearbyOrders, navigation, syncWallet]);

  useFocusEffect(
    useCallback(() => {
      loadHomeData();
    }, [loadHomeData]),
  );

  const handleNotificationPress = useCallback(
    notification => {
      const data = notification?.data || {};

      if (data.type === 'DOCUMENT_REJECTED' || data.type === 'REJECT') {
        setVerifyStatus('REJECT');
        setDocDes(data.body || 'Documents rejected');
        navigation.navigate('Docs');
        return;
      }

      if (data.type === 'DOCUMENT_VERIFIED' || data.type === 'VERIFIED') {
        setVerifyStatus('VERIFIED');
        Alert.alert('Success', 'Your documents have been verified.');
        return;
      }

      if (data.type === 'NEW_ORDER' || data.type === 'ORDER') {
        setOrderComing(true);
        setNotificationData(data);
        return;
      }

      if (data.screen) {
        navigation.navigate(data.screen);
      }
    },
    [navigation],
  );

  const handleIncomingMessage = useCallback(async remoteMessage => {
    const data = remoteMessage?.data || {};

    await addNotification({
      title: remoteMessage?.notification?.title || data.title || 'New Notification',
      body: remoteMessage?.notification?.body || data.body || '',
      type: data.type || 'general',
      data,
    });

    if (data.type === 'DOCUMENT_VERIFIED' || data.type === 'VERIFIED') {
      setVerifyStatus('VERIFIED');
      return;
    }

    if (data.type === 'DOCUMENT_REJECTED' || data.type === 'REJECT') {
      setVerifyStatus('REJECT');
      setDocDes(data.body || 'Documents rejected');
      return;
    }

    if (data.type === 'NEW_ORDER' || data.type === 'ORDER') {
      setOrderComing(true);
      setNotificationData(data);
    }
  }, []);

  const initializeNotifications = useCallback(async () => {
    try {
      let userId = await AsyncStorage.getItem('driverId');

      if (!userId) {
        const userDataRaw = await AsyncStorage.getItem('userData');
        const userData = userDataRaw ? JSON.parse(userDataRaw) : null;
        userId = userData?._id || userData?.id || null;
      }

      if (!userId) {
        return;
      }

      await NotificationService.initialize(userId);
      NotificationService.addListener('press', handleNotificationPress);
      NotificationService.addListener('message', handleIncomingMessage);
    } catch (error) {
      console.log('Error initializing notifications:', error);
    }
  }, [handleIncomingMessage, handleNotificationPress]);

  useEffect(() => {
    initializeNotifications();

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        loadHomeData();
      }
      appState.current = nextAppState;
    });

    return () => {
      NotificationService.removeListener('press', handleNotificationPress);
      NotificationService.removeListener('message', handleIncomingMessage);
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
      subscription.remove();
    };
  }, [
    handleIncomingMessage,
    handleNotificationPress,
    initializeNotifications,
    loadHomeData,
  ]);

  useEffect(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    if (isOnline) {
      checkNearbyOrders();
      pollRef.current = setInterval(() => {
        checkNearbyOrders();
      }, 12000);
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, [checkNearbyOrders, isOnline]);

  const handleToggleOnline = async () => {
    const nextStatus = !isOnline;

    if (nextStatus) {
      dispatch(setOnline());
    } else {
      dispatch(setOffline());
      await clearActiveOrder();
      setOrderComing(false);
      setNotificationData(null);
    }

    setStatusModalVisible(true);

    try {
      const result = await driverApi.updateOnlineStatus(nextStatus);
      await NotificationService.updateOnlineStatus(nextStatus);

      if (nextStatus && result?.nearbyOrder) {
        setNotificationData(result.nearbyOrder);
        setOrderComing(true);
      }
    } catch (error) {
      Alert.alert('Status update failed', driverApi.safeErrorMessage(error));
    }
  };

  const handleOrderAccept = async order => {
    try {
      const accepted = await driverApi.acceptOrder(order.id);
      await setActiveOrder(accepted || order);
      await addNotification({
        title: 'Order Accepted',
        body: `You accepted order ${order.id}`,
        type: 'order',
        data: accepted || order,
      });

      setOrderComing(false);
      setNotificationData(null);
      navigation.navigate('Map', { order: accepted || order });
    } catch (error) {
      Alert.alert('Accept failed', driverApi.safeErrorMessage(error));
    }
  };

  const handleOrderReject = async order => {
    try {
      await driverApi.rejectOrder(order.id);
    } catch {}

    await addNotification({
      title: 'Order Rejected',
      body: `You rejected order ${order?.id || ''}`,
      type: 'order',
      data: order,
    });

    setOrderComing(false);
    setNotificationData(null);
    setTimeout(() => {
      checkNearbyOrders();
    }, 5000);
  };

  const handleRechargeWallet = async amount => {
    try {
      const wallet = await driverApi.rechargeWallet(amount);
      if (wallet) {
        const updated = await setWalletData(wallet);
        setWalletBalance(updated.balance);
      } else {
        const updated = await addWalletAmount(amount);
        setWalletBalance(updated.balance);
      }
      Alert.alert('Wallet updated', `Rs ${amount} added successfully.`);
    } catch (error) {
      const updated = await addWalletAmount(amount);
      setWalletBalance(updated.balance);
      Alert.alert('Offline recharge', `Backend not reachable. Rs ${amount} added locally.`);
    }
  };

  return (
    <>
      <StatusBar backgroundColor="#F4C20D" barStyle="dark-content" />

      {verifyStatus === 'INRIVIEW' ? (
        <View style={styles.verifyModal}>
          <Ionicons name="time-outline" size={50} color="#F4C20D" />
          <Text style={styles.verifyModalText}>Document verification under review</Text>
          <Text style={styles.verifySubText}>We will notify you after review.</Text>
        </View>
      ) : verifyStatus === 'REJECT' ? (
        <View style={styles.verifyModal}>
          <Ionicons name="close-circle-outline" size={50} color="#FF3B30" />
          <Text style={styles.verifyModalText}>{docDes}</Text>
          <TouchableOpacity
            style={styles.uploadAgainBtn}
            onPress={() => navigation.navigate('Docs')}
          >
            <Text style={styles.uploadAgainText}>Upload Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.container}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.profileCard}>
            <View style={styles.profileLeft}>
              <Image
                source={require('../../assets/profile.png')}
                style={styles.avatar}
              />
              {isOnline ? <View style={styles.onlineDot} /> : null}

              <View>
                <Text style={styles.name}>Captain</Text>
                <Text style={styles.rating}>4.8 Rating • Scooter</Text>
                <Text style={styles.vehicle}>MP-13-FP-1405</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
                  <Text style={styles.seeprofile}>View profile</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.profileRight}>
              <TouchableOpacity
                style={styles.iconCircle}
                onPress={() => setAlertVisible(true)}
              >
                <Image
                  source={require('../../assets/siren.png')}
                  style={styles.sirenIcon}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconCircle}
                onPress={() => navigation.navigate('Notifications')}
              >
                <Ionicons name="notifications" size={22} color="#806504" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.walletCard}>
            <Text style={styles.walletLabel}>Wallet Balance</Text>
            <Text style={styles.balance}>Rs {walletBalance.toFixed(2)}</Text>

            <TouchableOpacity
              style={styles.rechargeBtn}
              onPress={() => setModalVisible(true)}
            >
              <Image
                source={require('../../assets/wallet.png')}
                style={styles.walletIcon}
              />
              <Text style={styles.rechargeText}>Recharge</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryAction}
              onPress={() => navigation.navigate('Earnings')}
            >
              <Text style={styles.secondaryActionText}>View Earnings</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.rewardCard}>
            <Image
              source={require('../../assets/trophy.png')}
              style={styles.rewardImg}
            />

            <View style={styles.rewardInfo}>
              <Text style={styles.rewardTitle}>Order History</Text>
              <Text style={styles.rewardSub}>Track all your completed deliveries.</Text>

              <TouchableOpacity
                style={styles.viewBtn}
                onPress={() => navigation.navigate('OrderHistory')}
              >
                <Text style={styles.viewText}>Open History</Text>
                <Ionicons name="chevron-forward" size={18} color="#000" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.onlineContainer}>
            <Ionicons
              name="wifi"
              size={36}
              color={isOnline ? '#16C784' : '#FF4D4D'}
            />
            <Text style={styles.onlineText}>{isOnline ? t('online') : t('offline')}</Text>

            <Switch
              value={isOnline}
              onValueChange={handleToggleOnline}
              trackColor={{ false: '#FF4D4D', true: '#16C784' }}
              thumbColor="#fff"
            />
          </View>
        </ScrollView>
      )}

      <RechargeNowModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        walletBalance={walletBalance}
        onRecharge={handleRechargeWallet}
      />

      <EmergencyModal
        visible={alertVisible}
        onClose={() => setAlertVisible(false)}
      />

      <StatusModal
        visible={statusModalVisible}
        isOnline={isOnline}
        onClose={() => setStatusModalVisible(false)}
      />

      <OrderModal
        visible={orderComing}
        onClose={() => setOrderComing(false)}
        orderData={notificationData}
        onAccept={handleOrderAccept}
        onReject={handleOrderReject}
      />
    </>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9',
    padding: 18,
  },
  scrollContent: {
    paddingBottom: 60,
  },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 25,
    paddingHorizontal: 18,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  onlineDot: {
    position: 'absolute',
    top: '70%',
    left: '25%',
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: '#15ff00',
    borderWidth: 2,
    borderColor: '#fff',
  },
  profileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 32,
    marginRight: 15,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  rating: {
    fontSize: 12,
    color: '#555',
    marginTop: 3,
  },
  vehicle: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  seeprofile: {
    fontSize: 10,
    color: 'blue',
  },
  profileRight: {
    flexDirection: 'row',
  },
  iconCircle: {
    backgroundColor: '#FFF8E1',
    padding: 12,
    borderRadius: 50,
    marginLeft: 10,
  },
  sirenIcon: {
    width: 22,
    height: 20,
  },
  walletCard: {
    backgroundColor: '#fff',
    borderRadius: 30,
    padding: 25,
    marginBottom: 25,
  },
  walletLabel: {
    fontSize: 15,
    color: '#000',
    opacity: 0.8,
  },
  balance: {
    fontSize: 34,
    fontWeight: 'bold',
    marginVertical: 10,
    color: '#000',
  },
  rechargeBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: '#fffcd0',
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#F4C20D',
    borderRadius: 30,
    gap: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  walletIcon: {
    width: 30,
    height: 30,
  },
  rechargeText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
  },
  secondaryAction: {
    alignItems: 'center',
    marginTop: 12,
  },
  secondaryActionText: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  rewardCard: {
    backgroundColor: '#fff',
    borderRadius: 30,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
  },
  rewardImg: {
    width: 85,
    height: 85,
    marginRight: 15,
    resizeMode: 'contain',
  },
  rewardInfo: {
    flex: 1,
  },
  rewardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  rewardSub: {
    fontSize: 13,
    color: '#666',
    marginVertical: 6,
  },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  viewText: {
    color: '#000',
    fontWeight: 'bold',
    marginRight: 5,
  },
  onlineContainer: {
    height: 65,
    borderRadius: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    marginBottom: 50,
  },
  onlineText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
    color: '#000',
  },
  verifyModal: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  verifyModalText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#000',
    textAlign: 'center',
    marginTop: 15,
    marginBottom: 10,
  },
  verifySubText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  uploadAgainBtn: {
    backgroundColor: '#F4C20D',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginTop: 20,
  },
  uploadAgainText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
