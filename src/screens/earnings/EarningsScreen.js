import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { moderateScale } from 'react-native-size-matters';
import { useFocusEffect } from '@react-navigation/native';
import {
  addWalletAmount,
  getWalletData,
  setWalletData,
} from '../../services/localDriverData';
import { driverApi } from '../../services/driverApi';
import { theme } from '../../theme';

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
    try {
      const earnings = await driverApi.getEarnings();
      const nextWallet = earnings?.wallet;
      if (nextWallet) {
        const local = await setWalletData(nextWallet);
        setWallet(local);
        return;
      }
    } catch {}

    const fallback = await getWalletData();
    setWallet(fallback);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadWallet();
    }, [loadWallet]),
  );

  const handleQuickAdd = async amount => {
    try {
      setLoadingAmount(amount);
      try {
        const walletResponse = await driverApi.rechargeWallet(amount);
        if (walletResponse) {
          const updated = await setWalletData(walletResponse);
          setWallet(updated);
          Alert.alert('Wallet Updated', `Rs ${amount} added to wallet balance.`);
          return;
        }
      } catch {}

      const updatedWallet = await addWalletAmount(amount);
      setWallet(updatedWallet);
      Alert.alert('Offline Recharge', `Backend not reachable. Rs ${amount} added locally.`);
    } finally {
      setLoadingAmount(null);
    }
  };

  const handlePayoutRequest = async () => {
    try {
      const result = await driverApi.requestPayout(wallet.balance);
      if (result) {
        setWallet({ ...wallet, balance: 0 });
        Alert.alert('Success', `Payout of ₹${wallet.balance} requested. Funds will be transferred shortly.`);
      }
    } catch (err) {
      if (err.response?.data?.message === 'Incomplete bank details') {
        Alert.alert('Bank Details Missing', 'Please add bank details before requesting a payout.');
      } else {
        Alert.alert('Error', err.response?.data?.message || 'Failed to request payout');
      }
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor={theme.colors.primary} barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Earnings</Text>
        <TouchableOpacity style={styles.helpBtn} onPress={() => Alert.alert('Help', 'Contacting support...')}>
          <Ionicons name="help-circle-outline" size={24} color={theme.colors.ink} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={['#1a1c1e', '#2c2f33']}
          style={styles.walletCard}
        >
          <View>
            <Text style={styles.cardLabel}>Wallet Balance</Text>
            <Text style={styles.cardAmount}>₹{Number(wallet?.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
          </View>
          
          <TouchableOpacity 
             style={[styles.payoutBtn, wallet.balance <= 0 && { opacity: 0.6 }]} 
             onPress={handlePayoutRequest}
             disabled={wallet.balance <= 0}
          >
             <Text style={styles.payoutBtnText}>TRANFER TO BANK</Text>
             <Ionicons name="chevron-forward" size={16} color="#000" />
          </TouchableOpacity>
        </LinearGradient>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>TODAY</Text>
            <Text style={styles.statValue}>₹{wallet.todayEarnings.toFixed(2)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>THIS WEEK</Text>
            <Text style={styles.statValue}>₹{wallet.totalEarnings.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.deliveriesCard}>
          <View style={styles.deliveriesIcon}>
            <Ionicons name="cube-outline" size={24} color={theme.colors.primary} />
          </View>
          <View>
            <Text style={styles.statLabel}>TOTAL DELIVERIES</Text>
            <Text style={styles.statValueLarge}>{wallet.totalDeliveries}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add Money to Wallet</Text>
          <View style={styles.rechargeRow}>
            {QUICK_ADD_AMOUNTS.map(amount => (
              <TouchableOpacity
                key={amount}
                style={styles.rechargeBtn}
                onPress={() => handleQuickAdd(amount)}
                disabled={loadingAmount !== null}
              >
                <Text style={styles.rechargeBtnText}>
                  {loadingAmount === amount ? '...' : `₹${amount}`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={styles.historyLink}
          onPress={() => navigation.navigate('OrderHistory')}
        >
          <View style={styles.historyIcon}>
             <Ionicons name="time-outline" size={22} color={theme.colors.ink} />
          </View>
          <Text style={styles.historyLinkText}>View Trip History</Text>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

export default EarningsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: moderateScale(16),
    paddingTop: Platform.OS === 'ios' ? moderateScale(50) : moderateScale(20),
    paddingBottom: moderateScale(15),
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: moderateScale(18),
    fontWeight: '800',
    color: theme.colors.ink,
  },
  helpBtn: {
    padding: 4,
  },
  content: {
    padding: moderateScale(16),
    paddingBottom: moderateScale(30),
  },
  walletCard: {
    borderRadius: theme.radii.xl,
    padding: moderateScale(24),
    marginBottom: moderateScale(20),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...theme.shadow.card,
  },
  cardLabel: {
    color: '#9CA3AF',
    fontSize: moderateScale(12),
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardAmount: {
    color: '#fff',
    fontSize: moderateScale(28),
    fontWeight: '900',
    marginTop: 4,
  },
  payoutBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: moderateScale(10),
    paddingHorizontal: moderateScale(14),
    borderRadius: theme.radii.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  payoutBtnText: {
    color: '#000',
    fontWeight: '900',
    fontSize: moderateScale(11),
    marginRight: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: moderateScale(16),
  },
  statCard: {
    width: '48%',
    backgroundColor: '#f9fafb',
    borderRadius: theme.radii.lg,
    padding: moderateScale(16),
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  statLabel: {
    color: theme.colors.muted,
    fontSize: moderateScale(10),
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statValue: {
    color: theme.colors.ink,
    fontSize: moderateScale(18),
    fontWeight: '900',
    marginTop: 4,
  },
  deliveriesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: theme.radii.lg,
    padding: moderateScale(16),
    marginBottom: moderateScale(24),
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  deliveriesIcon: {
    width: moderateScale(48),
    height: moderateScale(48),
    borderRadius: moderateScale(12),
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: moderateScale(16),
  },
  statValueLarge: {
    color: theme.colors.ink,
    fontSize: moderateScale(22),
    fontWeight: '900',
    marginTop: 2,
  },
  section: {
    marginBottom: moderateScale(24),
  },
  sectionTitle: {
    fontSize: moderateScale(15),
    fontWeight: '800',
    color: theme.colors.ink,
    marginBottom: moderateScale(12),
  },
  rechargeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rechargeBtn: {
    width: '31%',
    backgroundColor: '#fff',
    borderRadius: theme.radii.md,
    paddingVertical: moderateScale(12),
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
  },
  rechargeBtnText: {
    color: theme.colors.ink,
    fontWeight: '800',
    fontSize: moderateScale(13),
  },
  historyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: theme.radii.lg,
    padding: moderateScale(16),
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  historyIcon: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(10),
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: moderateScale(12),
  },
  historyLinkText: {
    flex: 1,
    fontSize: moderateScale(15),
    fontWeight: '700',
    color: theme.colors.ink,
  },
});
