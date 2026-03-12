import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  TextInput,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';


const HelpSupports = ({navigation}) => {
  const helpTopics = [
    { id: 1, title: 'order related', icon: 'layers-outline', screen: 'OrderHelp' },
    { id: 2, title: 'account update', icon: 'person-outline', screen: 'AccountHelp' },
    { id: 3, title: 'app related', icon: 'phone-portrait-outline', screen: 'AppHelp' },
    { id: 4, title: 'rewards/prime/branding', icon: 'gift-outline', screen: 'RewardsHelp' },
    { id: 5, title: 'not receiving orders', icon: 'close-circle-outline', screen: 'NoOrdersHelp' },
    { id: 6, title: 'wallet related', icon: 'wallet-outline', screen: 'WalletHelp' },
  ];

  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFD700" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={()=> navigation.goBack()} >
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('help & support')}</Text>
        <TouchableOpacity>
          <Ionicons name="language" size={24} color="#000" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Yellow Theme Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.heroIconContainer}>
            <MaterialIcons name="support-agent" size={50} color="#000" />
          </View>
          <Text style={styles.heroTitle}>{t('how can we help?')}</Text>
          <Text style={styles.heroSubtitle}>
            {t('select any option to help with your orders, earnings and more')}
          </Text>
          
          {/* Search Bar */}
          {/* <View style={styles.searchContainer}>
            <Ionicons name="search-outline" size={20} color="#666" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search help topics..."
              placeholderTextColor="#999"
            />
          </View> */}
        </View>

        {/* Help by Topic Section */}
        <View style={styles.topicSection}>
          <Text style={styles.sectionTitle}>{t('help by topic')}</Text>
          
          {helpTopics.map((topic) => (
            <TouchableOpacity key={topic.id} style={styles.topicItem} onPress={() => navigation.navigate('HelpDetail', { topicId: topic.screen, topicTitle: topic.title })}>
              <View style={styles.topicLeft}>
                <View style={styles.topicIconContainer}>
                  <Ionicons name={topic.icon} size={22} color="#000" />
                </View>
                <Text style={styles.topicText}>{t(topic.title)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
          ))}
        </View>

        
        {/* <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickActionItem}>
            <View style={[styles.quickIconContainer, { backgroundColor: '#FFF3CD' }]}>
              <Ionicons name="chatbubble-outline" size={24} color="#000" />
            </View>
            <Text style={styles.quickActionText}>Live Chat</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.quickActionItem}>
            <View style={[styles.quickIconContainer, { backgroundColor: '#FFF3CD' }]}>
              <Ionicons name="call-outline" size={24} color="#000" />
            </View>
            <Text style={styles.quickActionText}>Call Us</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.quickActionItem}>
            <View style={[styles.quickIconContainer, { backgroundColor: '#FFF3CD' }]}>
              <Ionicons name="mail-outline" size={24} color="#000" />
            </View>
            <Text style={styles.quickActionText}>Email</Text>
          </TouchableOpacity>
        </View>

        
        <View style={styles.faqSection}>
          <View style={styles.faqHeader}>
            <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
            <TouchableOpacity>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          {faqData.map((faq, index) => (
            <TouchableOpacity key={index} style={styles.faqItem}>
              <View style={styles.faqLeft}>
                <Text style={styles.faqQuestion}>{faq.question}</Text>
                <Text style={styles.faqAnswer}>{faq.answer}</Text>
              </View>
              <Ionicons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>
          ))}
        </View>

        
        <View style={styles.contactSection}>
          <Text style={styles.contactTitle}>Still need help?</Text>
          <Text style={styles.contactSubtitle}>
            Our support team is available 24/7
          </Text>
          
          <View style={styles.contactOptions}>
            <View style={styles.contactOption}>
              <Ionicons name="mail" size={18} color="#000" />
              <Text style={styles.contactText}>support@example.com</Text>
            </View>
            <View style={styles.contactOption}>
              <Ionicons name="call" size={18} color="#000" />
              <Text style={styles.contactText}>+91 12345 67890</Text>
            </View>
          </View>
        </View>

        
        <Text style={styles.versionText}>App Version 5.144.0</Text> */}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFD700',
    borderBottomWidth: 1,
    borderBottomColor: '#FFC107',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  notificationButton: {
    backgroundColor:'#fff',
    borderRadius:'50%',
    padding: 6,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  heroSection: {
    backgroundColor: '#FFD700',
    padding: 24,
    paddingBottom: 40,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    alignItems: 'center',
  },
  heroIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF3CD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#000',
    paddingVertical: 8,
  },
  topicSection: {
    padding: 20,
    backgroundColor: '#fff',
    marginTop: -20,
    marginHorizontal: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 16,
  },
  topicItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  topicLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topicIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF3CD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  topicText: {
    fontSize: 15,
    color: '#000',
    fontWeight: '500',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#fff',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quickActionItem: {
    alignItems: 'center',
  },
  quickIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
  },
  faqSection: {
    padding: 20,
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#fff',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  viewAllText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  faqItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  faqLeft: {
    flex: 1,
    marginRight: 12,
  },
  faqQuestion: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  faqAnswer: {
    fontSize: 12,
    color: '#666',
  },
  contactSection: {
    padding: 20,
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#FFF3CD',
    borderRadius: 20,
    alignItems: 'center',
  },
  contactTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  contactSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  contactOptions: {
    width: '100%',
  },
  contactOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#FFD700',
  },
  contactText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 12,
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#999',
    marginTop: 20,
  },
});

export default HelpSupports;