import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Alert,
  AppState,
  RefreshControl,
  Animated,
  PanResponder,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { moderateScale } from 'react-native-size-matters';
import SwitchToggle from 'react-native-switch-toggle';

import NotificationService from '../../services/NotificationService';
import LocationService from '../../services/locationService';
import RechargeNowModal from '../../modals/RechargeNowModal';
import EmergencyModal from '../../modals/EmergencyModal';
import StatusModal from '../../modals/StatusModal';
import { OrderModal } from '../../modals/OrderModal';
import {
  selectIsOnline,
  setOffline,
  setOnline,
} from '../../store/slices/onlineStatusSlice';
import { selectProfile } from '../../store/slices/profileSlice';
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
import { theme } from '../../theme';
import SwipeToggle from '../../components/SwipeToggle';

const HomeScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const isOnline = useSelector(selectIsOnline);
  const profile = useSelector(selectProfile);

  const [verifyStatus, setVerifyStatus] = useState('VERIFIED');
  const [modalVisible, setModalVisible] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [docDes, setDocDes] = useState('');
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [orderComing, setOrderComing] = useState(false);
  const [notificationData, setNotificationData] = useState(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [toggleBusy, setToggleBusy] = useState(false);

  const pollRef = useRef(null);
  const appState = useRef(AppState.currentState);
  const LOW_BALANCE_THRESHOLD = 100;
  const isBalanceLow = Number(walletBalance || 0) < LOW_BALANCE_THRESHOLD;
  const displayName =
    profile?.fullName ||
    profile?.name ||
    profile?.username ||
    profile?.phone ||
    'Captain';

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

  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await loadHomeData();
    } finally {
      setRefreshing(false);
    }
  }, [loadHomeData]);

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
      title:
        remoteMessage?.notification?.title || data.title || 'New Notification',
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
    if (toggleBusy) {
      return;
    }
    setToggleBusy(true);

    const nextStatus = !isOnline;

    if (nextStatus) {
      dispatch(setOnline());
      LocationService.start();
    } else {
      dispatch(setOffline());
      LocationService.stop();
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
    } finally {
      setToggleBusy(false);
    }
  };

  const handleOpenProfile = () => navigation.navigate('Profile');
  const handleOpenNotifications = () => navigation.navigate('Notifications');
  const handleOpenEarnings = () => navigation.navigate('Earnings');
  const handleOpenHistory = () => navigation.navigate('OrderHistory');
  const handleOpenDocs = () => navigation.navigate('Docs');

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
      Alert.alert(
        'Offline recharge',
        `Backend not reachable. Rs ${amount} added locally.`,
      );
    }
  };

  return (
    <>
      <StatusBar
        backgroundColor={theme.colors.primary}
        barStyle="dark-content"
      />

      {verifyStatus === 'INRIVIEW' ? (
        <View style={styles.gateScreen}>
          <View style={styles.gateCard}>
            <View style={styles.gateIconWrap}>
              <Ionicons
                name="time-outline"
                size={28}
                color={theme.colors.ink}
              />
            </View>
            <Text style={styles.gateTitle}>Verification in review</Text>
            <Text style={styles.gateSubTitle}>
              You will start receiving orders after approval.
            </Text>
            <TouchableOpacity
              style={styles.gateButton}
              onPress={handleOpenDocs}
            >
              <Text style={styles.gateButtonText}>Open Documents</Text>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={theme.colors.ink}
              />
            </TouchableOpacity>
          </View>
        </View>
      ) : verifyStatus === 'REJECT' ? (
        <View style={styles.gateScreen}>
          <View style={styles.gateCard}>
            <View style={[styles.gateIconWrap, styles.gateIconDanger]}>
              <Ionicons name="close" size={28} color="#fff" />
            </View>
            <Text style={styles.gateTitle}>Documents rejected</Text>
            <Text style={styles.gateSubTitle}>
              {docDes || 'Please re-upload your documents.'}
            </Text>
            <TouchableOpacity
              style={styles.gateButton}
              onPress={handleOpenDocs}
            >
              <Text style={styles.gateButtonText}>Upload Again</Text>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={theme.colors.ink}
              />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <ScrollView
          style={styles.container}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          <View style={styles.headerWrap}>
            <View style={styles.headerTopRow}>
              <View style={styles.headerLeft}>
                <Text style={styles.brand}>GoDelivo</Text>
                <Text style={styles.greeting} numberOfLines={1}>
                  Hello, {displayName}
                </Text>
                <View style={styles.statusPillRow}>
                  <View
                    style={[
                      styles.statusPill,
                      isOnline ? styles.pillOnline : styles.pillOffline,
                    ]}
                  >
                    <View
                      style={[
                        styles.pillDot,
                        isOnline ? styles.dotOnline : styles.dotOffline,
                      ]}
                    />
                    <Text style={styles.statusPillText}>
                      {isOnline ? t('online') : t('offline')}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.headerActions}>
                <TouchableOpacity
                  style={styles.headerIconButton}
                  onPress={() => setAlertVisible(true)}
                >
                  <Image
                    source={require('../../assets/siren.png')}
                    style={styles.headerSirenIcon}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.headerIconButton}
                  onPress={handleOpenNotifications}
                >
                  <Ionicons
                    name="notifications"
                    size={22}
                    color={theme.colors.ink}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={styles.profileCard}
              onPress={handleOpenProfile}
              activeOpacity={0.85}
            >
              <View style={styles.profileLeft}>
                <View style={styles.avatarWrap}>
                  <Image
                    source={require('../../assets/profile.png')}
                    style={styles.avatar}
                  />
                  {isOnline ? <View style={styles.onlineDot} /> : null}
                </View>
                <View style={styles.profileTextCol}>
                  <Text style={styles.name} numberOfLines={1}>
                    {displayName}
                  </Text>
                  <Text style={styles.subLine} numberOfLines={1}>
                    {profile?.rating != null
                      ? `★ ${Number(profile.rating).toFixed(1)} • `
                      : ''}
                    {profile?.email || profile?.phone || 'Tap to view profile'}
                  </Text>
                </View>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={theme.colors.muted}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.walletSection}>
            {isBalanceLow ? (
              <View style={styles.lowBalanceCard}>
                <View style={styles.lowBalanceTop}>
                  <View style={styles.lowBalanceIconWrap}>
                    <Ionicons
                      name="warning-outline"
                      size={22}
                      color={theme.colors.ink}
                    />
                  </View>
                  <View style={styles.lowBalanceText}>
                    <Text style={styles.lowBalanceTitle}>Balance is low</Text>
                    <Text style={styles.lowBalanceSub} numberOfLines={2}>
                      Recharge wallet to keep receiving orders smoothly.
                    </Text>
                  </View>
                  <Text style={styles.lowBalanceAmount}>
                    Rs {walletBalance.toFixed(2)}
                  </Text>
                </View>

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
              </View>
            ) : (
              <TouchableOpacity
                style={styles.ledgerCard}
                onPress={handleOpenEarnings}
                activeOpacity={0.9}
              >
                <View style={styles.ledgerLeft}>
                  <View style={styles.ledgerIconWrap}>
                    <Ionicons
                      name="wallet-outline"
                      size={22}
                      color={theme.colors.ink}
                    />
                  </View>
                  <Text style={styles.ledgerLabel}>Ledger balance</Text>
                </View>
                <Text style={styles.ledgerAmount}>
                  Rs {walletBalance.toFixed(2)}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.goOnlineWrap}>
            <Text style={styles.goOnlineHint} numberOfLines={2}>
              {isOnline
                ? 'You are online. You will receive new orders.'
                : 'Go online to start receiving new orders.'}
            </Text>
            <SwipeToggle isOnline={isOnline} onToggle={handleToggleOnline} />
          </View>

          <View style={styles.quickGrid}>
            <TouchableOpacity
              style={styles.quickCard}
              onPress={handleOpenEarnings}
            >
              <View style={styles.quickIconWrap}>
                <Ionicons
                  name="cash-outline"
                  size={22}
                  color={theme.colors.ink}
                />
              </View>
              <Text style={styles.quickTitle}>Earnings</Text>
              <Text style={styles.quickSub} numberOfLines={1}>
                Summary and wallet
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickCard}
              onPress={handleOpenHistory}
            >
              <View style={styles.quickIconWrap}>
                <Ionicons
                  name="time-outline"
                  size={22}
                  color={theme.colors.ink}
                />
              </View>
              <Text style={styles.quickTitle}>Trips</Text>
              <Text style={styles.quickSub} numberOfLines={1}>
                Order history
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickCard} onPress={handleOpenDocs}>
              <View style={styles.quickIconWrap}>
                <Ionicons
                  name="document-text-outline"
                  size={22}
                  color={theme.colors.ink}
                />
              </View>
              <Text style={styles.quickTitle}>Documents</Text>
              <Text style={styles.quickSub} numberOfLines={1}>
                KYC and vehicle
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickCard}
              onPress={() => navigation.navigate('Help')}
            >
              <View style={styles.quickIconWrap}>
                <Ionicons
                  name="headset-outline"
                  size={22}
                  color={theme.colors.ink}
                />
              </View>
              <Text style={styles.quickTitle}>Support</Text>
              <Text style={styles.quickSub} numberOfLines={1}>
                Help center
              </Text>
            </TouchableOpacity>
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
    backgroundColor: theme.colors.bg,
  },
  scrollContent: {
    paddingBottom: moderateScale(120),
  },

  headerWrap: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: moderateScale(18),
    paddingTop: moderateScale(18),
    paddingBottom: moderateScale(18),
    borderBottomLeftRadius: theme.radii.xl,
    borderBottomRightRadius: theme.radii.xl,
    marginBottom: moderateScale(12),
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
    paddingRight: moderateScale(10),
  },
  brand: {
    fontSize: moderateScale(12),
    fontWeight: '800',
    color: theme.colors.ink,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    opacity: 0.85,
  },
  greeting: {
    fontSize: moderateScale(22),
    fontWeight: '900',
    color: theme.colors.ink,
    marginTop: moderateScale(6),
  },
  statusPillRow: {
    flexDirection: 'row',
    marginTop: moderateScale(10),
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: theme.radii.pill,
    paddingHorizontal: moderateScale(10),
    paddingVertical: moderateScale(6),
  },
  statusPillText: {
    marginLeft: moderateScale(6),
    fontWeight: '800',
    fontSize: moderateScale(12),
    color: theme.colors.ink,
  },
  pillOnline: {
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  pillOffline: {
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  pillDot: {
    width: moderateScale(8),
    height: moderateScale(8),
    borderRadius: theme.radii.pill,
  },
  dotOnline: {
    backgroundColor: theme.colors.success,
  },
  dotOffline: {
    backgroundColor: theme.colors.danger,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconButton: {
    width: moderateScale(42),
    height: moderateScale(42),
    borderRadius: theme.radii.pill,
    backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: moderateScale(10),
  },
  headerSirenIcon: {
    width: moderateScale(22),
    height: moderateScale(20),
    resizeMode: 'contain',
  },

  profileCard: {
    marginTop: moderateScale(14),
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    paddingVertical: moderateScale(12),
    paddingHorizontal: moderateScale(12),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.primaryBorder,
    ...theme.shadow.card,
  },
  profileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarWrap: {
    width: moderateScale(46),
    height: moderateScale(46),
    borderRadius: theme.radii.pill,
    marginRight: moderateScale(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: moderateScale(46),
    height: moderateScale(46),
    borderRadius: theme.radii.pill,
  },
  onlineDot: {
    position: 'absolute',
    right: moderateScale(-1),
    bottom: moderateScale(-1),
    width: moderateScale(14),
    height: moderateScale(14),
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.success,
    borderWidth: 2,
    borderColor: theme.colors.surface,
  },
  profileTextCol: {
    flex: 1,
  },
  name: {
    fontSize: moderateScale(16),
    fontWeight: '900',
    color: theme.colors.ink,
  },
  subLine: {
    marginTop: moderateScale(2),
    fontSize: moderateScale(12),
    fontWeight: '600',
    color: theme.colors.muted,
  },

  walletSection: {
    marginTop: moderateScale(12),
    marginHorizontal: moderateScale(16),
  },
  ledgerCard: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radii.lg,
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(14),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: theme.colors.primaryBorder,
    ...theme.shadow.card,
  },
  ledgerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: moderateScale(10),
  },
  ledgerIconWrap: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: theme.radii.md,
    backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: moderateScale(10),
  },
  ledgerLabel: {
    fontSize: moderateScale(13),
    fontWeight: '900',
    color: theme.colors.ink,
  },
  ledgerAmount: {
    fontSize: moderateScale(20),
    fontWeight: '900',
    color: theme.colors.ink,
  },

  lowBalanceCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.xl,
    padding: moderateScale(16),
    borderWidth: 1,
    borderColor: theme.colors.primaryBorder,
    ...theme.shadow.card,
  },
  lowBalanceTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  lowBalanceIconWrap: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: moderateScale(10),
  },
  lowBalanceText: {
    flex: 1,
    paddingRight: moderateScale(10),
  },
  lowBalanceTitle: {
    fontSize: moderateScale(14),
    fontWeight: '900',
    color: theme.colors.ink,
  },
  lowBalanceSub: {
    marginTop: moderateScale(4),
    fontSize: moderateScale(11),
    fontWeight: '600',
    color: theme.colors.muted,
    lineHeight: moderateScale(16),
  },
  lowBalanceAmount: {
    fontSize: moderateScale(14),
    fontWeight: '900',
    color: theme.colors.ink,
  },
  rechargeBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
    paddingVertical: moderateScale(12),
    borderWidth: 1,
    borderColor: theme.colors.primaryBorder,
    borderRadius: theme.radii.pill,
    alignItems: 'center',
    marginTop: moderateScale(12),
  },
  walletIcon: {
    width: moderateScale(22),
    height: moderateScale(22),
    marginRight: moderateScale(10),
  },
  rechargeText: {
    color: theme.colors.ink,
    fontWeight: '900',
    fontSize: moderateScale(14),
  },
  walletHint: {
    marginTop: moderateScale(10),
    color: theme.colors.muted,
    fontSize: moderateScale(11),
    fontWeight: '600',
    lineHeight: moderateScale(16),
  },

  quickGrid: {
    marginTop: moderateScale(14),
    marginHorizontal: moderateScale(16),
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickCard: {
    width: '48%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: moderateScale(14),
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: moderateScale(12),
    ...theme.shadow.card,
  },
  quickIconWrap: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: moderateScale(10),
  },
  quickTitle: {
    fontSize: moderateScale(14),
    fontWeight: '900',
    color: theme.colors.ink,
  },
  quickSub: {
    marginTop: moderateScale(2),
    fontSize: moderateScale(11),
    fontWeight: '600',
    color: theme.colors.muted,
  },

  goOnlineWrap: {
    marginTop: moderateScale(30),
    marginHorizontal: moderateScale(16),
    marginBottom: moderateScale(12),
  },
  goOnlineHint: {
    color: theme.colors.muted,
    fontSize: moderateScale(12),
    fontWeight: '600',
    marginBottom: moderateScale(10),
  },
  swipeTrack: {
    height: moderateScale(62),
    borderRadius: theme.radii.pill,
    overflow: 'hidden',
    justifyContent: 'center',
    ...theme.shadow.card,
  },
  swipeTrackOn: {
    backgroundColor: theme.colors.success,
  },
  swipeTrackOff: {
    backgroundColor: theme.colors.danger,
  },
  swipeProgress: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: theme.radii.pill,
  },
  swipeProgressOn: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  swipeProgressOff: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  swipeLabel: {
    textAlign: 'center',
    fontSize: moderateScale(16),
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 1,
  },
  swipeTextStack: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipeStatusText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: moderateScale(16),
    letterSpacing: 2,
  },
  swipeThumb: {
    position: 'absolute',
    left: moderateScale(8),
    width: moderateScale(46),
    height: moderateScale(46),
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeDisabled: {
    opacity: 0.75,
  },

  gateScreen: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: moderateScale(18),
  },
  gateCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.xl,
    padding: moderateScale(18),
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  gateIconWrap: {
    width: moderateScale(56),
    height: moderateScale(56),
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: moderateScale(12),
  },
  gateIconDanger: {
    backgroundColor: theme.colors.danger,
  },
  gateTitle: {
    fontSize: moderateScale(18),
    fontWeight: '900',
    color: theme.colors.ink,
  },
  gateSubTitle: {
    marginTop: moderateScale(8),
    fontSize: moderateScale(12),
    fontWeight: '600',
    color: theme.colors.muted,
    lineHeight: moderateScale(18),
  },
  gateButton: {
    marginTop: moderateScale(14),
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radii.md,
    paddingVertical: moderateScale(12),
    paddingHorizontal: moderateScale(12),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gateButtonText: {
    fontWeight: '900',
    color: theme.colors.ink,
    fontSize: moderateScale(13),
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: moderateScale(12),
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  toggleText: {
    fontSize: moderateScale(14),
    fontWeight: '900',
    color: theme.colors.ink,
  },

  toggleSwitch: {
    width: '100%',
    height: moderateScale(50),
    borderRadius: 30,
    padding: 4,
    justifyContent: 'center',
  },

  toggleCircle: {
    width: moderateScale(44),
    height: moderateScale(44),
    borderRadius: 22,
  },
});
