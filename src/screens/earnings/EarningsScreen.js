import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { addWalletAmount, getWalletData } from '../../services/localDriverData';

const QUICK_ADD_AMOUNTS = [100, 250, 500];

const EarningsScreen = ({ navigation }) => {
  const [wallet, setWallet] = useState({
    balance: 0,
    todayEarnings: 0,
    totalEarnings: 0,
    totalDeliveries: 0,
  });
  const [loadingAmount, setLoadingAmount] = useState(null);

  const loadWallet = useCallback(async () => {
    const walletData = await getWalletData();
    setWallet(walletData);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadWallet();
    }, [loadWallet]),
  );

  const handleQuickAdd = async amount => {
    try {
      setLoadingAmount(amount);
      const updatedWallet = await addWalletAmount(amount);
      setWallet(updatedWallet);
      Alert.alert('Wallet Updated', `Rs ${amount} added to wallet balance.`);
    } finally {
      setLoadingAmount(null);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#F4C20D" barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Earnings and Wallet</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.walletCard}>
          <Text style={styles.cardLabel}>Wallet Balance</Text>
          <Text style={styles.cardAmount}>Rs {wallet.balance.toFixed(2)}</Text>
        </View>

        <View style={styles.grid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Today</Text>
            <Text style={styles.statValue}>Rs {wallet.todayEarnings.toFixed(2)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total</Text>
            <Text style={styles.statValue}>Rs {wallet.totalEarnings.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.statCardFull}>
          <Text style={styles.statLabel}>Completed Deliveries</Text>
          <Text style={styles.statValue}>{wallet.totalDeliveries}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Wallet Recharge</Text>
          <View style={styles.amountRow}>
            {QUICK_ADD_AMOUNTS.map(amount => (
              <TouchableOpacity
                key={amount}
                style={styles.amountButton}
                onPress={() => handleQuickAdd(amount)}
                disabled={loadingAmount !== null}
              >
                <Text style={styles.amountButtonText}>
                  {loadingAmount === amount ? 'Adding...' : `+ Rs ${amount}`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={styles.historyButton}
          onPress={() => navigation.navigate('OrderHistory')}
        >
          <Text style={styles.historyButtonText}>View Order History</Text>
          <Ionicons name="chevron-forward" size={20} color="#000" />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

export default EarningsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F7FB',
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
    color: '#000',
    marginLeft: 14,
  },
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  walletCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
  },
  cardLabel: {
    color: '#D1D5DB',
    fontSize: 14,
  },
  cardAmount: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '800',
    marginTop: 8,
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  statCardFull: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
  },
  statLabel: {
    color: '#6B7280',
    fontSize: 13,
  },
  statValue: {
    color: '#111827',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 6,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 10,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  amountButton: {
    width: '31%',
    backgroundColor: '#FFF7D6',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  amountButtonText: {
    color: '#7C5E00',
    fontWeight: '700',
    fontSize: 12,
  },
  historyButton: {
    backgroundColor: '#F4C20D',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyButtonText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 15,
  },
});
