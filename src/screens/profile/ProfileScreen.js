import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { selectIsOnline } from '../../store/slices/onlineStatusSlice';
import { useSelector } from 'react-redux';
import { changeLanguage } from '../../utils/changeLanguage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NotificationService from '../../services/NotificationService';
import { resetDriverLocalData } from '../../services/localDriverData';

const ProfileScreen = ({ navigation }) => {
  const isOnline = useSelector(selectIsOnline);

  // State for modals
  const [addressModalVisible, setAddressModalVisible] = useState(false);
  const [phoneModalVisible, setPhoneModalVisible] = useState(false);
  const [bankModalVisible, setBankModalVisible] = useState(false);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [trainingLanguageModalVisible, setTrainingLanguageModalVisible] =
    useState(false);

  // State for form data
  const [homeAddress, setHomeAddress] = useState('');
  const [savedAddress, setSavedAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('9876543210');
  const [newPhoneNumber, setNewPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtpField, setShowOtpField] = useState(false);

  // Bank details state
  const [bankDetails, setBankDetails] = useState({
    accountHolderName: '',
    accountNumber: '',
    confirmAccountNumber: '',
    ifscCode: '',
    bankName: '',
    upiId: '',
  });
  const [savedBankDetails, setSavedBankDetails] = useState(null);

  // Language state
  const [appLanguage, setAppLanguage] = useState('English');
  const [trainingLanguage, setTrainingLanguage] = useState('हिन्दी');

  // Load language from AsyncStorage
  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const language = await AsyncStorage.getItem('user-language');
        if (language) {
          setAppLanguage(language === 'en' ? 'English' : 'हिन्दी');
        }
      } catch (error) {
        console.error('Error loading language:', error);
      }
    };

    loadLanguage();
  }, []);

  // Memoized handlers to prevent unnecessary re-renders
  const handleAddressSave = useCallback(() => {
    if (homeAddress.trim()) {
      setSavedAddress(homeAddress);
      setHomeAddress('');
      setAddressModalVisible(false);
      Alert.alert('Success', 'Address added successfully!');
    } else {
      Alert.alert('Error', 'Please enter an address');
    }
  }, [homeAddress]);

  const handlePhoneSendOTP = useCallback(() => {
    if (newPhoneNumber.length === 10) {
      setShowOtpField(true);
      Alert.alert(
        'OTP Sent',
        'A verification code has been sent to your new number',
      );
    } else {
      Alert.alert('Error', 'Please enter a valid 10-digit mobile number');
    }
  }, [newPhoneNumber]);

  const handlePhoneVerifyOTP = useCallback(() => {
    if (otp.length === 6) {
      setPhoneNumber(newPhoneNumber);
      setPhoneModalVisible(false);
      setShowOtpField(false);
      setNewPhoneNumber('');
      setOtp('');
      Alert.alert('Success', 'Mobile number updated successfully!');
    } else {
      Alert.alert('Error', 'Please enter valid OTP');
    }
  }, [otp, newPhoneNumber]);

  const handleBankSave = useCallback(() => {
    if (
      bankDetails.accountHolderName &&
      bankDetails.accountNumber &&
      bankDetails.ifscCode &&
      bankDetails.bankName
    ) {
      if (bankDetails.accountNumber === bankDetails.confirmAccountNumber) {
        setSavedBankDetails(bankDetails);
        setBankModalVisible(false);
        Alert.alert('Success', 'Bank details saved successfully!');
        // Reset form
        setBankDetails({
          accountHolderName: '',
          accountNumber: '',
          confirmAccountNumber: '',
          ifscCode: '',
          bankName: '',
          upiId: '',
        });
      } else {
        Alert.alert('Error', 'Account numbers do not match');
      }
    } else {
      Alert.alert('Error', 'Please fill all required fields');
    }
  }, [bankDetails]);

  const handleLanguageSelect = useCallback((lang, isTraining) => {
    if (!isTraining) {
      setAppLanguage(lang);
      changeLanguage(lang === 'English' ? 'en' : 'hi');
    } else {
      setTrainingLanguage(lang);
    }
  }, []);

  // Memoized modal components to prevent recreation
  const AddressModal = useMemo(
    () => (
      <Modal
        animationType="slide"
        transparent={true}
        visible={addressModalVisible}
        onRequestClose={() => setAddressModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Home Address</Text>
              <TouchableOpacity onPress={() => setAddressModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.modalInput}
              placeholder="Enter your complete address"
              value={homeAddress}
              onChangeText={setHomeAddress}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setHomeAddress('');
                  setAddressModalVisible(false);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleAddressSave}
              >
                <Text style={styles.saveButtonText}>Save Address</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    ),
    [addressModalVisible, homeAddress, handleAddressSave],
  );

  const handleLogout = async () => {
    await NotificationService.removeToken();
    await AsyncStorage.multiRemove(['userToken', 'userData', 'driverId']);
    await resetDriverLocalData();
    Alert.alert('Logged out', 'You have been logged out successfully.');
    navigation.replace('Login');
  };

  const PhoneModal = useMemo(
    () => (
      <Modal
        animationType="slide"
        transparent={true}
        visible={phoneModalVisible}
        onRequestClose={() => {
          setPhoneModalVisible(false);
          setShowOtpField(false);
          setNewPhoneNumber('');
          setOtp('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {showOtpField ? 'Verify OTP' : 'Change Mobile Number'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setPhoneModalVisible(false);
                  setShowOtpField(false);
                  setNewPhoneNumber('');
                  setOtp('');
                }}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {!showOtpField ? (
              <>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Enter new mobile number"
                  value={newPhoneNumber}
                  onChangeText={setNewPhoneNumber}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
                <TouchableOpacity
                  style={{
                    backgroundColor: '#F4C20D',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 10,
                    borderRadius: 10,
                  }}
                  onPress={handlePhoneSendOTP}
                >
                  <Text style={styles.saveButtonText}>Send OTP</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.otpSentText}>
                  OTP sent to {newPhoneNumber}
                </Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Enter OTP"
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="number-pad"
                  maxLength={6}
                />
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => {
                      setShowOtpField(false);
                      setNewPhoneNumber('');
                      setOtp('');
                    }}
                  >
                    <Text style={styles.cancelButtonText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.saveButton]}
                    onPress={handlePhoneVerifyOTP}
                  >
                    <Text style={styles.saveButtonText}>Verify & Update</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    ),
    [
      phoneModalVisible,
      showOtpField,
      newPhoneNumber,
      otp,
      handlePhoneSendOTP,
      handlePhoneVerifyOTP,
    ],
  );

  const BankModal = useMemo(
    () => (
      <Modal
        animationType="slide"
        transparent={true}
        visible={bankModalVisible}
        onRequestClose={() => setBankModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.scrollModalContent}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {savedBankDetails ? 'Edit Bank Details' : 'Add Bank Details'}
                </Text>
                <TouchableOpacity onPress={() => setBankModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.modalInput}
                placeholder="Account Holder Name"
                value={bankDetails.accountHolderName}
                onChangeText={text =>
                  setBankDetails({ ...bankDetails, accountHolderName: text })
                }
              />

              <TextInput
                style={styles.modalInput}
                placeholder="Account Number"
                value={bankDetails.accountNumber}
                onChangeText={text =>
                  setBankDetails({ ...bankDetails, accountNumber: text })
                }
                keyboardType="numeric"
                secureTextEntry={true}
              />

              <TextInput
                style={styles.modalInput}
                placeholder="Confirm Account Number"
                value={bankDetails.confirmAccountNumber}
                onChangeText={text =>
                  setBankDetails({ ...bankDetails, confirmAccountNumber: text })
                }
                keyboardType="numeric"
                secureTextEntry={true}
              />

              <TextInput
                style={styles.modalInput}
                placeholder="IFSC Code"
                value={bankDetails.ifscCode}
                onChangeText={text =>
                  setBankDetails({
                    ...bankDetails,
                    ifscCode: text.toUpperCase(),
                  })
                }
                autoCapitalize="characters"
              />

              <TextInput
                style={styles.modalInput}
                placeholder="Bank Name"
                value={bankDetails.bankName}
                onChangeText={text =>
                  setBankDetails({ ...bankDetails, bankName: text })
                }
              />

              <TextInput
                style={styles.modalInput}
                placeholder="UPI ID (Optional)"
                value={bankDetails.upiId}
                onChangeText={text =>
                  setBankDetails({ ...bankDetails, upiId: text })
                }
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    setBankModalVisible(false);
                    setBankDetails({
                      accountHolderName: '',
                      accountNumber: '',
                      confirmAccountNumber: '',
                      ifscCode: '',
                      bankName: '',
                      upiId: '',
                    });
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={handleBankSave}
                >
                  <Text style={styles.saveButtonText}>Save Details</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    ),
    [bankModalVisible, bankDetails, savedBankDetails, handleBankSave],
  );

  const LanguageModal = useCallback(
    ({ visible, onClose, currentLanguage, onSelect, title, isTraining }) => (
      <Modal
        animationType="slide"
        transparent={true}
        visible={visible}
        onRequestClose={onClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{title}</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {['English', 'हिन्दी'].map(lang => (
              <TouchableOpacity
                key={lang}
                style={[
                  styles.languageOption,
                  currentLanguage === lang && styles.selectedLanguageOption,
                ]}
                onPress={() => {
                  onSelect(lang);
                  handleLanguageSelect(lang, isTraining);
                  onClose();
                }}
              >
                <Text
                  style={[
                    styles.languageOptionText,
                    currentLanguage === lang &&
                      styles.selectedLanguageOptionText,
                  ]}
                >
                  {lang}
                </Text>
                {currentLanguage === lang && (
                  <Ionicons name="checkmark" size={20} color="#4169E1" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    ),
    [handleLanguageSelect],
  );

  // Render bank details if saved
  const renderBankDetails = useCallback(() => {
    if (savedBankDetails) {
      return (
        <View style={styles.bankDetailsCard}>
          <View style={styles.bankDetailRow}>
            <Text style={styles.bankDetailLabel}>Account Holder:</Text>
            <Text style={styles.bankDetailValue}>
              {savedBankDetails.accountHolderName}
            </Text>
          </View>
          <View style={styles.bankDetailRow}>
            <Text style={styles.bankDetailLabel}>Account No:</Text>
            <Text style={styles.bankDetailValue}>
              ••••{savedBankDetails.accountNumber.slice(-4)}
            </Text>
          </View>
          <View style={styles.bankDetailRow}>
            <Text style={styles.bankDetailLabel}>IFSC:</Text>
            <Text style={styles.bankDetailValue}>
              {savedBankDetails.ifscCode}
            </Text>
          </View>
          <View style={styles.bankDetailRow}>
            <Text style={styles.bankDetailLabel}>Bank:</Text>
            <Text style={styles.bankDetailValue}>
              {savedBankDetails.bankName}
            </Text>
          </View>
          {savedBankDetails.upiId ? (
            <View style={styles.bankDetailRow}>
              <Text style={styles.bankDetailLabel}>UPI ID:</Text>
              <Text style={styles.bankDetailValue}>
                {savedBankDetails.upiId}
              </Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={styles.editBankButton}
            onPress={() => {
              setBankDetails(savedBankDetails);
              setBankModalVisible(true);
            }}
          >
            <Text style={styles.editBankButtonText}>Edit Details</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <TouchableOpacity
        style={styles.addDetailsButton}
        onPress={() => {
          setBankDetails({
            accountHolderName: '',
            accountNumber: '',
            confirmAccountNumber: '',
            ifscCode: '',
            bankName: '',
            upiId: '',
          });
          setBankModalVisible(true);
        }}
      >
        <Ionicons name="add-circle-outline" size={20} color="#F4C20D" />
        <Text style={styles.addDetailsText}>+ Add Details</Text>
      </TouchableOpacity>
    );
  }, [savedBankDetails]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Profile Info Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>A</Text>
              </View>
              {isOnline && <View style={styles.onlineDot} />}
            </View>

            <View style={styles.profileInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>Arsh</Text>
                <Text style={styles.starRating}> • ★ 4.8</Text>
              </View>
              <View style={styles.vehicleRow}>
                <MaterialIcons name="two-wheeler" size={16} color="#666" />
                <Text style={styles.vehicleText}> Scooter • MP-13-FP-1405</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.editButton}
              onPress={() =>
                Alert.alert('Edit Profile', 'Edit profile functionality')
              }
            >
              <Ionicons name="create-outline" size={20} color="#4169E1" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Home Address Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Home Address</Text>
            <TouchableOpacity onPress={() => setAddressModalVisible(true)}>
              <Ionicons name="add-circle-outline" size={22} color="#4169E1" />
            </TouchableOpacity>
          </View>
          <View style={styles.addressBox}>
            <Text style={styles.addressText}>{savedAddress || '--'}</Text>
          </View>
        </View>

        {/* Mobile Number Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Mobile number</Text>
            <TouchableOpacity onPress={() => setPhoneModalVisible(true)}>
              <Text style={styles.changeText}>Change</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.phoneBox}>
            <View style={styles.phoneRow}>
              <MaterialIcons name="phone" size={18} color="#666" />
              <Text style={styles.phoneText}>{phoneNumber}</Text>
            </View>
            <View style={styles.verifiedBadge}>
              <MaterialIcons name="verified" size={16} color="#4CAF50" />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          </View>
        </View>

        {/* Bank Details Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Bank details</Text>
          </View>
          {renderBankDetails()}
        </View>

        {/* My Vehicles Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Vehicles</Text>
            <TouchableOpacity
              onPress={() =>
                Alert.alert('Add Vehicle', 'Add new vehicle functionality')
              }
            >
              <Ionicons name="add-circle-outline" size={22} color="#4169E1" />
            </TouchableOpacity>
          </View>

          {/* Vehicle Card */}
          <View style={styles.vehicleCard}>
            <View style={styles.vehicleCardLeft}>
              <View style={styles.vehicleIconBg}>
                <MaterialIcons name="two-wheeler" size={24} color="#F4C20D" />
              </View>
              <View style={styles.vehicleDetails}>
                <Text style={styles.vehicleName}>Scooter</Text>
                <Text style={styles.vehicleNumber}>MP-13-FP-1405</Text>
              </View>
            </View>
            <View style={styles.vehicleCardRight}>
              <View style={styles.activeBadge}>
                <Text style={styles.activeText}>Active</Text>
              </View>
              <TouchableOpacity
                onPress={() =>
                  Alert.alert('Vehicle Details', 'View vehicle details')
                }
              >
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Language Preferences */}
        <View style={styles.languageSection}>
          <Text style={styles.languageSectionTitle}>Language Preferences</Text>

          {/* Preferred App Language */}
          <View style={styles.languageRow}>
            <View style={styles.languageInfo}>
              <Text style={styles.languageLabel}>Preferred app language</Text>
              <Text style={styles.languageValue}>{appLanguage}</Text>
            </View>
            <TouchableOpacity
              style={styles.changeButton}
              onPress={() => setLanguageModalVisible(true)}
            >
              <Text style={styles.changeButtonText}>Change</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {/* Change Training Language */}
          <View style={styles.languageRow}>
            <View style={styles.languageInfo}>
              <Text style={styles.languageLabel}>Change Training Language</Text>
              <Text style={styles.languageValue}>{trainingLanguage}</Text>
            </View>
            <TouchableOpacity
              style={styles.changeButton}
              onPress={() => setTrainingLanguageModalVisible(true)}
            >
              <Text style={styles.changeButtonText}>Change</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* App Version */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>App Version 1.0.0</Text>
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() =>
            Alert.alert('Logout', 'Are you sure you want to logout?', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Logout',
                style: 'destructive',
                onPress: () => handleLogout(),
              },
            ])
          }
        >
          <MaterialIcons name="logout" size={20} color="#FF5252" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modals */}
      {AddressModal}
      {PhoneModal}
      {BankModal}
      <LanguageModal
        visible={languageModalVisible}
        onClose={() => setLanguageModalVisible(false)}
        currentLanguage={appLanguage}
        onSelect={setAppLanguage}
        title="Select App Language"
        isTraining={false}
      />
      <LanguageModal
        visible={trainingLanguageModalVisible}
        onClose={() => setTrainingLanguageModalVisible(false)}
        currentLanguage={trainingLanguage}
        onSelect={setTrainingLanguage}
        title="Select Training Language"
        isTraining={true}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginLeft: 20,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  profileCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F4C20D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#fff',
  },
  profileInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  starRating: {
    fontSize: 14,
    color: '#FFD700',
    fontWeight: '600',
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vehicleText: {
    fontSize: 14,
    color: '#666',
  },
  editButton: {
    padding: 8,
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  addressBox: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
  },
  addressText: {
    color: '#333',
    fontSize: 14,
  },
  changeText: {
    color: '#4169E1',
    fontSize: 14,
    fontWeight: '500',
  },
  phoneBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  phoneText: {
    fontSize: 16,
    color: '#000',
    marginLeft: 8,
    fontWeight: '500',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  verifiedText: {
    fontSize: 12,
    color: '#4CAF50',
    marginLeft: 4,
    fontWeight: '500',
  },
  addDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9E6',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F4C20D',
    borderStyle: 'dashed',
  },
  addDetailsText: {
    color: '#665500',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  vehicleCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
  },
  vehicleCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vehicleIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  vehicleDetails: {
    justifyContent: 'center',
  },
  vehicleName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
    marginBottom: 2,
  },
  vehicleNumber: {
    fontSize: 12,
    color: '#666',
  },
  vehicleCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  activeText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },
  languageSection: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  languageSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  languageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  languageInfo: {
    flex: 1,
  },
  languageLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  languageValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
  },
  changeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F0F4FF',
    borderRadius: 6,
  },
  changeButtonText: {
    color: '#4169E1',
    fontSize: 12,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 4,
  },
  versionContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  versionText: {
    fontSize: 12,
    color: '#999',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF5252',
  },
  logoutText: {
    color: '#FF5252',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
  },
  scrollModalContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#F8F9FA',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#F0F0F0',
  },
  saveButton: {
    backgroundColor: '#F4C20D',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  saveButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  fullWidthButton: {
    marginHorizontal: 0,
  },
  otpSentText: {
    textAlign: 'center',
    color: '#666',
    marginBottom: 16,
    fontSize: 14,
  },
  bankDetailsCard: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
  },
  bankDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  bankDetailLabel: {
    fontSize: 14,
    color: '#666',
  },
  bankDetailValue: {
    fontSize: 14,
    color: '#000',
    fontWeight: '500',
  },
  editBankButton: {
    marginTop: 12,
    padding: 8,
    backgroundColor: '#F0F4FF',
    borderRadius: 6,
    alignItems: 'center',
  },
  editBankButtonText: {
    color: '#4169E1',
    fontSize: 14,
    fontWeight: '500',
  },
  languageOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  selectedLanguageOption: {
    backgroundColor: '#F0F4FF',
  },
  languageOptionText: {
    fontSize: 16,
    color: '#333',
  },
  selectedLanguageOptionText: {
    color: '#4169E1',
    fontWeight: '500',
  },
});

export default ProfileScreen;


