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
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import toast from '../../utils/toast';
import { selectIsOnline } from '../../store/slices/onlineStatusSlice';
import { changeLanguage } from '../../utils/changeLanguage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NotificationService from '../../services/NotificationService';
import SocketService from '../../services/socketService';
import { resetDriverLocalData, getActiveOrder } from '../../services/localDriverData';
import { useDispatch, useSelector } from 'react-redux';
import { clearProfile, getProfile, updateProfile, selectProfile, selectProfileLoading } from '../../store/slices/profileSlice';
import { theme } from '../../theme';

const ProfileScreen = ({ navigation }) => {
  const isOnline = useSelector(selectIsOnline);
  const dispatch = useDispatch();
  const profile = useSelector(selectProfile);
  const loading = useSelector(selectProfileLoading);

  const profileAddress = profile?.address || profile?.applicationDetails?.address;
  const profileBankDetails = profile?.bankDetails || profile?.applicationDetails?.bankDetails;
  const profileVehicleDetails = profile?.vehicleDetails || profile?.applicationDetails?.vehicleDetails ||{
    type: profile?.vehicleType,
    number: profile?.vehicleNumber,
  };
  const profileStats = profile?.stats || {};
  const applicationDetails = profile?.applicationDetails || {};

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
  const [phoneNumber, setPhoneNumber] = useState('0000000000');
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

  useEffect(() => {
    dispatch(getProfile());
  }, [dispatch]);

  useEffect(() => {
    console.log("profiledata", profile);
    
    if (profile) {
      setPhoneNumber(profile.phone || '');

      // Handle address - it may come from applicationDetails.address
      if (profileAddress) {
        const addressObj = profileAddress;
        const formattedAddress = `${addressObj.street || ''}, ${addressObj.city || ''}, ${addressObj.state || ''} - ${addressObj.pincode || ''}`;
        setSavedAddress(formattedAddress);
      }

      // Handle bank details from either root or nested applicationDetails
      if (profileBankDetails) {
        setSavedBankDetails({
          accountHolderName: profileBankDetails.accountHolderName || '',
          accountNumber: profileBankDetails.accountNumber || '',
          ifscCode: profileBankDetails.ifscCode || '',
          bankName: profileBankDetails.bankName || '',
          upiId: profileBankDetails.upiId || '',
        });
      }
    }
  }, [profile]);

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

  const handleAddressSave = useCallback(() => {
    if (homeAddress.trim()) {
      // Parse the address input (you might want to improve this parsing)
      const addressParts = homeAddress.split(',').map(part => part.trim());

      const addressObj = {
        street: addressParts[0] || '',
        city: addressParts[1] || profile?.address?.city || '',
        state: addressParts[2] || profile?.address?.state || '',
        pincode: addressParts[3] || profile?.address?.pincode || '',
      };

      dispatch(
        updateProfile({
          address: addressObj,
        }),
      );

      setSavedAddress(homeAddress);
      setHomeAddress('');
      setAddressModalVisible(false);

      toast.success('Address updated successfully!');
    } else {
      toast.error('Please enter an address');
    }
  }, [dispatch, homeAddress, profile]);

  const handlePhoneSendOTP = useCallback(() => {
    if (newPhoneNumber.length === 10) {
      setShowOtpField(true);
      toast.info('A verification code has been sent to your new number');
    } else {
      toast.error('Please enter a valid 10-digit mobile number');
    }
  }, [newPhoneNumber]);

  const handlePhoneVerifyOTP = useCallback(() => {
    if (otp.length === 6) {
      dispatch(
        updateProfile({
          phone: newPhoneNumber,
        }),
      );

      setPhoneNumber(newPhoneNumber);
      setPhoneModalVisible(false);
      setShowOtpField(false);
      setNewPhoneNumber('');
      setOtp('');

      toast.success('Mobile number updated successfully!');
    } else {
      toast.error('Please enter valid OTP');
    }
  }, [dispatch, newPhoneNumber, otp]);

  const handleBankSave = useCallback(() => {
    if (
      bankDetails.accountHolderName &&
      bankDetails.accountNumber &&
      bankDetails.ifscCode &&
      bankDetails.bankName
    ) {
      if (bankDetails.accountNumber === bankDetails.confirmAccountNumber) {
        // Remove confirmAccountNumber before sending to API
        const { confirmAccountNumber, ...bankDataToSave } = bankDetails;

        dispatch(
          updateProfile({
            bankDetails: bankDataToSave,
          }),
        );

        setSavedBankDetails(bankDataToSave);
        setBankModalVisible(false);

        toast.success('Bank details saved successfully!');
      } else {
        toast.error('Account numbers do not match');
      }
    } else {
      toast.error('Please fill all required fields');
    }
  }, [bankDetails, dispatch]);

  const handleLanguageSelect = useCallback((lang, isTraining) => {
    if (!isTraining) {
      setAppLanguage(lang);
      changeLanguage(lang === 'English' ? 'en' : 'hi');
    } else {
      setTrainingLanguage(lang);
    }
  }, []);

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

            <Text style={styles.inputLabel}>Street Address *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter street address"
              value={homeAddress}
              onChangeText={setHomeAddress}
            />

            <Text style={styles.inputLabel}>City</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="City"
              value={profileAddress?.city || ''}
              editable={false}
            />

            <Text style={styles.inputLabel}>State</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="State"
              value={profileAddress?.state || ''}
              editable={false}
            />

            <Text style={styles.inputLabel}>Pincode</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Pincode"
              value={profileAddress?.pincode || ''}
              editable={false}
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
    [addressModalVisible, homeAddress, handleAddressSave, profile],
  );

  const handleLogout = async () => {
    // Check if there's an active order
    const activeOrder = await getActiveOrder();
    if (activeOrder) {
            Alert.alert(
        'Order in Progress',
        'You cannot logout while an order is active. Please complete or cancel the current order.',
        [{ text: 'OK' }],
      );
      return;
    }

    await NotificationService.removeToken();
    await AsyncStorage.multiRemove(['userToken', 'userData', 'driverId']);
    await resetDriverLocalData();
    SocketService.cleanup();
    dispatch(clearProfile());
    toast.success('You have been logged out successfully.');
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
                <Text style={styles.inputLabel}>New Mobile Number</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Enter new mobile number"
                  value={newPhoneNumber}
                  onChangeText={setNewPhoneNumber}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
                <TouchableOpacity
                  style={styles.fullWidthButton}
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
                <Text style={styles.inputLabel}>Enter OTP</Text>
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

              <Text style={styles.inputLabel}>Account Holder Name *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Account Holder Name"
                value={bankDetails.accountHolderName}
                onChangeText={text =>
                  setBankDetails({ ...bankDetails, accountHolderName: text })
                }
              />

              <Text style={styles.inputLabel}>Account Number *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Account Number"
                value={bankDetails.accountNumber}
                onChangeText={text =>
                  setBankDetails({ ...bankDetails, accountNumber: text })
                }
                keyboardType="numeric"
              />

              <Text style={styles.inputLabel}>Confirm Account Number *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Confirm Account Number"
                value={bankDetails.confirmAccountNumber}
                onChangeText={text =>
                  setBankDetails({ ...bankDetails, confirmAccountNumber: text })
                }
                keyboardType="numeric"
              />

              <Text style={styles.inputLabel}>IFSC Code *</Text>
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

              <Text style={styles.inputLabel}>Bank Name *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Bank Name"
                value={bankDetails.bankName}
                onChangeText={text =>
                  setBankDetails({ ...bankDetails, bankName: text })
                }
              />

              <Text style={styles.inputLabel}>UPI ID (Optional)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="UPI ID"
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
    const bankInfo = savedBankDetails || profileBankDetails;
    if (bankInfo) {
      // Mask account number for display
      const maskedAccountNumber = bankInfo.accountNumber
        ? `••••${bankInfo.accountNumber.slice(-4)}`
        : '';

      return (
        <View style={styles.bankDetailsCard}>
          <View style={styles.bankDetailRow}>
            <Text style={styles.bankDetailLabel}>Account Holder:</Text>
            <Text style={styles.bankDetailValue}>
              {bankInfo.accountHolderName}
            </Text>
          </View>
          <View style={styles.bankDetailRow}>
            <Text style={styles.bankDetailLabel}>Account No:</Text>
            <Text style={styles.bankDetailValue}>
              {maskedAccountNumber}
            </Text>
          </View>
          <View style={styles.bankDetailRow}>
            <Text style={styles.bankDetailLabel}>IFSC:</Text>
            <Text style={styles.bankDetailValue}>
              {bankInfo.ifscCode}
            </Text>
          </View>
          <View style={styles.bankDetailRow}>
            <Text style={styles.bankDetailLabel}>Bank:</Text>
            <Text style={styles.bankDetailValue}>
              {bankInfo.bankName}
            </Text>
          </View>
          {bankInfo.upiId ? (
            <View style={styles.bankDetailRow}>
              <Text style={styles.bankDetailLabel}>UPI ID:</Text>
              <Text style={styles.bankDetailValue}>
                {bankInfo.upiId}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.editBankButton}
            onPress={() => {
              setBankDetails({
                accountHolderName: bankInfo.accountHolderName || '',
                accountNumber: bankInfo.accountNumber || '',
                confirmAccountNumber: bankInfo.accountNumber || '',
                ifscCode: bankInfo.ifscCode || '',
                bankName: bankInfo.bankName || '',
                upiId: bankInfo.upiId || '',
              });
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
  }, [savedBankDetails, profile, setBankDetails, setBankModalVisible]);

  // Loading state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F4C20D" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

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
                <Text style={styles.avatarText}>
                  {profile?.name ? profile.name.charAt(0).toUpperCase() : 'U'}
                </Text>
              </View>
              {isOnline && <View style={styles.onlineDot} />}
            </View>

            <View style={styles.profileInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{profile?.name || 'Driver'}</Text>
                <View style={styles.ratingBadge}>
                  <Text style={styles.starRating}>★ {profileStats.rating || 0}</Text>
                </View>
              </View>
              <View style={styles.vehicleRow}>
                {
                  
                }
                <Text style={styles.vehicleText}>
                  {profileVehicleDetails?.type || 'Vehicle'} • {profileVehicleDetails?.number || '--'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.editButton}
              onPress={() =>
                toast.info('View full profile details')
              }
            >
              <Ionicons name="chevron-forward" size={24} color="#CBD5E1" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Profile Stats Card */}
        <View style={styles.statsCard}>
          <View style={styles.statsRow}>
            <View style={styles.statsItem}>
              <Text style={styles.statsValue}>₹{profileStats.totalEarnings ?? 0}</Text>
              <Text style={styles.statsLabel}>Total Earnings</Text>
            </View>
            <View style={styles.statsItem}>
              <Text style={styles.statsValue}>{profileStats.totalTrips ?? 0}</Text>
              <Text style={styles.statsLabel}>Total Trips</Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statsItem}>
              <Text style={styles.statsValue}>{profileStats.rating ?? 0}</Text>
              <Text style={styles.statsLabel}>Rating</Text>
            </View>
            <View style={styles.statsItem}>
              <Text style={styles.statsValue}>₹{profileStats.walletBalance ?? 0}</Text>
              <Text style={styles.statsLabel}>Wallet</Text>
            </View>
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
            <Text style={styles.addressText}>{savedAddress || (profileAddress ? `${profileAddress.street || ''}, ${profileAddress.city || ''}, ${profileAddress.state || ''} - ${profileAddress.pincode || ''}` : 'No address added')}</Text>
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
          </View>

          {/* Vehicle Card */}
          <View style={styles.vehicleCard}>
            <View style={styles.vehicleCardLeft}>
              <View style={styles.vehicleIconBg}>
                <Text style={{fontSize:15, fontFamily:'Poppins-SemiBold'}} >{(profile?.name).slice(0,1)}</Text>
              </View>
              <View style={styles.vehicleDetails}>
                <Text style={styles.vehicleName}>
                  {profile?.vehicleDetails?.type || 'Vehicle'}
                </Text>
                <Text style={styles.vehicleNumber}>
                  {profile?.vehicleDetails?.number || '--'}
                </Text>
                {profile?.vehicleDetails?.model && (
                  <Text style={styles.vehicleModel}>
                    {profile.vehicleDetails.model} • {profile.vehicleDetails.year} • {profile.vehicleDetails.color}
                  </Text>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Document Status Section */}
        {profile?.documents && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Document Status</Text>
            </View>

            {Object.entries(profile.documents).map(([docType, docData]) => {
              if (docType === 'aadharCard' && docData.front) {
                return (
                  <View key={docType} style={styles.documentRow}>
                    <Text style={styles.documentLabel}>Aadhar Card</Text>
                    <View style={[
                      styles.statusBadge,
                      docData.front.status === 'verified' ? styles.statusVerified :
                        docData.front.status === 'rejected' ? styles.statusRejected :
                          styles.statusPending
                    ]}>
                      <Text style={styles.statusText}>
                        {docData.front.status === 'verified' ? '✓ Verified' :
                          docData.front.status === 'rejected' ? '✗ Rejected' :
                            '⏳ Pending'}
                      </Text>
                    </View>
                  </View>
                );
              } else if (docType !== 'aadharCard') {
                return (
                  <View key={docType} style={styles.documentRow}>
                    <Text style={styles.documentLabel}>
                      {docType.replace(/([A-Z])/g, ' $1').trim()}
                    </Text>
                    <View style={[
                      styles.statusBadge,
                      docData.status === 'verified' ? styles.statusVerified :
                        docData.status === 'rejected' ? styles.statusRejected :
                          styles.statusPending
                    ]}>
                      <Text style={styles.statusText}>
                        {docData.status === 'verified' ? '✓ Verified' :
                          docData.status === 'rejected' ? '✗ Rejected' :
                            '⏳ Pending'}
                      </Text>
                    </View>
                  </View>
                );
              }
              return null;
            })}

            <View style={styles.applicationStatus}>
              <Text style={styles.applicationStatusLabel}>Application Status:</Text>
              <View style={[
                styles.statusBadge,
                profile.verificationStatus === 'verified' ? styles.statusVerified :
                  profile.verificationStatus === 'rejected' ? styles.statusRejected :
                    styles.statusPending
              ]}>
                <Text style={styles.statusText}>
                  {profile.verificationStatus === 'verified' ? '✓ Verified' :
                    profile.verificationStatus === 'rejected' ? '✗ Rejected' :
                      profile.verificationStatus === 'submitted' ? '⏳ Under Review' :
                        'Pending'}
                </Text>
              </View>
            </View>

            {profile.submittedAt && (
              <Text style={styles.submittedDate}>
                Submitted: {new Date(profile.submittedAt).toLocaleDateString()}
              </Text>
            )}
          </View>
        )}

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
  smallInfoText: {
    color: '#555',
    fontSize: 12,
    marginTop: 4,
  },
  statsCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statsItem: {
    flex: 1,
    alignItems: 'center',
  },
  statsValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  statsLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginRight: 8,
  },
  ratingBadge: {
    backgroundColor: '#FFF9E6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  starRating: {
    fontSize: 12,
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
    marginLeft: 4,
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
    flex: 1,
  },
  vehicleName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
    marginBottom: 2,
  },
  vehicleNumber: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  vehicleModel: {
    fontSize: 12,
    color: '#999',
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
    backgroundColor: '#FEF2F2',
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 40,
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    ...theme.shadow.card,
  },
  logoutText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '900',
    marginLeft: 10,
    letterSpacing: 1,
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
  inputLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    marginTop: 8,
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
    backgroundColor: '#F4C20D',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  // Document status styles
  documentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  documentLabel: {
    fontSize: 14,
    color: '#333',
    textTransform: 'capitalize',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 70,
    alignItems: 'center',
  },
  statusVerified: {
    backgroundColor: '#E8F5E9',
  },
  statusPending: {
    backgroundColor: '#FFF9E6',
  },
  statusRejected: {
    backgroundColor: '#FFEBEE',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  applicationStatus: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  applicationStatusLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  verificationStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  submittedDate: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 8,
  },
});

export default ProfileScreen;