import React, { useRef, useEffect } from "react";
import { View, Text, StyleSheet, Animated, PanResponder } from "react-native";
import Ionicons from 'react-native-vector-icons/Ionicons';

const SwipeToggle = ({ isOnline, onToggle }) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const thumbScale = useRef(new Animated.Value(1)).current;
  
  const THUMB_SIZE = 50;
  const TRACK_PADDING = 10;
  const MAX_SWIPE = 220; // Maximum swipe distance

  // Update thumb position when isOnline changes (for external toggles)
  useEffect(() => {
    if (isOnline) {
      Animated.spring(translateX, {
        toValue: MAX_SWIPE,
        useNativeDriver: true,
        friction: 7,
        tension: 40,
      }).start();
    } else {
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        friction: 7,
        tension: 40,
      }).start();
    }
  }, [isOnline]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => {
        return Math.abs(gesture.dx) > 5;
      },

      onPanResponderGrant: () => {
        // Slightly scale down thumb when pressed
        Animated.spring(thumbScale, {
          toValue: 0.9,
          useNativeDriver: true,
          friction: 5,
        }).start();
      },

      onPanResponderMove: (_, gesture) => {
        // Constrain swipe within bounds
        const newValue = Math.max(0, Math.min(gesture.dx, MAX_SWIPE));
        translateX.setValue(newValue);
      },

      onPanResponderRelease: (_, gesture) => {
        // Scale thumb back to normal
        Animated.spring(thumbScale, {
          toValue: 1,
          useNativeDriver: true,
          friction: 5,
        }).start();

        const swipeThreshold = MAX_SWIPE * 0.4; // 40% threshold
        const currentValue = translateX._value;
        
        // Determine if we should toggle based on swipe distance and direction
        const shouldToggleOnline = currentValue > swipeThreshold;
        
        if ((shouldToggleOnline && !isOnline) || (!shouldToggleOnline && isOnline)) {
          // Swipe to change state
          Animated.spring(translateX, {
            toValue: shouldToggleOnline ? MAX_SWIPE : 0,
            useNativeDriver: true,
            friction: 7,
            tension: 40,
          }).start(() => {
            onToggle();
          });
        } else {
          // Return to original position
          Animated.spring(translateX, {
            toValue: isOnline ? MAX_SWIPE : 0,
            useNativeDriver: true,
            friction: 7,
            tension: 40,
          }).start();
        }
      },
    })
  ).current;

  // Calculate background color with smooth transition
  const backgroundColor = translateX.interpolate({
    inputRange: [0, MAX_SWIPE],
    outputRange: ["#ff3b30", "#28a745"],
  });

  // Calculate text opacity for smooth transition
  const onlineTextOpacity = translateX.interpolate({
    inputRange: [0, MAX_SWIPE * 0.3, MAX_SWIPE * 0.7, MAX_SWIPE],
    outputRange: [0, 0, 1, 1],
  });

  const offlineTextOpacity = translateX.interpolate({
    inputRange: [0, MAX_SWIPE * 0.3, MAX_SWIPE * 0.7, MAX_SWIPE],
    outputRange: [1, 1, 0, 0],
  });

  return (
    <Animated.View
      style={[
        styles.track,
        { backgroundColor },
      ]}
    >
      {/* Online Text */}
      <Animated.Text style={[styles.text, styles.textOnline, { opacity: onlineTextOpacity }]}>
        GO OFFLINE
      </Animated.Text>
      
      {/* Offline Text */}
      <Animated.Text style={[styles.text, styles.textOffline, { opacity: offlineTextOpacity }]}>
        GO ONLINE
      </Animated.Text>

      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.thumb,
          {
            transform: [
              { translateX },
              { scale: thumbScale }
            ],
          },
        ]}
      >
        <Ionicons 
          name={'finger-print-outline'} 
          size={24} 
          color="#333"
        />
      </Animated.View>
    </Animated.View>
  );
};

export default SwipeToggle;

const styles = StyleSheet.create({
  track: {
    width: "100%",
    height: 60,
    borderRadius: 35,
    justifyContent: "center",
    paddingHorizontal: 10,
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  text: {
    position: "absolute",
    alignSelf: "center",
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  textOnline: {
    right: '50%',
  },

  textOffline: {
    left: '50%',
  },

  thumb: {
    position: "absolute",
    left: 30,
    width: 50,
    height: 50,
    borderRadius: 30,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
});