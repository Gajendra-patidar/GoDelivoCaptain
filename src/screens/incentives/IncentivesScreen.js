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
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { driverApi } from '../../services/driverApi';
import { theme } from '../../theme';

const IncentivesScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [incentives, setIncentives] = useState(null);

  const fetchIncentives = useCallback(async () => {
    try {
      const data = await driverApi.getIncentives();
      setIncentives(data);
    } catch (e) {
      console.log('Incentives fetch error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchIncentives();
  }, [fetchIncentives]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchIncentives();
  };

  const targets = incentives?.targets || [
    { id: 1, title: 'Complete 10 orders', reward: 'Rs 100 bonus', progress: 0, goal: 10 },
    { id: 2, title: 'Complete 25 orders', reward: 'Rs 300 bonus', progress: 0, goal: 25 },
    { id: 3, title: 'Complete 50 orders', reward: 'Rs 750 bonus', progress: 0, goal: 50 },
  ];

  const weeklyEarned = incentives?.weeklyEarned || 0;

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor={theme.colors.primary} barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Incentives</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Summary */}
          <View style={styles.summaryCard}>
            <Ionicons name="trophy" size={32} color="#F59E0B" />
            <View style={styles.summaryText}>
              <Text style={styles.summaryLabel}>This Week's Bonus</Text>
              <Text style={styles.summaryAmount}>Rs {Number(weeklyEarned).toFixed(2)}</Text>
            </View>
          </View>

          {/* Targets */}
          <Text style={styles.sectionTitle}>Weekly Targets</Text>

          {targets.map(target => {
            const pct = target.goal > 0 ? Math.min((target.progress / target.goal) * 100, 100) : 0;
            const done = pct >= 100;

            return (
              <View key={target.id} style={styles.targetCard}>
                <View style={styles.targetTop}>
                  <View style={styles.targetInfo}>
                    <Ionicons
                      name={done ? 'checkmark-circle' : 'flag-outline'}
                      size={20}
                      color={done ? '#10B981' : '#6B7280'}
                    />
                    <Text style={styles.targetTitle}>{target.title}</Text>
                  </View>
                  <Text style={[styles.targetReward, done && styles.targetRewardDone]}>
                    {target.reward}
                  </Text>
                </View>
                <View style={styles.progressBg}>
                  <View style={[styles.progressFill, { width: `${pct}%` }, done && styles.progressDone]} />
                </View>
                <Text style={styles.progressLabel}>
                  {target.progress}/{target.goal} orders
                </Text>
              </View>
            );
          })}

          {/* Tips */}
          <View style={styles.tipsCard}>
            <Ionicons name="bulb-outline" size={22} color="#F59E0B" />
            <View style={styles.tipsText}>
              <Text style={styles.tipsTitle}>Earn More Tips</Text>
              <Text style={styles.tipsSub}>
                Stay online during peak hours (11AM-2PM, 7PM-10PM) to get more orders and complete targets faster.
              </Text>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
};

export default IncentivesScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: theme.colors.ink },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16, paddingBottom: 32 },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  summaryText: { marginLeft: 14 },
  summaryLabel: { fontSize: 13, color: '#92400E' },
  summaryAmount: { fontSize: 24, fontWeight: '800', color: '#92400E', marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.ink, marginBottom: 12 },
  targetCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    ...theme.shadow.card,
  },
  targetTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  targetInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  targetTitle: { fontSize: 14, fontWeight: '600', color: '#111827', marginLeft: 8 },
  targetReward: { fontSize: 13, fontWeight: '700', color: '#6B7280' },
  targetRewardDone: { color: '#10B981' },
  progressBg: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 4,
  },
  progressDone: { backgroundColor: '#10B981' },
  progressLabel: { fontSize: 11, color: '#6B7280', marginTop: 6 },
  tipsCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 16,
    marginTop: 12,
  },
  tipsText: { marginLeft: 12, flex: 1 },
  tipsTitle: { fontSize: 14, fontWeight: '700', color: '#92400E', marginBottom: 4 },
  tipsSub: { fontSize: 13, color: '#78350F', lineHeight: 19 },
});
