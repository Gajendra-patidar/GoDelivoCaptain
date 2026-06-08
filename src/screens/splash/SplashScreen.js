import { StyleSheet, View, Image, StatusBar } from 'react-native';
import React, { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { BASE_URL } from '../../services/api';

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

  console.log("final jai shree ram splash", response?.data, applicationId);
  

  return response?.data?.data || null;
};

const SplashScreen = () => {
  const navigation = useNavigation();

  useEffect(() => {
    // SPLASH SCREEN: 3 Second Delay
    // Display splash screen for 3 seconds before navigating to next screen
    const splashTimer = setTimeout(() => {
      const checkTokenAndNavigate = async () => {
        try {
          const token = await AsyncStorage.getItem('userToken');

          
          if (token) {
            const storedUser = await AsyncStorage.getItem('userData');
            const user = storedUser ? JSON.parse(storedUser) : null;
            const phone = (await AsyncStorage.getItem('userPhone')) || user?.phone;
            let latestUser = user;

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
                console.log('Error fetching status in splash:', error?.message);
              }
            }

            const applicationId = getApplicationId(latestUser);

            if (applicationId) {
              try {
                const paymentData = await fetchJoiningFeeStatus(
                  token,
                  applicationId,
                );

                if (
                  !isJoiningFeePaid(paymentData) &&
                  !isJoiningFeePaid(latestUser)
                ) {
                  navigation.replace('JoinFees', {
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
                  navigation.replace('JoinFees', {
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
              console.log("checking condition splash", latestUser, isVerified(latestUser));
              
              navigation.replace('MyTabs');
              return;
            }

            navigation.replace('Docs', {
              phone: latestUser?.phone || user?.phone,
              data: latestUser,
            });
          } else {
            navigation.replace('Login');
          }
        } catch (error) {
            navigation.replace('Login');
        }
      };

      checkTokenAndNavigate();
    }, 3000); // 3 second delay

    // Cleanup timer on component unmount
    return () => clearTimeout(splashTimer);
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
