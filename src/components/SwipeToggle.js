import React, { useRef, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  Animated,
  Dimensions,
  Platform,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Ionicons from "react-native-vector-icons/Ionicons";
import { moderateScale } from "react-native-size-matters";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const TOGGLE_WIDTH = SCREEN_WIDTH - 40;
const THUMB_SIZE = 52;
const TRACK_HEIGHT = 64;
const MAX_TRANSLATION = TOGGLE_WIDTH - THUMB_SIZE - 12;
const THRESHOLD = MAX_TRANSLATION / 2;
const TAP_THRESHOLD = 5;

const SwipeToggle = ({ onToggle, isOnline, disabled = false }) => {
  const translateX = useRef(new Animated.Value(isOnline ? MAX_TRANSLATION : 0)).current;
  const isAnimating = useRef(false);
  const lastToggleState = useRef(isOnline);
  const startX = useRef(0);
  const animationRef = useRef(null);

  // Memoized track color interpolation
  const trackColor = useMemo(() => {
    return translateX.interpolate({
      inputRange: [0, MAX_TRANSLATION],
      outputRange: ["#FF416C", "#00B09B"],
    });
  }, [translateX]);

  // Sync prop changes with spring animation
  useEffect(() => {
    if (animationRef.current) {
      animationRef.current.stop();
    }

    // Update the last known state
    lastToggleState.current = isOnline;

    animationRef.current = Animated.spring(translateX, {
      toValue: isOnline ? MAX_TRANSLATION : 0,
      useNativeDriver: true,
      friction: 7,
      tension: 50,
      restSpeedThreshold: 0.1,
      restDisplacementThreshold: 0.1,
    });

    animationRef.current.start(() => {
      isAnimating.current = false;
    });

    isAnimating.current = true;

    return () => {
      if (animationRef.current) {
        animationRef.current.stop();
      }
    };
  }, [isOnline, translateX]);

  const animateToggle = useCallback((toValue, newState) => {
    if (isAnimating.current || disabled) return;

    // Prevent duplicate calls to the same state
    if (newState === lastToggleState.current) {
            return;
    }

    isAnimating.current = true;
    lastToggleState.current = newState;

    Animated.spring(translateX, {
      toValue,
      useNativeDriver: true,
      friction: 7,
      tension: 50,
      restSpeedThreshold: 0.1,
      restDisplacementThreshold: 0.1,
    }).start(({ finished }) => {
      if (finished) {
        isAnimating.current = false;
        // Always call onToggle when animation completes successfully
        onToggle?.(newState);
      } else {
        // Reset state if animation was interrupted
        lastToggleState.current = isOnline;
        isAnimating.current = false;
      }
    });
  }, [translateX, isOnline, onToggle, disabled]);

  const handlePanResponderMove = useCallback((_, gestureState) => {
    if (isAnimating.current) return;

    let newX = isOnline ? MAX_TRANSLATION + gestureState.dx : gestureState.dx;
    newX = Math.max(0, Math.min(newX, MAX_TRANSLATION));
    translateX.setValue(newX);
  }, [isOnline, translateX]);

  const handlePanResponderRelease = useCallback((_, gestureState) => {
    if (isAnimating.current) return;

    const currentX = isOnline ? MAX_TRANSLATION + gestureState.dx : gestureState.dx;
    const isTap = Math.abs(gestureState.dx) < TAP_THRESHOLD &&
      Math.abs(gestureState.dy) < TAP_THRESHOLD;

    if (isTap) {
      const newState = !isOnline;
      animateToggle(newState ? MAX_TRANSLATION : 0, newState);
      return;
    }

    if (!isOnline && currentX > THRESHOLD) {
      animateToggle(MAX_TRANSLATION, true);
    } else if (isOnline && currentX < THRESHOLD) {
      animateToggle(0, false);
    } else {
      animateToggle(isOnline ? MAX_TRANSLATION : 0, isOnline);
    }
  }, [isOnline, animateToggle]);

  const panResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => !isAnimating.current && !disabled,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return !disabled && Math.abs(gestureState.dx) > 5;
      },
      onPanResponderGrant: (_, gestureState) => {
        startX.current = gestureState.x0;
      },
      onPanResponderMove: handlePanResponderMove,
      onPanResponderRelease: handlePanResponderRelease,
      onPanResponderTerminate: () => {
        // Reset to original position if interrupted
        if (!disabled) {
          animateToggle(isOnline ? MAX_TRANSLATION : 0, isOnline);
        }
      },
    });
  }, [handlePanResponderMove, handlePanResponderRelease, isOnline, animateToggle, disabled]);

  // Memoize text to prevent unnecessary re-renders
  const toggleText = useMemo(() => {
    return isOnline ? "SWIPE TO GO OFFLINE" : "SWIPE TO GO ONLINE";
  }, [isOnline]);

  const iconName = useMemo(() => {
    return isOnline ? "power" : "flash";
  }, [isOnline]);

  const iconColor = useMemo(() => {
    return isOnline ? "#00B09B" : "#FF416C";
  }, [isOnline]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.track, { backgroundColor: trackColor }]}>
        <View style={styles.textContainer} pointerEvents="none">
          <Text style={styles.text}>{toggleText}</Text>
        </View>

        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.thumb,
            {
              transform: [{ translateX }],
              // Optimize for native driver
              shadowOpacity: 0.3,
            },
          ]}
        >
          <Ionicons name={iconName} size={24} color={iconColor} />
        </Animated.View>
      </Animated.View>
    </View>
  );
};

export default SwipeToggle;

const styles = StyleSheet.create({
  container: {
    width: TOGGLE_WIDTH,
    alignSelf: 'center',
  },
  track: {
    width: "100%",
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    justifyContent: "center",
    paddingHorizontal: 6,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  textContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: "#fff",
    fontWeight: "900",
    fontSize: moderateScale(13),
    letterSpacing: 1,
    textTransform: "uppercase",
    backgroundColor: "transparent",
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
      },
      android: {
        elevation: 8,
      },
    }),
  },
});