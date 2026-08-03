import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Animated,
  Easing,
  Image,
  StatusBar,
  Dimensions,
} from 'react-native';
import { useDispatch } from 'react-redux';
import { colors } from '../../theme/theme';
import { getProfile } from '../../store/slices/profileSlice';

const { height } = Dimensions.get('window');

const LOGO_WIDTH  = 240;
const LOGO_HEIGHT = 120;

const SplashScreen = ({ navigation }) => {
  const dispatch    = useDispatch();
  const scaleAnim   = useRef(new Animated.Value(0.3)).current;
  const translateYPin = useRef(new Animated.Value(-height)).current;
  const scaleAnimPin  = useRef(new Animated.Value(0)).current;
  const fadeAnim      = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // ── Splash animation ──────────────────────────────────────────────────
    Animated.sequence([
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 1.2,
          duration: 2000,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.parallel([
          Animated.timing(translateYPin, {
            toValue: 0,
            duration: 1800,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnimPin, {
            toValue: 1,
            friction: 5,
            tension: 60,
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.delay(900),
      Animated.timing(scaleAnimPin, {
        toValue: 40,
        duration: 1800,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }),
    ]).start();

    // ── Auth routing ──────────────────────────────────────────────────────
    const timer = setTimeout(async () => {
      try {
        const token       = await AsyncStorage.getItem('userToken');
        const userDataRaw = await AsyncStorage.getItem('userData');

        console.log('[SplashScreen] token present:', !!token);

        if (token) {
          // ✅ Driver already logged in — rehydrate Redux profile silently
          dispatch(getProfile());

          if (userDataRaw) {
            const user   = JSON.parse(userDataRaw);
            const status = user?.verificationStatus || user?.applicationStatus || user?.status || '';
            const verified = String(status).trim().toLowerCase() === 'verified';

            if (user?.requiresRegistration || !verified) {
              navigation.replace('Docs', {
                phone: user?.phone,
                data:  user,
              });
              return;
            }
          }

          // Token valid + user verified → go straight to app, no login needed
          navigation.replace('MyTabs');
        } else {
          navigation.replace('Login');
        }
      } catch (error) {
        console.error('[SplashScreen] Routing error:', error);
        navigation.replace('Login');
      }
    }, 4000);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.primary} />

      <Animated.View
        style={[
          styles.logoWrapper,
          {
            transform: [{ scale: scaleAnim }],
            opacity: fadeAnim,
          },
        ]}
      >
        <Image
          source={require('../../assets/splash_logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        <Animated.View
          style={[
            styles.pinWrapper,
            {
              transform: [
                { translateY: translateYPin },
                { scale: scaleAnimPin },
              ],
            },
          ]}
        >
          <Image
            source={require('../../assets/pin_splash.png')}
            style={styles.logoLocation}
            resizeMode="contain"
          />
        </Animated.View>
      </Animated.View>
    </View>
  );
};

export default SplashScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
  },

  logoWrapper: {
    width: LOGO_WIDTH,
    height: LOGO_HEIGHT,
    position: 'relative',
  },

  logo: {
    width: LOGO_WIDTH,
    height: LOGO_HEIGHT,
  },

  pinWrapper: {
    position: 'absolute',
    left: LOGO_WIDTH * 0.65,
    top:  LOGO_HEIGHT * 0.31,
    width: 18,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  logoLocation: {
    width: 18,
    height: 16,
  },
});
