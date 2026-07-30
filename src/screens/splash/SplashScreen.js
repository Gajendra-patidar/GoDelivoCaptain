import { StyleSheet, View, Image, StatusBar } from 'react-native';
import React, { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { BASE_URL } from '../../services/api';
import NetInfo from '@react-native-community/netinfo';

const MIN_SPLASH_TIME_MS = 3000; // Enforces a minimum display time for UI stability

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

  console.log("final status fetch in splash", response?.data, applicationId);
  return response?.data?.data || null;
};

const SplashScreen = () => {
  const navigation = useNavigation();

  useEffect(()=>{
    checkInternet()
  }, [])

  const checkInternet = async () => {
    const netInfo = await NetInfo.fetch();
    
    if (!netInfo.isConnected) {
      navigation.replace('Network-error');
    } 
  };

  useEffect(() => {
    const checkTokenAndNavigate = async () => {
      const startTime = Date.now();
      try {
        const token = await AsyncStorage.getItem('userToken');

        if (!token) {
          routeTo('Login', startTime);
          return;
        }

        const storedUserRaw = await AsyncStorage.getItem('userData');
        const user = storedUserRaw ? JSON.parse(storedUserRaw) : null;
        const phone = (await AsyncStorage.getItem('userPhone')) || user?.phone;
        
        let latestUser = user;

        // Perform status checks in parallel if we have a phone number
        if (phone) {
          try {
            const statusResponse = await axios.get(`${BASE_URL}/status/${phone}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            const statusUser = statusResponse?.data?.data || statusResponse?.data;
            if (statusUser) {
              latestUser = {
                ...(user || {}),
                ...statusUser,
              };
              // Persist latest values back to async storage
              await AsyncStorage.setItem('userData', JSON.stringify(latestUser));
            }
          } catch (error) {
            console.log('Error fetching status in splash:', error?.message);
          }
        }

        const applicationId = getApplicationId(latestUser);

        if (applicationId) {
          try {
            const paymentData = await fetchJoiningFeeStatus(token, applicationId);

            if (!isJoiningFeePaid(paymentData) && !isJoiningFeePaid(latestUser)) {
              routeTo('JoinFees', startTime, {
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
            await AsyncStorage.setItem('userData', JSON.stringify(latestUser));
          } catch (error) {
            console.log('Joining fee status check failed:', error?.response?.data || error?.message);

            if (!isJoiningFeePaid(latestUser)) {
              routeTo('JoinFees', startTime, {
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

        if (latestUser && isVerified(latestUser)) {
          routeTo('MyTabs', startTime);
          return;
        }

        routeTo('Docs', startTime, {
          phone: latestUser?.phone || user?.phone,
          data: latestUser,
        });

      } catch (error) {
        console.error('Splash navigation check failed:', error);
        routeTo('Login', startTime);
      }
    };

    const routeTo = (screenName, startTime, params = null) => {
      const timeElapsed = Date.now() - startTime;
      const remainingDelay = Math.max(0, MIN_SPLASH_TIME_MS - timeElapsed);

      setTimeout(() => {
        if (params) {
          navigation.replace(screenName, params);
        } else {
          navigation.replace(screenName);
        }
      }, remainingDelay);
    };

    checkTokenAndNavigate();
  }, [navigation]);

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#fccf1e" barStyle="dark-content" />
      <Image
        source={require('../../assets/logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />
    </View>
  );
};

export default SplashScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fccf1e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 200,
    height: 200,
  },
});
