import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Animated,
  Dimensions,
  DeviceEventEmitter,
  TouchableOpacity,
  Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

const { width } = Dimensions.get('window');

const TOAST_EVENTS = {
  SHOW: 'SHOW_PREMIUM_TOAST',
  HIDE: 'HIDE_PREMIUM_TOAST',
};

const TOAST_DURATION = {
  success: 3000,
  info: 3000,
  warn: 4000,
  warning: 4000,
  error: 5000,
};

const TOAST_CONFIG = {
  success: {
    iconName: 'checkmark-circle',
    iconColor: '#22c55e',
    borderColor: '#22c55e',
    bg: 'rgba(17,24,15,0.96)',
  },
  error: {
    iconName: 'close-circle',
    iconColor: '#ef4444',
    borderColor: '#ef4444',
    bg: 'rgba(24,10,10,0.96)',
  },
  warn: {
    iconName: 'warning',
    iconColor: '#f59e0b',
    borderColor: '#f59e0b',
    bg: 'rgba(24,20,5,0.96)',
  },
  warning: {
    iconName: 'warning',
    iconColor: '#f59e0b',
    borderColor: '#f59e0b',
    bg: 'rgba(24,20,5,0.96)',
  },
  info: {
    iconName: 'information-circle',
    iconColor: '#38bdf8',
    borderColor: '#38bdf8',
    bg: 'rgba(5,18,24,0.96)',
  },
};

// Expose a global method to call the toast from anywhere
export const showToast = (type = 'success', title = '', message = '') => {
  DeviceEventEmitter.emit(TOAST_EVENTS.SHOW, { type, title, message });
};

const PremiumToast = () => {
  const [toastConfig, setToastConfig] = useState(null);
  const [queue, setQueue] = useState([]);
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const timerRef = useRef(null);
  const isShowing = useRef(false);

  const hideAnimation = useCallback((onDone) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 50, // Move down when hiding
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.92,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => {
      isShowing.current = false;
      setToastConfig(null);
      onDone?.();
    });
  }, [translateY, opacity, scaleAnim]);

  const showAnimation = useCallback((config) => {
    isShowing.current = true;
    setToastConfig(config);

    // Reset before animating
    translateY.setValue(50); // Start below
    opacity.setValue(0);
    scaleAnim.setValue(0.92);

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        friction: 8,
        tension: 55,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 8,
        tension: 55,
      }),
    ]).start();

    const duration = TOAST_DURATION[config.type] || 3500;
    timerRef.current = setTimeout(() => {
      hideAnimation(() => {
        // Process next in queue
        setQueue(prev => prev.slice(1));
      });
    }, duration);
  }, [translateY, opacity, scaleAnim, hideAnimation]);

  // Process queue
  useEffect(() => {
    if (queue.length > 0 && !isShowing.current) {
      showAnimation(queue[0]);
    }
  }, [queue, showAnimation]);

  useEffect(() => {
    const showListener = DeviceEventEmitter.addListener(TOAST_EVENTS.SHOW, (config) => {
      setQueue(prev => {
        // If already showing the same message, ignore
        if (prev.length > 2) return prev; // cap queue at 3
        return [...prev, config];
      });
    });

    const hideListener = DeviceEventEmitter.addListener(TOAST_EVENTS.HIDE, () => {
      hideAnimation(() => setQueue([]));
    });

    return () => {
      showListener.remove();
      hideListener.remove();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [hideAnimation]);

  if (!toastConfig) return null;

  const cfg = TOAST_CONFIG[toastConfig.type] || TOAST_CONFIG.info;
  const { type, title, message } = toastConfig;

  return (
    <Animated.View
      style={[
        styles.toastContainer,
        {
          transform: [{ translateY }, { scale: scaleAnim }],
          opacity,
          backgroundColor: cfg.bg,
        },
      ]}
    >
      <View style={styles.iconContainer}>
        <Ionicons name={cfg.iconName} size={20} color={cfg.iconColor} />
      </View>
      <Text style={styles.message} numberOfLines={2}>
        {message || title}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 80,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 999999,
    maxWidth: width * 0.85,
  },
  iconContainer: {
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.95)',
    flexShrink: 1,
  },
});

export default PremiumToast;
