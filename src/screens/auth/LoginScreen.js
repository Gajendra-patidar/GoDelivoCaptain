import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import axios from 'axios';
import { BASE_URL } from '../../services/api.js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addNotification } from '../../services/localDriverData';
import { useDispatch } from 'react-redux';
import { getProfile } from '../../store/slices/profileSlice';

const LoginScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [checked1, setChecked1] = useState(true);
  const [checked2, setChecked2] = useState(true);
  const [showOTP, setShowOTP] = useState(false);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false); // Prevent multiple auto-verification calls

  const otpInputs = useRef([]);
  const timerRef = useRef(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Auto-verify OTP when all digits are filled
  useEffect(() => {
    const otpString = otp.join('');
    if (otpString.length === 6 && showOTP && !loading && !isVerifying) {
      // Small delay to ensure the last digit is properly set
      const timer = setTimeout(() => {
        verifyOTP();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [otp, showOTP]);

  // Start timer for resend OTP
  const startTimer = () => {
    setTimer(30);
    setCanResend(false);

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    timerRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Validate phone number
  const validatePhone = phone => {
    const phoneRegex = /^[0-9]{10}$/;
    if (!phone) {
      setPhoneError('Mobile number is required');
      return false;
    } else if (!phoneRegex.test(phone)) {
      setPhoneError('Please enter a valid 10-digit mobile number');
      return false;
    }
    setPhoneError('');
    return true;
  };

  // Validate checkboxes
  const validateCheckboxes = () => {
    if (!checked1) {
      Alert.alert(
        'Error',
        'Please accept Terms and Conditions and Privacy Policy',
      );
      return false;
    }
    if (!checked2) {
      Alert.alert('Error', 'Please accept TDS Declaration');
      return false;
    }
    return true;
  };

  // Send OTP
  const sendOTP = async () => {
    if (!validatePhone(mobile) || !validateCheckboxes()) {
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${BASE_URL}/send-otp`, {
        phone: mobile,
      });

      if (response.data.success) {
        setShowOTP(true);
        startTimer();
        Alert.alert('Success', 'OTP sent successfully to your mobile');
              } else {
        Alert.alert('Error', response.data.message || 'Failed to send OTP');
      }
    } catch (error) {
      console.error('Send OTP Error:', error.message);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Network error. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const resendOTP = async () => {
    if (!canResend) return;

    setLoading(true);
    try {
      const response = await axios.post(`${BASE_URL}/send-otp`, {
        phone: mobile,
      });

      if (response.data.success) {
        startTimer();
        // Clear OTP inputs
        setOtp(['', '', '', '', '', '']);
        setIsVerifying(false); // Reset verifying flag
        otpInputs.current[0]?.focus();
        Alert.alert('Success', 'OTP resent successfully');
              }
    } catch (error) {
      console.error('Resend OTP Error:', error);
      Alert.alert('Error', 'Failed to resend OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP input change
  const handleOtpChange = (text, index) => {
    // Handle autofill/paste - if text length is more than 1, it's likely a paste/autofill
    if (text.length > 1) {
      // Split the pasted text into individual digits
      const pastedDigits = text.split('').slice(0, 6);
      const newOtp = [...otp];

      // Fill the OTP array with pasted digits
      pastedDigits.forEach((digit, i) => {
        if (i < 6) {
          newOtp[i] = digit;
        }
      });

      setOtp(newOtp);

      // Focus on the appropriate input after paste
      if (pastedDigits.length === 6) {
        // If all digits are filled, focus on the last input or trigger verification
        otpInputs.current[5]?.focus();
      } else if (pastedDigits.length < 6) {
        // Focus on the next empty input
        const nextEmptyIndex = newOtp.findIndex(d => !d);
        if (nextEmptyIndex !== -1) {
          otpInputs.current[nextEmptyIndex]?.focus();
        }
      }
      return;
    }

    // Normal single character input
    const newOtp = [...otp];
    newOtp[index] = text;

    // Auto move to next input
    if (text && index < 5) {
      otpInputs.current[index + 1]?.focus();
    }

    setOtp(newOtp);
  };

  // Handle OTP input key press (backspace)
  const handleOtpKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputs.current[index - 1]?.focus();
    }
  };

  // Verify OTP
  const verifyOTP = async () => {
    const otpString = otp.join('');

    if (otpString.length !== 6) {
      Alert.alert('Error', 'Please enter complete 6-digit OTP');
      return;
    }

    // Prevent multiple verification calls
    if (isVerifying) return;

    setIsVerifying(true);
    setLoading(true);

    try {
            
      const response = await axios.post(`${BASE_URL}/verify-otp`, {
        phone: mobile,
        otp: otpString,
      });

      
      // Check different possible success indicators
      if (response.data.success || response.data.status === 'success') {
        
        // Store token if returned
        const token = response.data?.data?.token || response.data?.token;
        if (token) {
          await AsyncStorage.setItem('userToken', token);
          await AsyncStorage.setItem('userPhone', response?.data?.data?.phone);
                  }

        // Store user data if needed
        const user = response?.data?.data;
        if (user) {
          await AsyncStorage.setItem('userData', JSON.stringify(user));
        }

        
        const driverId = response.data?.data?.driverId || `driver_${mobile}`;
        await AsyncStorage.setItem('driverId', driverId);

        // Kick off a profile fetch so profile data is ready across the app.
        dispatch(getProfile());

        await addNotification({
          title: 'Login successful',
          body: 'Welcome back. Complete your onboarding to start deliveries.',
          type: 'auth',
        });

        
        Alert.alert('Success', 'Login Successfully', [
          {
            text: 'OK',
            onPress: () => {
              if (response?.data?.data?.requiresRegistration) {
                navigation.navigate('Docs', {
                  phone: response?.data?.data?.phone,
                  data: response?.data?.data,
                });
                //                 
              } else {
                navigation.navigate('MyTabs');
                //                 
              }
            },
          },
        ]);
      } else {
        Alert.alert('Error', response.data.message || 'Invalid OTP');
        // Clear OTP on invalid attempt
        setOtp(['', '', '', '', '', '']);
        setIsVerifying(false); // Reset verifying flag
        otpInputs.current[0]?.focus();
      }
    } catch (error) {
      console.error('❌ Verify OTP Error:', error);

      // Handle different error scenarios
      if (error.response) {
        // Server responded with error
        console.error('Error Response:', error.response.data);
        Alert.alert(
          'Error',
          error.response.data.message || 'Invalid OTP. Please try again.',
        );
      } else if (error.request) {
        // Request made but no response
        Alert.alert(
          'Network Error',
          'Unable to connect to server. Please check your internet connection.',
        );
      } else {
        Alert.alert('Error', 'An unexpected error occurred. Please try again.');
      }

      // Clear OTP on error
      setOtp(['', '', '', '', '', '']);
      setIsVerifying(false); // Reset verifying flag
      otpInputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  // Handle back button from OTP screen
  const handleBack = () => {
    setShowOTP(false);
    setOtp(['', '', '', '', '', '']);
    setTimer(30);
    setCanResend(false);
    setIsVerifying(false); // Reset verifying flag
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  const dummyFuc = async () => {
    try {
      const token =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5YmQzNDIzNmIxOTJmNjFlNTEwNjZmOSIsInBob25lIjoiNjI2MzM1MjQ5NiIsInR5cGUiOiJkcml2ZXJfYXV0aCIsInJvbGUiOiJkcml2ZXIiLCJpYXQiOjE3NzQwMDczMzEsImV4cCI6MTc3NjU5OTMzMX0.cMSvLVfR31Qoa9aKTRe5hzRXb3Rgh7Roa5SbIJoa49M';
      await AsyncStorage.setItem('userToken', token);
      navigation.navigate('MyTabs');
    } catch (error) {
          }
  };

  // Render OTP Input Screen
  const renderOTPScreen = () => (
    <>
      {/* <TouchableOpacity onPress={handleBack} style={styles.backButton}>
        <Icon name="arrow-back" size={24} color="#333" />
      </TouchableOpacity> */}

      <Text style={styles.otpTitle}>Enter OTP</Text>
      <Text style={styles.otpSubtitle}>
        We've sent a 6-digit OTP to {'\n'}+91 {mobile}
      </Text>

      <View style={styles.otpContainer}>
        {otp.map((digit, index) => (
          <TextInput
            key={index}
            ref={ref => (otpInputs.current[index] = ref)}
            style={[styles.otpInput, digit && styles.otpInputFilled]}
            maxLength={1}
            keyboardType="number-pad"
            value={digit}
            onChangeText={text => handleOtpChange(text, index)}
            onKeyPress={e => handleOtpKeyPress(e, index)}
            editable={!loading}
          />
        ))}
      </View>

      <View style={styles.timerContainer}>
        {!canResend ? (
          <Text style={styles.timerText}>
            Resend OTP in <Text style={styles.timerBold}>{timer}s</Text>
          </Text>
        ) : (
          <TouchableOpacity onPress={resendOTP} disabled={loading}>
            <Text style={styles.resendText}>Resend OTP</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Optional: Manual Verify Button - can be hidden if you want only auto-verify */}
      <TouchableOpacity
        style={[
          styles.loginBtn,
          otp.join('').length !== 6 && styles.loginBtnDisabled,
        ]}
        onPress={verifyOTP}
        disabled={loading || otp.join('').length !== 6 || isVerifying}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.loginText}>VERIFY OTP</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={handleBack} style={styles.changeNumberBtn}>
        <Text style={styles.changeNumberText}>Change Mobile Number</Text>
      </TouchableOpacity>
    </>
  );

  // Render Mobile Input Screen
  const renderMobileScreen = () => (
    <>
      <Text style={styles.logo}>
        GODELIVO <Text style={styles.partner}>Partner</Text>
      </Text>

      <View style={styles.countryContainer}>
        <Text style={styles.flag}>🇮🇳</Text>
        <Text style={styles.countryText}>India</Text>
        <TouchableOpacity>
          <Text style={styles.changeText}>Change</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Mobile number</Text>

        <View style={styles.mobileRow}>
          <Text style={styles.code}>+91</Text>
          <TextInput
            style={[styles.input, phoneError && styles.inputError]}
            keyboardType="number-pad"
            value={mobile}
            onChangeText={text => {
              setMobile(text);
              setPhoneError('');
            }}
            maxLength={10}
            editable={!loading}
            placeholder="Enter 10-digit number"
            placeholderTextColor="#9CA3AF"
          />
        </View>
        {phoneError ? <Text style={styles.errorText}>{phoneError}</Text> : null}
      </View>

      <TouchableOpacity
        style={styles.checkboxRow}
        onPress={() => !loading && setChecked1(!checked1)}
        disabled={loading}
      >
        <Icon
          name={checked1 ? 'checkbox' : 'square-outline'}
          size={22}
          color={checked1 ? '#3B82F6' : '#9CA3AF'}
        />
        <Text style={styles.checkboxText}>
          I have read and agreed to{' '}
          <Text style={styles.link}>Terms and Conditions</Text> and{' '}
          <Text style={styles.link}>Privacy Policy</Text>
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.checkboxRow}
        onPress={() => !loading && setChecked2(!checked2)}
        disabled={loading}
      >
        <Icon
          name={checked2 ? 'checkbox' : 'square-outline'}
          size={22}
          color={checked2 ? '#3B82F6' : '#9CA3AF'}
        />
        <Text style={styles.checkboxText}>
          I have read and hereby provide my consent on the{' '}
          <Text style={styles.link}>TDS Declaration</Text>
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
        onPress={sendOTP}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.loginText}>SEND OTP</Text>
        )}
      </TouchableOpacity>
    </>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar backgroundColor="#F4C20D" barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {showOTP ? renderOTPScreen() : renderMobileScreen()}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 25,
    paddingBottom: 30,
  },
  logo: {
    fontSize: 30,
    fontWeight: '600',
    color: '#F4C20D',
    alignSelf: 'center',
    marginTop: 40,
  },
  partner: {
    fontWeight: '400',
    color: '#6B7280',
  },
  countryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#F3F4F6',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 25,
    marginTop: 20,
  },
  flag: {
    fontSize: 18,
  },
  countryText: {
    marginHorizontal: 8,
    fontSize: 16,
  },
  changeText: {
    color: '#3B82F6',
    fontWeight: '500',
  },
  inputContainer: {
    marginTop: 50,
  },
  label: {
    color: '#9CA3AF',
    fontSize: 14,
    marginBottom: 8,
  },
  mobileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 8,
  },
  code: {
    fontSize: 18,
    marginRight: 10,
    color: '#333',
  },
  input: {
    flex: 1,
    fontSize: 18,
    color: '#333',
    padding: 0,
  },
  inputError: {
    color: '#EF4444',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 5,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 25,
  },
  checkboxText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 22,
  },
  link: {
    color: '#3B82F6',
    textDecorationLine: 'underline',
  },
  loginBtn: {
    marginTop: 40,
    backgroundColor: '#F4C20D',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
  },
  loginBtnDisabled: {
    opacity: 0.5,
  },
  loginText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // OTP Screen Styles
  backButton: {
    marginTop: 20,
    marginBottom: 30,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  otpTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  otpSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 30,
    lineHeight: 24,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 10,
    marginBottom: 30,
  },
  otpInput: {
    width: 45,
    height: 55,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    backgroundColor: '#F9FAFB',
  },
  otpInputFilled: {
    borderColor: '#F4C20D',
    backgroundColor: '#FFF9E6',
  },
  timerContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  timerText: {
    fontSize: 16,
    color: '#6B7280',
  },
  timerBold: {
    fontWeight: 'bold',
    color: '#F4C20D',
  },
  resendText: {
    fontSize: 16,
    color: '#3B82F6',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  changeNumberBtn: {
    marginTop: 20,
    alignItems: 'center',
  },
  changeNumberText: {
    fontSize: 16,
    color: '#3B82F6',
    fontWeight: '500',
  },
});
