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
import { getOrderHistory } from '../../services/localDriverData';

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

  const loadHistory = useCallback(async () => {
    const history = await getOrderHistory();
    setOrders(history);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory]),
  );

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#F4C20D" barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order History</Text>
      </View>

      <FlatList
        data={orders}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No completed orders yet.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
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
          </View>
        )}
      />
    </View>
  );
};

export default OrderHistoryScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4C20D',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 14,
    color: '#000',
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
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
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
