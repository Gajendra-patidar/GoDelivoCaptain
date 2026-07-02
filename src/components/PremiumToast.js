import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Animated,
  Dimensions,
  DeviceEventEmitter,
  TouchableOpacity,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

const { width } = Dimensions.get('window');

const TOAST_EVENTS = {
  SHOW: 'SHOW_PREMIUM_TOAST',
  HIDE: 'HIDE_PREMIUM_TOAST',
};

// Expose a global method to call the toast from anywhere
export const showToast = (type = 'success', title = '', message = '') => {
  DeviceEventEmitter.emit(TOAST_EVENTS.SHOW, { type, title, message });
};

const PremiumToast = () => {
  const [toastConfig, setToastConfig] = useState(null);
  const translateY = useRef(new Animated.Value(-150)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);

  useEffect(() => {
    const showListener = DeviceEventEmitter.addListener(TOAST_EVENTS.SHOW, (config) => {
      setToastConfig(config);
      showAnimation();
      
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      
      timerRef.current = setTimeout(() => {
        hideAnimation();
      }, 4000); // Auto hide after 4 seconds
    });

    const hideListener = DeviceEventEmitter.addListener(TOAST_EVENTS.HIDE, () => {
      hideAnimation();
    });

    return () => {
      showListener.remove();
      hideListener.remove();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const showAnimation = () => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 50, // Distance from top
        useNativeDriver: true,
        friction: 7,
        tension: 40,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const hideAnimation = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -150,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setToastConfig(null);
    });
  };

  if (!toastConfig) return null;

  const { type, title, message } = toastConfig;

  // Design config based on toast type
  let iconName = 'checkmark-circle';
  let iconColor = '#00C851'; // Success Green
  let backgroundColor = '#E8F5E9';
  let borderColor = '#00C851';

  if (type === 'error') {
    iconName = 'alert-circle';
    iconColor = '#ff4444';
    backgroundColor = '#FFEBEE';
    borderColor = '#ff4444';
  } else if (type === 'warn' || type === 'warning') {
    iconName = 'warning';
    iconColor = '#ffbb33';
    backgroundColor = '#FFF8E1';
    borderColor = '#ffbb33';
  } else if (type === 'info') {
    iconName = 'information-circle';
    iconColor = '#33b5e5';
    backgroundColor = '#E1F5FE';
    borderColor = '#33b5e5';
  }

  return (
    <Animated.View
      style={[
        styles.toastContainer,
        {
          transform: [{ translateY }],
          opacity,
          backgroundColor,
          borderLeftColor: borderColor,
        },
      ]}
    >
      <View style={styles.iconContainer}>
        <Ionicons name={iconName} size={28} color={iconColor} />
      </View>
      <View style={styles.textContainer}>
        {title ? <Text style={[styles.title, { color: iconColor }]}>{title}</Text> : null}
        {message ? (
          <Text style={styles.message} numberOfLines={2}>
            {message}
          </Text>
        ) : null}
      </View>
      <TouchableOpacity style={styles.closeBtn} onPress={hideAnimation}>
        <Ionicons name="close" size={20} color="#999" />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 0,
    left: width * 0.05,
    width: width * 0.9,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 6,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8, // For Android shadow
    zIndex: 999999, // Ensure it's above everything
  },
  iconContainer: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  closeBtn: {
    padding: 4,
  },
});

export default PremiumToast;
