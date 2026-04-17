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
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1e293b',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    ...theme.shadow.card,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94A3B8',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  label: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  value: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
  },
  amountValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  statusCompleted: {
    backgroundColor: '#DCFCE7',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#166534',
    letterSpacing: 0.5,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    marginTop: 6,
    marginRight: 16,
  },
  routeDotDrop: {
    backgroundColor: '#EF4444',
  },
  routeLine: {
    width: 2,
    height: 24,
    backgroundColor: '#F1F5F9',
    marginLeft: 4,
    marginVertical: 4,
  },
  routeTextWrap: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  routeAddress: {
    fontSize: 15,
    color: '#1E293B',
    fontWeight: '700',
    lineHeight: 22,
  },
});
