import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import RazorpayCheckout from 'react-native-razorpay';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../../services/api';
import axios from 'axios';
import InReviewModal from '../../modals/InReviewModal';
import { Toast } from 'toastify-react-native';

const JoiningFeesScreen = ({ navigation, route }) => {
  const [loading, setLoading] = useState(false);
  const [subscriptionFee, setSubscriptionFee] = useState(0);
  const [feeLoading, setFeeLoading] = useState(true);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [showInReviewModal, setShowInReviewModal] = useState(false);
  const [pendingNavigateData, setPendingNavigateData] = useState(null);
  const [savedFormData, setSavedFormData] = useState(null);
  const [savedApplicationId, setSavedApplicationId] = useState(null);
  const [vehicleType, setVehicleType] = useState('Bike');

  useEffect(() => {
    const saveOrLoadData = async () => {
      const routeFormData = route?.params?.formData;
      const routeApplicationId = route?.params?.applicationId;

      if (routeFormData && routeApplicationId) {
        await AsyncStorage.setItem(
          'joinFeesFormData',
          JSON.stringify(routeFormData),
        );
        await AsyncStorage.setItem('joinFeesApplicationId', routeApplicationId);

        setSavedFormData(routeFormData);
        setSavedApplicationId(routeApplicationId);
      } else {
        const storedFormData = await AsyncStorage.getItem('joinFeesFormData');
        const storedApplicationId = await AsyncStorage.getItem(
          'joinFeesApplicationId',
        );

        if (storedFormData && storedApplicationId) {
          setSavedFormData(JSON.parse(storedFormData));
          setSavedApplicationId(storedApplicationId);
        } else {
          navigation.replace('Docs');
        }
      }
    };

    saveOrLoadData();
  }, [navigation, route?.params?.applicationId, route?.params?.formData]);

  // useEffect(() => {
  //   loadType();
  // });

  const formData = route?.params?.formData || savedFormData;
  const applicationId = route?.params?.applicationId || savedApplicationId;

  console.log('application id ', applicationId);
  console.log('formData vehicle type', formData);

  const getApplicationId = () => {
    return (
      applicationId ||
      formData?.backendData?.applicationId ||
      formData?.backendData?._id ||
      formData?.applicationId ||
      formData?._id ||
      null
    );
  };

  const normalizePhone = phone => String(phone || '').replace(/\D/g, '');

  const getPaymentStatus = data =>
    String(
      data?.subscriptionPayment?.status ||
        data?.joiningFeePayment?.status ||
        data?.subscriptionPaymentStatus ||
        data?.joiningFeePaymentStatus ||
        data?.paymentStatus ||
        '',
    )
      .trim()
      .toLowerCase();

  const isPaymentCompleted = data =>
    ['completed', 'paid', 'success', 'captured'].includes(
      getPaymentStatus(data),
    );

  const fetchJoiningFeeStatus = async (token, appId) => {
    const response = await axios.get(
      `${BASE_URL}/subscription/status/${appId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    );

    return response?.data?.data || null;
  };

  const confirmCompletedPayment = async (token, appId) => {
    const paymentStatusData = await fetchJoiningFeeStatus(token, appId);
    return isPaymentCompleted(paymentStatusData) ? paymentStatusData : null;
  };

  const buildCompletedPayment = data => {
    const existingPayment =
      data?.subscriptionPayment || data?.joiningFeePayment || null;

    return (
      existingPayment || {
        status: 'completed',
        amount: data?.subscriptionFee ?? subscriptionFee,
        paidAt: data?.paidAt || new Date().toISOString(),
      }
    );
  };

  const navigateAfterPayment = data => {
    const verificationStatus = String(
      data?.verificationStatus ||
        formData?.verificationStatus ||
        formData?.backendData?.verificationStatus ||
        'submitted',
    )
      .trim()
      .toLowerCase();
    const payment = buildCompletedPayment(data || {});
    const completeReviewData = {
      ...(formData?.backendData || {}),
      ...(formData || {}),
      ...(data || {}),
      applicationId: data?.applicationId || getApplicationId(),
      vehicleType:
        data?.vehicleType ||
        formData?.vehicleType ||
        formData?.backendData?.vehicleType,
      verificationStatus: verificationStatus || 'submitted',
      subscriptionPayment: payment,
      joiningFeePayment: payment,
      subscriptionPaymentStatus: payment?.status || 'completed',
      joiningFeePaymentStatus: payment?.status || 'completed',
      subscriptionPaid: true,
      joiningFeePaid: true,
      isSubscriptionPaid: true,
      isJoiningFeePaid: true,
    };

    if (verificationStatus === 'verified') {
      navigation.replace('MyTabs');
      return;
    }

    navigation.replace('Docs', {
      phone: data?.phone || formData?.phone || formData?.backendData?.phone,
      data: completeReviewData,
    });
  };

  // Load subscription fee from API
  useEffect(() => {
    if (formData?.vehicleType) {
      loadSubscriptionFee();
    }
    // Load fee when this screen receives its registration payload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData?.vehicleType]);

  useEffect(() => {
    checkJoiningFeesStatus();
    // Check the server payment state once for the current application.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkJoiningFeesStatus = async () => {
    const fees = AsyncStorage.getItem('subscribtion_fees');
    try {
      setCheckingStatus(true);

      const token = await AsyncStorage.getItem('userToken');

      if (!token) {
        console.log('No token found');
        setCheckingStatus(false);
        return;
      }

      const appId = getApplicationId();

      if (!appId) {
        console.log('No applicationId found');
        setCheckingStatus(false);
        return;
      }

      const response = await axios.get(
        `${BASE_URL}/subscription/status/${appId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      console.log('Subscription status response:', response?.data);

      if (response?.data?.success && response?.data?.data) {
        const paymentStatus = response.data.data.subscriptionPayment?.status;
        const verificationStatus = String(
          response.data.data.verificationStatus || '',
        )
          .trim()
          .toLowerCase();

        console.log('Payment status:', paymentStatus);
        console.log('Verification status:', verificationStatus);

        if (isPaymentCompleted(response.data.data)) {
          if (verificationStatus === 'verified') {
            Alert.alert(
              'Application Approved',
              'Your application is active and verified.',
              [
                {
                  text: 'OK',
                  onPress: () => navigateAfterPayment(response.data.data),
                },
              ],
            );
          } else {
            setPendingNavigateData(response.data.data);
            setShowInReviewModal(true);
          }
          return;
        }
      }

      // If payment not completed, load the subscription fee
      if (formData?.vehicleType || fees) {
        loadSubscriptionFee();
      }
    } catch (error) {
      console.log(
        'Error checking subscription status:',
        error?.response?.data || error?.message,
      );
      // If error occurs (like 404 or something), load the fee normally
      if (formData?.vehicleType || fees) {
        loadSubscriptionFee();
      }
    } finally {
      setCheckingStatus(false);
    }
  };

  const loadSubscriptionFee = async () => {
    try {
      setFeeLoading(true);
      const currentVehicleType =
        (await AsyncStorage.getItem('vehicleType')) ||
        formData?.vehicleType ||
        'Bike';

      console.log('checking sun jcn ci wi', currentVehicleType);
      setVehicleType(currentVehicleType);

      // Fetch dynamic fees from backend using old API
      const response = await axios.get(
        `${BASE_URL}/subscription/fee?vehicleType=${currentVehicleType}`,
      );

      console.log('Subscription fee response:', response?.data);

      if (response?.data?.success && response?.data?.data) {
        const fee = response.data.data.subscriptionFee ?? 0;
        setSubscriptionFee(fee);
        await AsyncStorage.setItem('subscribtion_fees', String(fee));
      } else {
        // Fallback to 0 or locally saved if not success
        const storedFee = await AsyncStorage.getItem('subscribtion_fees');
        setSubscriptionFee(storedFee ? Number(storedFee) : 0);
      }
    } catch (error) {
      console.log('Fee load error:', error);
      const storedFee = await AsyncStorage.getItem('subscribtion_fees');
      setSubscriptionFee(storedFee ? Number(storedFee) : 0);
    } finally {
      setFeeLoading(false);
    }
  };


  const handlePayNow = async () => {
    try {
      setLoading(true);

      const token = await AsyncStorage.getItem('userToken');

      if (!token) {
        Alert.alert('Error', 'Session expired. Please login again.');
        navigation.navigate('Login');
        return;
      }

      // Get application ID from various possible sources
      const appId = getApplicationId();

      if (!appId) {
        Alert.alert(
          'Error',
          'Application ID not found. Please restart registration.',
        );
        return;
      }

      console.log('Creating order for applicationId:', appId);

      // Create Razorpay order
      const orderRes = await axios.post(
        `${BASE_URL}/subscription/create-order`,
        {
          applicationId: appId,
          amount: subscriptionFee,
          vehicleType: vehicleType || formData?.vehicleType,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      console.log('Order response:', orderRes?.data);

      // Check if no payment is required (free subscription)
      if (orderRes?.data?.noPaymentRequired) {
        const verificationStatus = String(
          orderRes?.data?.data?.verificationStatus || 'submitted',
        )
          .trim()
          .toLowerCase();

        const successData = {
          ...(orderRes?.data?.data || {}),
          applicationId: appId,
          subscriptionFee: 0,
          subscriptionPayment: {
            status: 'completed',
            amount: 0,
            paidAt: new Date().toISOString(),
          },
          verificationStatus:
            orderRes?.data?.data?.verificationStatus || 'submitted',
        };

        if (verificationStatus === 'verified') {
          Alert.alert(
            'Registration Successful',
            orderRes?.data?.message || 'Your application has been approved!',
            [
              {
                text: 'OK',
                onPress: () => navigateAfterPayment(successData),
              },
            ],
          );
        } else {
          setPendingNavigateData(successData);
          setShowInReviewModal(true);
        }
        return;
      }

      // Check if already paid
      if (orderRes?.data?.alreadyPaid) {
        const completedPaymentData = await confirmCompletedPayment(
          token,
          appId,
        );

        if (!completedPaymentData) {
          Alert.alert(
            'Payment Pending',
            'We could not confirm your joining fee payment yet. Please complete the payment to continue.',
          );
          return;
        }

        const verificationStatus = String(
          completedPaymentData?.verificationStatus ||
            orderRes?.data?.data?.verificationStatus ||
            'submitted',
        )
          .trim()
          .toLowerCase();

        const successData = {
          ...(orderRes?.data?.data || {}),
          ...completedPaymentData,
          applicationId: appId,
          verificationStatus:
            completedPaymentData?.verificationStatus ||
            orderRes?.data?.data?.verificationStatus ||
            'submitted',
        };

        if (verificationStatus === 'verified') {
          Alert.alert(
            'Application Approved',
            orderRes?.data?.message || 'Your application has been approved.',
            [
              {
                text: 'Continue',
                onPress: () => navigateAfterPayment(successData),
              },
            ],
          );
        } else {
          setPendingNavigateData(successData);
          setShowInReviewModal(true);
        }
        return;
      }

      const orderData = orderRes?.data?.data;

      if (!orderData || !orderData.orderId) {
        throw new Error('Failed to create payment order');
      }

      const storedPhone = await AsyncStorage.getItem('userPhone');
      const driverPhone = normalizePhone(
        orderData?.driverPhone ||
          formData?.phone ||
          formData?.backendData?.phone ||
          storedPhone,
      );

      console.log('order datad aftafa', orderData);

      // Razorpay payment options
      const options = {
        key: orderData?.keyId,
        amount: Number(orderData?.amount), // paise me hona chahiye: 49900
        currency: orderData?.currency || 'INR',
        name: 'GoDelivo Partner',
        description: 'GoDelivo Captain Subscription Fee',
        order_id: orderData?.orderId,

        prefill: {
          name:
            orderData?.driverName ||
            formData?.fullName ||
            formData?.backendData?.fullName ||
            'GoDelivo User',
          contact: driverPhone,
          email:
            formData?.email || formData?.backendData?.email || 'test@gmail.com',
        },

        notes: {
          applicationId: appId,
          vehicleType: orderData?.vehicleType || formData?.vehicleType || '',
        },

        theme: {
          color: '#fccf1e',
        },
      };
      console.log('Payment success data:', options);

      const paymentData = await RazorpayCheckout.open(options);

      console.log('Payment success data:', paymentData);

      // Verify payment
      const verifyRes = await axios.post(
        `${BASE_URL}/subscription/verify`,
        {
          applicationId: appId,
          razorpay_order_id: paymentData.razorpay_order_id,
          razorpay_payment_id: paymentData.razorpay_payment_id,
          razorpay_signature: paymentData.razorpay_signature,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      console.log('Verification response:', verifyRes?.data);

      if (verifyRes?.data?.success) {
        let completedPaymentData = null;

        try {
          completedPaymentData = await confirmCompletedPayment(token, appId);
        } catch (statusError) {
          console.log(
            'Payment status confirmation delayed:',
            statusError?.response?.data || statusError?.message,
          );
        }

        const verificationStatus = String(
          completedPaymentData?.verificationStatus ||
            verifyRes?.data?.data?.verificationStatus ||
            'submitted',
        )
          .trim()
          .toLowerCase();

        const successData = {
          ...(verifyRes?.data?.data || {}),
          ...(completedPaymentData || {}),
          applicationId: appId,
          verificationStatus:
            completedPaymentData?.verificationStatus ||
            verifyRes?.data?.data?.verificationStatus ||
            'submitted',
          subscriptionPayment: {
            ...(completedPaymentData?.subscriptionPayment || {}),
            status:
              completedPaymentData?.subscriptionPayment?.status ||
              completedPaymentData?.joiningFeePayment?.status ||
              'completed',
            amount:
              completedPaymentData?.subscriptionPayment?.amount ||
              verifyRes?.data?.data?.subscriptionFee ||
              subscriptionFee,
            paidAt:
              completedPaymentData?.subscriptionPayment?.paidAt ||
              new Date().toISOString(),
            razorpayOrderId: paymentData.razorpay_order_id,
            razorpayPaymentId: paymentData.razorpay_payment_id,
          },
          joiningFeePayment: {
            ...(completedPaymentData?.joiningFeePayment || {}),
            status:
              completedPaymentData?.joiningFeePayment?.status ||
              completedPaymentData?.subscriptionPayment?.status ||
              'completed',
            amount:
              completedPaymentData?.joiningFeePayment?.amount ||
              verifyRes?.data?.data?.subscriptionFee ||
              subscriptionFee,
            paidAt:
              completedPaymentData?.joiningFeePayment?.paidAt ||
              new Date().toISOString(),
            razorpayOrderId: paymentData.razorpay_order_id,
            razorpayPaymentId: paymentData.razorpay_payment_id,
          },
          subscriptionPaymentStatus: 'completed',
          joiningFeePaymentStatus: 'completed',
          subscriptionPaid: true,
          joiningFeePaid: true,
          isSubscriptionPaid: true,
          isJoiningFeePaid: true,
        };

        if (verificationStatus === 'verified') {
          Alert.alert(
            'Payment Successful',
            'Your payment was verified successfully!',
            [
              {
                text: 'Continue',
                onPress: () => navigateAfterPayment(successData),
              },
            ],
          );
        } else {
          setPendingNavigateData(successData);
          setShowInReviewModal(true);
        }
      } else {
        Alert.alert(
          'Error',
          'Payment verification failed. Please contact support.',
        );
      }
    } catch (error) {
      console.log('Payment error:', error);

      try {
        const token = await AsyncStorage.getItem('userToken');
        const appId = getApplicationId();

        if (token && appId) {
          const completedPaymentData = await confirmCompletedPayment(
            token,
            appId,
          );

          if (completedPaymentData) {
            Alert.alert(
              'Payment Successful',
              'Your payment was completed successfully.',
              [
                {
                  text: 'Continue',
                  onPress: () => navigateAfterPayment(completedPaymentData),
                },
              ],
            );
            return;
          }
        }
      } catch (statusError) {
        console.log(
          'Payment status recheck error:',
          statusError?.response?.data || statusError?.message,
        );
      }

      let errorMessage =
        'Payment failed. If amount was debited, please wait or contact support.';

      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.description) {
        errorMessage = error.description;
      } else if (error?.message) {
        errorMessage = error.message;
      }

      Toast.error('Payment Issue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar
        backgroundColor="#fccf1e"
        barStyle="dark-content"
        translucent
      />

      <LinearGradient colors={['#fccf1e', '#fccf1e']} style={styles.header}>
        {!vehicleType && (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
        )}

        <Text style={styles.headerTitle}>Partner Security Balance</Text>

        <View style={styles.backBtnPlaceholder} />
      </LinearGradient>

      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Icon name="workspace-premium" size={60} color="#fccf1e" />
        </View>

        <Text style={styles.title}>Start Earning with GoDelivo</Text>

        <Text style={styles.subtitle}>
          This amount is maintained as your Partner Adjustment Balance.
          Applicable platform commission and other approved deductions will be
          adjusted automatically from this balance until it is exhausted
        </Text>

        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Vehicle Type</Text>
            <Text style={styles.value}>
              {formData?.vehicleType || vehicleType}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.label}>Partner Security Balence</Text>
            {feeLoading ? (
              <ActivityIndicator size="small" color="#fccf1e" />
            ) : (
              
                subscriptionFee === 0 ? <Text style={styles.amountFree}>Free</Text> : <Text style={styles.amount}>₹{subscriptionFee}</Text>
            )}
          </View>
        </View>

        {subscriptionFee != 0 && (
          <View style={styles.benefitCard}>
          

            <View style={styles.benefitRow}>
              <Icon name="check-circle" size={20} color="#4CAF50" />
              <Text style={styles.benefitText}>
                Start accepting rides after approval
              </Text>
            </View>

           

            <View style={styles.benefitRow}>
              <Icon name="alarm" size={25} color="#4CAF50" />
              <Text style={[styles.benefitText, { marginRight: 10 }]}>
                After paying Partner Security Balance, document verification might takes up
                to 5 Days
              </Text>
            </View>
          </View>
        )}

        {subscriptionFee === 0 && !feeLoading && (
          <View style={styles.freeCard}>
            <Icon name="verified" size={24} color="#4CAF50" />
            <Text style={styles.freeText}>
              No joining fee required for this vehicle!
            </Text>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.payBtn,
            (loading || feeLoading || checkingStatus) && styles.payBtnDisabled,
          ]}
          onPress={handlePayNow}
          disabled={loading || feeLoading || checkingStatus}
        >
          {loading || checkingStatus ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <>
              <Icon name="payments" size={22} color="#000" />
              <Text style={styles.payBtnText}>
                {subscriptionFee === 0 ? 'Continue' : `Pay ₹${subscriptionFee}`}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
      <InReviewModal
        visible={showInReviewModal}
        onClose={() => {
          setShowInReviewModal(false);
          if (pendingNavigateData) {
            navigateAfterPayment(pendingNavigateData);
          }
        }}
      />
    </View>
  );
};

export default JoiningFeesScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    paddingTop: 15,
    paddingBottom: 18,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnPlaceholder: {
    width: 42,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111827',
  },
  content: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 60,
    backgroundColor: '#FFF7D6',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 25,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#111',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 25,
  },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    marginBottom: 18,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '600',
  },
  value: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '800',
  },
  amount: {
    fontSize: 26,
    color: '#111827',
    fontWeight: '900',
  },
  amountFree: {
    fontSize: 26,
    color: '#15b307',
    fontWeight: '900',
  },
  divider: {
    height: 1,
    backgroundColor: '#F8F9FA',
    marginVertical: 16,
  },
  benefitCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  benefitText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 10,
    fontWeight: '600',
  },
  footer: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  payBtn: {
    height: 58,
    borderRadius: 16,
    backgroundColor: '#fccf1e',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  payBtnDisabled: {
    opacity: 0.6,
  },
  payBtnText: {
    fontSize: 17,
    fontWeight: '900',
    color: '#000',
  },
  freeCard: {
    width: '100%',
    backgroundColor: '#0E2A1A',
    borderRadius: 18,
    padding: 15,
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  freeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
  },
});
