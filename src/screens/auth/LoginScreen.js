import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  Linking,
  Keyboard,
} from 'react-native';
import RNOtpVerify from 'react-native-otp-verify';
import toast from '../../utils/toast';
import axios from 'axios';
import { BASE_URL } from '../../services/api.js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addNotification } from '../../services/localDriverData';
import { useDispatch } from 'react-redux';
import { getProfile } from '../../store/slices/profileSlice';
import { Toast } from 'toastify-react-native';

const OTP_LENGTH = 6;

const extractOtp = message => {
  if (!message) return null;
  const strMsg =
    typeof message === 'string'
      ? message
      : String(message?.message || message || '');

  if (!strMsg) return null;

  const labelledMatch = strMsg.match(
    /(?:otp|code|verification|passcode|password|is)[^\d]*(\d{6})/i,
  );
  if (labelledMatch?.[1]) return labelledMatch[1];

  const match = strMsg.match(/\b\d{6}\b/);
  return match ? match[0] : null;
};

const cleanOtp = value =>
  String(value || '')
    .replace(/[^0-9]/g, '')
    .slice(0, OTP_LENGTH);

const getApplicationId = user => {
  return (
    user?.applicationId ||
    user?._id ||
    user?.id ||
    user?.application?._id ||
    user?.application?.id ||
    user?.subscriptionPayment?.applicationId ||
    user?.joiningFeePayment?.applicationId ||
    null
  );
};

const isVerified = user => {
  const status =
    user?.verificationStatus || user?.applicationStatus || user?.status || '';

  return String(status).trim().toLowerCase() === 'verified';
};

const isJoiningFeePaid = user => {
  if (
    user?.joiningFeePaid === true ||
    user?.isJoiningFeePaid === true ||
    user?.subscriptionPaid === true ||
    user?.isSubscriptionPaid === true
  ) {
    return true;
  }

  const paymentStatus =
    user?.subscriptionPayment?.status ||
    user?.joiningFeePayment?.status ||
    user?.paymentStatus ||
    user?.subscriptionPaymentStatus ||
    user?.joiningFeePaymentStatus ||
    '';

  return ['completed', 'paid', 'success', 'captured'].includes(
    String(paymentStatus).trim().toLowerCase(),
  );
};

const fetchJoiningFeeStatus = async (token, applicationId) => {
  if (!token || !applicationId) return null;

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

const LoginScreen = ({ navigation }) => {
  const dispatch = useDispatch();

  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [showOTP, setShowOTP] = useState(false);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [isChecked, setIsChecked] = useState(false);
  const [isChecked_TDS, setIsChecked_TDS] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const otpInputRef = useRef(null);
  const timerRef = useRef(null);
  const verifyLockRef = useRef(false);
  const otpListenerRef = useRef(null);

  const navigateAfterLogin = useCallback(
    async user => {
      let latestUser = user;
      const phone = user?.phone || mobile;

      if (phone) {
        try {
          const response = await axios.get(`${BASE_URL}/status/${phone}`);
          const statusUser = response?.data?.data || response?.data;
          if (statusUser) {
            latestUser = {
              ...(user || {}),
              ...statusUser,
            };
          }
        } catch (error) {
          console.log('Error fetching status in login:', error?.message);
        }
      }

      if (latestUser?.requiresRegistration) {
        navigation.navigate('Docs', {
          phone: latestUser?.phone || user?.phone || phone,
          data: latestUser,
        });
        return;
      }

      const applicationId = getApplicationId(latestUser);

      if (applicationId) {
        try {
          const token = await AsyncStorage.getItem('userToken');
          const paymentData = await fetchJoiningFeeStatus(token, applicationId);

          if (!isJoiningFeePaid(paymentData) && !isJoiningFeePaid(latestUser)) {
            navigation.navigate('JoinFees', {
              formData: {
                ...(latestUser || {}),
                backendData: latestUser,
                vehicleType: latestUser?.vehicleType || user?.vehicleType,
              },
              applicationId,
            });
            return;
          }

          latestUser = {
            ...(latestUser || {}),
            ...(paymentData || {}),
          };
        } catch (error) {
          console.log(
            'Joining fee status check failed:',
            error?.response?.data || error?.message,
          );

          if (!isJoiningFeePaid(latestUser)) {
            navigation.navigate('JoinFees', {
              formData: {
                ...(latestUser || {}),
                backendData: latestUser,
                vehicleType: latestUser?.vehicleType || user?.vehicleType,
              },
              applicationId,
            });
            return;
          }
        }
      }
      if (!isVerified(latestUser)) {
        navigation.navigate('Docs', {
          phone: latestUser?.phone || user?.phone || phone,
          data: latestUser,
        });
        return;
      }

      navigation.navigate('MyTabs');
    },
    [navigation, mobile],
  );

  const stopOtpAutoFill = useCallback(() => {
    if (Platform.OS !== 'android') return;

    try {
      if (otpListenerRef.current?.remove) {
        otpListenerRef.current.remove();
      }
      otpListenerRef.current = null;
      if (typeof RNOtpVerify?.removeListener === 'function') {
        RNOtpVerify.removeListener();
      }
    } catch (e) {
      console.log('Error stopping OTP listener:', e);
    }
  }, []);

  const handleIncomingOtp = useCallback(
    message => {
      if (!message) return;
      const strMsg =
        typeof message === 'string'
          ? message
          : String(message?.message || message || '');

      if (
        strMsg.includes('Timeout Error') ||
        strMsg.includes('TimeoutError')
      ) {
        stopOtpAutoFill();
        return;
      }

      const detectedOtp = extractOtp(strMsg);

      if (!detectedOtp) return;

      setOtp(detectedOtp);

      Keyboard.dismiss();
      
      stopOtpAutoFill();
    },
    [stopOtpAutoFill],
  );

  const startOtpAutoFill = useCallback(async () => {
    if (Platform.OS !== 'android') return;

    try {
      stopOtpAutoFill();

      if (typeof RNOtpVerify?.startOtpListener === 'function') {
        const sub = await RNOtpVerify.startOtpListener(handleIncomingOtp);
        if (sub) {
          otpListenerRef.current = sub;
          return;
        }
      }

      if (typeof RNOtpVerify?.getOtp === 'function') {
        await RNOtpVerify.getOtp();
        if (typeof RNOtpVerify?.addListener === 'function') {
          otpListenerRef.current = RNOtpVerify.addListener(handleIncomingOtp);
        }
      }
    } catch (error) {
      console.log('OTP Auto Fill Listener Error:', error);
    }
  }, [handleIncomingOtp, stopOtpAutoFill]);

  const getOtpAppHash = useCallback(async () => {
    if (Platform.OS !== 'android') return null;

    try {
      if (typeof RNOtpVerify?.getHash !== 'function') return null;

      const hashes = await RNOtpVerify.getHash();
      if (Array.isArray(hashes) && hashes.length > 0) {
        return hashes[0] || null;
      } else if (typeof hashes === 'string' && hashes.length > 0) {
        return hashes;
      }
      return null;
    } catch (error) {
      console.log('OTP Hash Error:', error);
      return null;
    }
  }, []);

  const buildSendOtpPayload = useCallback(
    async phone => {
      const payload = { phone };
      const appHash = await getOtpAppHash();

      if (appHash) {
        payload.appHash = appHash;
        payload.hash = appHash;
        payload.app_hash = appHash;
      }

      return payload;
    },
    [getOtpAppHash],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      stopOtpAutoFill();
    };
  }, [stopOtpAutoFill]);

  const startTimer = () => {
    setTimer(30);
    setCanResend(false);

    if (timerRef.current) clearInterval(timerRef.current);

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

  const validatePhone = phone => {
    const phoneRegex = /^[0-9]{10}$/;

    if (!phone) {
      setPhoneError('Mobile number is required');
      return false;
    }

    if (!phoneRegex.test(phone)) {
      setPhoneError('Please enter a valid 10-digit mobile number');
      return false;
    }

    setPhoneError('');
    return true;
  };

  const sendOTP = async () => {
    if (!validatePhone(mobile)) return;
    if (!isChecked) {
      Toast.show({
        type: 'error',
        text1: 'Terms Required',
        text2: 'Please accept Terms & Conditions and Privacy Policy',
      });
      return;
    }
    if (!isChecked_TDS) {
      Toast.show({
        type: 'error',
        text1: 'Terms Required',
        text2: 'Please accept Partner Declaration',
      });
      return;
    }

    setLoading(true);
    setOtp('');
    setIsVerifying(false);
    verifyLockRef.current = false;
    await startOtpAutoFill();

    try {
      const payload = await buildSendOtpPayload(mobile);
      const response = await axios.post(`${BASE_URL}/send-otp`, payload, {
        timeout: 15000,
        headers: { 'Connection': 'close' },
      });

      console.log("checking daa s us", response);
      

      if (response.data.success) {
        setShowOTP(true);
        startTimer();

        toast.success('OTP sent successfully to your mobile');
      } else {
        stopOtpAutoFill();
        toast.error(response.data.message || 'Failed to send OTP');
      }
    } catch (error) {
      console.log('Send OTP Error:', error);
      stopOtpAutoFill();
      toast.error(
        error.response?.data?.message || 'Network error. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = useCallback(
    async otpValue => {
      const otpString = cleanOtp(otpValue || otp);

      if (otpString.length !== OTP_LENGTH) {
        toast.error('Please enter complete 6-digit OTP');
        return;
      }

      if (verifyLockRef.current || isVerifying) return;

      verifyLockRef.current = true;
      setIsVerifying(true);
      setLoading(true);

      try {
        const response = await axios.post(`${BASE_URL}/verify-otp`, {
          phone: mobile,
          otp: otpString,
        }, {
          timeout: 15000,
          headers: { 'Connection': 'close' },
        });

        console.log('token checking res', response);

        if (response.data.success || response.data.status === 'success') {
          const token = response.data?.data?.token || response.data?.token;

          if (token) {
            await AsyncStorage.setItem('userToken', token);
            await AsyncStorage.setItem(
              'userPhone',
              response?.data?.data?.phone || mobile,
            );
          }

          const user = response?.data?.data;

          console.log('user data checking', token, user);

          if (user) {
            await AsyncStorage.setItem('userData', JSON.stringify(user));
          }

          const driverId = response.data?.data?.driverId || `driver_${mobile}`;
          await AsyncStorage.setItem('driverId', driverId);

          dispatch(getProfile());

          await addNotification({
            title: 'Login successful',
            body: 'Welcome back. Complete your onboarding to start deliveries.',
            type: 'auth',
          });

          stopOtpAutoFill();

          Alert.alert('Success', 'Login Successfully', [
            {
              text: 'OK',
              onPress: () => navigateAfterLogin(response?.data?.data),
            },
          ]);
        } else {
          toast.error(response.data.message || 'Invalid OTP');
          setOtp('');
          setIsVerifying(false);
          verifyLockRef.current = false;

          setTimeout(() => {
            otpInputRef.current?.focus();
          }, 100);
        }
      } catch (error) {
        console.log('Verify OTP Error:', error);

        if (error.response) {
          toast.error(
            error.response.data.message || 'Invalid OTP. Please try again.',
          );
        } else if (error.request) {
          toast.error(
            'Unable to connect to server. Please check your internet connection.',
          );
        } else {
          toast.error('An unexpected error occurred. Please try again.');
        }

        setOtp('');
        setIsVerifying(false);
        verifyLockRef.current = false;

        setTimeout(() => {
          otpInputRef.current?.focus();
        }, 100);
      } finally {
        setLoading(false);
      }
    },
    [otp, mobile, isVerifying, dispatch, navigateAfterLogin, stopOtpAutoFill],
  );

  useEffect(() => {
    const otpString = cleanOtp(otp);

    if (
      showOTP &&
      otpString.length === OTP_LENGTH &&
      !loading &&
      !isVerifying &&
      !verifyLockRef.current
    ) {
      const autoTimer = setTimeout(() => {
        verifyOTP(otpString);
      }, 150);

      return () => clearTimeout(autoTimer);
    }
  }, [otp, showOTP, loading, isVerifying, verifyOTP]);

  const resendOTP = async () => {
    if (!canResend) return;

    setLoading(true);
    setOtp('');
    setIsVerifying(false);
    verifyLockRef.current = false;
    await startOtpAutoFill();

    try {
      const payload = await buildSendOtpPayload(mobile);
      const response = await axios.post(`${BASE_URL}/send-otp`, payload, {
        timeout: 15000,
        headers: { 'Connection': 'close' },
      });

      if (response.data.success) {
        startTimer();

        toast.success('OTP resent successfully');
      } else {
        stopOtpAutoFill();
        toast.error(response.data.message || 'Failed to resend OTP');
      }
    } catch (error) {
      console.log('Resend OTP Error:', error);
      stopOtpAutoFill();
      toast.error('Failed to resend OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = text => {
    setOtp(cleanOtp(text));
  };

  const handleOpenURL = async url => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', `Cannot open URL: ${url}`);
      }
    } catch (error) {
      Alert.alert('Error', 'An error occurred while opening the page.');
    }
  };

  const handleBack = () => {
    setShowOTP(false);
    setOtp('');
    setTimer(30);
    setCanResend(false);
    setIsVerifying(false);
    verifyLockRef.current = false;
    stopOtpAutoFill();

    if (timerRef.current) clearInterval(timerRef.current);
  };

  const renderOTPScreen = () => (
    <>
      <Text style={styles.otpTitle}>Enter OTP</Text>

      <Text style={styles.otpSubtitle}>
        We've sent a 6-digit OTP to {'\n'}+91 {mobile}
      </Text>

      <View style={styles.otpContainer}>
        <TextInput
          ref={otpInputRef}
          style={styles.otpHiddenInput}
          maxLength={OTP_LENGTH}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
          importantForAutofill="yes"
          value={otp}
          onChangeText={handleOtpChange}
          editable={!loading && !isVerifying}
          caretHidden
          selectTextOnFocus={false}
        />

        {Array.from({ length: OTP_LENGTH }, (_, index) => {
          const digit = otp[index] || '';

          return (
            <TouchableOpacity
              key={index}
              activeOpacity={0.8}
              style={[styles.otpInput, digit && styles.otpInputFilled]}
              onPress={() => otpInputRef.current?.focus()}
              disabled={loading || isVerifying}
            >
              <Text style={styles.otpDigit}>{digit}</Text>
            </TouchableOpacity>
          );
        })}
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

      <TouchableOpacity
        style={[
          styles.loginBtn,
          otp.length !== OTP_LENGTH && styles.loginBtnDisabled,
        ]}
        onPress={() => verifyOTP()}
        disabled={loading || isVerifying || otp.length !== OTP_LENGTH}
      >
        {loading || isVerifying ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text style={styles.loginText}>VERIFY OTP</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={handleBack} style={styles.changeNumberBtn}>
        <Text style={styles.changeNumberText}>Change Mobile Number</Text>
      </TouchableOpacity>
    </>
  );

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
              const onlyNumbers = text.replace(/[^0-9]/g, '');
              setMobile(onlyNumbers);
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

      <View style={styles.checkboxContainer}>
        <TouchableOpacity
          style={styles.checkbox}
          onPress={() => setIsChecked(!isChecked)}
        >
          {isChecked && <Text style={styles.checkMark}>✓</Text>}
        </TouchableOpacity>
        <Text style={styles.checkboxText}>I have read and agreed to </Text>

        <TouchableOpacity
          onPress={() =>
            handleOpenURL(
              'https://drive.google.com/file/d/1_Q27iyNAX87BAUyBFAsSh_0JpYsDfOCW/view?usp=sharing',
            )
          }
        >
          <Text style={styles.link}>Terms and Conditions</Text>
        </TouchableOpacity>

        <Text style={styles.checkboxText}> and </Text>

        <TouchableOpacity
          onPress={() =>
            handleOpenURL(
              'https://drive.google.com/file/d/1ZZftTTrui7xY00HTqxSLl2QgkkPv-U3u/view?usp=sharing',
            )
          }
        >
          <Text style={styles.link}>Privacy Policy</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.checkboxContainer}>
        <TouchableOpacity
          style={styles.checkbox}
          onPress={() => setIsChecked_TDS(!isChecked_TDS)}
        >
          {isChecked_TDS && <Text style={styles.checkMark}>✓</Text>}
        </TouchableOpacity>
        <Text style={styles.checkboxText}>I have read and agreed to the </Text>

        <TouchableOpacity
          onPress={() =>
            handleOpenURL(
              'https://drive.google.com/file/d/1QHGQJ3AHEHffgBQkMR_A9CAQhI5Akx3J/view?usp=sharing',
            )
          }
        >
          <Text style={styles.link}>Partner Declaration</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
        onPress={sendOTP}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#000" />
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
      <StatusBar backgroundColor="#fccf1e" barStyle="dark-content" />

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
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 25,
    paddingBottom: 30,
  },
  logo: {
    fontSize: 30,
    fontWeight: '600',
    color: '#fccf1e',
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
    backgroundColor: '#F8F9FA',
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
    color: '#111827',
  },
  input: {
    flex: 1,
    fontSize: 18,
    color: '#111827',
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
  loginBtn: {
    marginTop: 40,
    backgroundColor: '#fccf1e',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
  },
  loginBtnDisabled: {
    opacity: 0.5,
  },
  loginText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  otpTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 60,
    marginBottom: 10,
  },
  otpSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 30,
    lineHeight: 24,
  },
  otpContainer: {
    position: 'relative',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 10,
    marginBottom: 30,
  },
  otpHiddenInput: {
    ...StyleSheet.absoluteFillObject,
    color: 'transparent',
    opacity: 0.01,
    zIndex: 1,
  },
  otpInput: {
    width: 45,
    height: 55,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    backgroundColor: '#F8F9FA',
  },
  otpDigit: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  otpInputFilled: {
    borderColor: '#fccf1e',
    backgroundColor: '#FFF7D6',
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
    color: '#fccf1e',
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
  checkboxContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 20,
  },

  checkboxText: {
    fontSize: 14,
    color: '#6B7280',
  },

  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 15,
    paddingHorizontal: 10,
  },

  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: '#fccf1e', // Purple Theme
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 2,
  },

  checkMark: {
    color: '#fccf1e',
    fontSize: 14,
    fontWeight: 'bold',
  },

  termsText: {
    flex: 1,
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 22,
  },

  link: {
    color: '#fccf1e',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
