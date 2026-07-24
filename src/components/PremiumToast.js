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
        toValue: -120,
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
    translateY.setValue(-120);
    opacity.setValue(0);
    scaleAnim.setValue(0.92);

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: Platform.OS === 'android' ? 12 : 50,
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
          borderLeftColor: cfg.borderColor,
        },
      ]}
    >
      <View style={[styles.iconContainer, { backgroundColor: cfg.borderColor + '22' }]}>
        <Ionicons name={cfg.iconName} size={20} color={cfg.iconColor} />
      </View>
      <View style={styles.textContainer}>
        {title ? <Text style={[styles.title, { color: cfg.iconColor }]} numberOfLines={1}>{title}</Text> : null}
        {message ? (
          <Text style={styles.message} numberOfLines={2}>
            {message}
          </Text>
        ) : null}
      </View>
      <TouchableOpacity
        style={styles.closeBtn}
        onPress={() => hideAnimation(() => setQueue([]))}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="close" size={16} color="rgba(255,255,255,0.5)" />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 50,
    left: width * 0.04,
    width: width * 0.92,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 12,
    zIndex: 999999,
  },
  iconContainer: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    flexShrink: 0,
  },
  textContainer: {
    flex: 1,
    paddingRight: 4,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginBottom: 1,
  },
  message: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 17,
  },
  closeBtn: {
    padding: 4,
    flexShrink: 0,
  },
});

export default PremiumToast;
