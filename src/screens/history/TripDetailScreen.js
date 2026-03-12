import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { theme } from '../../theme';

const formatTime = value => {
  if (!value) return '--';
  const date = new Date(value);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
};

const TripDetailScreen = ({ navigation, route }) => {
  const order = route?.params?.order || {};

  const amount = Number(order.amount || order.fare || 0);
  const pickupAddress = order.pickupAddress || order.pickup?.address || '--';
  const dropAddress = order.dropAddress || order.drop?.address || '--';

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor={theme.colors.primary} barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trip Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Order ID & Status */}
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Order ID</Text>
            <Text style={styles.value}>{order.id || order._id || '--'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Status</Text>
            <View style={[styles.statusBadge, order.status === 'completed' && styles.statusCompleted]}>
              <Text style={styles.statusText}>{(order.status || 'completed').toUpperCase()}</Text>
            </View>
          </View>
        </View>

        {/* Route */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Route</Text>
          <View style={styles.routeRow}>
            <View style={styles.routeDot} />
            <View style={styles.routeTextWrap}>
              <Text style={styles.routeLabel}>Pickup</Text>
              <Text style={styles.routeAddress}>{pickupAddress}</Text>
            </View>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, styles.routeDotDrop]} />
            <View style={styles.routeTextWrap}>
              <Text style={styles.routeLabel}>Drop</Text>
              <Text style={styles.routeAddress}>{dropAddress}</Text>
            </View>
          </View>
        </View>

        {/* Payment */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Payment</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Amount</Text>
            <Text style={styles.amountValue}>Rs {amount.toFixed(2)}</Text>
          </View>
          {order.paymentMethod && (
            <View style={styles.row}>
              <Text style={styles.label}>Method</Text>
              <Text style={styles.value}>{order.paymentMethod}</Text>
            </View>
          )}
          {order.deliveredDistanceKm != null && (
            <View style={styles.row}>
              <Text style={styles.label}>Distance</Text>
              <Text style={styles.value}>{Number(order.deliveredDistanceKm).toFixed(1)} km</Text>
            </View>
          )}
        </View>

        {/* Timeline */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Timeline</Text>
          {order.acceptedAt && (
            <View style={styles.row}>
              <Text style={styles.label}>Accepted</Text>
              <Text style={styles.value}>{formatTime(order.acceptedAt)}</Text>
            </View>
          )}
          {order.pickedUpAt && (
            <View style={styles.row}>
              <Text style={styles.label}>Picked Up</Text>
              <Text style={styles.value}>{formatTime(order.pickedUpAt)}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>Delivered</Text>
            <Text style={styles.value}>
              {formatTime(order.completedAt || order.deliveredAt || order.updatedAt)}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default TripDetailScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.ink,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    ...theme.shadow.card,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.ink,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  label: {
    fontSize: 13,
    color: '#6B7280',
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  amountValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F766E',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
  },
  statusCompleted: {
    backgroundColor: '#D1FAE5',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#111827',
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  routeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.primary,
    marginTop: 4,
    marginRight: 12,
  },
  routeDotDrop: {
    backgroundColor: theme.colors.success,
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: '#D1D5DB',
    marginLeft: 5,
    marginVertical: 2,
  },
  routeTextWrap: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  routeAddress: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    lineHeight: 20,
  },
});
