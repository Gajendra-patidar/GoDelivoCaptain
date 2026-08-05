import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Share,
} from 'react-native';
import React, { useState } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Modal } from 'react-native';

const MoreScreen = ({ navigation }) => {
  const [langModalVisible, setLangModalVisible] = useState(false);
  const menuOptions = [
    {
      id: 1,
      title: 'earnings',
      icon: 'wallet-outline',
      color: '#4CAF50',
      badge: 'Wallet',
      route: 'Earnings',
    },
    {
      id: 2,
      title: 'order history',
      icon: 'time-outline',
      color: '#2196F3',
      badge: 'Trips',
      route: 'OrderHistory',
    },
    {
      id: 3,
      title: 'notifications',
      icon: 'notifications-outline',
      color: '#F44336',
      badge: 'Inbox',
      route: 'Notifications',
    },
    {
      id: 4,
      title: 'profile',
      icon: 'person-outline',
      color: '#3F51B5',
      route: 'Profile',
    },
    {
      id: 5,
      title: 'refer & earn',
      icon: 'gift-outline',
      color: '#FF9800',
      badge: 'Share',
      route: 'ShareApp',
    },
    // {
    //   id: 6,
    //   title: 'subscription plans',
    //   icon: 'card-outline',
    //   color: '#9C27B0',
    //   route: 'Subscription',
    // },
    // {
    //   id: 6,
    //   title: 'incentives',
    //   icon: 'trophy-outline',
    //   color: '#E91E63',
    //   route: 'Incentives',
    // },
    {
      id: 7,
      title: 'change language',
      icon: 'language-outline',
      color: '#00BCD4',
      action: 'ChangeLanguage',
    },
  ];

  const { t, i18n } = useTranslation();

  const changeLanguage = async (lng) => {
    i18n.changeLanguage(lng);
    await AsyncStorage.setItem('user-language', lng);
    setLangModalVisible(false);
  };

  const handleNavigate = async route => {
    if (route === 'ShareApp') {
      try {
        await Share.share({
          message:
            'Download GoDelivo Captain App now! https://play.google.com/store/apps/details?id=com.godelivo.captain&pcampaignid=web_share',
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
      return;
    }
    if (route === 'ChangeLanguage') {
      setLangModalVisible(true);
      return;
    }
    if (route) {
      navigation.navigate(route);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fccf1e" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('more')}</Text>
        {/* <TouchableOpacity style={styles.settingsButton}>
          <Ionicons name="settings-outline" size={24} color="#000" />
        </TouchableOpacity> */}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.menuContainer}>
          <Text style={styles.menuTitle}>{t('quick actions')}</Text>

          {menuOptions.map(item => (
            <TouchableOpacity
              key={item.id}
              style={styles.menuItem}
              onPress={() => handleNavigate(item.route || item.action)}
            >
              <View style={styles.menuLeft}>
                <View
                  style={[
                    styles.menuIconContainer,
                    { backgroundColor: `${item.color}15` },
                  ]}
                >
                  <Ionicons name={item.icon} size={24} color={item.color} />
                </View>
                <Text style={styles.menuText}>{t(item.title)}</Text>
              </View>

              <View style={styles.menuRight}>
                {item.badge ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.badge}</Text>
                  </View>
                ) : null}
                <Ionicons name="chevron-forward" size={20} color="#6B7280" />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <Modal
        visible={langModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setLangModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setLangModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('select language')}</Text>
            
            <TouchableOpacity 
              style={styles.langOption} 
              onPress={() => changeLanguage('en')}
            >
              <Text style={[styles.langText, i18n.language === 'en' && styles.langTextSelected]}>English</Text>
              {i18n.language === 'en' && <Ionicons name="checkmark-circle" size={24} color="#fccf1e" />}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.langOption} 
              onPress={() => changeLanguage('hi')}
            >
              <Text style={[styles.langText, i18n.language === 'hi' && styles.langTextSelected]}>हिंदी (Hindi)</Text>
              {i18n.language === 'hi' && <Ionicons name="checkmark-circle" size={24} color="#fccf1e" />}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

export default MoreScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fccf1e',
    borderBottomWidth: 1,
    borderBottomColor: '#F7D94C',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  settingsButton: {
    padding: 5,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  menuContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuText: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
  },
  menuRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginRight: 8,
  },
  badgeText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    width: '80%',
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 15,
    textAlign: 'center',
  },
  langOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  langText: {
    fontSize: 16,
    color: '#333',
  },
  langTextSelected: {
    fontWeight: 'bold',
    color: '#000',
  },
});
