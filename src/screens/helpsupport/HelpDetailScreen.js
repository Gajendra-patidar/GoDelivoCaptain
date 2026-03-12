import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

const FAQ_DATA = {
  OrderHelp: [
    { q: 'How do I accept an order?', a: 'When a new order comes in, a popup will appear. Tap "Accept" to take the order.' },
    { q: 'How do I cancel an order?', a: 'On the map screen, tap the "Cancel" button before pickup. Select a reason and confirm.' },
    { q: 'What if the customer is not available?', a: 'Try calling the customer. If unreachable for 10 minutes, contact support to cancel.' },
    { q: 'Order amount is incorrect?', a: 'Contact support with the order ID. The difference will be adjusted in your wallet.' },
  ],
  AccountHelp: [
    { q: 'How do I update my phone number?', a: 'Go to Profile → Mobile Number → Change. Enter the new number and verify with OTP.' },
    { q: 'How do I change my address?', a: 'Go to Profile → Home Address and update your address.' },
    { q: 'How do I update bank details?', a: 'Go to Profile → Bank Details and add or edit your bank information.' },
    { q: 'How do I change my vehicle?', a: 'Contact support to update your vehicle information and documents.' },
  ],
  AppHelp: [
    { q: 'App is crashing frequently?', a: 'Clear app cache, update to the latest version, and restart your phone.' },
    { q: 'GPS is not working?', a: 'Enable location permissions, turn on high-accuracy mode, and ensure GPS is on.' },
    { q: 'Notifications are not coming?', a: 'Check notification permissions, disable battery optimization for the app.' },
    { q: 'App is running slow?', a: 'Close other apps, clear cache, and ensure you have a stable internet connection.' },
  ],
  RewardsHelp: [
    { q: 'How do incentives work?', a: 'Complete weekly order targets to earn bonus rewards. Check the Incentives screen for details.' },
    { q: 'When are bonuses credited?', a: 'Weekly bonuses are credited every Monday to your wallet.' },
    { q: 'How do I check my rewards?', a: 'Go to Home → Incentives to see your current targets and earned rewards.' },
  ],
  NoOrdersHelp: [
    { q: 'Why am I not receiving orders?', a: 'Ensure you are online, have good internet, and your location is in an active delivery zone.' },
    { q: 'My wallet balance is low, will I get orders?', a: 'Low wallet balance may reduce order priority. Recharge your wallet to receive orders.' },
    { q: 'How to get more orders?', a: 'Stay online during peak hours (11AM-2PM, 7PM-10PM) and maintain high ratings.' },
  ],
  WalletHelp: [
    { q: 'How do I recharge my wallet?', a: 'Go to Earnings → Recharge Wallet. Enter the amount and complete payment.' },
    { q: 'Why is wallet recharge needed?', a: 'Wallet balance covers app commission. Keep it positive to receive orders.' },
    { q: 'Recharge failed but money deducted?', a: 'Amount will be refunded in 3-5 business days. Contact support if not received.' },
  ],
};

const HelpDetailScreen = ({ navigation, route }) => {
  const { topicId, topicTitle } = route?.params || {};
  const faqs = FAQ_DATA[topicId] || [];
  const [expanded, setExpanded] = useState(null);

  const toggleExpand = index => {
    setExpanded(prev => (prev === index ? null : index));
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFD700" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {topicTitle || 'Help'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {faqs.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="help-circle-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyText}>No FAQs available for this topic.</Text>
          </View>
        ) : (
          faqs.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.faqCard}
              onPress={() => toggleExpand(index)}
              activeOpacity={0.8}
            >
              <View style={styles.faqTop}>
                <Text style={styles.question}>{item.q}</Text>
                <Ionicons
                  name={expanded === index ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color="#6B7280"
                />
              </View>
              {expanded === index && <Text style={styles.answer}>{item.a}</Text>}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
};

export default HelpDetailScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFD700',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#FFC107',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#000', flex: 1, textAlign: 'center' },
  content: { padding: 16, paddingBottom: 32 },
  emptyWrap: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: '#6B7280', fontSize: 15, marginTop: 12 },
  faqCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  faqTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  question: { fontSize: 14, fontWeight: '600', color: '#111827', flex: 1, marginRight: 8 },
  answer: {
    fontSize: 13,
    color: '#4B5563',
    marginTop: 10,
    lineHeight: 20,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 10,
  },
});
