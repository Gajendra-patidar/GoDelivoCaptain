import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  Animated,
  Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { moderateScale } from 'react-native-size-matters';
import { theme } from '../theme';
import { stopOrderSound } from '../components/playOrderSound';

const { width, height } = Dimensions.get('window');

export const OrderModal = ({
  visible,
  onClose,
  orderData,
  onAccept,
  onReject,
}) => {
  const [timeLeft, setTimeLeft] = useState(5);
  const [isExpired, setIsExpired] = useState(false);
  const progressAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) {
      setTimeLeft(5);
      setIsExpired(false);
      progressAnim.setValue(1);
      return;
    }

    // Progress bar animation
    Animated.timing(progressAnim, {
      toValue: 0,
      duration: 5000,
      useNativeDriver: false,
    }).start();

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [visible, progressAnim]);

  const resetAndClose = () => {
    setTimeLeft(5);
    setIsExpired(false);
    onClose();
  };

  const handleAccept = () => {
    onAccept?.(orderData);
    console.log("modal data", orderData, onAccept?.orderData);

    // resetAndClose();
    stopOrderSound();
  };

  const handleReject = () => {
    onReject?.(orderData);
    resetAndClose();
    stopOrderSound();
  };

  const amount = Number(orderData?.rideDetails?.estimatedFare || 0).toLocaleString('en-IN');
  const pickupDistance = Number(orderData?.rideDetails?.distanceText || 0).toFixed(1);

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={resetAndClose}
    >
      <View style={styles.container}>
        <View style={styles.modalBackdrop} />

        <View style={styles.cardContainer}>
          {isExpired ? (
            <View style={styles.expiredBody}>
              <View style={styles.expiredIconWrap}>
                <Ionicons name="time-outline" size={48} color="#94a3b8" />
              </View>
              <Text style={styles.expiredTitle}>You are let</Text>
              <Text style={styles.expiredText}>This order is no longer available.</Text>
              <TouchableOpacity style={styles.dismissBtn} onPress={resetAndClose}>
                <Text style={styles.dismissBtnText}>BACK TO HOME</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <LinearGradient
                colors={['#1a1c1e', '#2c2f33']}
                style={styles.header}
              >
                <View style={styles.headerTop}>
                  <View style={styles.timerChip}>
                    <Ionicons name="time" size={14} color={theme.colors.primary} />
                    <Text style={styles.timerChipText}>{timeLeft}s</Text>
                  </View>
                  <TouchableOpacity style={styles.closeBtn} onPress={handleReject}>
                    <Ionicons name="close" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>

                <View style={styles.fareContainer}>
                  <Text style={styles.fareSymbol}>₹</Text>
                  <Text style={styles.fareAmount}>{amount}</Text>
                </View>
                <Text style={styles.tripType}>ON-DEMAND TRIP</Text>
              </LinearGradient>

              <View style={styles.progressBarWrap}>
                <Animated.View
                  style={[
                    styles.progressBar,
                    {
                      width: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%']
                      }),
                      backgroundColor: progressAnim.interpolate({
                        inputRange: [0, 0.3, 1],
                        outputRange: ['#ef4444', '#f59e0b', '#10b981']
                      })
                    }
                  ]}
                />
              </View>

              <View style={styles.body}>
                <View style={styles.routeContainer}>
                  <View style={styles.routeLineWrap}>
                    <View style={[styles.dot, { backgroundColor: '#10b981' }]} />
                    <View style={styles.line} />
                    <View style={[styles.dot, { backgroundColor: '#ef4444' }]} />
                  </View>
                  <View style={styles.addressCol}>
                    <View style={styles.addressBlock}>
                      <Text style={styles.addressLabel}>PICKUP • {pickupDistance}km away</Text>
                      <Text style={styles.addressText} numberOfLines={2}>
                        {orderData?.pickupAddress || 'Locating pickup...'}
                      </Text>
                    </View>
                    <View style={[styles.addressBlock, { marginTop: 20 }]}>
                      <Text style={styles.addressLabel}>DROP LOCATION</Text>
                      <Text style={styles.addressText} numberOfLines={2}>
                        {orderData?.dropAddress || 'Locating drop...'}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <View style={styles.infoItem}>
                    <Ionicons name="bicycle" size={18} color={theme.colors.muted} />
                    <Text style={styles.infoValue}>2-Wheeler</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Ionicons name="wallet-outline" size={18} color={theme.colors.muted} />
                    <Text style={styles.infoValue}>Cash Trip</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.acceptBtn}
                  onPress={handleAccept}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#FFD700', '#F4C20D']}
                    style={styles.acceptBtnGradient}
                  >
                    <Text style={styles.acceptBtnText}>ACCEPT ORDER</Text>
                    <Ionicons name="chevron-forward-circle" size={24} color="#000" />
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity style={styles.rejectLink} onPress={handleReject}>
                  <Text style={styles.rejectLinkText}>REJECT ORDER</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  cardContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: moderateScale(28),
    borderTopRightRadius: moderateScale(28),
    overflow: 'hidden',
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  header: {
    padding: moderateScale(24),
    alignItems: 'center',
    paddingTop: moderateScale(15),
  },
  headerTop: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: moderateScale(10),
  },
  timerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(6),
    borderRadius: theme.radii.pill,
  },
  timerChipText: {
    color: theme.colors.primary,
    fontWeight: '900',
    fontSize: moderateScale(13),
    marginLeft: 6,
  },
  closeBtn: {
    padding: 4,
  },
  fareContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: moderateScale(5),
  },
  fareSymbol: {
    color: theme.colors.primary,
    fontSize: moderateScale(24),
    fontWeight: '900',
    marginTop: moderateScale(8),
    marginRight: 4,
  },
  fareAmount: {
    color: '#fff',
    fontSize: moderateScale(60),
    fontWeight: '900',
  },
  tripType: {
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '800',
    fontSize: moderateScale(12),
    letterSpacing: 2,
    marginTop: moderateScale(-5),
  },
  progressBarWrap: {
    height: 4,
    backgroundColor: '#eee',
    width: '100%',
  },
  progressBar: {
    height: '100%',
  },
  body: {
    padding: moderateScale(24),
  },
  routeContainer: {
    flexDirection: 'row',
    marginBottom: moderateScale(20),
  },
  routeLineWrap: {
    alignItems: 'center',
    paddingTop: 8,
    marginRight: moderateScale(15),
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: '#eee',
    marginVertical: 4,
  },
  addressCol: {
    flex: 1,
  },
  addressBlock: {
    flex: 1,
  },
  addressLabel: {
    fontSize: moderateScale(10),
    fontWeight: '800',
    color: theme.colors.muted,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  addressText: {
    fontSize: moderateScale(15),
    fontWeight: '700',
    color: theme.colors.ink,
    lineHeight: moderateScale(20),
  },
  infoRow: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: theme.radii.lg,
    padding: moderateScale(15),
    marginBottom: moderateScale(24),
    justifyContent: 'space-around',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoValue: {
    marginLeft: 8,
    fontSize: moderateScale(13),
    fontWeight: '700',
    color: theme.colors.ink,
  },
  acceptBtn: {
    width: '100%',
    height: moderateScale(64),
    borderRadius: moderateScale(16),
    overflow: 'hidden',
    ...theme.shadow.card,
  },
  acceptBtnGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtnText: {
    fontSize: moderateScale(18),
    fontWeight: '900',
    color: '#000',
    marginRight: 12,
    letterSpacing: 1,
  },
  rejectLink: {
    marginTop: moderateScale(18),
    alignSelf: 'center',
    padding: 10,
  },
  rejectLinkText: {
    fontSize: moderateScale(13),
    fontWeight: '800',
    color: theme.colors.muted,
    textDecorationLine: 'underline',
  },
  expiredBody: {
    padding: moderateScale(40),
    alignItems: 'center',
  },
  expiredIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: moderateScale(20),
  },
  expiredTitle: {
    fontSize: moderateScale(22),
    fontWeight: '900',
    color: theme.colors.ink,
    marginBottom: 8,
  },
  expiredText: {
    fontSize: moderateScale(14),
    color: theme.colors.muted,
    textAlign: 'center',
    marginBottom: moderateScale(30),
  },
  dismissBtn: {
    width: '100%',
    paddingVertical: moderateScale(16),
    backgroundColor: '#f1f5f9',
    borderRadius: theme.radii.md,
    alignItems: 'center',
  },
  dismissBtnText: {
    fontWeight: '800',
    color: theme.colors.ink,
    letterSpacing: 1,
  },
});
