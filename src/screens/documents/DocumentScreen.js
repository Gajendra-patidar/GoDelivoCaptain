import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Alert,
  Image,
  Platform,
  PermissionsAndroid,
  Animated,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../../services/api';
import { theme } from '../../theme';

const { width } = Dimensions.get('window');

const VEHICLE_TYPES = [
  'Bike',
  'Scooter',
  'Loader (3 Wheeler)',
  'Truck (4 Wheeler)',
];

const getVehicleIcon = type => {
  switch (type) {
    case 'Bike':
      return 'two-wheeler';

    case 'Scooter':
      return 'moped';

    case 'Loader (3 Wheeler)':
      return 'electric-rickshaw';

    case 'Truck (4 Wheeler)':
      return 'local-shipping';

    default:
      return 'car';
  }
};

const DocumentScreen = ({ navigation, route }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const scrollViewRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [verifyStatus, setVerifyStatusVal] = useState('PENDING');
  const [rejectReason, setRejectReason] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const phoneData = route?.params?.phone;
  const statusData = route?.params?.data;

  useEffect(() => {
    if (statusData) {
      if (
        verifyStatus === 'submitted' ||
        verifyStatus === 'partially_verified'
      ) {
        return;
      }
      handleStatus(statusData);
    } else {
      checkStatus();
    }
  }, []);

  const handleStatus = data => {
    // 🆕 NEW DRIVER → FORM SHOW
    if (data?.requiresRegistration === true) {
      setVerifyStatusVal('NEW');
      return;
    }

    // 📄 Already Uploaded → check status
    const status = data?.applicationStatus;

    if (status === 'PENDING') {
      setVerifyStatusVal('PENDING');
    } else if (status === 'REJECTED') {
      setVerifyStatusVal('REJECTED');
      setRejectReason(data?.statusMessage || '');
    } else if (status === 'VERIFIED') {
      navigation.replace('MyTabs');
    }
  };

  const checkStatus = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      const phone = await AsyncStorage.getItem('userPhone');
      if (phone) setUserPhone(phone);

      if (token) {
        const response = await axios
          .get(`${BASE_URL}/status/${phone}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          .catch(err => ({
            data: { verifyStatus: 'PENDING', rejectReason: '' },
          }));

        setVerifyStatusVal(
          response?.data?.data?.verificationStatus ||
            response?.data?.verifyStatus ||
            'PENDING',
        );
        setRejectReason(
          response?.data?.rejectReason ||
            response?.data?.data?.statusMessage ||
            '',
        );
        //VERIFIED
        if (response?.data?.data?.verificationStatus === 'verified') {
          navigation.replace('MyTabs');
        }
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const [form, setForm] = useState({
    // Phone (from stored login)
    phone: '',

    // Personal Info
    fullName: '',
    email: '',
    dateOfBirth: '',
    address: '',
    city: '',
    state: '',
    pincode: '',

    // Vehicle Info
    vehicleType: '',
    vehicleNumber: '',
    // vehicleModel: '',
    // vehicleYear: '',
    // vehicleColor: '',

    // Bank Info
    accountHolderName: '',
    accountNumber: '',
    ifscCode: '',
    bankName: '',
    branchName: '',

    // Document Numbers
    aadharNumber: '',
    licenseNumber: '',
    // rcNumber: '',

    // Files
    profilePhoto: null,
    aadharFront: null,
    aadharBack: null,
    panCard: null,
    drivingLicense: null,
    vehicleRC: null,
    vehiclePhoto: null,

    // Track upload status
    uploadStatus: {
      profilePhoto: false,
      aadharFront: false,
      aadharBack: false,
      panCard: false,
      drivingLicense: false,
      vehicleRC: false,
      vehiclePhoto: false,
    },
  });

  // Load phone from storage on mount
  useEffect(() => {
    const loadPhone = async () => {
      const phone = await AsyncStorage.getItem('userPhone');
      if (phone) {
        setForm(prev => ({ ...prev, phone }));
      }
    };
    loadPhone();
  }, []);

  // Get token from storage
  const getToken = async () => {
    try {
      return await AsyncStorage.getItem('userToken');
    } catch (error) {
      console.error('Error getting token:', error);
      return null;
    }
  };

  const requestCameraPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'App needs camera access to capture your documents',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        return false;
      }
    }
    return true;
  };

  const pickImage = (key, useCamera = false) => {
    const options = {
      mediaType: 'photo',
      includeBase64: false,
      maxHeight: 2000,
      maxWidth: 2000,
      quality: 0.8,
      saveToPhotos: false,
    };

    const handleResponse = response => {
      if (response.didCancel) {
      } else if (response.errorCode) {
        Alert.alert('Error', response.errorMessage || 'Something went wrong');
      } else if (response.assets && response.assets.length > 0) {
        const asset = response.assets[0];

        // Validate file size (max 5MB)
        if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
          Alert.alert('Error', 'File size should be less than 5MB');
          return;
        }

        Animated.sequence([
          Animated.timing(fadeAnim, {
            toValue: 0.5,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();

        setForm(prev => ({
          ...prev,
          [key]: asset,
          uploadStatus: {
            ...prev.uploadStatus,
            [key]: true,
          },
        }));
      }
    };

    if (useCamera) {
      launchCamera(options, handleResponse);
    } else {
      launchImageLibrary(options, handleResponse);
    }
  };

  const removeFile = key => {
    setForm(prev => ({
      ...prev,
      [key]: null,
      uploadStatus: {
        ...prev.uploadStatus,
        [key]: false,
      },
    }));
  };

  const detectBank = async ifsc => {
    setForm(prev => ({
      ...prev,
      ifscCode: ifsc.toUpperCase(),
    }));

    if (ifsc.length === 11) {
      setLoading(true);
      try {
        const res = await axios.get(`https://ifsc.razorpay.com/${ifsc}`);
        setForm(prev => ({
          ...prev,
          bankName: res.data.BANK || '',
          branchName: res.data.BRANCH || '',
          ifscCode: ifsc.toUpperCase(),
        }));
      } catch (err) {
        // Don't show alert for every keystroke, just clear the auto-filled data
        setForm(prev => ({
          ...prev,
          bankName: '',
          branchName: '',
        }));
      } finally {
        setLoading(false);
      }
    }
  };

  const handleNext = () => {
    if (validateStep()) {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setStep(step + 1);
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    }
  };

  const validateStep = () => {
    switch (step) {
      case 1: // Personal Info
        if (!form.fullName?.trim()) {
          showError('Please enter your full name');
          return false;
        }
        if (!form.email?.trim() || !form.email.includes('@')) {
          showError('Please enter a valid email address');
          return false;
        }
        if (!form.dateOfBirth) {
          showError('Please enter your date of birth');
          return false;
        }
        if (!form.address?.trim()) {
          showError('Please enter your address');
          return false;
        }
        if (!form.city?.trim()) {
          showError('Please enter your city');
          return false;
        }
        if (!form.state?.trim()) {
          showError('Please enter your state');
          return false;
        }
        if (!form.pincode?.trim() || form.pincode.length !== 6) {
          showError('Please enter a valid 6-digit pincode');
          return false;
        }
        if (!form.profilePhoto) {
          showError('Please upload your profile photo');
          return false;
        }
        return true;

      case 2: // Identity Documents
        if (!form.aadharFront) {
          showError('Please upload Aadhar front image');
          return false;
        }
        if (!form.aadharBack) {
          showError('Please upload Aadhar back image');
          return false;
        }
        if (!form.aadharNumber || form.aadharNumber.length !== 12) {
          showError('Please enter valid 12-digit Aadhar number');
          return false;
        }
        if (!form.panCard) {
          showError('Please upload PAN card');
          return false;
        }
        if (!form.drivingLicense) {
          showError('Please upload driving license');
          return false;
        }
        if (!form.licenseNumber?.trim()) {
          showError('Please enter license number');
          return false;
        }
        return true;

      case 3: // Vehicle Details
        if (!form.vehicleType) {
          showError('Please select vehicle type');
          return false;
        }
        if (!form.vehicleNumber?.trim()) {
          showError('Please enter vehicle number');
          return false;
        }
        if (!form.vehicleRC) {
          showError('Please upload vehicle RC');
          return false;
        }
        // if (!form.rcNumber?.trim()) {
        //   showError('Please enter RC number');
        //   return false;
        // }
        if (!form.vehiclePhoto) {
          showError('Please upload vehicle photo');
          return false;
        }
        return true;

      case 4: // Bank Details
        if (!form.accountHolderName?.trim()) {
          showError('Please enter account holder name');
          return false;
        }
        if (!form.accountNumber?.trim()) {
          showError('Please enter account number');
          return false;
        }
        if (!form.ifscCode || form.ifscCode.length !== 11) {
          showError('Please enter valid IFSC code');
          return false;
        }
        if (!form.bankName?.trim()) {
          showError('Please enter bank name');
          return false;
        }
        return true;

      default:
        return true;
    }
  };

  const showError = message => {
    Alert.alert(
      'Missing Information',
      message,
      [{ text: 'Got it', style: 'default' }],
      { cancelable: true },
    );
  };

  const handleSubmit = async () => {
    // Validate final step
    if (!validateStep()) return;

    setLoading(true);

    try {
      const token = await getToken();

      if (!token) {
        Alert.alert('Error', 'Session expired. Please login again.');
        navigation.navigate('Login');
        return;
      }

      const formData = new FormData();

      // Append all text fields
      const textFields = {
        fullName: form.fullName,
        email: form.email,
        dateOfBirth: form.dateOfBirth,
        phone: form.phone,
        vehicleType: form.vehicleType,
        vehicleNumber: form.vehicleNumber,
        // vehicleModel: form.vehicleModel || '',
        // vehicleYear: form.vehicleYear || '',
        // vehicleColor: form.vehicleColor || '',
        accountHolderName: form.accountHolderName,
        accountNumber: form.accountNumber,
        ifscCode: form.ifscCode,
        bankName: form.bankName,
        branchName: form.branchName || '',
        aadharNumber: form.aadharNumber,
        licenseNumber: form.licenseNumber,
        // rcNumber: form.rcNumber,
      };

      // Add address as JSON string
      const addressObj = {
        street: form.address,
        city: form.city,
        state: form.state,
        pincode: form.pincode,
      };
      formData.append('address', JSON.stringify(addressObj));

      // Append all text fields
      Object.entries(textFields).forEach(([key, value]) => {
        if (value) formData.append(key, value);
      });

      // Append all files
      const fileFields = [
        'profilePhoto',
        'aadharFront',
        'aadharBack',
        'panCard',
        'drivingLicense',
        'vehicleRC',
        'vehiclePhoto',
      ];

      fileFields.forEach(field => {
        if (form[field]) {
          formData.append(field, {
            uri: form[field].uri,
            type: form[field].type || 'image/jpeg',
            name: form[field].fileName || `${field}.jpg`,
          });
        }
      });

      const response = await axios.post(`${BASE_URL}/register`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000,
      });

      if (response.data?.data?.verificationStatus === 'submitted') {
        Alert.alert(
          'Success!',
          response.data.message ||
            'Registration successful! Your application is under review.',
          [
            {
              text: 'OK',
              onPress: () => setVerifyStatusVal('PENDING'),
            },
          ],
        );
      } else {
        navigation.navigate('MyTabs');
      }
    } catch (error) {
      console.error(
        'Submission error:',
        error.response || error.message || error,
      );

      // Safely extract error message
      let errorMessage = 'Registration failed. Please try again.';

      if (error.response?.data) {
        const data = error.response.data;
        if (typeof data.message === 'string') {
          errorMessage = data.message;
        } else if (data.message === true) {
          errorMessage = 'Success';
        } else if (data.message === false) {
          errorMessage = 'Failed';
        } else if (data.error) {
          errorMessage =
            typeof data.error === 'string'
              ? data.error
              : JSON.stringify(data.error);
        }
      } else if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert('Error ---', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const renderProgressBar = () => {
    const progress = (step / 4) * 100;
    return (
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBar, { width: `${progress}%` }]} />
      </View>
    );
  };

  const renderImagePicker = (
    title,
    key,
    showCamera = true,
    required = true,
  ) => (
    <View style={styles.uploadCard}>
      <View style={styles.uploadHeader}>
        <View style={styles.uploadTitleContainer}>
          <Icon
            name={form.uploadStatus[key] ? 'check-circle' : 'cloud-upload'}
            size={20}
            color={form.uploadStatus[key] ? '#4CAF50' : '#666'}
          />
          <Text style={styles.uploadTitle}>
            {title} {required && <Text style={styles.requiredStar}>*</Text>}
          </Text>
        </View>
        {form.uploadStatus[key] && (
          <TouchableOpacity
            onPress={() => removeFile(key)}
            style={styles.removeBtn}
          >
            <Icon name="close" size={18} color="#FF3B30" />
          </TouchableOpacity>
        )}
      </View>

      {!form[key] ? (
        <View style={styles.uploadActions}>
          <TouchableOpacity
            style={styles.uploadBtn}
            onPress={() => pickImage(key, false)}
          >
            <Icon name="photo-library" size={24} color="#F4C20D" />
            <Text style={styles.uploadBtnText}>Gallery</Text>
          </TouchableOpacity>

          {showCamera && (
            <TouchableOpacity
              style={styles.uploadBtn}
              onPress={async () => {
                const hasPermission = await requestCameraPermission();
                if (hasPermission) {
                  pickImage(key, true);
                } else {
                  Alert.alert('Permission Denied', 'Camera access is required');
                }
              }}
            >
              <Icon name="camera-alt" size={24} color="#F4C20D" />
              <Text style={styles.uploadBtnText}>Camera</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.previewWrapper}>
          <Image source={{ uri: form[key].uri }} style={styles.previewImage} />
          <View style={styles.previewInfo}>
            <Icon name="insert-drive-file" size={16} color="#666" />
            <Text style={styles.previewFileName} numberOfLines={1}>
              {form[key].fileName || 'Document uploaded'}
            </Text>
          </View>
        </View>
      )}
    </View>
  );

  const renderCustomAlert = ({ title, message, type }) => (
    <View
      style={[
        styles.customAlert,
        type === 'success' && styles.customAlertSuccess,
      ]}
    >
      <Icon
        name={type === 'success' ? 'check-circle' : 'info'}
        size={20}
        color={type === 'success' ? '#4CAF50' : '#F4C20D'}
      />
      <View style={styles.customAlertContent}>
        <Text style={styles.customAlertTitle}>{title}</Text>
        <Text style={styles.customAlertMessage}>{message}</Text>
      </View>
    </View>
  );

  // Status check screens
  if (verifyStatus === 'PENDING' || verifyStatus === 'submitted') {
    return (
      <View style={styles.reviewContainer}>
        <StatusBar backgroundColor="#fff" barStyle="dark-content" />
        <View style={styles.reviewContent}>
          <View style={styles.statusBadgePending}>
            <Icon name="hourglass-top" size={48} color="#F4C20D" />
          </View>
          <Text style={styles.reviewTitle}>Application Under Review</Text>
          <Text style={styles.reviewText}>
            Your documents have been submitted successfully. Our team is
            currently verifying your details. This usually takes 24-48 hours.
          </Text>
          <View style={styles.infoPoint}>
            <Icon name="info" size={18} color="#666" />
            <Text style={styles.infoPointText}>
              We will notify you once verified.
            </Text>
          </View>
          <TouchableOpacity style={styles.refreshBtn} onPress={checkStatus}>
            <Text style={styles.refreshBtnText}>REFRESH STATUS</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (verifyStatus === 'partially_verified' || verifyStatus === 'rejected') {
    return (
      <View style={styles.reviewContainer}>
        <StatusBar backgroundColor="#fff" barStyle="dark-content" />
        <View style={styles.reviewContent}>
          <View style={styles.statusBadgeError}>
            <Icon name="error-outline" size={48} color="#FF3B30" />
          </View>
          <Text style={styles.reviewTitle}>Application Rejected</Text>
          <Text style={styles.rejectReasonText}>
            Reason: {rejectReason || 'Document verification failed.'}
          </Text>
          <Text style={styles.reviewText}>
            Please re-submit your documents with correct information to proceed.
          </Text>
          <TouchableOpacity
            style={styles.reSubmitBtn}
            onPress={() => setVerifyStatusVal('PENDING')}
          >
            <Text style={styles.reSubmitBtnText}>RE-SUBMIT DOCUMENTS</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading && step === 1) {
    return (
      <View style={styles.loadingContainerFull}>
        <ActivityIndicator size="large" color="#F4C20D" />
        <Text style={styles.loadingTextFull}>Loading...</Text>
      </View>
    );
  }

  // Main Registration Form
  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#F4C20D" barStyle="dark-content" />

      {/* Header with Gradient */}
      <LinearGradient colors={['#F4C20D', '#F5D142']} style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Icon name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Driver Application</Text>
          <Text style={styles.headerSubtitle}>
            Step {step} of 4:{' '}
            {step === 1
              ? 'Personal Info'
              : step === 2
              ? 'Identity Docs'
              : step === 3
              ? 'Vehicle Details'
              : 'Bank Details'}
          </Text>
        </View>
        <TouchableOpacity onPress={()=> navigation.navigate('HelpDetail')} style={styles.headerRight}>
          <Icon name="support-agent" size={24} color="#000" />
        </TouchableOpacity>
      </LinearGradient>

      {renderProgressBar()}

      {(loading || uploading) && (
        <View style={styles.globalLoader}>
          <ActivityIndicator size="large" color="#F4C20D" />
          <Text style={styles.loaderText}>
            {uploading ? 'Uploading documents...' : 'Submitting...'}
          </Text>
        </View>
      )}

      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <ScrollView
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* STEP 1 - Personal Information */}
          {step === 1 && (
            <View>
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Icon name="person" size={24} color="#F4C20D" />
                  <Text style={styles.sectionTitle}>Personal Information</Text>
                </View>

                {/* Profile Photo */}
                {renderImagePicker('Profile Photo', 'profilePhoto', true, true)}

                <View style={styles.inputContainer}>
                  <Icon
                    name="badge"
                    size={20}
                    color="#999"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    placeholder="Full Name *"
                    style={styles.input}
                    placeholderTextColor="#999"
                    value={form.fullName}
                    onChangeText={v => setForm({ ...form, fullName: v })}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Icon
                    name="email"
                    size={20}
                    color="#999"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    placeholder="Email Address *"
                    style={styles.input}
                    placeholderTextColor="#999"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={form.email}
                    onChangeText={v => setForm({ ...form, email: v })}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Icon
                    name="cake"
                    size={20}
                    color="#999"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    placeholder="Date of Birth * (YYYY-MM-DD)"
                    style={styles.input}
                    placeholderTextColor="#999"
                    value={form.dateOfBirth}
                    onChangeText={v => setForm({ ...form, dateOfBirth: v })}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Icon
                    name="home"
                    size={20}
                    color="#999"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    placeholder="Street Address *"
                    style={styles.input}
                    placeholderTextColor="#999"
                    value={form.address}
                    onChangeText={v => setForm({ ...form, address: v })}
                  />
                </View>

                <View style={styles.rowContainer}>
                  <View style={[styles.inputContainer, styles.halfInput]}>
                    <Icon
                      name="location-city"
                      size={20}
                      color="#999"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      placeholder="City *"
                      style={styles.input}
                      placeholderTextColor="#999"
                      value={form.city}
                      onChangeText={v => setForm({ ...form, city: v })}
                    />
                  </View>

                  <View style={[styles.inputContainer, styles.halfInput]}>
                    <Icon
                      name="map"
                      size={20}
                      color="#999"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      placeholder="State *"
                      style={styles.input}
                      placeholderTextColor="#999"
                      value={form.state}
                      onChangeText={v => setForm({ ...form, state: v })}
                    />
                  </View>
                </View>

                <View style={styles.inputContainer}>
                  <Icon
                    name="pin-drop"
                    size={20}
                    color="#999"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    placeholder="Pincode *"
                    style={styles.input}
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                    maxLength={6}
                    value={form.pincode}
                    onChangeText={v =>
                      setForm({ ...form, pincode: v.replace(/[^0-9]/g, '') })
                    }
                  />
                </View>
              </View>
            </View>
          )}

          {/* STEP 2 - Identity Documents */}
          {step === 2 && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Icon name="description" size={24} color="#F4C20D" />
                <Text style={styles.sectionTitle}>Identity Documents</Text>
              </View>

              {/* Aadhar Front & Back */}
              {renderImagePicker(
                'Aadhar Card (Front)',
                'aadharFront',
                true,
                true,
              )}
              {renderImagePicker(
                'Aadhar Card (Back)',
                'aadharBack',
                true,
                true,
              )}

              <View style={styles.inputContainer}>
                <Icon
                  name="credit-card"
                  size={20}
                  color="#999"
                  style={styles.inputIcon}
                />
                <TextInput
                  placeholder="Aadhar Number * (12 digits)"
                  style={styles.input}
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                  maxLength={12}
                  value={form.aadharNumber}
                  onChangeText={v =>
                    setForm({ ...form, aadharNumber: v.replace(/[^0-9]/g, '') })
                  }
                />
              </View>

              {/* PAN Card */}
              {renderImagePicker('PAN Card', 'panCard', true, true)}

              {/* Driving License */}
              {renderImagePicker(
                'Driving License',
                'drivingLicense',
                true,
                true,
              )}

              <View style={styles.inputContainer}>
                <Icon
                  name="confirmation-number"
                  size={20}
                  color="#999"
                  style={styles.inputIcon}
                />
                <TextInput
                  placeholder="License Number *"
                  style={styles.input}
                  placeholderTextColor="#999"
                  maxLength={16}
                  autoCapitalize="characters"
                  // keyboardType="numeric"
                  value={form.licenseNumber}
                  onChangeText={v => setForm({ ...form, licenseNumber: v })}
                />
              </View>
            </View>
          )}

          {/* STEP 3 - Vehicle Details */}
          {step === 3 && (
            <View>
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Icon name="directions-car" size={24} color="#F4C20D" />
                  <Text style={styles.sectionTitle}>Vehicle Information</Text>
                </View>

                {/* Vehicle Photo */}
                {renderImagePicker(
                  'Vehicle Photograph',
                  'vehiclePhoto',
                  true,
                  true,
                )}

                <View style={styles.selectorContainer}>
                  <Text style={styles.label}>
                    Vehicle Type <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.categoryScrollContent}
                  >
                    {VEHICLE_TYPES.map(type => (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.typeChip,
                          form.vehicleType === type && styles.typeChipActive,
                        ]}
                        onPress={() => setForm({ ...form, vehicleType: type })}
                      >
                        <Icon
                          name={getVehicleIcon(type)}
                          size={25}
                          color={form.vehicleType === type ? '#000' : '#333'}
                        />

                        <Text
                          style={[
                            styles.typeChipText,
                            form.vehicleType === type &&
                              styles.typeChipTextActive,
                          ]}
                        >
                          {type}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.inputContainer}>
                  <Icon
                    name="local-taxi"
                    size={20}
                    color="#999"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    placeholder="Vehicle Number * (e.g., MH12AB1234)"
                    style={styles.input}
                    placeholderTextColor="#999"
                    autoCapitalize="characters"
                    maxLength={10}
                    value={form.vehicleNumber}
                    onChangeText={v => setForm({ ...form, vehicleNumber: v })}
                  />
                </View>

                {/* <View style={styles.rowContainer}>
                  <View style={[styles.inputContainer, styles.halfInput]}>
                    <Icon
                      name="model-training"
                      size={20}
                      color="#999"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      placeholder="Model"
                      style={styles.input}
                      placeholderTextColor="#999"
                      value={form.vehicleModel}
                      onChangeText={v => setForm({ ...form, vehicleModel: v })}
                    />
                  </View>

                  <View style={[styles.inputContainer, styles.halfInput]}>
                    <Icon
                      name="calendar-today"
                      size={20}
                      color="#999"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      placeholder="Year"
                      style={styles.input}
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                      maxLength={4}
                      value={form.vehicleYear}
                      onChangeText={v =>
                        setForm({
                          ...form,
                          vehicleYear: v.replace(/[^0-9]/g, ''),
                        })
                      }
                    />
                  </View>
                </View>

                <View style={styles.inputContainer}>
                  <Icon
                    name="color-lens"
                    size={20}
                    color="#999"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    placeholder="Color"
                    style={styles.input}
                    placeholderTextColor="#999"
                    value={form.vehicleColor}
                    onChangeText={v => setForm({ ...form, vehicleColor: v })}
                  />
                </View> */}
              </View>

              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Icon name="assignment" size={24} color="#F4C20D" />
                  <Text style={styles.sectionTitle}>Vehicle Documents</Text>
                </View>

                {/* Vehicle RC */}
                {renderImagePicker('Vehicle RC', 'vehicleRC', true, true)}

                {/* <View style={styles.inputContainer}>
                  <Icon
                    name="confirmation-number"
                    size={20}
                    color="#999"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    placeholder="RC Number *"
                    style={styles.input}
                    placeholderTextColor="#999"
                    value={form.rcNumber}
                    onChangeText={v => setForm({ ...form, rcNumber: v })}
                  />
                </View> */}
              </View>
            </View>
          )}

          {/* STEP 4 - Bank Details */}
          {step === 4 && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Icon name="account-balance" size={24} color="#F4C20D" />
                <Text style={styles.sectionTitle}>Bank Account Details</Text>
              </View>

              <View style={styles.inputContainer}>
                <Icon
                  name="person"
                  size={20}
                  color="#999"
                  style={styles.inputIcon}
                />
                <TextInput
                  placeholder="Account Holder Name *"
                  style={styles.input}
                  placeholderTextColor="#999"
                  value={form.accountHolderName}
                  onChangeText={v => setForm({ ...form, accountHolderName: v })}
                />
              </View>

              <View style={styles.inputContainer}>
                <Icon
                  name="credit-card"
                  size={20}
                  color="#999"
                  style={styles.inputIcon}
                />
                <TextInput
                  placeholder="Account Number *"
                  style={styles.input}
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                  value={form.accountNumber}
                  onChangeText={v => setForm({ ...form, accountNumber: v })}
                />
              </View>

              <View style={styles.inputContainer}>
                <Icon
                  name="qr-code"
                  size={20}
                  color="#999"
                  style={styles.inputIcon}
                />
                <TextInput
                  placeholder="IFSC Code *"
                  style={styles.input}
                  placeholderTextColor="#999"
                  value={form.ifscCode}
                  onChangeText={detectBank}
                  autoCapitalize="characters"
                  maxLength={11}
                />
              </View>

              {loading && (
                <View style={styles.loadingContainer}>
                  <Icon name="hourglass-empty" size={20} color="#F4C20D" />
                  <Text style={styles.loadingText}>
                    Fetching bank details...
                  </Text>
                </View>
              )}

              <View
                style={[styles.inputContainer, styles.disabledInputContainer]}
              >
                <Icon
                  name="account-balance"
                  size={20}
                  color="#999"
                  style={styles.inputIcon}
                />
                <TextInput
                  placeholder="Bank Name"
                  value={form.bankName}
                  editable={false}
                  style={[styles.input, styles.disabledInput]}
                  placeholderTextColor="#999"
                />
              </View>

              <View
                style={[styles.inputContainer, styles.disabledInputContainer]}
              >
                <Icon
                  name="location-city"
                  size={20}
                  color="#999"
                  style={styles.inputIcon}
                />
                <TextInput
                  placeholder="Branch Name"
                  value={form.branchName}
                  editable={false}
                  style={[styles.input, styles.disabledInput]}
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.infoBox}>
                <Icon name="info" size={20} color="#F4C20D" />
                <Text style={styles.infoText}>
                  Your bank details are encrypted and securely stored
                </Text>
              </View>
            </View>
          )}
        </ScrollView>
      </Animated.View>

      {/* Footer Navigation */}
      <View style={styles.footer}>
        {step > 1 && (
          <TouchableOpacity
            style={[styles.footerBtn, styles.secondaryBtn]}
            onPress={() => setStep(step - 1)}
            disabled={loading || uploading}
          >
            <Icon name="arrow-back" size={20} color="#666" />
            <Text style={styles.secondaryBtnText}>Back</Text>
          </TouchableOpacity>
        )}

        {step < 4 ? (
          <TouchableOpacity
            style={[
              styles.footerBtn,
              styles.primaryBtn,
              step > 1 && styles.flex2,
            ]}
            onPress={handleNext}
            disabled={loading || uploading}
          >
            <Text style={styles.primaryBtnText}>Continue</Text>
            <Icon name="arrow-forward" size={20} color="#000" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.footerBtn, styles.submitBtn]}
            onPress={handleSubmit}
            disabled={loading || uploading}
          >
            {loading || uploading ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <Icon name="check-circle" size={20} color="#000" />
                <Text style={styles.primaryBtnText}>Submit Application</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },

  headerSubtitle: {
    fontSize: 12,
    color: '#333',
    marginTop: 2,
  },

  headerRight: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  progressBarContainer: {
    height: 4,
    backgroundColor: '#E0E0E0',
    width: '100%',
  },

  progressBar: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 2,
  },

  content: {
    flex: 1,
  },

  scrollContent: {
    padding: 20,
  },

  sectionCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingBottom: 15,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 10,
  },

  sectionSubtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
    marginBottom: 10,
    marginTop: 5,
  },

  rowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },

  halfInput: {
    flex: 1,
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    marginBottom: 15,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },

  inputIcon: {
    marginRight: 10,
  },

  input: {
    flex: 1,
    paddingVertical: 15,
    fontSize: 14,
    color: '#333',
  },

  disabledInputContainer: {
    backgroundColor: '#F0F0F0',
  },

  disabledInput: {
    color: '#666',
  },

  uploadCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderStyle: 'dashed',
  },

  uploadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },

  uploadTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  uploadTitle: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
    fontWeight: '500',
  },

  requiredStar: {
    color: '#FF3B30',
  },

  removeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFE5E5',
    justifyContent: 'center',
    alignItems: 'center',
  },

  uploadActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 10,
  },

  uploadBtn: {
    flex: 1,
    backgroundColor: '#FFF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F4C20D',
  },

  uploadBtnText: {
    fontSize: 14,
    color: '#333',
    marginTop: 5,
    fontWeight: '500',
  },

  previewWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 10,
  },

  previewImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },

  previewInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    padding: 8,
    borderRadius: 8,
  },

  previewFileName: {
    flex: 1,
    fontSize: 12,
    color: '#666',
    marginLeft: 6,
  },

  selectorContainer: {
    marginBottom: 20,
  },

  label: {
    fontSize: 14,
    color: '#333',
    marginBottom: 12,
    fontWeight: '600',
  },

  categoryScrollContent: {
    paddingHorizontal: 5,
    gap: 8,
    paddingBottom: 5,
  },

  typeChip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#F8F9FA',
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    alignItems:'center'
  },

  typeChipActive: {
    backgroundColor: '#F4C20D',
    borderColor: '#F4C20D',
  },

  typeChipText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },

  typeChipTextActive: {
    color: '#000',
    fontWeight: '600',
  },

  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#FFF9E6',
    borderRadius: 8,
  },

  loadingText: {
    fontSize: 14,
    color: '#F4C20D',
    marginLeft: 8,
  },

  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9E6',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },

  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },

  footer: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    gap: 12,
  },

  footerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 14,
    gap: 8,
  },

  flex2: {
    flex: 2,
  },

  primaryBtn: {
    backgroundColor: '#F4C20D',
  },

  secondaryBtn: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },

  submitBtn: {
    backgroundColor: '#4CAF50',
    flex: 2,
  },

  primaryBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },

  secondaryBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },

  globalLoader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },

  loaderText: {
    marginTop: 10,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },

  // Custom Alert Styles
  customAlert: {
    flexDirection: 'row',
    backgroundColor: '#FFF9E6',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F4C20D',
  },

  customAlertSuccess: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
  },

  customAlertContent: {
    flex: 1,
    marginLeft: 12,
  },

  customAlertTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },

  customAlertMessage: {
    fontSize: 12,
    color: '#666',
  },

  loadingContainerFull: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },

  loadingTextFull: {
    marginTop: 15,
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },

  reviewContainer: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 30,
    justifyContent: 'center',
  },

  reviewContent: {
    alignItems: 'center',
  },

  reviewLogo: {
    width: 120,
    height: 120,
    marginBottom: 40,
  },

  statusBadgePending: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFF9E6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },

  statusBadgeError: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFE5E5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },

  reviewTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#000',
    marginBottom: 16,
    textAlign: 'center',
  },

  reviewText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
  },

  rejectReasonText: {
    fontSize: 14,
    color: '#FF3B30',
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
    backgroundColor: '#FFE5E5',
    padding: 12,
    borderRadius: 8,
    width: '100%',
  },

  infoPoint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
  },

  infoPointText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 8,
    fontWeight: '500',
  },

  refreshBtn: {
    width: '100%',
    backgroundColor: '#F4C20D',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    ...theme.shadow.card,
  },

  refreshBtnText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 1,
  },

  reSubmitBtn: {
    width: '100%',
    backgroundColor: '#000',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    ...theme.shadow.card,
  },

  reSubmitBtnText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 1,
  },
});

export default DocumentScreen;
