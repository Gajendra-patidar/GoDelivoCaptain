
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
  StatusBar,
} from 'react-native';
import {
  NavigationView,
  useNavigation,
  TravelMode,
  AlternateRoutingStrategy,
  RoutingStrategy,
} from '@googlemaps/react-native-navigation-sdk';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { moderateScale } from 'react-native-size-matters';
import { theme } from '../../theme';
import { driverApi } from '../../services/driverApi';
import SocketService from '../../services/socketService';
import LocationService from '../../services/locationService';
import {
  completeOrder,
  addNotification,
  clearActiveOrder,
} from '../../services/localDriverData';
import { updateService, updateServiceBody } from '../../services/foregroundService';
import toast from '../../utils/toast';

// ─────────────────────────────────────────────────────────────
// Inner component that uses the useNavigation hook
// ─────────────────────────────────────────────────────────────
function NavigationContent({ route, navigation }) {
  const { navigationController } = useNavigation();

  const {
    order,
    drop,
    pickup,
    pickupAddress,
    dropAddress,
    rideAmount,
    initialStage, // 'GOING_TO_DROP' or 'GOING_TO_PICKUP'
  } = route.params || {};

  const navViewControllerRef = useRef(null);
  const mapViewControllerRef = useRef(null);
  const isNavigating = useRef(false);
  const locationUnsubscribe = useRef(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isAtDrop, setIsAtDrop] = useState(false);
  const [distance, setDistance] = useState(null);
  const [duration, setDuration] = useState(null);
  const [showCashModal, setShowCashModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod] = useState(
    (order?.paymentMode || order?.payment_mode || 'cash').toLowerCase()
  );

  // ── Start Navigation ──────────────────────────────────────────
  const startNavigation = useCallback(async (destination) => {
    if (isNavigating.current) return;



    // Guard: Navigation SDK not ready yet
    if (!navigationController) {
      console.warn('[NavigationScreen] navigationController is null, skipping init');
      setIsLoading(false);
      toast.warn('Navigation is initializing. Please wait a moment and try again.');
      return;
    }

    isNavigating.current = true;

    try {
      // 1. Initialize the navigation controller
      await navigationController.init();

      // 2. Enable audio voice guidance
      await navigationController.setAudioGuidanceType({
        isBluetoothAudioEnabled: false,
        isVibrationEnabled: true,
      });

      // 3. Set travel mode to TWO_WHEELER for bike drivers
      const waypoints = [
        {
          position: {
            lat: destination.latitude,
            lng: destination.longitude,
          },
        },
      ];

      // 4. Set the destination and start guidance
      await navigationController.setDestinations([waypoints], {
        routingOptions: {
          travelMode: TravelMode.TWO_WHEELER,
          routingStrategy: RoutingStrategy.DEFAULT_BEST,
          alternateRoutesStrategy: AlternateRoutingStrategy.SHOW_ONE,
          avoidTolls: false,
          avoidHighways: false,
        },
        displayOptions: {
          showDestinationMarkers: true,
          showStopSigns: true,
          showTrafficLights: true,
        },
      });

      await navigationController.startGuidance();

      // 5. Set camera to navigation tilt
      if (navViewControllerRef.current) {
        try {
          await navViewControllerRef.current.setNightMode(0); // AUTO
        } catch (_) { }
      }

      setIsLoading(false);
    } catch (error) {
      console.error('[NavigationScreen] startNavigation error:', error);
      isNavigating.current = false; // allow retry
      setIsLoading(false);
      // Fallback: use external maps
      toast.warn('Navigation could not start. Using default map view.');
    }
  }, [navigationController]);

  const onNavigationViewControllerCreated = useCallback(async (controller) => {
    navViewControllerRef.current = controller;
    if (drop) {
      await startNavigation(drop);
    }
  }, [drop, startNavigation]);

  // ── Ride Verification & Socket Listeners ──────────────────────
  useEffect(() => {
    const rideId = order?.rideId || order?.id;
    if (!rideId) return;

    const verifyStatus = async () => {
      try {
        const currentRide = await driverApi.getRideStatus(rideId);
        if (currentRide && (currentRide.status === 'cancelled' || currentRide.status === 'completed')) {
          toast.info(`Ride was ${currentRide.status}.`);
          await clearActiveOrder();
          navigation.navigate('Home');
        }
      } catch (error) {
        if (error?.response?.status === 404) {
          await clearActiveOrder();
          navigation.navigate('Home');
        }
      }
    };
    verifyStatus();

    const handleRideCancelled = async (data) => {
      if (data?.rideId === rideId || data?.id === rideId) {
        toast.info('Ride cancelled by admin/customer.');
        await clearActiveOrder();
        navigation.navigate('Home');
      }
    };

    SocketService.on('ride:cancelled', handleRideCancelled);
    SocketService.on('ride_cancelled', handleRideCancelled);

    return () => {
      SocketService.off('ride:cancelled', handleRideCancelled);
      SocketService.off('ride_cancelled', handleRideCancelled);
    };
  }, [order?.rideId, order?.id, navigation]);


  const onMapViewControllerCreated = useCallback((controller) => {
    mapViewControllerRef.current = controller;
  }, []);

  // ── Location listener to detect arrival ──────────────────────
  useEffect(() => {
    locationUnsubscribe.current = LocationService.subscribe((coords) => {
      if (!coords || !drop) return;

      // Simple distance check using Haversine
      const R = 6371e3;
      const φ1 = (coords.latitude * Math.PI) / 180;
      const φ2 = (drop.latitude * Math.PI) / 180;
      const Δφ = ((drop.latitude - coords.latitude) * Math.PI) / 180;
      const Δλ = ((drop.longitude - coords.longitude) * Math.PI) / 180;
      const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const distMeters = 6371e3 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      setIsAtDrop(distMeters <= 80);
    });

    return () => {
      if (locationUnsubscribe.current) {
        locationUnsubscribe.current();
      }
    };
  }, [drop]);

  // ── Navigation arrive event ───────────────────────────────────
  useEffect(() => {
    const unsubArrival = navigationController.addOnArrivalListener?.(() => {
      setIsAtDrop(true);
    });

    const unsubNavInfo = navigationController.addOnNavInfoChangedListener?.(
      (navInfo) => {
        if (navInfo?.distanceToCurrentStepMeters != null) {
          const remainingM = navInfo.distanceToCurrentStepMeters;
          setDistance((remainingM / 1000).toFixed(1));
        }
        if (navInfo?.timeToCurrentStepSeconds != null) {
          setDuration(Math.ceil(navInfo.timeToCurrentStepSeconds / 60));
        }
      }
    );

    return () => {
      unsubArrival?.();
      unsubNavInfo?.();
    };
  }, [navigationController]);

  // ── Stop navigation on unmount ────────────────────────────────
  useEffect(() => {
    return () => {
      try {
        navigationController.stopGuidance?.();
        navigationController.cleanup?.();
      } catch (_) { }
    };
  }, [navigationController]);

  // ── Complete Delivery ─────────────────────────────────────────
  const handleCompleteDelivery = useCallback(async () => {
    if (!['online', 'wallet'].includes(paymentMethod)) {
      setShowCashModal(true);
      return;
    }
    // Auto-complete for online payment
    await completeTripNow(order?.amount || 0, paymentMethod);
  }, [paymentMethod, order]);

  const completeTripNow = useCallback(async (amount, method) => {
    setIsProcessing(true);
    try {
      const rideId = order?.rideId || order?.id;

      // Stop navigation
      try {
        await navigationController.stopGuidance();
      } catch (_) { }

      // Notify backend
      let serverCompleted = null;
      try {
        serverCompleted = await driverApi.completeRide(rideId, amount, method);
      } catch (_) {
        try {
          serverCompleted = await driverApi.completeOrder(order?.id);
        } catch (__) { }
      }

      // Emit socket
      SocketService.emitRideCompleted(rideId, amount, method);
      SocketService.clearActiveRide();

      const completedOrder = await completeOrder({
        ...order,
        ...(serverCompleted || {}),
        drop,
        pickup,
        pickupAddress,
        dropAddress,
        amount,
        paymentMethod: method,
        completedAt: new Date().toISOString(),
      });

      await addNotification({
        title: 'Delivery Completed',
        body: `Order completed. ₹${amount} collected via ${method}.`,
        type: 'order',
        data: completedOrder,
      });

      await updateService('online');
      LocationService.stopTracking?.();

      setShowCashModal(false);

      Alert.alert(
        'Delivery Complete! 🎉',
        method === 'cash'
          ? `Order delivered. ₹${amount} collected.\nYour earnings: ₹${(amount * 0.8).toFixed(2)}`
          : `Payment received online. ₹${(amount * 0.8).toFixed(2)} credited to wallet.`,
        [{ text: 'Go Home', onPress: () => navigation.navigate('MyTabs') }]
      );
    } catch (error) {
      console.error('[NavigationScreen] completeTripNow error:', error);
      toast.error('Failed to complete delivery. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [order, navigationController, navigation, drop, pickup, pickupAddress, dropAddress]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Loading overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Starting Navigation...</Text>
        </View>
      )}

      {/* Full-screen NavigationView from Google Nav SDK */}
      <NavigationView
        style={styles.navView}
        onNavigationViewControllerCreated={onNavigationViewControllerCreated}
        onMapViewControllerCreated={onMapViewControllerCreated}
        androidStylingOptions={{
          primaryDayModeThemeColor: '#004D40',
          secondaryDayModeThemeColor: '#1B5E20',
        }}
      />

      {/* Top info banner */}
      <View style={styles.topBanner}>
        <View style={styles.topBannerRow}>
          <View style={styles.topBannerIcon}>
            <Ionicons name="navigate" size={18} color="#FFFFFF" />
          </View>
          <Text style={styles.topBannerText} numberOfLines={1}>
            Heading to{' '}
            <Text style={styles.topBannerBold}>
              {dropAddress?.split(',')[0] || 'Destination'}
            </Text>
          </Text>
        </View>
      </View>

      {/* Bottom action card */}
      <View style={styles.bottomCard}>
        {/* Info row */}
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>DISTANCE</Text>
            <Text style={styles.infoValue}>
              {distance != null ? `${distance} km` : '--'}
            </Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>ETA</Text>
            <Text style={styles.infoValue}>
              {duration != null ? `${duration} min` : '--'}
            </Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>AMOUNT</Text>
            <Text style={[styles.infoValue, { color: theme.colors.success }]}>
              ₹{rideAmount || order?.amount || 0}
            </Text>
          </View>
        </View>

        {/* Address row */}
        <View style={styles.addressRow}>
          <View style={styles.addressDot} />
          <View style={styles.addressTextWrap}>
            <Text style={styles.addressLabel}>DROP AT</Text>
            <Text style={styles.addressText} numberOfLines={2}>
              {dropAddress || 'Destination'}
            </Text>
          </View>
        </View>

        {/* Action button */}
        {isAtDrop ? (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={handleCompleteDelivery}
            activeOpacity={0.85}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.actionBtnText}>COMPLETE ORDER</Text>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.disabledMsg}>
            <Text style={styles.disabledMsgText}>
              Reach drop location to complete order
            </Text>
          </View>
        )}
      </View>

      {/* Cash Collection Modal */}
      <Modal
        visible={showCashModal}
        transparent
        animationType="slide"
        onRequestClose={() => !isProcessing && setShowCashModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Payment Collection</Text>
              <TouchableOpacity onPress={() => !isProcessing && setShowCashModal(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.amountBox}>
              <Text style={styles.amountLabel}>Amount to Collect</Text>
              <Text style={styles.amountValue}>
                ₹{rideAmount || order?.amount || 0}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.collectBtn, isProcessing && { opacity: 0.6 }]}
              onPress={() => completeTripNow(rideAmount || order?.amount || 0, 'cash')}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.collectBtnText}>Cash Collected ✓</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Wrapper with NavigationProvider
// ─────────────────────────────────────────────────────────────
export default function NavigationScreen(props) {
  return <NavigationContent {...props} />;
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#4c83bbff',
  },
  navView: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(191, 31, 31, 0.92)',
    zIndex: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 14,
    fontSize: 16,
    color: '#374151',
    fontWeight: '600',
  },

  // Top Banner
  topBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 40,
    left: 14,
    right: 14,
    zIndex: 100,
  },
  topBannerRow: {
    backgroundColor: '#004D40',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  topBannerIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  topBannerText: {
    flex: 1,
    fontSize: 14,
    color: '#E0F2F1',
    fontWeight: '500',
  },
  topBannerBold: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '800',
  },

  // Bottom Card
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: moderateScale(24),
    borderTopRightRadius: moderateScale(24),
    padding: moderateScale(20),
    paddingBottom: Platform.OS === 'ios' ? moderateScale(40) : moderateScale(24),
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: moderateScale(16),
  },
  infoItem: {
    flex: 1,
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: moderateScale(10),
    fontWeight: '800',
    color: '#9CA3AF',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: moderateScale(16),
    fontWeight: '900',
    color: '#111827',
  },
  infoDivider: {
    width: 1,
    height: 22,
    backgroundColor: '#E5E7EB',
  },

  // Address
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: moderateScale(12),
    marginBottom: moderateScale(18),
  },
  addressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.danger,
    marginTop: 3,
    marginRight: 12,
  },
  addressTextWrap: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9CA3AF',
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  addressText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },

  // Action buttons
  actionBtn: {
    backgroundColor: theme.colors.success,
    borderRadius: 12,
    paddingVertical: moderateScale(16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: moderateScale(16),
    letterSpacing: 1,
  },
  disabledMsg: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  disabledMsgText: {
    color: '#9CA3AF',
    fontSize: 13,
    textAlign: 'center',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  closeBtn: {
    fontSize: 22,
    color: '#9CA3AF',
    padding: 4,
  },
  amountBox: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  amountLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 6,
  },
  amountValue: {
    fontSize: 36,
    fontWeight: '900',
    color: '#16A34A',
  },
  collectBtn: {
    backgroundColor: theme.colors.success,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  collectBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
});
