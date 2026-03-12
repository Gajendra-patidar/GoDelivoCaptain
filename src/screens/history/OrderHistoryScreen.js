import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  FlatList,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { getOrderHistory, setOrderHistory } from '../../services/localDriverData';
import { driverApi } from '../../services/driverApi';
import { theme } from '../../theme';
import { SkeletonList } from '../../components/SkeletonLoader';

const normalizeOrder = (item = {}) => {
  const pickupAddress =
    item.pickupAddress ||
    item.pickup_location ||
    item.pickup?.address ||
    item.pickup?.location ||
    '--';
  const dropAddress =
    item.dropAddress ||
    item.drop_location ||
    item.drop?.address ||
    item.drop?.location ||
    '--';

  return {
    ...item,
    id: item.id || item._id || item.orderId || item.tripId || `${Date.now()}`,
    amount:
      Number(item.amount ?? item.fare ?? item.total ?? item.price ?? 0) || 0,
    pickupAddress,
    dropAddress,
    completedAt: item.completedAt || item.deliveredAt || item.updatedAt || item.createdAt,
  };
};

const formatTime = value => {
  if (!value) {
    return '--';
  }
  const date = new Date(value);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
};

const OrderHistoryScreen = ({ navigation }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    try {
      const remote = await driverApi.getOrderHistory();
      if (Array.isArray(remote)) {
        const normalized = remote.map(normalizeOrder);
        await setOrderHistory(normalized);
        setOrders(normalized);
        return;
      }
    } catch {}

    const local = await getOrderHistory();
    setOrders((Array.isArray(local) ? local : []).map(normalizeOrder));
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory]),
  );

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor={theme.colors.primary} barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order History</Text>
      </View>

      {loading ? (
        <SkeletonList count={5} />
      ) : (
      <FlatList
        data={orders}
        keyExtractor={(item, index) =>
          String(item?.id || item?._id || item?.orderId || item?.createdAt || index)
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No completed orders yet.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('TripDetail', { order: item })}
            activeOpacity={0.85}
          >
            <View style={styles.rowTop}>
              <Text style={styles.orderId}>{item.id}</Text>
              <Text style={styles.amount}>Rs {Number(item.amount || 0).toFixed(2)}</Text>
            </View>
            <Text style={styles.address} numberOfLines={1}>
              Pickup: {item.pickupAddress || '--'}
            </Text>
            <Text style={styles.address} numberOfLines={1}>
              Drop: {item.dropAddress || '--'}
            </Text>
            <Text style={styles.timeText}>Delivered: {formatTime(item.completedAt)}</Text>
          </TouchableOpacity>
        )}
      />
      )}
    </View>
  );
};

export default OrderHistoryScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 14,
    color: theme.colors.ink,
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 15,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    ...theme.shadow.card,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  orderId: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  amount: {
    fontSize: 16,
    color: '#0F766E',
    fontWeight: '700',
  },
  address: {
    color: '#374151',
    fontSize: 13,
    marginBottom: 4,
  },
  timeText: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 4,
  },
});
