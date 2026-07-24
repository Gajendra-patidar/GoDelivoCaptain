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
  Image,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import toast from '../../utils/toast';
import { selectIsOnline } from '../../store/slices/onlineStatusSlice';
import { changeLanguage } from '../../utils/changeLanguage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NotificationService from '../../services/NotificationService';
import SocketService from '../../services/socketService';
import { launchImageLibrary } from 'react-native-image-picker';
import {
  resetDriverLocalData,
  getActiveOrder,
} from '../../services/localDriverData';
import { useDispatch, useSelector } from 'react-redux';
import {
  clearProfile,
  getProfile,
  updateProfile,
  uploadProfileImage,
  selectProfile,
  selectProfileLoading,
  selectImageUploading,
} from '../../store/slices/profileSlice';
import { theme } from '../../theme';

const ProfileScreen = ({ navigation }) => {
  const isOnline = useSelector(selectIsOnline);
  const dispatch = useDispatch();
  const profile = useSelector(selectProfile);
  const loading = useSelector(selectProfileLoading);
  const imageUploading = useSelector(selectImageUploading);

  const profileAddress = profile?.address || profile?.applicationDetails?.address;
  const profileBankDetails = profile?.bankDetails || profile?.applicationDetails?.bankDetails;
  const profileVehicleDetails = profile?.vehicleDetails ||
    profile?.applicationDetails?.vehicleDetails || {
      type: profile?.vehicleType,
      number: profile?.vehicleNumber,
    };
  const profileStats = profile?.stats || {};

  console.log("profile check: ", profile);
  

  // State for modals
  const [addressModalVisible, setAddressModalVisible] = useState(false);
  const [phoneModalVisible, setPhoneModalVisible] = useState(false);
  const [bankModalVisible, setBankModalVisible] = useState(false);
  const [editProfileModalVisible, setEditProfileModalVisible] = useState(false);

  // State for form data
  const [homeAddress, setHomeAddress] = useState('');
  const [savedAddress, setSavedAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('0000000000');
  const [newPhoneNumber, setNewPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtpField, setShowOtpField] = useState(false);

  // Edit Profile state
  const [editProfileData, setEditProfileData] = useState({
    name: '',
    vehicleType: '',
    vehicleNumber: '',
  });

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

  useEffect(() => {
    dispatch(getProfile());
  }, [dispatch]);

  useEffect(() => {
    if (profile) {
      setPhoneNumber(profile.phone || '');
      setEditProfileData({
        name: profile.name || '',
        vehicleType: profileVehicleDetails?.type || profile.vehicleType || '',
        vehicleNumber: profileVehicleDetails?.number || profile.vehicleNumber || '',
      });

      if (profileAddress) {
        const addressObj = profileAddress;
        const formattedAddress = `${addressObj.street || ''}, ${
          addressObj.city || ''
        }, ${addressObj.state || ''} - ${addressObj.pincode || ''}`;
        setSavedAddress(formattedAddress);
      }

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

  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const language = await AsyncStorage.getItem('user-language');
        if (language) {
          setAppLanguage(language === 'en' ? 'English' : 'हिन्दी');
        }
      } catch (error) {}
    };
    loadLanguage();
  }, []);

  const handleImageUpload = () => {
    launchImageLibrary({ mediaType: 'photo', quality: 0.8 }, (response) => {
      if (response.didCancel) return;
      if (response.errorMessage) {
        toast.error('Image picker error: ' + response.errorMessage);
        return;
      }
      if (response.assets && response.assets.length > 0) {
        const uri = response.assets[0].uri;
        dispatch(uploadProfileImage(uri))
          .unwrap()
          .then(() => toast.success('Profile picture updated successfully'))
          .catch((err) => toast.error(err || 'Failed to update profile picture'));
      }
    });
  };

  const handleEditProfileSave = () => {
    if (!editProfileData.name.trim()) {
      toast.error('Name is required');
      return;
    }
    
    // Determine how to update vehicle details based on existing structure
    let updatePayload = { name: editProfileData.name };
    
    if (profile?.vehicleDetails || profile?.applicationDetails?.vehicleDetails) {
      updatePayload.vehicleDetails = {
        ...profileVehicleDetails,
        type: editProfileData.vehicleType,
        number: editProfileData.vehicleNumber,
      };
    } else {
      updatePayload.vehicleType = editProfileData.vehicleType;
      updatePayload.vehicleNumber = editProfileData.vehicleNumber;
    }

    dispatch(updateProfile(updatePayload))
      .unwrap()
      .then(() => {
        toast.success('Profile updated successfully');
        setEditProfileModalVisible(false);
      })
      .catch((err) => toast.error(err || 'Failed to update profile'));
  };

  const handleLogout = async () => {
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

  // Loading state
  if (loading && !profile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fccf1e" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Profile Info Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <View>
                {profile?.profileimage ? (
                  <Image source={{ uri: profile?.profileimage}} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {profile?.name ? profile.name.charAt(0).toUpperCase() : 'U'}
                    </Text>
                  </View>
                )}
                {imageUploading && (
                  <View style={styles.imageOverlay}>
                    <ActivityIndicator size="small" color="#fff" />
                  </View>
                )}
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
                <Text style={styles.vehicleText}>
                  {profileVehicleDetails?.type || profile?.vehicleType || 'Vehicle'} •{' '}
                  {profileVehicleDetails?.number || profile?.vehicleNumber || '--'}
                </Text>
              </View>
            </View>

            {/* <TouchableOpacity
              style={styles.editButton}
              onPress={() => setEditProfileModalVisible(true)}

            >
              <Ionicons name="pencil" size={20} color="#4169E1" />
            </TouchableOpacity> */}
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

        {/* Logout Section */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#EF4444" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editProfileModalVisible}
        onRequestClose={() => setEditProfileModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setEditProfileModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={styles.modalInput}
              value={editProfileData.name}
              onChangeText={(t) => setEditProfileData(p => ({ ...p, name: t }))}
              placeholder="Enter your name"
            />

            <Text style={styles.inputLabel}>Vehicle Type</Text>
            <TextInput
              style={styles.modalInput}
              value={editProfileData.vehicleType}
              onChangeText={(t) => setEditProfileData(p => ({ ...p, vehicleType: t }))}
              placeholder="e.g. Bike, Scooter, Auto"
            />

            <Text style={styles.inputLabel}>Vehicle Number</Text>
            <TextInput
              style={styles.modalInput}
              value={editProfileData.vehicleNumber}
              onChangeText={(t) => setEditProfileData(p => ({ ...p, vehicleNumber: t }))}
              placeholder="e.g. MP 09 AB 1234"
              autoCapitalize="characters"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setEditProfileModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleEditProfileSave}
              >
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6' },
  loadingText: { marginTop: 10, fontSize: 16, color: '#4B5563' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#FFFFFF', elevation: 2 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginLeft: 16 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  
  profileCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 16, elevation: 1 },
  profileHeader: { flexDirection: 'row', alignItems: 'center' },
  avatarContainer: { position: 'relative', marginRight: 16 },
  avatar: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#fccf1e', justifyContent: 'center', alignItems: 'center' },
  avatarImage: { width: 70, height: 70, borderRadius: 35, resizeMode: 'cover' },
  imageOverlay: { position: 'absolute', width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 28, fontWeight: 'bold', color: '#000' },
  onlineDot: { position: 'absolute', bottom: 2, right: 2, width: 14, height: 14, borderRadius: 7, backgroundColor: '#10B981', borderWidth: 2, borderColor: '#FFFFFF' },
  editIconBadge: { position: 'absolute', bottom: -4, right: -4, backgroundColor: '#4169E1', width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  
  profileInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  name: { fontSize: 18, fontWeight: '700', color: '#111827', marginRight: 8 },
  ratingBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 12 },
  starRating: { fontSize: 12, fontWeight: '700', color: '#D97706' },
  vehicleRow: { flexDirection: 'row', alignItems: 'center' },
  vehicleText: { fontSize: 14, color: '#6B7280' },
  editButton: { padding: 8 },
  
  statsCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 16, elevation: 1 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  statsItem: { flex: 1, alignItems: 'center' },
  statsValue: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 4 },
  statsLabel: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEE2E2', padding: 16, borderRadius: 12, marginTop: 24 },
  logoutText: { fontSize: 16, fontWeight: '700', color: '#EF4444', marginLeft: 8 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, width: '100%', maxWidth: 400 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  inputLabel: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 8 },
  modalInput: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, fontSize: 16, color: '#111827', marginBottom: 16, backgroundColor: '#F9FAFB' },
  
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  modalButton: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  cancelButton: { backgroundColor: '#F3F4F6', marginRight: 8 },
  saveButton: { backgroundColor: '#fccf1e', marginLeft: 8 },
  cancelButtonText: { fontSize: 16, fontWeight: '600', color: '#4B5563' },
  saveButtonText: { fontSize: 16, fontWeight: '700', color: '#000' },
});

export default ProfileScreen;
