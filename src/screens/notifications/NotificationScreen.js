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
import {
  getNotifications,
  markAllNotificationsRead,
  setNotifications as setNotificationsStorage,
} from '../../services/localDriverData';
import { driverApi } from '../../services/driverApi';
import { theme } from '../../theme';

const normalizeNotification = (item = {}) => {
  const data = item.data || item.payload || {};
  return {
    ...item,
    id: item.id || item._id || item.notificationId || `${Date.now()}`,
    title: item.title || item.heading || data.title || 'Notification',
    body: item.body || item.message || data.body || '',
    read: Boolean(item.read ?? item.isRead ?? false),
    createdAt: item.createdAt || item.timestamp || item.sentAt || new Date().toISOString(),
    data,
  };
};

const NotificationScreen = ({ navigation }) => {
  const [notifications, setNotificationsState] = useState([]);

  const loadNotifications = useCallback(async () => {
    try {
      const remote = await driverApi.getNotifications();
      if (Array.isArray(remote)) {
        const normalized = remote.map(normalizeNotification);
        await setNotificationsStorage(normalized);
        setNotificationsState(normalized);
        return;
      }
    } catch {}

    const data = await getNotifications();
    setNotificationsState((Array.isArray(data) ? data : []).map(normalizeNotification));
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [loadNotifications]),
  );

  const handleMarkAllRead = async () => {
    try {
      await driverApi.markAllNotificationsRead();
    } catch {}
    const updated = await markAllNotificationsRead();
    setNotificationsState(updated);
  };

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor={theme.colors.primary} barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity onPress={handleMarkAllRead}>
          <Text style={styles.markAll}>Mark all read</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item, index) => String(item?.id || item?._id || item?.createdAt || index)}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No notifications yet.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, !item.read && styles.unreadCard]}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{item.title}</Text>
              {!item.read ? <View style={styles.dot} /> : null}
            </View>
            <Text style={styles.body}>{item.body}</Text>
            <Text style={styles.timeText}>
              {new Date(item.createdAt).toLocaleString()}
            </Text>
          </View>
        )}
      />
    </View>
  );
};

export default NotificationScreen;

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
  markAll: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '600',
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
    marginBottom: 10,
    ...theme.shadow.card,
  },
  unreadCard: {
    borderWidth: 1,
    borderColor: theme.colors.primaryBorder,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  body: {
    color: '#374151',
    fontSize: 13,
    marginBottom: 6,
  },
  timeText: {
    color: '#6B7280',
    fontSize: 11,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F59E0B',
  },
});
