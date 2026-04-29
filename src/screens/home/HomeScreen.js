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
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { moderateScale } from 'react-native-size-matters';
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
import { getProfile, selectProfile } from '../../store/slices/profileSlice';
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
import LinearGradient from 'react-native-linear-gradient';
import {
  startService,
  stopService,
  updateService,
} from '../../services/foregroundService';
import { playOrderSound } from '../../components/playOrderSound';
import SocketService from '../../services/socketService';
import { setLocationPermission } from '../../store/slices/permissionSlice';
import { getLocationPermission } from '../../services/permissionService';

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
  const [locationServiceHealthy, setLocationServiceHealthy] = useState(true);

  const pollRef = useRef(null);
  const appState = useRef(AppState.currentState);
  const LOW_BALANCE_THRESHOLD = 100;
  const isBalanceLow = Number(walletBalance || 0) < LOW_BALANCE_THRESHOLD;
  const displayName = profile?.name || 'Captain';

  useEffect(() => {
    const initPermission = async () => {
      const granted = await getLocationPermission();
      dispatch(setLocationPermission(granted));
    };

    initPermission();
  }, []);

  useEffect(() => {
    dispatch(getProfile());
  }, [dispatch]);

  // Health check for location service
  const checkLocationHealth = useCallback(async () => {
    try {
      const status = LocationService.getConnectionStatus();
      const coords = LocationService.getLastCoords();


      const isStale = status.lastLocationAge && status.lastLocationAge > 30000;

      if (!status.hasLocation || isStale) {
        setLocationServiceHealthy(false);
        return false;
      }

      setLocationServiceHealthy(true);
      return true;
    } catch (error) {
      console.error('Health check error:', error);
      setLocationServiceHealthy(false);
      return false;
    }
  }, []);

  const syncWallet = useCallback(async () => {
    try {
      const earnings = await driverApi.getEarnings();
      const wallet = earnings?.wallet;
      if (wallet) {
        const local = await setWalletData(wallet);
        setWalletBalance(local.balance);
        return;
      }
    } catch { }

    const fallbackWallet = await getWalletData();
    setWalletBalance(fallbackWallet.balance);
  }, []);

  const checkNearbyOrders = useCallback(async () => {
    if (!isOnline || orderComing) {
      return;
    }

    try {
      const activeOrder = await getActiveOrder();
      if (activeOrder) return;

      const order = await driverApi.getNearbyOrder();
      if (!order) return;

      if (order.status === 'accepted' || order.status === 'picked_up') {
        await setActiveOrder(order);
        navigation.navigate('Map', { order: order });
        return;
      }

      if (order != null) {
        console.log("nearbyorder data", order);

        setNotificationData(order);
        setOrderComing(true);
        playOrderSound();
      }
    } catch (error) {
    }
  }, [isOnline, navigation, orderComing]);

  const loadHomeData = useCallback(async () => {
    await syncWallet();

    const activeOrder = await getActiveOrder();
    if (activeOrder) {
      SocketService.setActiveRide(activeOrder.rideId || activeOrder.id);
      navigation.navigate('Map', { order: activeOrder });
      return;
    }

    await checkNearbyOrders();
  }, [checkNearbyOrders, navigation, syncWallet]);

  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await loadHomeData();
      if (isOnline) {
        await checkLocationHealth();
      }
    } finally {
      setRefreshing(false);
    }
  }, [loadHomeData, isOnline, checkLocationHealth]);

  useFocusEffect(
    useCallback(() => {
      const syncProfileStatus = async () => {
        try {
          const profileData = await driverApi.getProfile();
          if (profileData?.verifyStatus) {
            setVerifyStatus(profileData.verifyStatus);
            if (profileData.verifyStatus === 'REJECT') {
              setDocDes(profileData.rejectionReason || 'Documents rejected');
            }
          }
        } catch (error) {
        }
      };

      loadHomeData();
      syncProfileStatus();

      if (profile?.homeArea) {
        setHomeAreaActive(profile.homeArea.isActive);
        setPreferredArea(profile.homeArea);
      }
    }, [loadHomeData, profile]),
  );

  const handleToggleHomeArea = async () => {
    try {
      if (!preferredArea && !homeAreaActive) {
        setShowAreaModal(true);
        return;
      }

      const nextStatus = !homeAreaActive;
      await driverApi.updateHomeArea({ isActive: nextStatus });
      setHomeAreaActive(nextStatus);
      Alert.alert(
        'Filter Updated',
        `Order filter ${nextStatus ? 'enabled' : 'disabled'}.`,
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to update filter preference.');
    }
  };

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
        console.log("nearbyorder data 2", data);

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
      playOrderSound();
      setNotificationData(data);
    }
  }, []);

  // Initialize Socket.io event listeners
  const initializeSocketListeners = useCallback(() => {
    // Listen for new ride requests via Socket.io
    SocketService.on('new_ride', async rideData => {

      if (isOnline && !orderComing) {
        const activeOrder = await getActiveOrder();
        if (!activeOrder) {
          setNotificationData(rideData);
          console.log("initialize socket data", rideData);

          setOrderComing(true);
          playOrderSound();
        }
      }
    });

    // Support the new server event name for pending request socket flow
    SocketService.on('ride:new_request', async rideData => {
      if (isOnline && !orderComing) {
        const activeOrder = await getActiveOrder();
        if (!activeOrder) {
          setNotificationData(rideData);
          console.log("initialize socket data 2", rideData);

          setOrderComing(true);
          playOrderSound();
        }
      }
    });
    SocketService.on('ride_updated', data => {
      // Update active order if needed
    });

    SocketService.on('customer_message', data => {
      // Handle customer message
    });
  }, [isOnline, orderComing, notificationData]);

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

      // Initialize Socket.io listeners
      initializeSocketListeners();
    } catch (error) {
    }
  }, [
    handleIncomingMessage,
    handleNotificationPress,
    initializeSocketListeners,
  ]);

  useEffect(() => {
    initializeNotifications();

    const subscription = AppState.addEventListener(
      'change',
      async nextAppState => {
        if (
          appState.current.match(/inactive|background/) &&
          nextAppState === 'active' &&
          isOnline
        ) {
          await loadHomeData();
          const isHealthy = await checkLocationHealth();
          if (!isHealthy) {
            await LocationService.stop();
            await LocationService.start();
          }
        }
        appState.current = nextAppState;
      },
    );

    return () => {
      NotificationService.removeListener('press', handleNotificationPress);
      NotificationService.removeListener('message', handleIncomingMessage);
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
      subscription.remove();

      // Cleanup Socket.io listeners
      SocketService.off('new_ride');
      SocketService.off('ride:new_request');
      SocketService.off('ride_cancelled');
      SocketService.off('ride_updated');
      SocketService.off('customer_message');
    };
  }, [
    handleIncomingMessage,
    handleNotificationPress,
    initializeNotifications,
    loadHomeData,
    isOnline,
    checkLocationHealth,
  ]);

  // Periodic location service health check when online
  useEffect(() => {
    let healthInterval;

    if (isOnline) {
      healthInterval = setInterval(
        async () => {
          const isHealthy = await checkLocationHealth();
          if (!isHealthy) {
            // Removing manual stop and start here so Geolocation and Socket.IO can stabilize natively!
            setLocationServiceHealthy(false);
          } else {
            setLocationServiceHealthy(true);
          }
        },
        locationServiceHealthy ? 30000 : 3000,
      );
    }

    return () => {
      if (healthInterval) clearInterval(healthInterval);
    };
  }, [isOnline, checkLocationHealth, locationServiceHealthy]);

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

  const handleToggleOnline = async (targetState) => {
    // If targetState is provided, validate it's different from current state
    // If not provided, toggle to opposite of current state
    const nextStatus = targetState !== undefined ? targetState : !isOnline;

    // Prevent duplicate calls to the same state
    if (nextStatus === isOnline) {
      return;
    }

    if (toggleBusy) {
      return;
    }

    setToggleBusy(true);
    let locationServiceStarted = false;
    let foregroundServiceStarted = false;

    try {
      if (nextStatus) {
        // ========== GOING ONLINE ==========

        // Start location tracking
        try {
          await LocationService.start();
          locationServiceStarted = true;
          // 
          // Wait for location service to initialize (max 5 seconds)
          let retries = 0;
          while (retries < 10) {
            const status = LocationService.getConnectionStatus();
            if (status.hasLocation) {
              break;
            }
            await new Promise(r => setTimeout(r, 500));
            retries++;
          }

          if (retries === 10) {
          }
        } catch (locationError) {
          console.error('Location service start error:', locationError);
          throw new Error(
            'Failed to start location service: ' + locationError.message,
          );
        }

        // Start foreground service
        try {
          await startService();
          foregroundServiceStarted = true;
        } catch (foregroundError) {
          console.error('Foreground service error:', foregroundError);
          throw new Error('Failed to start foreground service');
        }

        // Update Redux state
        try {
          dispatch(setOnline());
        } catch (reduxError) {
          console.error('Redux update error:', reduxError);
        }

        // Emit socket events: join driver pool + status change
        try {
          SocketService.emitStatusChange(true, true);
        } catch (socketError) {
          console.error('Socket status emit error:', socketError);
        }

        // Update server status
        let serverResult;
        try {
          serverResult = await driverApi.updateOnlineStatus(true);
        } catch (serverError) {
          console.error('Server status update error:', serverError);
          throw new Error('Failed to update server status');
        }

        // Update notification service
        try {
          await NotificationService.updateOnlineStatus(true);
        } catch (notificationError) {
          console.error(
            'Notification service update error:',
            notificationError,
          );
        }

        // Check for nearby orders
        if (serverResult?.nearbyOrder) {
          setNotificationData(serverResult?.nearbyOrder);
          console.log("log log data", serverResult?.nearbyOrder);

          setOrderComing(true);
        }
      } else {
        // ========== GOING OFFLINE ==========
        // Check if there's an active order
        const activeOrder = await getActiveOrder();
        if (activeOrder) {
          setToggleBusy(false);
          Alert.alert(
            'Order in Progress',
            'You cannot go offline while an order is active. Please complete or cancel the current order.',
            [{ text: 'OK' }],
          );
          return;
        }

        // Stop location tracking
        try {
          await LocationService.stop();
        } catch (locationError) {
          console.error('Location service stop error:', locationError);
        }

        // Stop foreground service
        try {
          await stopService();
        } catch (foregroundError) {
          console.error('Foreground service stop error:', foregroundError);
        }

        // Update Redux state
        try {
          dispatch(setOffline());
        } catch (reduxError) {
          console.error('Redux update error:', reduxError);
        }

        // Emit socket event: driver going offline
        try {
          SocketService.emitStatusChange(false, false);
        } catch (socketError) {
          console.error('Socket offline emit error:', socketError);
        }

        // Update server status
        try {
          await driverApi.updateOnlineStatus(false);
        } catch (serverError) {
          console.error('Server status update error:', serverError);
          throw new Error('Failed to update server status to offline');
        }

        // Update notification service
        try {
          await NotificationService.updateOnlineStatus(false);
        } catch (notificationError) {
          console.error(
            'Notification service update error:',
            notificationError,
          );
        }

        // Clear any pending orders
        try {
          await clearActiveOrder();
          SocketService.clearActiveRide();
          setOrderComing(false);
          setNotificationData(null);

        } catch (clearError) {
          console.error('Clear orders error:', clearError);
        }
      }

      setStatusModalVisible(true);
    } catch (error) {
      console.error('Toggle online error:', error);

      let errorMessage = 'Failed to update status. Please try again.';
      if (error.message.includes('location')) {
        errorMessage =
          'Unable to access location. Please check location permissions.';
      } else if (error.message.includes('server')) {
        errorMessage = 'Network error. Please check your internet connection.';
      } else if (error.message.includes('foreground')) {
        errorMessage =
          'Unable to start background service. Please restart the app.';
      }

      Alert.alert('Status Update Failed', errorMessage, [{ text: 'OK' }]);

      // ROLLBACK CHANGES on failure
      try {
        if (nextStatus) {

          if (locationServiceStarted) {
            try {
              await LocationService.stop();
            } catch (stopError) {
              console.error('Rollback stop error:', stopError);
            }
          }

          if (foregroundServiceStarted) {
            try {
              await stopService();
            } catch (stopError) {
              console.error('Rollback foreground stop error:', stopError);
            }
          }

          try {
            dispatch(setOffline());
          } catch (reduxError) {
            console.error('Rollback redux error:', reduxError);
          }

          try {
            await NotificationService.updateOnlineStatus(false);
          } catch (notificationError) {
            console.error('Rollback notification error:', notificationError);
          }
        } else {

          try {
            // 
            await LocationService.start();
          } catch (startError) {
            console.error('Rollback start error:', startError);
          }

          try {
            await startService();
          } catch (startError) {
            console.error('Rollback foreground start error:', startError);
          }

          try {
            dispatch(setOnline());
          } catch (reduxError) {
            console.error('Rollback redux error:', reduxError);
          }

          try {
            await NotificationService.updateOnlineStatus(true);
          } catch (notificationError) {
            console.error('Rollback notification error:', notificationError);
          }
        }
      } catch (rollbackError) {
        console.error('Critical rollback error:', rollbackError);
      }
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
    // 
    try {
      // Step 3.2: Accept via HTTP API
      const accepted = await driverApi.acceptOrder(order?.rideId);
      console.log("dbxs csjkc ", accepted);

      const finalOrder =
        accepted && accepted.rideId
          ? accepted
          : { ...order, ...(accepted || {}) };

      await setActiveOrder(finalOrder);

      // Step 3.2: Join Socket Tracking after accept
      const rideId = finalOrder.rideId || finalOrder.id;
      SocketService.setActiveRide(rideId);
      // Explicitly emit driver:join-tracking (spec step 3.2)
      SocketService.joinRideTracking(rideId).catch(err =>
        console.error('joinRideTracking error:', err),
      );

      // Mark driver as unavailable (on a ride now)
      SocketService.emitStatusChange(true, false);

      await addNotification({
        title: 'Order Accepted',
        body: `You accepted order ${order?.rideId}`,
        type: 'order',
        data: finalOrder,
      });

      await updateService('on_trip', {
        orderId: order?.rideId || order?.id,
        pickup: order?.pickupAddress,
        drop: order?.dropAddress,
      });

      setOrderComing(false);
      setNotificationData(null);
      navigation.navigate('Map', { order: finalOrder });
    } catch (error) {
      Alert.alert('Accept failed', driverApi.safeErrorMessage(error));
    }
  };

  const handleOrderReject = async order => {
    try {
      await driverApi.rejectOrder(order.id);
    } catch { }

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
                style={[styles.headerIconButton, styles.notificationBtn]}
                onPress={handleOpenNotifications}
              >
                <Ionicons
                  name="notifications"
                  size={22}
                  color={theme.colors.ink}
                />
                <View style={styles.notificationDot} />
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
                {isOnline ? (
                  <View style={styles.onlinePillDot} />
                ) : (
                  <View
                    style={[
                      styles.onlinePillDot,
                      { backgroundColor: '#9ca3af' },
                    ]}
                  />
                )}
              </View>
              <View style={styles.profileTextCol}>
                <Text style={styles.name} numberOfLines={1}>
                  {displayName}
                </Text>
                <Text>
                  {profile?.vehicleType || 'Vehicle'} •{' '}
                  {profile?.vehicleNumber || '--'}
                </Text>
                <View style={styles.statusPillRow}>
                  <View
                    style={[
                      styles.statusPill,
                      isOnline ? styles.pillOnline : styles.pillOffline,
                    ]}
                  >
                    <Text style={styles.statusPillText}>
                      {isOnline ? t('online') : t('offline')}
                    </Text>
                  </View>
                  {profile?.rating == null && (
                    <View style={styles.ratingPill}>
                      <Text style={styles.ratingText}>★ 4.5</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.colors.muted}
            />
          </TouchableOpacity>
        </View>

        {/* Location Service Health Warning */}
        {/* {isOnline && !locationServiceHealthy && (
          <View
            style={[
              styles.warningBanner,
              {
                backgroundColor: '#FEE2E2',
                marginHorizontal: 16,
                marginBottom: 12,
              },
            ]}
          >
            <Ionicons name="warning" size={18} color="#DC2626" />
            <Text style={[styles.warningText, { color: '#DC2626' }]}>
              Location service issue. Tap to retry.
            </Text>
            <TouchableOpacity onPress={() => handleToggleOnline()}>
              <Text
                style={{ color: '#DC2626', fontWeight: 'bold', marginLeft: 8 }}
              >
                Fix
              </Text>
            </TouchableOpacity>
          </View>
        )} */}

        <View style={styles.walletSection}>
          <View style={styles.walletCardOuter}>
            <View style={styles.walletBalanceRow}>
              <View>
                <Text style={styles.ledgerLabel}>Total Balance</Text>
                <Text style={styles.ledgerAmount}>
                  ₹ {walletBalance.toFixed(2)}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.earningsLink}
                onPress={handleOpenEarnings}
              >
                <Text style={styles.earningsLinkText}>View Earnings</Text>
                <Ionicons
                  name="arrow-forward"
                  size={16}
                  color={theme.colors.primary}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.walletDivider} />

            <View style={styles.walletActionRow}>
              <TouchableOpacity
                style={styles.walletActionBtn}
                onPress={() => setModalVisible(true)}
              >
                <Ionicons
                  name="add-circle-outline"
                  size={20}
                  color={theme.colors.ink}
                />
                <Text style={styles.walletActionText}>Recharge</Text>
              </TouchableOpacity>
              <View style={styles.walletActionDivider} />
              <TouchableOpacity
                style={styles.walletActionBtn}
                onPress={handleOpenHistory}
              >
                <Ionicons
                  name="time-outline"
                  size={20}
                  color={theme.colors.ink}
                />
                <Text style={styles.walletActionText}>History</Text>
              </TouchableOpacity>
            </View>
          </View>

          {isBalanceLow && (
            <View style={styles.warningBanner}>
              <Ionicons name="warning" size={18} color="#92400E" />
              <Text style={styles.warningText}>
                Low balance! Online status might be restricted soon.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.goOnlineWrap}>
          <Text style={styles.goOnlineHint} numberOfLines={2}>
            {isOnline
              ? 'You are online. You will receive new orders.'
              : 'Go online to start receiving new orders.'}
          </Text>
          <SwipeToggle
            isOnline={isOnline}
            onToggle={handleToggleOnline}
            disabled={toggleBusy}
          />
        </View>

        {/* Offer Card Section */}
        <View style={styles.offerCard}>
          <LinearGradient
            colors={['#f1cb40', '#f1da7a', '#f7ebaa']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.offerGradient}
          >
            <View style={styles.offerContent}>
              <View style={styles.offerLeft}>
                <View style={styles.offerIconContainer}>
                  <Ionicons name="gift-outline" size={28} color="#000" />
                </View>
                <View style={styles.offerTextContainer}>
                  <Text style={styles.offerTitle}>Special Offer!</Text>
                  <Text style={styles.offerDescription}>
                    Complete 10 rides this week and get ₹500 bonus
                  </Text>
                </View>
              </View>
              <View style={styles.offerRight}>
                <View style={styles.offerProgress}>
                  <Text style={styles.offerProgressText}>3/10</Text>
                  <View style={styles.progressBarContainer}>
                    <View style={[styles.progressBar, { width: '30%' }]} />
                  </View>
                </View>
                <TouchableOpacity style={styles.offerButton}>
                  <Text style={styles.offerButtonText}>View Details</Text>
                  <Ionicons name="arrow-forward" size={16} color="#000" />
                </TouchableOpacity>
              </View>
            </View>
          </LinearGradient>
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
  goAreaContainer: {
    backgroundColor: '#fff',
    marginHorizontal: moderateScale(18),
    padding: moderateScale(15),
    borderRadius: theme.radii.lg,
    marginBottom: moderateScale(15),
    ...theme.shadow.card,
  },
  goAreaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: moderateScale(10),
  },
  goAreaTextWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  goAreaTitle: {
    fontSize: moderateScale(14),
    fontWeight: '800',
    color: theme.colors.ink,
  },
  goAreaSub: {
    fontSize: moderateScale(12),
    color: theme.colors.muted,
  },
  changeAreaText: {
    color: theme.colors.primary,
    fontWeight: '700',
    fontSize: moderateScale(12),
    textDecorationLine: 'underline',
  },
  switchContainer: {
    width: moderateScale(40),
    height: moderateScale(22),
    borderRadius: moderateScale(11),
    padding: moderateScale(2),
  },
  switchCircle: {
    width: moderateScale(18),
    height: moderateScale(18),
    borderRadius: moderateScale(9),
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  modalSub: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  areaItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  areaItemText: {
    fontSize: 16,
    color: '#333',
  },
  closeBtn: {
    marginTop: 20,
    paddingVertical: 15,
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 16,
    color: theme.colors.danger,
    fontWeight: '600',
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
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: theme.radii.pill,
    paddingVertical: moderateScale(6),
  },
  statusPillText: {
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
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: moderateScale(10),
  },
  notificationBtn: {
    paddingHorizontal: 0,
  },
  notificationDot: {
    position: 'absolute',
    top: moderateScale(10),
    right: moderateScale(10),
    width: moderateScale(8),
    height: moderateScale(8),
    borderRadius: 4,
    backgroundColor: theme.colors.danger,
    borderWidth: 1.5,
    borderColor: '#fff',
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
  onlinePillDot: {
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
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(158, 136, 11, 0.12)',
    borderRadius: theme.radii.pill,
    paddingHorizontal: moderateScale(8),
    marginLeft: moderateScale(8),
  },
  ratingText: {
    fontSize: moderateScale(10),
    fontWeight: '800',
    color: theme.colors.ink,
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
    paddingHorizontal: moderateScale(15),
  },

  walletCardOuter: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.xl,
    padding: moderateScale(18),
    ...theme.shadow.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  walletBalanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  earningsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primarySoft,
    paddingHorizontal: moderateScale(10),
    paddingVertical: moderateScale(6),
    borderRadius: theme.radii.pill,
  },
  earningsLinkText: {
    fontSize: moderateScale(11),
    fontWeight: '800',
    color: theme.colors.ink,
    marginRight: 4,
  },
  walletDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: moderateScale(16),
  },
  walletActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  walletActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletActionText: {
    fontSize: moderateScale(13),
    fontWeight: '800',
    color: theme.colors.ink,
    marginLeft: 8,
  },
  walletActionDivider: {
    width: 1,
    height: 20,
    backgroundColor: theme.colors.border,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: moderateScale(12),
    borderRadius: theme.radii.lg,
    marginTop: moderateScale(10),
  },
  warningText: {
    fontSize: moderateScale(11),
    fontWeight: '700',
    color: '#92400E',
    marginLeft: 8,
    flex: 1,
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
  offerCard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 16,
    overflow: 'hidden',
    ...theme.shadow.card,
  },
  offerGradient: {
    padding: 16,
  },
  offerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  offerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  offerIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  offerTextContainer: {
    flex: 1,
  },
  offerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  offerDescription: {
    fontSize: 12,
    color: '#333',
    opacity: 0.8,
    lineHeight: 16,
  },
  offerRight: {
    alignItems: 'flex-end',
  },
  offerProgress: {
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  offerProgressText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  progressBarContainer: {
    width: 80,
    height: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#000',
    borderRadius: 2,
  },
  offerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  offerButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
  },
});
