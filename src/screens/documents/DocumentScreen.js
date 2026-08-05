import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  BackHandler,
} from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../../services/api';
import { theme } from '../../theme';
import DatePicker from 'react-native-date-picker';

const { width } = Dimensions.get('window');

const VEHICLE_TYPES = [
  'Bike',
  'Scooter',
  'Loader (3 Wheeler)',
  'Truck (4 Wheeler)',
];

const STATE_CITY_DATA = {
  'Madhya Pradesh': ['Indore', 'Bhopal', 'Ujjain', 'Dewas', 'Ratlam'],
  Maharashtra: ['Mumbai', 'Pune', 'Nagpur', 'Nashik'],
  Rajasthan: ['Jaipur', 'Udaipur', 'Kota', 'Jodhpur'],
  Gujarat: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot'],
};

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
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const scrollViewRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [verifyStatus, setVerifyStatusVal] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [openDatePicker, setOpenDatePicker] = useState(false);
  const phoneData = route?.params?.phone;
  const statusData = route?.params?.data;
  const [showStateList, setShowStateList] = useState(false);
  const [showCityList, setShowCityList] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [driverData, setDriverData] = useState(null);

  const getPaymentStatus = data => {
    const payment =
      data?.subscriptionPayment ||
      data?.joiningFeePayment ||
      data?.payment ||
      {};

    return (
      payment?.status ||
      data?.subscriptionPaymentStatus ||
      data?.joiningFeePaymentStatus ||
      data?.paymentStatus ||
      ''
    );
  };

  const isJoiningFeePaid = data => {
    if (
      data?.joiningFeePaid === true ||
      data?.isJoiningFeePaid === true ||
      data?.subscriptionPaid === true ||
      data?.isSubscriptionPaid === true
    ) {
      return true;
    }

    return ['completed', 'paid', 'success', 'captured'].includes(
      String(getPaymentStatus(data)).trim().toLowerCase(),
    );
  };

  const getVerificationStatus = data =>
    String(
      data?.verificationStatus || data?.applicationStatus || data?.status || '',
    )
      .trim()
      .toLowerCase();

  const toIsoDate = value => {
    if (!value) return '';

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toISOString();
  };

  const getApplicationId = data => {
    return (
      data?.applicationId ||
      data?._id ||
      data?.id ||
      data?.application?._id ||
      data?.application?.id ||
      data?.subscriptionPayment?.applicationId ||
      data?.joiningFeePayment?.applicationId ||
      driverData?.data?.applicationId ||
      driverData?.data?._id ||
      null
    );
  };

  const buildJoinFeesParams = backendData => ({
    formData: {
      ...form,
      profilePhoto: form.profilePhoto,
      aadharFront: form.aadharFront,
      aadharBack: form.aadharBack,
      panCard: form.panCard,
      drivingLicense: form.drivingLicense,
      vehicleRC: form.vehicleRC,
      vehiclePhoto: form.vehiclePhoto,
      backendData,
      vehicleType: backendData?.vehicleType || form.vehicleType,
    },
    applicationId: getApplicationId(backendData),
  });

  const fetchJoiningFeeStatus = async (token, applicationId) => {
    if (!applicationId) return null;

    const response = await axios.get(
      `${BASE_URL}/subscription/status/${applicationId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    );

    return response?.data?.data || null;
  };

  const navigateAfterVerified = async () => {
    navigation.replace('MyTabs');
  };

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
    // Run only once on screen entry so refresh and navigation stay user-driven.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStatus = async data => {
    const status = getVerificationStatus(data);
    const routeHasPaidJoiningFee = isJoiningFeePaid(data);

    if (status === 'rejected') {
      setVerifyStatusVal('rejected');
      setRejectReason(data?.statusMessage || data?.rejectionReason || '');
      return;
    }

    // 🆕 NEW DRIVER → FORM SHOW
    if (data?.requiresRegistration === true) {
      setVerifyStatusVal('NEW');
      return;
    }

    // 📄 Already Uploaded → check status
    const applicationId = getApplicationId(data);

    if (
      routeHasPaidJoiningFee &&
      !['pending', 'submitted', 'under_review', 'verified'].includes(status)
    ) {
      setVerifyStatusVal('submitted');
      return;
    }

    if (['pending', 'submitted', 'under_review'].includes(status)) {
      if (!applicationId) {
        setVerifyStatusVal(status === 'pending' ? 'PENDING' : 'submitted');
        return;
      }

      let paymentData = null;

      try {
        const token = await AsyncStorage.getItem('userToken');
        paymentData = token
          ? await fetchJoiningFeeStatus(token, applicationId)
          : null;
      } catch (error) {
        console.log(
          'Joining fee status check failed:',
          error?.response?.data || error?.message,
        );
      }

      const latestData = paymentData
        ? {
            ...data,
            ...paymentData,
          }
        : data;
      const latestStatus = getVerificationStatus(latestData) || status;

      if (!isJoiningFeePaid(latestData)) {
        navigation.replace('JoinFees', {
          ...buildJoinFeesParams(data),
          applicationId,
        });
        return;
      }

      if (latestStatus === 'verified') {
        await navigateAfterVerified();
        return;
      }

      setVerifyStatusVal('submitted');
    } else if (status === 'verified') {
      await navigateAfterVerified();
    }
  };

  const checkStatus = async () => {
    try {
      setLoading(true);
      const phone = await AsyncStorage.getItem('userPhone');
      if (phone) setUserPhone(phone);
      const statusPhone = phone || phoneData || form.phone;

      if (statusPhone) {
        const response = await axios
          .get(`${BASE_URL}/status/${statusPhone}`)
          .catch(err => ({
            data: { verifyStatus: 'PENDING', rejectReason: '' },
          }));

        const responseData = response?.data?.data || response?.data || {};
        setRejectReason(
          response?.data?.rejectReason ||
            response?.data?.data?.statusMessage ||
            '',
        );

        if (
          responseData?.verificationStatus ||
          responseData?.applicationStatus
        ) {
          await handleStatus(responseData);
        } else {
          setVerifyStatusVal(response?.data?.verifyStatus || 'PENDING');
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
    city: 'Indore',
    state: 'Madhya Pradesh',
    pincode: '',

    // Vehicle Info
    vehicleType: '',
    vehicleNumber: '',
    vehicleModel: '',
    vehicleYear: '',
    vehicleColor: '',

    // Bank Info
    accountHolderName: '',
    accountNumber: '',
    ifscCode: '',
    bankName: '',
    branchName: '',

    // Document Numbers
    aadharNumber: '',
    licenseNumber: '',

    // Files
    profilePhoto: null,
    aadharFront: null,
    aadharBack: null,
    panCard: null,
    drivingLicense: null,
    vehicleRC: null,
    vehiclePhoto: null,
    hasHiredDriver: null,
    hiredDriverName: '',
    hiredDriverPhone: '',

    // Track upload status
    uploadStatus: {
      profilePhoto: false,
      aadharFront: false,
      aadharBack: false,
      panCard: false,
      drivingLicense: false,
      vehicleRC: false,
      vehiclePhoto: false,
      hiredDriverLicense: false,
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

  const getDraftKey = phone => {
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    return cleanPhone ? `documentFormDraft_${cleanPhone}` : null;
  };

  const getStepKey = phone => {
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    return cleanPhone ? `documentFormStep_${cleanPhone}` : null;
  };

  // Auto-save form and step as draft when editing
  useEffect(() => {
    const saveDraft = async () => {
      const phone = form.phone || userPhone || phoneData;
      const draftKey = getDraftKey(phone);
      const stepKey = getStepKey(phone);

      if (!draftKey || !stepKey) return;

      try {
        if (
          verifyStatus === 'NEW' ||
          verifyStatus === 'PENDING' ||
          verifyStatus === 'rejected' ||
          !verifyStatus
        ) {
          const hasData =
            form.fullName ||
            form.email ||
            form.address ||
            form.aadharNumber ||
            form.licenseNumber ||
            form.vehicleNumber ||
            form.vehicleModel ||
            form.accountHolderName ||
            form.accountNumber;

          if (hasData) {
            await AsyncStorage.setItem(
              'documentFormDraft',
              JSON.stringify(form),
            );
            await AsyncStorage.setItem('documentFormStep', String(step));
            await AsyncStorage.setItem(draftKey, JSON.stringify(form));
            await AsyncStorage.setItem(stepKey, String(step));
          }
        }
      } catch (error) {
        console.error('Error saving document draft:', error);
      }
    };
    saveDraft();
  }, [form, step, verifyStatus, userPhone, phoneData]);

  // Load draft when verifyStatus allows editing
  useEffect(() => {
    const loadDraft = async () => {
      const phone = form.phone || userPhone || phoneData;
      const draftKey = getDraftKey(phone);
      const stepKey = getStepKey(phone);

      if (!draftKey || !stepKey) return;

      try {
        // First try the phone-scoped keys, fallback to global key
        let draftStr = await AsyncStorage.getItem(draftKey);
        let savedStep = await AsyncStorage.getItem(stepKey);

        if (!draftStr) {
          draftStr = await AsyncStorage.getItem('documentFormDraft');
          savedStep = await AsyncStorage.getItem('documentFormStep');
        }

        if (draftStr) {
          const draft = JSON.parse(draftStr);
          if (draft) {
            setForm(prev => {
              const finalPhone = prev.phone || draft.phone || phone || '';
              return {
                ...prev,
                ...draft,
                phone: finalPhone,
              };
            });

            if (savedStep) {
              const stepNum = parseInt(savedStep, 10);
              if (stepNum >= 1 && stepNum <= 5) {
                setStep(stepNum);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error loading document draft:', error);
      }
    };

    if (
      verifyStatus === 'NEW' ||
      verifyStatus === 'PENDING' ||
      verifyStatus === 'rejected'
    ) {
      loadDraft();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verifyStatus, userPhone, phoneData]);

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
        // STEP 1 VALIDATION: Personal Information
        // This step collects driver's personal details and address
        // NOTE: City and State are RESTRICTED to Indore, Madhya Pradesh only

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
        if (!form.vehiclePhoto) {
          showError('Please upload vehicle photo');
          return false;
        }
        return true;

      case 4:
        if (form.hasHiredDriver === 'true') {
          if (!form.hiredDriverName?.trim()) {
            showError('Please enter driver name');
            return false;
          }

          if (
            !form.hiredDriverPhone?.trim() ||
            form.hiredDriverPhone.length !== 10
          ) {
            showError('Please enter valid 10-digit driver phone number');
            return false;
          }

          if (!form.hiredDriverLicense) {
            showError('Please upload driver license');
            return false;
          }
        }

        return true;

      case 5: // Bank Details
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

      const headers = {
        'Content-Type': 'multipart/form-data',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const formData = new FormData();

      // Append all text fields
      const textFields = {
        fullName: form.fullName,
        email: form.email,
        dateOfBirth: toIsoDate(form.dateOfBirth),
        phone: form.phone,
        vehicleType: form.vehicleType,
        vehicleNumber: form.vehicleNumber,
        vehicleModel: form.vehicleModel || '',
        vehicleYear: form.vehicleYear || '',
        vehicleColor: form.vehicleColor || '',
        accountHolderName: form.accountHolderName,
        accountNumber: form.accountNumber,
        ifscCode: form.ifscCode,
        bankName: form.bankName,
        branchName: form.branchName || '',
        aadharNumber: form.aadharNumber,
        licenseNumber: form.licenseNumber,
        hasHiredDriver: form.hasHiredDriver || 'false',
        hiredDriverName:
          form.hasHiredDriver === 'true' ? form.hiredDriverName : '',
        hiredDriverPhone:
          form.hasHiredDriver === 'true' ? form.hiredDriverPhone : '',
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
        'hiredDriverLicense',
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

      const isAvailableLocation =
        form.city?.trim().toLowerCase() === 'indore' &&
        form.state?.trim().toLowerCase() === 'madhya pradesh';

      if (!isAvailableLocation) {
        setShowComingSoon(true);
        return;
      }
      console.log('after register data');

      const response = await axios.post(`${BASE_URL}/register`, formData, {
        headers,
      });

      const vehicleType =
        response?.data?.data?.vehicleType || form.vehicleType || '';

      if (vehicleType) {
        await AsyncStorage.setItem('vehicleType', vehicleType);
      }

      console.log('response data of document', response.data);

      // Clear draft on successful submission
      const phone = form.phone || userPhone || phoneData;
      const draftKey = getDraftKey(phone);
      const stepKey = getStepKey(phone);
      if (draftKey && stepKey) {
        await AsyncStorage.removeItem(draftKey);
        await AsyncStorage.removeItem(stepKey);
      }
      await AsyncStorage.removeItem('documentFormDraft');
      await AsyncStorage.removeItem('documentFormStep');

      setDriverData(response?.data);

      navigation.replace('JoinFees', {
        ...buildJoinFeesParams(response?.data?.data || response?.data),
        applicationId: getApplicationId(response?.data?.data || response?.data),
      });
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
    const progress = (step / 5) * 100;
    return (
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBar, { width: `${progress}%` }]} />
      </View>
    );
  };

  const handleBackPress = async () => {
    const fees = await AsyncStorage.getItem('subscribtion_fees');

    if (fees) {
      BackHandler.exitApp();
    } else {
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        BackHandler.exitApp();
      }
    }
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
            color={form.uploadStatus[key] ? '#4CAF50' : '#6B7280'}
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
            <Icon name="photo-library" size={24} color="#fccf1e" />
            <Text style={styles.uploadBtnText}>{t('Gallery')}</Text>
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
              <Icon name="camera-alt" size={24} color="#fccf1e" />
              <Text style={styles.uploadBtnText}>{t('Camera')}</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.previewWrapper}>
          <Image source={{ uri: form[key].uri }} style={styles.previewImage} />
          <View style={styles.previewInfo}>
            <Icon name="insert-drive-file" size={16} color="#6B7280" />
            <Text style={styles.previewFileName} numberOfLines={1}>
              {form[key].fileName || 'Document uploaded'}
            </Text>
          </View>
        </View>
      )}
    </View>
  );

  // Status check screens
  if (verifyStatus === 'submitted') {
    return (
      <View style={styles.reviewContainer}>
        <StatusBar backgroundColor="#FFFFFF" barStyle="dark-content" />
        <View style={styles.reviewContent}>
          <View style={styles.statusBadgePending}>
            <Icon name="hourglass-top" size={48} color="#fccf1e" />
          </View>
          <Text style={styles.reviewTitle}>{t('Application Under Review')}</Text>
          <Text style={styles.reviewText}>
            Your documents have been submitted successfully. Our team is
            currently verifying your details. This usually takes 24-48 hours.
          </Text>
          <View style={styles.infoPoint}>
            <Icon name="info" size={18} color="#6B7280" />
            <Text style={styles.infoPointText}>
              We will notify you once verified.
            </Text>
          </View>
          <TouchableOpacity style={styles.refreshBtn} onPress={checkStatus}>
            <Text style={styles.refreshBtnText}>{t('REFRESH STATUS')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (verifyStatus === 'partially_verified' || verifyStatus === 'rejected') {
    return (
      <View style={styles.reviewContainer}>
        <StatusBar backgroundColor="#FFFFFF" barStyle="dark-content" />
        <View style={styles.reviewContent}>
          <View style={styles.statusBadgeError}>
            <Icon name="error-outline" size={48} color="#FF3B30" />
          </View>
          <Text style={styles.reviewTitle}>{t('Application Rejected')}</Text>
          <Text style={styles.rejectReasonText}>
            {t('Reason: ')}{rejectReason || 'Document verification failed.'}
          </Text>
          <Text style={styles.reviewText}>
            Please re-submit your documents with correct information to proceed.
          </Text>
          <TouchableOpacity
            style={styles.reSubmitBtn}
            onPress={() => setVerifyStatusVal('PENDING')}
          >
            <Text style={styles.reSubmitBtnText}>{t('RE-SUBMIT DOCUMENTS')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading && step === 1) {
    return (
      <View style={styles.loadingContainerFull}>
        <ActivityIndicator size="large" color="#fccf1e" />
        <Text style={styles.loadingTextFull}>{t('Loading...')}</Text>
      </View>
    );
  }

  if (showComingSoon) {
    return (
      <View style={styles.comingSoonContainer}>
        <StatusBar backgroundColor="#FFFFFF" barStyle="dark-content" />

        <View style={styles.comingSoonIconBox}>
          <Icon name="location-off" size={70} color="#fccf1e" />
        </View>

        <Text style={styles.comingSoonTitle}>{t('Coming Soon!')}</Text>

        <Text style={styles.comingSoonText}>
          Currently GoDelivo Captain registration is available only in Indore,
          Madhya Pradesh.
        </Text>

        <Text style={styles.comingSoonSubText}>
          We will launch in your city soon.
        </Text>

        <TouchableOpacity
          style={styles.comingSoonBtn}
          onPress={() => {
            setShowComingSoon(false);
            setStep(1);
          }}
        >
          <Text style={styles.comingSoonBtnText}>{t('Change Location')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Main Registration Form
  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#fccf1e" barStyle="dark-content" />

      {/* Header with Gradient */}
      <LinearGradient colors={['#fccf1e', '#fccf1e']} style={styles.header}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems:'center', gap:'28%'}}>
          <View>
            <Text style={styles.headerTitle}>{t('Driver Application')}</Text>
            <Text style={styles.headerSubtitle}>
              Step {step} of 5:{' '}
              {step === 1
                ? 'Personal Info'
                : step === 2
                ? 'Identity Docs'
                : step === 3
                ? 'Vehicle Details'
                : step === 4
                ? 'Driver Details'
                : 'Bank Details'}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => navigation.navigate('HelpDetail')}
            style={styles.headerRight}
          >
            <Icon name="support-agent" size={24} color="#000" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {renderProgressBar()}

      {(loading || uploading) && (
        <View style={styles.globalLoader}>
          <ActivityIndicator size="large" color="#fccf1e" />
          <Text style={styles.loaderText}>
            {uploading ? t('Uploading documents...') : t('Submitting...')}
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
                  <Icon name="person" size={24} color="#fccf1e" />
                  <Text style={styles.sectionTitle}>{t('Personal Information')}</Text>
                </View>

                {/* Profile Photo */}
                {renderImagePicker(t('Profile Photo'), 'profilePhoto', true, true)}

                <View style={styles.inputContainer}>
                  <Icon
                    name="badge"
                    size={20}
                    color="#999"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    placeholder={t('Full Name *')}
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
                    placeholder={t('Email Address *')}
                    style={styles.input}
                    placeholderTextColor="#999"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={form.email}
                    onChangeText={v => setForm({ ...form, email: v })}
                  />
                </View>

                <TouchableOpacity
                  style={styles.inputContainer}
                  activeOpacity={0.8}
                  onPress={() => setOpenDatePicker(true)}
                >
                  <Icon
                    name="cake"
                    size={20}
                    color="#999"
                    style={styles.inputIcon}
                  />

                  <TouchableOpacity
                    style={{ flex: 1 }}
                    activeOpacity={0.8}
                    onPress={() => setOpenDatePicker(true)}
                  >
                    <TextInput
                      placeholder={t('Date of Birth *')}
                      style={styles.input}
                      placeholderTextColor="#999"
                      value={form.dateOfBirth}
                      editable={false}
                      pointerEvents="none"
                    />
                  </TouchableOpacity>

                  <DatePicker
                    modal
                    mode="date"
                    open={openDatePicker}
                    date={
                      form.dateOfBirth ? new Date(form.dateOfBirth) : new Date()
                    }
                    maximumDate={new Date()}
                    onConfirm={date => {
                      setOpenDatePicker(false);

                      const formattedDate = date.toISOString().split('T')[0];

                      setForm({
                        ...form,
                        dateOfBirth: formattedDate,
                      });
                    }}
                    onCancel={() => {
                      setOpenDatePicker(false);
                    }}
                  />
                </TouchableOpacity>

                <View style={styles.inputContainer}>
                  <Icon
                    name="home"
                    size={20}
                    color="#999"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    placeholder={t('Street Address *')}
                    style={styles.input}
                    placeholderTextColor="#999"
                    value={form.address}
                    onChangeText={v => setForm({ ...form, address: v })}
                  />
                </View>

                {/*
                  STEP 1 - CITY & STATE INPUT
                  Restricted to: Indore, Madhya Pradesh only
                  These fields are required for driver verification
                  Only drivers from Indore, Madhya Pradesh are currently supported
                */}
                <View style={styles.rowContainer_box}>
                  {/* State Select */}
                  <View style={[styles.dropdownWrapper, styles.halfInput]}>
                    <TouchableOpacity
                      style={styles.inputContainer}
                      activeOpacity={0.8}
                      onPress={() => setShowStateList(!showStateList)}
                    >
                      <Icon
                        name="map"
                        size={20}
                        color="#999"
                        style={styles.inputIcon}
                      />

                      <Text
                        style={[
                          styles.input,
                          { color: form.state ? '#111827' : '#8A8A8A' },
                        ]}
                      >
                        {form.state || t('Select State *')}
                      </Text>

                      <Icon name="keyboard-arrow-down" size={22} color="#999" />
                    </TouchableOpacity>

                    {showStateList && (
                      <View style={styles.dropdownList}>
                        {Object.keys(STATE_CITY_DATA).map(stateName => (
                          <TouchableOpacity
                            key={stateName}
                            style={styles.dropdownItem}
                            onPress={() => {
                              setForm({
                                ...form,
                                state: stateName,
                                city: '',
                              });
                              setShowStateList(false);
                              setShowCityList(false);
                            }}
                          >
                            <Text style={styles.dropdownText} numberOfLines={1}>
                              {stateName}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>

                  {/* City Select */}
                  <View style={[styles.dropdownWrapper, styles.halfInput]}>
                    <TouchableOpacity
                      style={styles.inputContainer}
                      activeOpacity={0.8}
                      onPress={() => {
                        if (!form.state) {
                          showError('Please select state first');
                          return;
                        }
                        setShowCityList(!showCityList);
                      }}
                    >
                      <Icon
                        name="location-city"
                        size={20}
                        color="#999"
                        style={styles.inputIcon}
                      />

                      <Text
                        style={[
                          styles.input,
                          { color: form.city ? '#111827' : '#8A8A8A' },
                        ]}
                      >
                        {form.city || t('Select City *')}
                      </Text>

                      <Icon name="keyboard-arrow-down" size={22} color="#999" />
                    </TouchableOpacity>

                    {showCityList && (
                      <View style={styles.dropdownList}>
                        {STATE_CITY_DATA[form.state]?.map(cityName => (
                          <TouchableOpacity
                            key={cityName}
                            style={styles.dropdownItem}
                            onPress={() => {
                              setForm({
                                ...form,
                                city: cityName,
                              });
                              setShowCityList(false);
                            }}
                          >
                            <Text style={styles.dropdownText}>{cityName}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
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
                    placeholder={t('Pincode *')}
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
                <Icon name="description" size={24} color="#fccf1e" />
                <Text style={styles.sectionTitle}>{t('Identity Documents')}</Text>
              </View>

              {/* Aadhar Front & Back */}
              {renderImagePicker(
                t('Aadhar Card (Front)'),
                'aadharFront',
                true,
                true,
              )}
              {renderImagePicker(
                t('Aadhar Card (Back)'),
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
                  placeholder={t('Aadhar Number * (12 digits)')}
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
              {renderImagePicker(t('PAN Card'), 'panCard', true, true)}

              {/* Driving License */}
              {renderImagePicker(
                t('Driving License'),
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
                  placeholder={t('License Number *')}
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
                  <Icon name="directions-car" size={24} color="#fccf1e" />
                  <Text style={styles.sectionTitle}>{t('Vehicle Information')}</Text>
                </View>

                {/* Vehicle Photo */}
                {renderImagePicker(
                  t('Vehicle Photograph'),
                  'vehiclePhoto',
                  true,
                  true,
                )}

                <View style={styles.selectorContainer}>
                  <Text style={styles.label}>
                    Vehicle Type <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      justifyContent: 'space-between',
                      gap: 5,
                    }}
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
                          color={form.vehicleType === type ? '#000' : '#111827'}
                        />

                        <Text
                          style={[
                            styles.typeChipText,
                            form.vehicleType === type &&
                              styles.typeChipTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          {type}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.inputContainer}>
                  <Icon
                    name="local-taxi"
                    size={20}
                    color="#999"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    placeholder={t('Vehicle Number * (e.g., MH12AB1234)')}
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
                  <Icon name="assignment" size={24} color="#fccf1e" />
                  <Text style={styles.sectionTitle}>{t('Vehicle Documents')}</Text>
                </View>

                {/* Vehicle RC */}
                {renderImagePicker(t('Vehicle RC'), 'vehicleRC', true, true)}
              </View>
            </View>
          )}

          {step === 4 && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Icon name="person-pin" size={24} color="#fccf1e" />
                <Text style={styles.sectionTitle}>{t('Driver Details')}</Text>
              </View>

              <Text style={styles.label}>
                {t('I will be driving this vehicle *').replace(' *', '')}{' '}
                <Text style={styles.requiredStar}>*</Text>
              </Text>

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: '20%',
                  marginBottom: 10,
                }}
              >
                {/* YES */}
                <TouchableOpacity
                  style={{ flexDirection: 'row' }}
                  onPress={() =>
                    setForm({
                      ...form,
                      hasHiredDriver: 'false',
                      hiredDriverName: '',
                      hiredDriverPhone: '',
                      hiredDriverLicense: null,
                    })
                  }
                >
                  <Icon
                    name={
                      form.hasHiredDriver === 'false'
                        ? 'radio-button-checked'
                        : 'radio-button-unchecked'
                    }
                    size={24}
                    color={form.hasHiredDriver === 'false' ? '#0B66E4' : '#555'}
                  />

                  <Text
                    style={{
                      alignSelf: 'center',
                      marginLeft: 5,
                      fontFamily: 'Poppins-Medium',
                    }}
                  >
                    Yes
                  </Text>
                </TouchableOpacity>

                {/* NO */}
                <TouchableOpacity
                  style={{ flexDirection: 'row' }}
                  onPress={() => setForm({ ...form, hasHiredDriver: 'true' })}
                >
                  <Icon
                    name={
                      form.hasHiredDriver === 'true'
                        ? 'radio-button-checked'
                        : 'radio-button-unchecked'
                    }
                    size={24}
                    color={form.hasHiredDriver === 'true' ? '#0B66E4' : '#555'}
                  />

                  <Text
                    style={{
                      alignSelf: 'center',
                      marginLeft: 5,
                      fontFamily: 'Poppins-Medium',
                    }}
                  >
                    No
                  </Text>
                </TouchableOpacity>
              </View>
              {form.hasHiredDriver === 'true' && (
                <View>
                  <Text style={styles.label}>
                    {t('Driver Name *').replace(' *', '')} <Text style={styles.requiredStar}>*</Text>
                  </Text>

                  <View style={styles.inputContainer}>
                    <Icon
                      name="person"
                      size={20}
                      color="#999"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      placeholder={t('Driver Name')}
                      style={styles.input}
                      placeholderTextColor="#999"
                      value={form.hiredDriverName}
                      onChangeText={v =>
                        setForm({ ...form, hiredDriverName: v })
                      }
                    />
                  </View>

                  <Text style={styles.label}>
                    {t('Driver Phone Number *').replace(' *', '')}{' '}
                    <Text style={styles.requiredStar}>*</Text>
                  </Text>

                  <View style={styles.inputContainer}>
                    <Icon
                      name="phone"
                      size={20}
                      color="#999"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      placeholder={t('Driver Phone Number')}
                      style={styles.input}
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                      maxLength={10}
                      value={form.hiredDriverPhone}
                      onChangeText={v =>
                        setForm({
                          ...form,
                          hiredDriverPhone: v.replace(/[^0-9]/g, ''),
                        })
                      }
                    />
                  </View>

                  <Text style={styles.label}>
                    {t('Upload Driver License *').replace(' *', '')}{' '}
                    <Text style={styles.requiredStar}>*</Text>
                  </Text>

                  {renderImagePicker(
                    t('Driving Licence'),
                    'hiredDriverLicense',
                    true,
                    true,
                  )}
                </View>
              )}
            </View>
          )}

          {/* STEP 5 - Bank Details */}
          {step === 5 && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Icon name="account-balance" size={24} color="#fccf1e" />
                <Text style={styles.sectionTitle}>{t('Bank Account Details')}</Text>
              </View>

              <View style={styles.inputContainer}>
                <Icon
                  name="person"
                  size={20}
                  color="#999"
                  style={styles.inputIcon}
                />
                <TextInput
                  placeholder={t('Account Holder Name *')}
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
                  placeholder={t('Account Number *')}
                  style={styles.input}
                  placeholderTextColor="#999"
                  maxLength={18}
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
                  placeholder={t('IFSC Code *')}
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
                  <Icon name="hourglass-empty" size={20} color="#fccf1e" />
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
                  placeholder={t('Bank Name')}
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
                  placeholder={t('Branch Name')}
                  value={form.branchName}
                  editable={false}
                  style={[styles.input, styles.disabledInput]}
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.infoBox}>
                <Icon name="info" size={20} color="#fccf1e" />
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
            <Icon name="arrow-back" size={20} color="#6B7280" />
            <Text style={styles.secondaryBtnText}>{t('Back')}</Text>
          </TouchableOpacity>
        )}

        {step < 5 ? (
          <TouchableOpacity
            style={[
              styles.footerBtn,
              styles.primaryBtn,
              step > 1 && styles.flex2,
            ]}
            onPress={handleNext}
            disabled={loading || uploading}
          >
            <Text style={styles.primaryBtnText}>{t('Continue')}</Text>
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
                <Text style={styles.primaryBtnText}>{t('Submit Application')}</Text>
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
    marginRight: '10%',
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },

  headerSubtitle: {
    fontSize: 12,
    color: '#111827',
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
    backgroundColor: '#E5E7EB',
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
    backgroundColor: '#FFFFFF',
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
    borderBottomColor: '#E5E7EB',
    paddingBottom: 15,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 10,
  },

  sectionSubtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 10,
    marginTop: 5,
  },

  rowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },

  rowContainer_box: {
    justifyContent: 'space-between',
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
    borderColor: '#E5E7EB',
  },

  inputIcon: {
    marginRight: 10,
  },

  input: {
    flex: 1,
    paddingVertical: 15,
    fontSize: 14,
    color: '#111827',
  },

  disabledInputContainer: {
    backgroundColor: '#F8F9FA',
  },

  disabledInput: {
    color: '#6B7280',
  },

  uploadCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    color: '#111827',
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
    backgroundColor: '#2A1010',
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
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fccf1e',
  },

  uploadBtnText: {
    fontSize: 14,
    color: '#111827',
    marginTop: 5,
    fontWeight: '500',
  },

  previewWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#F8F9FA',
    padding: 8,
    borderRadius: 8,
  },

  previewFileName: {
    flex: 1,
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 6,
  },

  selectorContainer: {
    marginBottom: 20,
  },

  label: {
    fontSize: 14,
    color: '#111827',
    marginBottom: 12,
    fontWeight: '600',
  },

  categoryScrollContent: {
    paddingHorizontal: 5,
    gap: 8,
    paddingBottom: 5,
  },

  typeChip: {
    width: '48%',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#F8F9FA',
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },

  typeChipActive: {
    backgroundColor: '#fccf1e',
    borderColor: '#fccf1e',
  },

  typeChipText: {
    fontSize: 14,
    color: '#6B7280',
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
    backgroundColor: '#FFF7D6',
    borderRadius: 8,
  },

  loadingText: {
    fontSize: 14,
    color: '#fccf1e',
    marginLeft: 8,
  },

  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7D6',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },

  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 8,
  },

  footer: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
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
    backgroundColor: '#fccf1e',
  },

  secondaryBtn: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  submitBtn: {
    backgroundColor: '#4CAF50',
    flex: 2,
  },

  primaryBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },

  secondaryBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
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
    color: '#111827',
    fontWeight: '500',
  },

  // Custom Alert Styles
  customAlert: {
    flexDirection: 'row',
    backgroundColor: '#FFF7D6',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#fccf1e',
  },

  customAlertSuccess: {
    backgroundColor: '#0E2A1A',
    borderColor: '#4CAF50',
  },

  customAlertContent: {
    flex: 1,
    marginLeft: 12,
  },

  customAlertTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },

  customAlertMessage: {
    fontSize: 12,
    color: '#6B7280',
  },

  loadingContainerFull: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },

  loadingTextFull: {
    marginTop: 15,
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },

  reviewContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#FFF7D6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },

  statusBadgeError: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#2A1010',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },

  reviewTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },

  reviewText: {
    fontSize: 15,
    color: '#6B7280',
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
    backgroundColor: '#2A1010',
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
    color: '#6B7280',
    marginLeft: 8,
    fontWeight: '500',
  },

  refreshBtn: {
    width: '100%',
    backgroundColor: '#fccf1e',
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
    backgroundColor: '#FFFFFF',
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

  dropdownWrapper: {
    position: 'relative',
    zIndex: 10,
  },

  dropdownList: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    marginTop: -10,
    marginBottom: 15,
    maxHeight: '100%',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },

  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 15,
  },

  dropdownText: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  comingSoonContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },

  comingSoonIconBox: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#FFF7D6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },

  comingSoonTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 12,
  },

  comingSoonText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },

  comingSoonSubText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 30,
  },

  comingSoonBtn: {
    backgroundColor: '#fccf1e',
    paddingVertical: 16,
    paddingHorizontal: 34,
    borderRadius: 14,
  },

  comingSoonBtnText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000',
  },
});

export default DocumentScreen;
