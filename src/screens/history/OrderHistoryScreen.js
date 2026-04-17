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
              <View style={styles.idCol}>
                 <Text style={styles.orderIdLabel}>Order ID</Text>
                 <Text style={styles.orderId}>{item.id}</Text>
              </View>
              <Text style={styles.amount}>₹{Number(item.amount || 0).toLocaleString('en-IN')}</Text>
            </View>
            
            <View style={styles.routeContainer}>
               <View style={styles.routeLine}>
                  <View style={[styles.dot, { backgroundColor: '#10B981' }]} />
                  <View style={styles.line} />
                  <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
               </View>
               <View style={styles.addressCol}>
                  <View style={styles.addressBlock}>
                     <Text style={styles.addressLabel}>PICKUP</Text>
                     <Text style={styles.addressText} numberOfLines={1}>{item.pickupAddress || '--'}</Text>
                  </View>
                  <View style={styles.addressBlock}>
                     <Text style={styles.addressLabel}>DROP</Text>
                     <Text style={styles.addressText} numberOfLines={1}>{item.dropAddress || '--'}</Text>
                  </View>
               </View>
            </View>

            <View style={styles.cardFooter}>
               <Text style={styles.timeText}>{formatTime(item.completedAt)}</Text>
               <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>Completed</Text>
               </View>
            </View>
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
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    marginLeft: 14,
    color: '#1a1c1e',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 100,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    ...theme.shadow.card,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  idCol: {
    flex: 1,
  },
  orderIdLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  orderId: {
    fontSize: 15,
    fontWeight: '900',
    color: '#1E293B',
    marginTop: 2,
  },
  amount: {
    fontSize: 22,
    color: '#0F172A',
    fontWeight: '900',
  },
  routeContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  routeLine: {
    alignItems: 'center',
    marginRight: 12,
    paddingTop: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 4,
  },
  addressCol: {
    flex: 1,
  },
  addressBlock: {
    marginBottom: 12,
  },
  addressLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    marginBottom: 2,
  },
  addressText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  timeText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
  },
  statusBadge: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
});
