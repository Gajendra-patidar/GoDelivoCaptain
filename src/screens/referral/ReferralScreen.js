import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Share,
  Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Clipboard from '@react-native-clipboard/clipboard';
import { useSelector } from 'react-redux';
import { theme } from '../../theme';

const ReferralScreen = ({ navigation }) => {
  const { profile } = useSelector(state => state.profile);
  const referralCode = profile?.referralCode || profile?.phone || 'GODELIVO';

  const handleCopy = () => {
    try {
      Clipboard.setString(referralCode);
      Alert.alert('Copied!', 'Referral code copied to clipboard.');
    } catch {
      Alert.alert('Error', 'Could not copy code.');
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join GoDelivo as a delivery partner and start earning! Use my referral code: ${referralCode}\n\nDownload now!`,
      });
    } catch {
      // user cancelled
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor={theme.colors.primary} barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Refer & Earn</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.body}>
        {/* Hero */}
        <View style={styles.heroCard}>
          <Ionicons name="gift" size={48} color="#F59E0B" />
          <Text style={styles.heroTitle}>Invite Friends, Earn Rewards</Text>
          <Text style={styles.heroSub}>
            Share your referral code with friends. When they complete their first delivery, you both earn a bonus!
          </Text>
        </View>

        {/* Referral Code */}
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>Your Referral Code</Text>
          <View style={styles.codeRow}>
            <Text style={styles.codeText}>{referralCode}</Text>
            <TouchableOpacity style={styles.copyBtn} onPress={handleCopy}>
              <Ionicons name="copy-outline" size={20} color={theme.colors.ink} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Steps */}
        <View style={styles.stepsCard}>
          <Text style={styles.stepsTitle}>How it works</Text>
          {[
            { icon: 'share-social-outline', text: 'Share your referral code with friends' },
            { icon: 'person-add-outline', text: 'Friend signs up and completes verification' },
            { icon: 'bicycle-outline', text: 'Friend completes their first delivery' },
            { icon: 'wallet-outline', text: 'Both of you earn a bonus reward!' },
          ].map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepIcon}>
                <Ionicons name={step.icon} size={18} color="#F59E0B" />
              </View>
              <Text style={styles.stepText}>{step.text}</Text>
            </View>
          ))}
        </View>

        {/* Share Button */}
        <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
          <Ionicons name="share-social" size={22} color="#000" />
          <Text style={styles.shareBtnText}>Share Referral Code</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default ReferralScreen;

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
  body: { flex: 1, padding: 16 },
  heroCard: {
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  heroTitle: { fontSize: 20, fontWeight: '800', color: '#92400E', marginTop: 12, textAlign: 'center' },
  heroSub: { fontSize: 13, color: '#78350F', textAlign: 'center', marginTop: 8, lineHeight: 20 },
  codeCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    marginBottom: 20,
    ...theme.shadow.card,
  },
  codeLabel: { fontSize: 13, color: '#6B7280', marginBottom: 10 },
  codeRow: { flexDirection: 'row', alignItems: 'center' },
  codeText: {
    fontSize: 28,
    fontWeight: '900',
    color: theme.colors.ink,
    letterSpacing: 3,
    marginRight: 12,
  },
  copyBtn: {
    padding: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
  },
  stepsCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    ...theme.shadow.card,
  },
  stepsTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.ink, marginBottom: 14 },
  stepRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  stepIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFBEB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepText: { fontSize: 13, color: '#374151', flex: 1, lineHeight: 19 },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
  },
  shareBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginLeft: 10,
  },
});
