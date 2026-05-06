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
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import RNOtpVerify from 'react-native-otp-verify';
import toast from '../../utils/toast';
import axios from 'axios';
import { BASE_URL } from '../../services/api.js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addNotification } from '../../services/localDriverData';
import { useDispatch } from 'react-redux';
import { getProfile } from '../../store/slices/profileSlice';

const OTP_LENGTH = 6;

const LoginScreen = ({ navigation }) => {
  const dispatch = useDispatch();

  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
  const [checked1, setChecked1] = useState(true);
  const [checked2, setChecked2] = useState(true);
  const [showOTP, setShowOTP] = useState(false);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const otpInputs = useRef([]);
  const timerRef = useRef(null);
  const verifyLockRef = useRef(false);

  const extractOtp = message => {
    const match = message?.match(/\b\d{6}\b/);
    return match ? match[0] : null;
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      RNOtpVerify.removeListener();
    };
  }, []);

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

  const validateCheckboxes = () => {
    if (!checked1) {
      toast.error('Please accept Terms and Conditions and Privacy Policy');
      return false;
    }

    if (!checked2) {
      toast.error('Please accept TDS Declaration');
      return false;
    }

    return true;
  };

  const sendOTP = async () => {
    if (!validatePhone(mobile) || !validateCheckboxes()) return;

    setLoading(true);

    try {
      const response = await axios.post(`${BASE_URL}/send-otp`, {
        phone: mobile,
      });

      if (response.data.success) {
        setShowOTP(true);
        setOtp(Array(OTP_LENGTH).fill(''));
        setIsVerifying(false);
        verifyLockRef.current = false;
        startTimer();

        setTimeout(() => {
          otpInputs.current[0]?.focus();
        }, 300);

        toast.success('OTP sent successfully to your mobile');
      } else {
        toast.error(response.data.message || 'Failed to send OTP');
      }
    } catch (error) {
      console.log('Send OTP Error:', error);
      toast.error(
        error.response?.data?.message || 'Network error. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = useCallback(
    async otpValue => {
      const otpString = otpValue || otp.join('');

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
        });

        if (response.data.success || response.data.status === 'success') {
          const token = response.data?.data?.token || response.data?.token;

          console.log("token checking", token);
          

          if (token) {
            await AsyncStorage.setItem('userToken', token);
            await AsyncStorage.setItem(
              'userPhone',
              response?.data?.data?.phone || mobile,
            );
          }

          const user = response?.data?.data;

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

          RNOtpVerify.removeListener();

          Alert.alert('Success', 'Login Successfully', [
            {
              text: 'OK',
              onPress: () => {
                if (response?.data?.data?.requiresRegistration) {
                  navigation.navigate('Docs', {
                    phone: response?.data?.data?.phone,
                    data: response?.data?.data,
                  });
                } else {
                  navigation.navigate('MyTabs');
                }
              },
            },
          ]);
        } else {
          toast.error(response.data.message || 'Invalid OTP');
          setOtp(Array(OTP_LENGTH).fill(''));
          setIsVerifying(false);
          verifyLockRef.current = false;

          setTimeout(() => {
            otpInputs.current[0]?.focus();
          }, 100);
        }
      } catch (error) {
        console.log('Verify OTP Error:', error);

        if (error.response) {
          toast.error(error.response.data.message || 'Invalid OTP. Please try again.');
        } else if (error.request) {
          toast.error('Unable to connect to server. Please check your internet connection.');
        } else {
          toast.error('An unexpected error occurred. Please try again.');
        }

        setOtp(Array(OTP_LENGTH).fill(''));
        setIsVerifying(false);
        verifyLockRef.current = false;

        setTimeout(() => {
          otpInputs.current[0]?.focus();
        }, 100);
      } finally {
        setLoading(false);
      }
    },
    [otp, mobile, isVerifying, dispatch, navigation],
  );

  useEffect(() => {
    if (!showOTP) return;

    RNOtpVerify.getOtp()
      .then(() => {
        RNOtpVerify.addListener(message => {
          const detectedOtp = extractOtp(message);

          if (detectedOtp) {
            const otpArray = detectedOtp.split('');
            setOtp(otpArray);

            setTimeout(() => {
              verifyOTP(detectedOtp);
            }, 200);

            RNOtpVerify.removeListener();
          }
        });
      })
      .catch(error => {
        console.log('OTP Listener Error:', error);
      });

    return () => {
      RNOtpVerify.removeListener();
    };
  }, [showOTP, verifyOTP]);

  useEffect(() => {
    const otpString = otp.join('');

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

    try {
      const response = await axios.post(`${BASE_URL}/send-otp`, {
        phone: mobile,
      });

      if (response.data.success) {
        setOtp(Array(OTP_LENGTH).fill(''));
        setIsVerifying(false);
        verifyLockRef.current = false;
        startTimer();

        setTimeout(() => {
          otpInputs.current[0]?.focus();
        }, 200);

        toast.success('OTP resent successfully');
      } else {
        toast.error(response.data.message || 'Failed to resend OTP');
      }
    } catch (error) {
      console.log('Resend OTP Error:', error);
      toast.error('Failed to resend OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (text, index) => {
    const cleanText = text.replace(/[^0-9]/g, '');

    if (cleanText.length > 1) {
      const digits = cleanText.slice(0, OTP_LENGTH).split('');
      const newOtp = Array(OTP_LENGTH).fill('');

      digits.forEach((digit, i) => {
        newOtp[i] = digit;
      });

      setOtp(newOtp);

      if (digits.length === OTP_LENGTH) {
        otpInputs.current[OTP_LENGTH - 1]?.focus();
      } else {
        otpInputs.current[digits.length]?.focus();
      }

      return;
    }

    const newOtp = [...otp];
    newOtp[index] = cleanText;
    setOtp(newOtp);

    if (cleanText && index < OTP_LENGTH - 1) {
      otpInputs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputs.current[index - 1]?.focus();
    }
  };

  const handleBack = () => {
    setShowOTP(false);
    setOtp(Array(OTP_LENGTH).fill(''));
    setTimer(30);
    setCanResend(false);
    setIsVerifying(false);
    verifyLockRef.current = false;
    RNOtpVerify.removeListener();

    if (timerRef.current) clearInterval(timerRef.current);
  };

  const renderOTPScreen = () => (
    <>
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
            maxLength={index === 0 ? OTP_LENGTH : 1}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            importantForAutofill="yes"
            value={digit}
            onChangeText={text => handleOtpChange(text, index)}
            onKeyPress={e => handleOtpKeyPress(e, index)}
            editable={!loading && !isVerifying}
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

      <TouchableOpacity
        style={[
          styles.loginBtn,
          otp.join('').length !== OTP_LENGTH && styles.loginBtnDisabled,
        ]}
        onPress={() => verifyOTP()}
        disabled={
          loading ||
          isVerifying ||
          otp.join('').length !== OTP_LENGTH
        }
      >
        {loading || isVerifying ? (
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
  otpTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
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