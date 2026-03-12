import React, { useState, useRef } from 'react';
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

const { width } = Dimensions.get('window');

// const BASE_URL = 'https://porterbackend-iyxh.onrender.com/api/driver';

const ICONS = {
  'two-wheeler': require('../../assets/motor.png'),
  'three-wheeler': require('../../assets/riksha_dark.png'),
  motorcycle: require('../../assets/motorcycle.png'),
  'electric-scooter': require('../../assets/scooter.png'),
  scooter: require('../../assets/scooter.png'),
  riksha: require('../../assets/riksha_dark.png'),
  'mini-truck': require('../../assets/mini-truck.png'),
  truck: require('../../assets/truck.png'),
};

// Vehicle data with categories, body types, and icons
const VEHICLE_DATA = {
  '2 Wheeler': {
    icon: 'two-wheeler',
    bodyTypes: [
      { id: 'scooter', name: 'Scooter', icon: 'scooter' },
      { id: 'bike', name: 'Bike', icon: 'motorcycle' },
    ],
  },
  '3 Wheeler': {
    icon: 'three-wheeler',
    bodyTypes: [
      { id: 'tuktuk', name: 'Tuk Tuk', icon: 'riksha' },
      { id: 'loader', name: 'Loader', icon: 'riksha' },
    ],
  },
  truck: {
    icon: 'truck',
    bodyTypes: [
      { id: 'mini-truck', name: 'Mini Truck', icon: 'mini-truck' },
      { id: 'heavy-truck', name: 'Heavy Truck', icon: 'truck' },
    ],
  },
};

const DocumentScreen = ({ navigation }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const scrollViewRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const [form, setForm] = useState({
    // Personal Information
    fullName: '',
    email: '',
    dateOfBirth: '',
    address: {
      street: '',
      city: '',
      state: '',
      pincode: '',
    },

    // Owner Details - Documents (Backend expects single aadharCard)
    aadharCard: null, // Changed from aadharCardFront/aadharCardBack
    aadharNumber: '',
    panCard: null,
    panNumber: '', // Added PAN number field
    selfie: null,

    // Vehicle Details - Documents
    vehicleRC: null,
    rcNumber: '',
    drivingLicense: null,
    licenseNumber: '',
    licenseExpiryDate: '',
    vehicleInsurance: null,
    insurancePolicyNumber: '',
    insuranceExpiryDate: '',
    vehiclePhoto: null,

    // Vehicle Details - Info
    vehicleCategory: '',
    vehicleBodyType: '',
    vehicleNumber: '',
    vehicleModel: '',
    vehicleYear: '',
    vehicleColor: '',

    // Bank Details
    bankDetails: {
      accountHolderName: '',
      accountNumber: '',
      ifscCode: '',
      bankName: '',
      branchName: '',
    },
  });

  // Get token from storage
  const getToken = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      return token;
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
        console.warn(err);
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
      quality: 0.9,
      saveToPhotos: false,
    };

    const handleResponse = response => {
      if (response.didCancel) {
        console.log('User cancelled image picker');
      } else if (response.errorCode) {
        Alert.alert('Error', response.errorMessage || 'Something went wrong');
      } else if (response.assets && response.assets.length > 0) {
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

        setForm({ ...form, [key]: response.assets[0] });
      }
    };

    if (useCamera) {
      launchCamera(options, handleResponse);
    } else {
      launchImageLibrary(options, handleResponse);
    }
  };

  // Upload document to server
  // Upload document to server
  const uploadDocument = async (documentType, file, additionalData = {}) => {
    try {
      const token = await getToken();
      if (!token) {
        Alert.alert('Error', 'Please login again');
        navigation.navigate('Login');
        return null;
      }

      const formData = new FormData();

      // IMPORTANT: Backend expects file in 'file' field
      formData.append('file', {
        uri: file.uri,
        type: file.type || 'image/jpeg',
        name: file.fileName || `${documentType}.jpg`,
      });

      // Add additional fields based on document type
      Object.keys(additionalData).forEach(key => {
        formData.append(key, additionalData[key]);
      });

      console.log(`📤 Uploading ${documentType}...`, additionalData);

      const response = await axios.post(
        `${BASE_URL}/upload-document/${documentType}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        },
      );

      console.log(`✅ ${documentType} uploaded:`, response.data);
      return response.data;
    } catch (error) {
      console.error(
        `❌ Error uploading ${documentType}:`,
        error.response?.data || error.message,
      );

      // Show specific error message from backend
      if (error.response?.data?.message) {
        Alert.alert('Upload Failed', error.response.data.message);
      } else {
        Alert.alert('Upload Failed', `Failed to upload ${documentType}`);
      }

      throw error;
    }
  };

  // Submit basic info
  const submitBasicInfo = async () => {
    try {
      const token = await getToken();
      if (!token) {
        Alert.alert('Error', 'Please login again');
        navigation.navigate('Login');
        return false;
      }

      setLoading(true);

      const payload = {
        fullName: form.fullName,
        email: form.email,
        dateOfBirth: form.dateOfBirth,
        address: form.address,
      };

      console.log('📤 Submitting basic info...', payload, token);

      const response = await axios.post(`${BASE_URL}/register`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('✅ Basic info submitted:', response.data);
      return true;
    } catch (error) {
      console.error('❌ Error submitting basic info:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to submit basic info',
      );
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Submit vehicle details
  const submitVehicleDetails = async () => {
    try {
      const token = await getToken();
      if (!token) {
        Alert.alert('Error', 'Please login again');
        navigation.navigate('Login');
        return false;
      }

      setLoading(true);
      console.log('📤 Submitting vehicle details...');

      const payload = {
        vehicleType: form.vehicleCategory,
        vehicleNumber: form.vehicleNumber,
        vehicleModel: form.vehicleModel,
        vehicleYear: parseInt(form.vehicleYear),
        vehicleColor: form.vehicleColor,
      };

      const response = await axios.post(
        `${BASE_URL}/vehicle-details`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      console.log('✅ Vehicle details submitted:', response.data);
      return true;
    } catch (error) {
      console.error('❌ Error submitting vehicle details:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to submit vehicle details',
      );
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Submit bank details
  const submitBankDetails = async () => {
    try {
      const token = await getToken();
      if (!token) {
        Alert.alert('Error', 'Please login again');
        navigation.navigate('Login');
        return false;
      }

      setLoading(true);
      console.log('📤 Submitting bank details...');

      const response = await axios.post(
        `${BASE_URL}/bank-details`,
        form.bankDetails,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      console.log('✅ Bank details submitted:', response.data);
      return true;
    } catch (error) {
      console.error('❌ Error submitting bank details:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to submit bank details',
      );
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Submit final application
  const submitApplication = async () => {
    try {
      const token = await getToken();
      if (!token) {
        Alert.alert('Error', 'Please login again');
        navigation.navigate('Login');
        return false;
      }

      setLoading(true);
      console.log('📤 Submitting final application...');

      const response = await axios.post(
        `${BASE_URL}/submit`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      console.log('✅ Application submitted:', response.data);
      return true;
    } catch (error) {
      console.error('❌ Error submitting application:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to submit application',
      );
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Upload all documents
  // Upload all documents
  const uploadAllDocuments = async () => {
    setUploading(true);

    console.log('check all docs', form);

    try {
      // Upload profile photo (if you have this field)
      // if (form.profilePhoto) {
      //   await uploadDocument('profilePhoto', form.profilePhoto);
      // }

      // Upload Aadhar - combine front and back?
      // Backend expects a single aadharCard, so you need to decide:
      // Option 1: Upload only front (or merge both sides into one file)
      if (form.aadharCard) {
        await uploadDocument('aadharCard', form.aadharCard, {
          aadharNumber: form.aadharNumber,
        });
      }

      // Upload PAN with PAN number
      if (form.panCard) {
        await uploadDocument('panCard', form.panCard, {
          panNumber: form.panNumber, // Make sure to add this
        });
      }

      // Upload Selfie
      if (form.selfie) {
        await uploadDocument('profilePhoto', form.selfie); // Changed to profilePhoto as backend expects
      }

      // Upload Driving License
      if (form.drivingLicense) {
        await uploadDocument('drivingLicense', form.drivingLicense, {
          licenseNumber: form.licenseNumber,
          licenseExpiryDate: form.licenseExpiryDate,
        });
      }

      // Upload Vehicle RC
      if (form.vehicleRC) {
        await uploadDocument('vehicleRC', form.vehicleRC, {
          rcNumber: form.rcNumber,
        });
      }

      // Upload Vehicle Insurance
      if (form.vehicleInsurance) {
        await uploadDocument('vehicleInsurance', form.vehicleInsurance, {
          policyNumber: form.insurancePolicyNumber,
          insuranceExpiryDate: form.insuranceExpiryDate,
        });
      }

      // Upload Vehicle Photo
      if (form.vehiclePhoto) {
        await uploadDocument('vehiclePhoto', form.vehiclePhoto);
      }

      return true;
    } catch (error) {
      console.error('Error uploading documents:', error);
      Alert.alert(
        'Error',
        'Failed to upload some documents. Please try again.',
      );
      return false;
    } finally {
      setUploading(false);
    }
  };

  const detectBank = async ifsc => {
    setForm({
      ...form,
      bankDetails: { ...form.bankDetails, ifscCode: ifsc.toUpperCase() },
    });

    if (ifsc.length === 11) {
      setLoading(true);
      try {
        const res = await axios.get(`https://ifsc.razorpay.com/${ifsc}`);
        setForm({
          ...form,
          bankDetails: {
            ...form.bankDetails,
            bankName: res.data.BANK,
            branchName: res.data.BRANCH,
            ifscCode: ifsc.toUpperCase(),
          },
        });
      } catch (err) {
        Alert.alert('Invalid IFSC', 'Please enter a valid IFSC code');
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
      case 1:
        if (!form.fullName) {
          showError('Please enter your full name');
          return false;
        }
        if (!form.email || !form.email.includes('@')) {
          showError('Please enter a valid email address');
          return false;
        }
        if (!form.dateOfBirth) {
          showError('Please enter your date of birth');
          return false;
        }
        if (
          !form.address.street ||
          !form.address.city ||
          !form.address.state ||
          !form.address.pincode
        ) {
          showError('Please fill complete address');
          return false;
        }

        // Aadhar validation - backend expects aadharCard
        if (!form.aadharCard) {
          showError('Please upload your Aadhaar card');
          return false;
        }
        if (!form.aadharNumber || form.aadharNumber.length !== 12) {
          showError('Please enter valid 12-digit Aadhaar number');
          return false;
        }

        // PAN validation with PAN number
        if (!form.panCard) {
          showError('Please upload your PAN card');
          return false;
        }
        if (!form.panNumber || form.panNumber.length < 10) {
          showError('Please enter valid PAN number (10 characters)');
          return false;
        }

        // Selfie validation
        if (!form.selfie) {
          showError('Please take a clear selfie');
          return false;
        }
        return true;

      case 2:
        if (!form.vehicleRC) {
          showError('Please upload your RC');
          return false;
        }
        if (!form.rcNumber) {
          showError('Please enter your RC number');
          return false;
        }
        if (!form.drivingLicense) {
          showError('Please upload your Driving License');
          return false;
        }
        if (!form.licenseNumber) {
          showError('Please enter your license number');
          return false;
        }
        if (!form.licenseExpiryDate) {
          showError('Please enter license expiry date');
          return false;
        }
        if (!form.vehicleInsurance) {
          showError('Please upload vehicle insurance');
          return false;
        }
        if (!form.insurancePolicyNumber) {
          showError('Please enter insurance policy number');
          return false;
        }
        if (!form.insuranceExpiryDate) {
          showError('Please enter insurance expiry date');
          return false;
        }
        if (!form.vehicleNumber) {
          showError('Please enter your vehicle number');
          return false;
        }
        if (!form.vehicleModel) {
          showError('Please enter vehicle model');
          return false;
        }
        if (!form.vehicleYear) {
          showError('Please enter vehicle year');
          return false;
        }
        if (!form.vehicleColor) {
          showError('Please enter vehicle color');
          return false;
        }
        if (!form.vehiclePhoto) {
          showError('Please upload a clear photo of your vehicle');
          return false;
        }
        if (!form.vehicleCategory) {
          showError('Please select your vehicle category');
          return false;
        }
        if (!form.vehicleBodyType) {
          showError('Please select your vehicle body type');
          return false;
        }
        return true;

      case 3:
        if (!form.bankDetails.accountHolderName) {
          showError('Please enter the account holder name');
          return false;
        }
        if (
          !form.bankDetails.accountNumber ||
          form.bankDetails.accountNumber.length < 9
        ) {
          showError('Please enter a valid account number');
          return false;
        }
        if (
          !form.bankDetails.ifscCode ||
          form.bankDetails.ifscCode.length !== 11
        ) {
          showError('Please enter a valid IFSC code');
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
    if (!validateStep()) return;

    Alert.alert(
      'Submit Application',
      'Are you sure all information is correct?',
      [
        { text: 'Review', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async () => {
            setLoading(true);

            try {
              // Step 1: Submit basic info
              const basicInfoSuccess = await submitBasicInfo();
              if (!basicInfoSuccess) {
                setLoading(false);
                return;
              }

              // Step 2: Upload all documents
              const uploadSuccess = await uploadAllDocuments();
              if (!uploadSuccess) {
                setLoading(false);
                return;
              }

              // Step 3: Submit vehicle details
              const vehicleSuccess = await submitVehicleDetails();
              if (!vehicleSuccess) {
                setLoading(false);
                return;
              }

              // Step 4: Submit bank details
              const bankSuccess = await submitBankDetails();
              if (!bankSuccess) {
                setLoading(false);
                return;
              }

              // Step 5: Submit final application
              const finalSuccess = await submitApplication();

              if (finalSuccess) {
                Alert.alert(
                  'Success!',
                  'Your application has been submitted successfully.',
                  [
                    {
                      text: 'OK',
                      onPress: () => navigation.navigate('MyTabs'),
                    },
                  ],
                );
              }
            } catch (error) {
              console.error('Submission error:', error);
              Alert.alert('Error', 'Something went wrong. Please try again.');
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  const renderProgressBar = () => {
    const progress = (step / 3) * 100;
    return (
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBar, { width: `${progress}%` }]} />
      </View>
    );
  };

  const renderImagePicker = (
    title,
    key,
    showCamera = false,
    isRequired = true,
  ) => (
    <View style={styles.uploadCard}>
      <View style={styles.uploadHeader}>
        <View style={styles.uploadTitleContainer}>
          <Icon
            name={form[key] ? 'check-circle' : 'cloud-upload'}
            size={20}
            color={form[key] ? '#4CAF50' : '#666'}
          />
          <Text style={styles.uploadTitle}>
            {title} {isRequired && <Text style={styles.requiredStar}>*</Text>}
          </Text>
        </View>
        {form[key] && (
          <TouchableOpacity
            onPress={() => setForm({ ...form, [key]: null })}
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
            <Text style={styles.uploadBtnText}>Upload</Text>
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

  const renderVehicleCategorySelector = () => (
    <View style={styles.selectorContainer}>
      <Text style={styles.label}>
        Vehicle Category <Text style={styles.requiredStar}>*</Text>
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryScrollContent}
      >
        {Object.keys(VEHICLE_DATA).map(category => (
          <TouchableOpacity
            key={category}
            style={[
              styles.categoryCard,
              form.vehicleCategory === category && styles.categoryCardActive,
            ]}
            onPress={() => {
              setForm({
                ...form,
                vehicleCategory: category,
                vehicleBodyType: '', // Reset body type when category changes
              });
            }}
          >
            <View
              style={[
                styles.categoryIconContainer,
                form.vehicleCategory === category &&
                  styles.categoryIconContainerActive,
              ]}
            >
              <Image
                source={ICONS[VEHICLE_DATA[category].icon]}
                style={{ width: 50, height: 50 }}
              />
            </View>
            <Text
              style={[
                styles.categoryText,
                form.vehicleCategory === category && styles.categoryTextActive,
              ]}
            >
              {category}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderVehicleBodyTypeSelector = () => {
    if (!form.vehicleCategory) return null;

    const bodyTypes = VEHICLE_DATA[form.vehicleCategory]?.bodyTypes || [];

    return (
      <View style={styles.selectorContainer}>
        <Text style={styles.label}>
          Vehicle Body Type <Text style={styles.requiredStar}>*</Text>
        </Text>
        <View style={styles.bodyTypeGrid}>
          {bodyTypes.map(type => (
            <TouchableOpacity
              key={type.id}
              style={[
                styles.bodyTypeCard,
                form.vehicleBodyType === type.id && styles.bodyTypeCardActive,
              ]}
              onPress={() => setForm({ ...form, vehicleBodyType: type.id })}
            >
              <View
                style={[
                  styles.bodyTypeIconContainer,
                  form.vehicleBodyType === type.id,
                ]}
              >
                <Image
                  source={ICONS[type.icon]}
                  style={{ width: 50, height: 50 }}
                />
              </View>
              <Text
                style={[
                  styles.bodyTypeText,
                  form.vehicleBodyType === type.id && styles.bodyTypeTextActive,
                ]}
                numberOfLines={2}
              >
                {type.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

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
            Step {step} of 3:{' '}
            {step === 1
              ? 'Personal Details'
              : step === 2
              ? 'Vehicle Details'
              : 'Bank Details'}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Icon name="support-agent" size={24} color="#000" />
        </View>
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
          {/* STEP 1 - Owner Details */}
          {step === 1 && (
            <View>
              {/* Personal Information Section */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Icon name="person" size={24} color="#F4C20D" />
                  <Text style={styles.sectionTitle}>Personal Information</Text>
                </View>

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

                <Text style={styles.sectionSubtitle}>Address</Text>

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
                    value={form.address.street}
                    onChangeText={v =>
                      setForm({
                        ...form,
                        address: { ...form.address, street: v },
                      })
                    }
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
                      value={form.address.city}
                      onChangeText={v =>
                        setForm({
                          ...form,
                          address: { ...form.address, city: v },
                        })
                      }
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
                      value={form.address.state}
                      onChangeText={v =>
                        setForm({
                          ...form,
                          address: { ...form.address, state: v },
                        })
                      }
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
                    value={form.address.pincode}
                    onChangeText={v =>
                      setForm({
                        ...form,
                        address: { ...form.address, pincode: v },
                      })
                    }
                  />
                </View>
              </View>

              {/* Documents Section */}
              {/* Documents Section */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Icon name="description" size={24} color="#F4C20D" />
                  <Text style={styles.sectionTitle}>Required Documents</Text>
                </View>

                {/* Aadhar Card - Single upload as backend expects */}
                {renderImagePicker(
                  'Aadhaar Card (Front & Back combined or separate?)',
                  'aadharCard',
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
                    placeholder="Aadhaar Number * (12 digits)"
                    style={styles.input}
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                    maxLength={12}
                    value={form.aadharNumber}
                    onChangeText={v => setForm({ ...form, aadharNumber: v })}
                  />
                </View>

                {/* PAN Card with number field */}
                {renderImagePicker('PAN Card', 'panCard', true, true)}

                <View style={styles.inputContainer}>
                  <Icon
                    name="credit-card"
                    size={20}
                    color="#999"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    placeholder="PAN Number * (10 characters, e.g., ABCDE1234F)"
                    style={styles.input}
                    placeholderTextColor="#999"
                    autoCapitalize="characters"
                    maxLength={10}
                    value={form.panNumber}
                    onChangeText={v =>
                      setForm({ ...form, panNumber: v.toUpperCase() })
                    }
                  />
                </View>

                {/* Selfie */}
                {renderImagePicker('Selfie with ID', 'selfie', true, true)}
              </View>
            </View>
          )}

          {/* STEP 2 - Vehicle Details */}
          {step === 2 && (
            <View>
              {/* RC Documents */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Icon name="assignment" size={24} color="#F4C20D" />
                  <Text style={styles.sectionTitle}>
                    Registration Certificate (RC)
                  </Text>
                </View>

                {renderImagePicker('RC Document', 'vehicleRC', false, true)}

                <View style={styles.inputContainer}>
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
                    onChangeText={v =>
                      setForm({ ...form, rcNumber: v.toUpperCase() })
                    }
                  />
                </View>
              </View>

              {/* Insurance */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Icon name="security" size={24} color="#F4C20D" />
                  <Text style={styles.sectionTitle}>Insurance</Text>
                </View>

                {renderImagePicker(
                  'Insurance Document',
                  'vehicleInsurance',
                  false,
                  true,
                )}

                <View style={styles.inputContainer}>
                  <Icon
                    name="policy"
                    size={20}
                    color="#999"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    placeholder="Policy Number *"
                    style={styles.input}
                    placeholderTextColor="#999"
                    value={form.insurancePolicyNumber}
                    onChangeText={v =>
                      setForm({ ...form, insurancePolicyNumber: v })
                    }
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Icon
                    name="event"
                    size={20}
                    color="#999"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    placeholder="Insurance Expiry Date * (YYYY-MM-DD)"
                    style={styles.input}
                    placeholderTextColor="#999"
                    value={form.insuranceExpiryDate}
                    onChangeText={v =>
                      setForm({ ...form, insuranceExpiryDate: v })
                    }
                  />
                </View>
              </View>

              {/* Driving License */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Icon name="credit-card" size={24} color="#F4C20D" />
                  <Text style={styles.sectionTitle}>Driving License</Text>
                </View>

                {renderImagePicker(
                  'Driving License',
                  'drivingLicense',
                  false,
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
                    value={form.licenseNumber}
                    onChangeText={v =>
                      setForm({ ...form, licenseNumber: v.toUpperCase() })
                    }
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Icon
                    name="event"
                    size={20}
                    color="#999"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    placeholder="License Expiry Date * (YYYY-MM-DD)"
                    style={styles.input}
                    placeholderTextColor="#999"
                    value={form.licenseExpiryDate}
                    onChangeText={v =>
                      setForm({ ...form, licenseExpiryDate: v })
                    }
                  />
                </View>
              </View>

              {/* Vehicle Information */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Icon name="directions-car" size={24} color="#F4C20D" />
                  <Text style={styles.sectionTitle}>Vehicle Information</Text>
                </View>

                <View style={styles.inputContainer}>
                  <Icon
                    name="local-taxi"
                    size={20}
                    color="#999"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    placeholder="Vehicle Number * (e.g., MH01AB1234)"
                    style={styles.input}
                    placeholderTextColor="#999"
                    value={form.vehicleNumber}
                    onChangeText={v =>
                      setForm({ ...form, vehicleNumber: v.toUpperCase() })
                    }
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Icon
                    name="model-training"
                    size={20}
                    color="#999"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    placeholder="Vehicle Model * (e.g., Tata 407)"
                    style={styles.input}
                    placeholderTextColor="#999"
                    value={form.vehicleModel}
                    onChangeText={v => setForm({ ...form, vehicleModel: v })}
                  />
                </View>

                <View style={styles.rowContainer}>
                  <View style={[styles.inputContainer, styles.halfInput]}>
                    <Icon
                      name="calendar-today"
                      size={20}
                      color="#999"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      placeholder="Year *"
                      style={styles.input}
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                      maxLength={4}
                      value={form.vehicleYear}
                      onChangeText={v => setForm({ ...form, vehicleYear: v })}
                    />
                  </View>

                  <View style={[styles.inputContainer, styles.halfInput]}>
                    <Icon
                      name="color-lens"
                      size={20}
                      color="#999"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      placeholder="Color *"
                      style={styles.input}
                      placeholderTextColor="#999"
                      value={form.vehicleColor}
                      onChangeText={v => setForm({ ...form, vehicleColor: v })}
                    />
                  </View>
                </View>

                {renderVehicleCategorySelector()}
                {renderVehicleBodyTypeSelector()}

                {renderImagePicker(
                  'Vehicle Photograph',
                  'vehiclePhoto',
                  true,
                  true,
                )}
              </View>
            </View>
          )}

          {/* STEP 3 - Bank Details */}
          {step === 3 && (
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
                  value={form.bankDetails.accountHolderName}
                  onChangeText={v =>
                    setForm({
                      ...form,
                      bankDetails: {
                        ...form.bankDetails,
                        accountHolderName: v,
                      },
                    })
                  }
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
                  value={form.bankDetails.accountNumber}
                  onChangeText={v =>
                    setForm({
                      ...form,
                      bankDetails: { ...form.bankDetails, accountNumber: v },
                    })
                  }
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
                  value={form.bankDetails.ifscCode}
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
                  value={form.bankDetails.bankName}
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
                  value={form.bankDetails.branchName}
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

        {step < 3 ? (
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
    gap: 12,
  },

  categoryCard: {
    alignItems: 'center',
    width: 96,
    marginRight: 8,
  },

  categoryIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E8E8E8',
    marginBottom: 8,
  },

  categoryIconContainerActive: {
    backgroundColor: '#F4C20D',
    borderColor: '#F4C20D',
  },

  categoryText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
  },

  categoryTextActive: {
    color: '#000',
    fontWeight: '600',
  },

  bodyTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },

  bodyTypeCard: {
    width: (width - 90) / 2,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },

  bodyTypeCardActive: {
    backgroundColor: '#F4C20D',
    borderColor: '#F4C20D',
  },

  bodyTypeIconContainer: {},

  bodyTypeText: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
  },

  bodyTypeTextActive: {
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
});

export default DocumentScreen;
