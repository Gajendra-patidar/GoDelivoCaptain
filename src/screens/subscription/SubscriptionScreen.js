import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Image,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { useSelector } from 'react-redux';
import { selectProfile } from '../../store/slices/profileSlice';
import { driverApi } from '../../services/driverApi';
import { theme } from '../../theme';
import toast from '../../utils/toast';

const { width } = Dimensions.get('window');

// Vehicle type normalization
const normalizeVehicleType = (raw) => {
  if (!raw) return null;
  const v = String(raw).toLowerCase().trim();
  if (v.includes('bike') || v.includes('motorcycle') || v.includes('motor')) return 'bike';
  if (v.includes('scooter')) return 'scooter';
  if (v.includes('auto') || v.includes('rickshaw') || v.includes('riksha')) return 'auto';
  if (v.includes('car') || v.includes('sedan') || v.includes('suv')) return 'car';
  if (v.includes('truck') || v.includes('mini')) return 'truck';
  if (v.includes('van')) return 'van';
  return v;
};

const VEHICLE_LABELS = {
  bike: 'Bike / Motorcycle',
  scooter: 'Scooter',
  auto: 'Auto Rickshaw',
  car: 'Car',
  truck: 'Mini Truck',
  van: 'Van',
};

const VEHICLE_ICONS = {
  bike: 'bicycle-outline',
  scooter: 'bicycle-outline',
  auto: 'car-sport-outline',
  car: 'car-outline',
  truck: 'cube-outline',
  van: 'car-outline',
};

const PlanCard = ({ plan, onSubscribe, isPopular }) => {
  const [subscribing, setSubscribing] = useState(false);

  const handlePress = async () => {
    if (subscribing) return;
    setSubscribing(true);
    try {
      await onSubscribe(plan);
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <View style={[styles.planCard, isPopular && styles.popularCard]}>
      {isPopular && (
        <View style={styles.popularBadge}>
          <Ionicons name="star" size={12} color="#000" />
          <Text style={styles.popularBadgeText}>Most Popular</Text>
        </View>
      )}

      <View style={styles.planHeader}>
        <View style={styles.planDurationBadge}>
          <Text style={styles.planDurationText}>{plan.duration || plan.durationDays ? `${plan.durationDays || plan.duration} Days` : 'Monthly'}</Text>
        </View>
        <View style={styles.planPriceCol}>
          <Text style={styles.planPrice}>₹{plan.price ?? plan.amount ?? 0}</Text>
          <Text style={styles.planPriceSub}>one-time</Text>
        </View>
      </View>

      <Text style={styles.planName}>{plan.name || plan.title || 'Subscription Plan'}</Text>

      {(plan.benefits || plan.features || []).length > 0 && (
        <View style={styles.benefitsList}>
          {(plan.benefits || plan.features || []).map((benefit, i) => (
            <View key={i} style={styles.benefitRow}>
              <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
              <Text style={styles.benefitText}>{benefit}</Text>
            </View>
          ))}
        </View>
      )}

      {plan.description ? (
        <Text style={styles.planDescription}>{plan.description}</Text>
      ) : null}

      <TouchableOpacity
        style={[styles.subscribeBtn, isPopular && styles.popularSubscribeBtn]}
        onPress={handlePress}
        disabled={subscribing}
        activeOpacity={0.85}
      >
        {subscribing ? (
          <ActivityIndicator color={isPopular ? '#000' : theme.colors.ink} size="small" />
        ) : (
          <>
            <Text style={[styles.subscribeBtnText, isPopular && styles.popularSubscribeBtnText]}>
              Subscribe Now
            </Text>
            <Ionicons name="arrow-forward" size={16} color={isPopular ? '#000' : theme.colors.ink} />
          </>
        )}
      </TouchableOpacity>
    </View>
  );
};

const SubscriptionScreen = ({ navigation }) => {
  const profile = useSelector(selectProfile);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const vehicleTypeRaw = profile?.vehicleDetails?.type || profile?.vehicleType || null;
  const vehicleType = normalizeVehicleType(vehicleTypeRaw);
  const vehicleLabel = VEHICLE_LABELS[vehicleType] || vehicleTypeRaw || 'All Vehicles';
  const vehicleIcon = VEHICLE_ICONS[vehicleType] || 'car-outline';

  const fetchPlans = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const allPlans = await driverApi.getSubscriptionPlans(vehicleType);
      setPlans(allPlans || []);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to load plans';
      setError(msg);
      console.warn('[SubscriptionScreen] fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [vehicleType]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const handleSubscribe = useCallback(async (plan) => {
    try {
      await driverApi.subscribePlan(plan._id || plan.id);
      toast.success(`You have subscribed to the ${plan.name || 'plan'} successfully!`);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Subscription failed. Please try again.');
    }
  }, []);

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading plans...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centerContainer}>
          <View style={styles.errorIconWrap}>
            <Ionicons name="wifi-outline" size={40} color={theme.colors.muted} />
          </View>
          <Text style={styles.errorTitle}>Couldn't load plans</Text>
          <Text style={styles.errorSubtitle}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchPlans()}>
            <Ionicons name="refresh" size={16} color={theme.colors.ink} />
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (plans.length === 0) {
      return (
        <View style={styles.centerContainer}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="receipt-outline" size={44} color={theme.colors.muted} />
          </View>
          <Text style={styles.emptyTitle}>No Plans Available</Text>
          <Text style={styles.emptySubtitle}>
            {vehicleType
              ? `No subscription plans found for your vehicle type (${vehicleLabel}).`
              : 'No subscription plans are currently available.'}
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchPlans()}>
            <Ionicons name="refresh" size={16} color={theme.colors.ink} />
            <Text style={styles.retryText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return plans.map((plan, idx) => (
      <PlanCard
        key={plan._id || plan.id || idx}
        plan={plan}
        onSubscribe={handleSubscribe}
        isPopular={idx === 0}
      />
    ));
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.primary} />

      {/* Header */}
      <LinearGradient
        colors={[theme.colors.primary, theme.colors.primary + 'DD']}
        style={styles.header}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={theme.colors.ink} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Subscription Plans</Text>
          <Text style={styles.headerSub}>Choose the right plan for you</Text>
        </View>
      </LinearGradient>

      {/* Vehicle type banner */}
      {vehicleType && (
        <View style={styles.vehicleBanner}>
          <View style={styles.vehicleIconWrap}>
            <Ionicons name={vehicleIcon} size={20} color={theme.colors.primary} />
          </View>
          <View style={styles.vehicleTextCol}>
            <Text style={styles.vehicleBannerLabel}>Showing plans for</Text>
            <Text style={styles.vehicleBannerValue}>{vehicleLabel}</Text>
          </View>
          <View style={styles.vehicleFilterBadge}>
            <Ionicons name="filter" size={14} color={theme.colors.ink} />
            <Text style={styles.vehicleFilterText}>Filtered</Text>
          </View>
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchPlans(true)}
            colors={[theme.colors.primary]}
          />
        }
      >
        {renderContent()}
      </ScrollView>
    </View>
  );
};

export default SubscriptionScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: theme.colors.ink,
  },
  headerSub: {
    fontSize: 13,
    color: theme.colors.ink,
    opacity: 0.7,
    marginTop: 2,
  },
  vehicleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.primaryBorder,
    ...theme.shadow.card,
  },
  vehicleIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  vehicleTextCol: {
    flex: 1,
  },
  vehicleBannerLabel: {
    fontSize: 11,
    color: theme.colors.muted,
    fontWeight: '600',
  },
  vehicleBannerValue: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.ink,
    marginTop: 1,
  },
  vehicleFilterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 4,
  },
  vehicleFilterText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.ink,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 40,
  },
  planCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  popularCard: {
    borderColor: theme.colors.primary,
    borderWidth: 2,
  },
  popularBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 12,
    gap: 4,
  },
  popularBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  planDurationBadge: {
    backgroundColor: theme.colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  planDurationText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.ink,
  },
  planPriceCol: {
    alignItems: 'flex-end',
  },
  planPrice: {
    fontSize: 28,
    fontWeight: '900',
    color: theme.colors.ink,
    lineHeight: 30,
  },
  planPriceSub: {
    fontSize: 11,
    color: theme.colors.muted,
    fontWeight: '600',
  },
  planName: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.ink,
    marginBottom: 12,
  },
  benefitsList: {
    marginBottom: 14,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  benefitText: {
    fontSize: 13,
    color: theme.colors.ink,
    fontWeight: '500',
    flex: 1,
  },
  planDescription: {
    fontSize: 12,
    color: theme.colors.muted,
    lineHeight: 18,
    marginBottom: 14,
  },
  subscribeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.ink,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  popularSubscribeBtn: {
    backgroundColor: theme.colors.primary,
  },
  subscribeBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.surface,
  },
  popularSubscribeBtnText: {
    color: '#000',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: theme.colors.muted,
    fontWeight: '600',
  },
  errorIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.ink,
    marginBottom: 6,
  },
  errorSubtitle: {
    fontSize: 13,
    color: theme.colors.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.ink,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.ink,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: theme.colors.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
});
