/**
 * NavigationButton.js
 *
 * A premium floating circular button that launches Google Maps in
 * Turn-by-Turn Navigation mode. Designed to match the Porter / Uber Driver
 * app experience.
 *
 * Features:
 *  - Circular, elevated design with Google Navigation blue/green accent
 *  - Ripple / pulse animation on press
 *  - Double-tap guard via useRef (prevents multiple simultaneous launches)
 *  - AppState listener: resets launching state when app returns to foreground
 *  - Disabled state with dimmed opacity during launch & COMPLETED stage
 *  - Auto-switches destination based on tripStage (pickup vs drop) — handled by parent
 *
 * Props:
 *  @param {{ latitude: number, longitude: number }} origin         Driver's current coords
 *  @param {{ latitude: number, longitude: number }} destination     Pickup or Drop coords
 *  @param {string}  [destinationLabel]  Human-readable label for toast/error feedback
 *  @param {boolean} [disabled]          Externally disable the button (e.g. COMPLETED stage)
 *  @param {function} [onSuccess]        Called with { method } when navigation launched
 *  @param {function} [onError]          Called with { error } when launch fails
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { openGoogleNavigation, isValidCoordinate } from '../utils/googleNavigation';
import toast from '../utils/toast';

// ─── Constants ────────────────────────────────────────────────────────────────
const BUTTON_SIZE = 54;
const RIPPLE_SIZE = BUTTON_SIZE + 24;

// ─── Component ────────────────────────────────────────────────────────────────
const NavigationButton = ({
  origin,
  destination,
  destinationLabel = 'Destination',
  disabled = false,
  onSuccess,
  onError,
}) => {
  // Prevents multiple simultaneous launches (ref so it doesn't trigger re-render)
  const isLaunchingRef = useRef(false);

  // Visual loading state (affects opacity)
  const [isLaunching, setIsLaunching] = useState(false);

  // Animated value for the pulsing ripple ring
  const rippleAnim = useRef(new Animated.Value(0)).current;
  const rippleOpacity = useRef(new Animated.Value(0.6)).current;

  // ── Ripple animation loop ───────────────────────────────────────────────────
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.parallel([
        Animated.timing(rippleAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(rippleOpacity, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [rippleAnim, rippleOpacity]);

  // ── AppState: reset isLaunching when driver returns to the app ─────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        // Driver returned from Google Maps — release the launch guard
        isLaunchingRef.current = false;
        setIsLaunching(false);
      }
    });
    return () => sub.remove();
  }, []);

  // ── Handle button press ────────────────────────────────────────────────────
  const handlePress = useCallback(async () => {
    // Guard: prevent repeated taps while already launching
    if (isLaunchingRef.current || disabled) return;

    // Validate coords before even trying
    if (!isValidCoordinate(origin)) {
      const msg = 'Your location is not available yet. Please wait.';
      toast.warn(msg);
      onError?.({ error: 'INVALID_ORIGIN', message: msg });
      return;
    }
    if (!isValidCoordinate(destination)) {
      const msg = `${destinationLabel} coordinates are unavailable.`;
      toast.warn(msg);
      onError?.({ error: 'INVALID_DESTINATION', message: msg });
      return;
    }

    // Lock launch guard
    isLaunchingRef.current = true;
    setIsLaunching(true);

    try {
      const result = await openGoogleNavigation(origin, destination, {
        label: destinationLabel,
      });

      if (result.success) {
        if (result.method === 'browser') {
          toast.info('Google Maps not found. Opened navigation in browser.');
        }
        onSuccess?.(result);
        // NOTE: do NOT reset isLaunchingRef here.
        // It is reset by the AppState listener when the driver returns to app.
      } else {
        // Release guard on failure
        isLaunchingRef.current = false;
        setIsLaunching(false);

        let userMessage = 'Unable to open navigation. Please try again.';
        if (result.error === 'MISSING_DESTINATION') {
          userMessage = 'Destination is not set yet.';
        } else if (result.error === 'INVALID_DESTINATION') {
          userMessage = `${destinationLabel} location is invalid.`;
        } else if (result.error === 'INVALID_ORIGIN') {
          userMessage = 'Your location is not available. Enable GPS and try again.';
        }

        toast.error(userMessage);
        onError?.(result);
      }
    } catch (err) {
      // Unexpected error — always release the guard
      isLaunchingRef.current = false;
      setIsLaunching(false);
      toast.error('Navigation failed. Please try again.');
      onError?.({ error: 'LAUNCH_FAILED', message: err?.message });
    }
  }, [origin, destination, destinationLabel, disabled, onSuccess, onError]);

  // ── Interpolate ripple scale & opacity ─────────────────────────────────────
  const rippleScale = rippleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1.5],
  });

  const isButtonDisabled = disabled || isLaunching;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      {/* Ripple ring behind button */}
      <Animated.View
        style={[
          styles.ripple,
          {
            opacity: isButtonDisabled ? 0 : rippleOpacity,
            transform: [{ scale: rippleScale }],
          },
        ]}
        pointerEvents="none"
      />

      <TouchableOpacity
        style={[
          styles.button,
          isButtonDisabled && styles.buttonDisabled,
        ]}
        onPress={handlePress}
        activeOpacity={0.85}
        disabled={isButtonDisabled}
        accessibilityLabel={`Navigate to ${destinationLabel}`}
        accessibilityRole="button"
      >
        {/* Navigation arrow icon */}
        <Ionicons
          name={isLaunching ? 'hourglass-outline' : 'navigate'}
          size={24}
          color="#FFFFFF"
          style={isLaunching ? styles.iconSpin : undefined}
        />
      </TouchableOpacity>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    // Bottom-right corner, just above the navCardOverlay bottom sheet.
    // The navCardOverlay's 'bottom: 29.5%' for the re-centre pill is reference;
    // we place this button at 28% from bottom so it sits above the card edge.
    right: 16,
    bottom: '29.5%',
    width: RIPPLE_SIZE,
    height: RIPPLE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  ripple: {
    position: 'absolute',
    width: RIPPLE_SIZE,
    height: RIPPLE_SIZE,
    borderRadius: RIPPLE_SIZE / 2,
    backgroundColor: '#1A73E8',
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: '#1A73E8',    // Google Maps Blue — instantly recognisable
    alignItems: 'center',
    justifyContent: 'center',
    // Premium shadow
    ...Platform.select({
      android: { elevation: 10 },
      ios: {
        shadowColor: '#1A73E8',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
      },
    }),
    // White border ring for contrast against the map
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  buttonDisabled: {
    backgroundColor: '#9BB3D6',
    borderColor: '#E8EEF7',
    ...Platform.select({
      android: { elevation: 3 },
      ios: { shadowOpacity: 0.15 },
    }),
  },
  iconSpin: {
    opacity: 0.7,
  },
});

export default NavigationButton;
