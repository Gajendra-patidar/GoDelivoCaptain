import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  Animated,
  Dimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { moderateScale } from 'react-native-size-matters';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TOGGLE_WIDTH = SCREEN_WIDTH - 40;
const THUMB_SIZE = 52;
const TRACK_HEIGHT = 64;
const MAX_TRANSLATION = TOGGLE_WIDTH - THUMB_SIZE - 12;
const THRESHOLD = MAX_TRANSLATION / 2;

const SwipeToggle = ({
  onToggle,
  isOnline,
  disabled = false,
  loading = false,
  pendingState = null,
}) => {
  const translateX = useRef(
    new Animated.Value(isOnline ? MAX_TRANSLATION : 0),
  ).current;
  const isAnimating = useRef(false);
  const lastToggleState = useRef(isOnline);
  const animationRef = useRef(null);

  const trackColor = useMemo(() => {
    return translateX.interpolate({
      inputRange: [0, MAX_TRANSLATION],
      outputRange: ['#D64545', '#1BB15B'],
    });
  }, [translateX]);

  const springTo = useCallback(
    (toValue, onComplete) => {
      if (animationRef.current) {
        animationRef.current.stop();
      }

      animationRef.current = Animated.spring(translateX, {
        toValue,
        useNativeDriver: true,
        friction: 7,
        tension: 50,
        restSpeedThreshold: 0.1,
        restDisplacementThreshold: 0.1,
      });

      animationRef.current.start(({ finished }) => {
        isAnimating.current = false;
        onComplete?.(finished);
      });
    },
    [translateX],
  );

  const snapToState = useCallback(
    state => {
      isAnimating.current = true;
      lastToggleState.current = state;
      springTo(state ? MAX_TRANSLATION : 0);
    },
    [springTo],
  );

  useEffect(() => {
    if (animationRef.current) {
      animationRef.current.stop();
    }

    lastToggleState.current = isOnline;
    isAnimating.current = true;
    springTo(isOnline ? MAX_TRANSLATION : 0);

    return () => {
      if (animationRef.current) {
        animationRef.current.stop();
      }
    };
  }, [isOnline, springTo]);

  const animateToggle = useCallback(
    (toValue, newState) => {
      if (isAnimating.current || disabled || loading) return;

      if (newState === lastToggleState.current) {
        snapToState(isOnline);
        return;
      }

      isAnimating.current = true;
      lastToggleState.current = newState;

      springTo(toValue, async finished => {
        if (!finished) {
          lastToggleState.current = isOnline;
          snapToState(isOnline);
          return;
        }

        try {
          const result = await onToggle?.(newState);
          if (result === false) {
            lastToggleState.current = isOnline;
            snapToState(isOnline);
          }
        } catch {
          lastToggleState.current = isOnline;
          snapToState(isOnline);
        }
      });
    },
    [disabled, isOnline, loading, onToggle, snapToState, springTo],
  );

  const handlePanResponderMove = useCallback(
    (_, gestureState) => {
      if (isAnimating.current || disabled || loading) return;

      let newX = isOnline
        ? MAX_TRANSLATION + gestureState.dx
        : gestureState.dx;
      newX = Math.max(0, Math.min(newX, MAX_TRANSLATION));
      translateX.setValue(newX);
    },
    [disabled, isOnline, loading, translateX],
  );

  const handlePanResponderRelease = useCallback(
    (_, gestureState) => {
      if (isAnimating.current || disabled || loading) return;

      const currentX = isOnline
        ? MAX_TRANSLATION + gestureState.dx
        : gestureState.dx;

      if (!isOnline && currentX > THRESHOLD) {
        animateToggle(MAX_TRANSLATION, true);
      } else if (isOnline && currentX < THRESHOLD) {
        animateToggle(0, false);
      } else {
        snapToState(isOnline);
      }
    },
    [animateToggle, disabled, isOnline, loading, snapToState],
  );

  const panResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () =>
        !isAnimating.current && !disabled && !loading,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return !disabled && !loading && Math.abs(gestureState.dx) > 5;
      },
      onPanResponderMove: handlePanResponderMove,
      onPanResponderRelease: handlePanResponderRelease,
      onPanResponderTerminate: () => {
        if (!disabled && !loading) {
          snapToState(isOnline);
        }
      },
    });
  }, [
    disabled,
    handlePanResponderMove,
    handlePanResponderRelease,
    isOnline,
    loading,
    snapToState,
  ]);

  const toggleText = useMemo(() => {
    if (loading) {
      return pendingState ? 'GOING ONLINE...' : 'GOING OFFLINE...';
    }

    return isOnline ? 'SLIDE TO GO OFFLINE' : 'SLIDE TO GO ONLINE';
  }, [isOnline, loading, pendingState]);

  const iconName = useMemo(() => {
    return isOnline ? 'power' : 'flash';
  }, [isOnline]);

  const iconColor = useMemo(() => {
    return isOnline ? '#1BB15B' : '#D64545';
  }, [isOnline]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.track,
          { backgroundColor: trackColor },
          (disabled || loading) && styles.disabledTrack,
        ]}
      >
        <View style={styles.textContainer} pointerEvents="none">
          <Text style={styles.text}>{toggleText}</Text>
        </View>

        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.thumb,
            styles.thumbShadow,
            {
              transform: [{ translateX }],
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator color={iconColor} size="small" />
          ) : (
            <Ionicons name={iconName} size={24} color={iconColor} />
          )}
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
    width: '100%',
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    justifyContent: 'center',
    paddingHorizontal: 6,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  disabledTrack: {
    opacity: 0.76,
  },
  textContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontWeight: '900',
    fontSize: moderateScale(13),
    letterSpacing: 0,
    textTransform: 'uppercase',
    backgroundColor: 'transparent',
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: '#222222',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  thumbShadow: {
    shadowOpacity: 0.3,
  },
});
