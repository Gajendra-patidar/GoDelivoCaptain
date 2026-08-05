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
import { colors } from '../../theme/theme';

const { height } = Dimensions.get('window');

const LOGO_WIDTH = 240;
const LOGO_HEIGHT = 120;

const SplashScreen = ({ navigation }) => {
  const scaleAnim = useRef(new Animated.Value(0.3)).current;

  // 👇 Screen ke top se start hoga
  const translateYPin = useRef(new Animated.Value(-height)).current;

  const scaleAnimPin = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
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
          // 👇 Smooth falling animation
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

    const timer = setTimeout(async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        const driverId = await AsyncStorage.getItem('driverId');
        const userPhone = await AsyncStorage.getItem('userPhone');

        console.log('Splash session check:', { hasToken: !!token, driverId, userPhone });

        if (token) {
          // Valid token → go straight to the app
          navigation.replace('MyTabs');
        } else {
          // No token → always go to Login; no need to wipe existing profile data
          navigation.replace('Login');
        }
      } catch (error) {
        console.error('Splash error:', error);
        navigation.replace('Login');
      }
    }, 2000);

    return () => clearTimeout(timer);
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
    top: LOGO_HEIGHT * 0.31,

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
