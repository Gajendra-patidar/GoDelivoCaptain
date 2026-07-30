import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { theme } from '../theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const BUBBLE_SIZE = 30;
const MENU_ITEM_SIZE = 50;
const EDGE_PADDING = 10;

/**
 * FloatingBubble
 *
 * A draggable floating action bubble that sticks to the left / right edge
 * (like Porter Partner app).  Tap once to expand a radial quick-nav menu;
 * tap a menu item to navigate.
 *
 * Props:
 *   navigation  – React Navigation navigation object OR navigationRef
 *   isVisible   – boolean (default true)
 */
const FloatingBubble = ({ navigation, isVisible = true }) => {
  // ─── Position state ──────────────────────────────────────────────────────
  const pan = useRef(new Animated.ValueXY({ x: SCREEN_W - BUBBLE_SIZE - EDGE_PADDING, y: SCREEN_H * 0.55 })).current;
  const lastPos = useRef({ x: SCREEN_W - BUBBLE_SIZE - EDGE_PADDING, y: SCREEN_H * 0.55 });

  // ─── Animation values ────────────────────────────────────────────────────
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;
  const menuAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const [menuOpen, setMenuOpen] = useState(false);
  const isDragging = useRef(false);

  // ─── Pulse loop ───────────────────────────────────────────────────────────
  useEffect(() => {
    const pulsate = () => {
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 800, useNativeDriver: true }),
      ]).start(({ finished }) => finished && pulsate());
    };

    const ripple = () => {
      ringAnim.setValue(0);
      Animated.timing(ringAnim, {
        toValue: 1,
        duration: 1400,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setTimeout(ripple, 600);
      });
    };

    pulsate();
    ripple();
  }, [pulseAnim, ringAnim]);

  // ─── Snap to edge on release ──────────────────────────────────────────────
  const snapToEdge = useCallback(
    (x, y) => {
      const snapX = x + BUBBLE_SIZE / 2 > SCREEN_W / 2
        ? SCREEN_W - BUBBLE_SIZE - EDGE_PADDING
        : EDGE_PADDING;

      const clampedY = Math.max(
        EDGE_PADDING,
        Math.min(y, SCREEN_H - BUBBLE_SIZE - 80),
      );

      lastPos.current = { x: snapX, y: clampedY };

      Animated.parallel([
        Animated.spring(pan.x, { toValue: snapX, useNativeDriver: false, tension: 60, friction: 7 }),
        Animated.spring(pan.y, { toValue: clampedY, useNativeDriver: false, tension: 60, friction: 7 }),
      ]).start();
    },
    [pan],
  );

  // ─── PanResponder ─────────────────────────────────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 4 || Math.abs(gs.dy) > 4,

      onPanResponderGrant: () => {
        pan.setOffset({ x: lastPos.current.x, y: lastPos.current.y });
        pan.setValue({ x: 0, y: 0 });
        isDragging.current = false;
      },

      onPanResponderMove: (_, gs) => {
        if (Math.abs(gs.dx) > 4 || Math.abs(gs.dy) > 4) {
          isDragging.current = true;
        }
        Animated.event(
          [null, { dx: pan.x, dy: pan.y }],
          { useNativeDriver: false },
        )(_, gs);
      },

      onPanResponderRelease: (_, gs) => {
        pan.flattenOffset();
        const currentX = lastPos.current.x + gs.dx;
        const currentY = lastPos.current.y + gs.dy;
        snapToEdge(currentX, currentY);
      },
    }),
  ).current;

  // ─── Menu toggle ──────────────────────────────────────────────────────────
  const toggleMenu = useCallback(() => {
    if (isDragging.current) return;
    const open = !menuOpen;
    setMenuOpen(open);
    Animated.spring(menuAnim, {
      toValue: open ? 1 : 0,
      tension: 80,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [menuAnim, menuOpen]);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    Animated.timing(menuAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [menuAnim]);

  // ─── Navigate helper ──────────────────────────────────────────────────────
  const goTo = useCallback(
    screen => {
      closeMenu();
      setTimeout(() => {
        try {
          // Supports both a navigation prop and a navigationRef container ref
          if (typeof navigation?.navigate === 'function') {
            navigation.navigate(screen);
          } else if (navigation?.isReady?.() && typeof navigation?.navigate === 'function') {
            navigation.navigate(screen);
          }
        } catch {}
      }, 250);
    },
    [navigation, closeMenu],
  );

  if (!isVisible) return null;

  // ─── Ring scale / opacity ─────────────────────────────────────────────────
  const ringScale = ringAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] });
  const ringOpacity = ringAnim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.5, 0.15, 0] });

  // ─── Menu items ───────────────────────────────────────────────────────────
  const menuItems = [
    { icon: 'home-outline', label: 'Home', screen: 'MyTabs', color: '#fccf1e' },
    { icon: 'wallet-outline', label: 'Earnings', screen: 'Earnings', color: '#22c55e' },
    { icon: 'receipt-outline', label: 'History', screen: 'OrderHistory', color: '#3b82f6' },
    { icon: 'person-outline', label: 'Profile', screen: 'Profile', color: '#a855f7' },
    { icon: 'notifications-outline', label: 'Alerts', screen: 'Notifications', color: '#f97316' },
  ];

  return (
    <>
      {/* ── Backdrop to close menu ─────────────────────────────────────── */}
      {menuOpen && (
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={closeMenu}
        />
      )}

      {/* ── Bubble ────────────────────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.bubbleContainer,
          {
            transform: [
              { translateX: pan.x },
              { translateY: pan.y },
            ],
          },
        ]}
        {...panResponder.panHandlers}
      >
        {/* Ripple ring */}
        <Animated.View
          style={[
            styles.ring,
            {
              opacity: ringOpacity,
              transform: [{ scale: ringScale }],
            },
          ]}
          pointerEvents="none"
        />

        {/* ── Radial menu items ────────────────────────────────────────── */}
        {menuItems.map((item, index) => {
          // Fan out upward from bubble center
          const totalItems = menuItems.length;
          const startAngle = -130;
          const endAngle = -50;
          const angle = startAngle + ((endAngle - startAngle) / (totalItems - 1)) * index;
          const rad = (angle * Math.PI) / 180;
          const radius = 95;
          const tx = Math.cos(rad) * radius;
          const ty = Math.sin(rad) * radius;

          const itemScale = menuAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });
          const itemOpacity = menuAnim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0.7, 1] });

          return (
            <Animated.View
              key={item.screen}
              style={[
                styles.menuItemWrapper,
                {
                  opacity: itemOpacity,
                  transform: [
                    {
                      translateX: menuAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, tx],
                      }),
                    },
                    {
                      translateY: menuAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, ty],
                      }),
                    },
                    { scale: itemScale },
                  ],
                },
              ]}
              pointerEvents={menuOpen ? 'auto' : 'none'}
            >
              <TouchableOpacity
                style={[styles.menuItem, { backgroundColor: item.color }]}
                onPress={() => goTo(item.screen)}
                activeOpacity={0.85}
              >
                <Ionicons name={item.icon} size={20} color="#000" />
              </TouchableOpacity>
              <Text style={styles.menuLabel}>{item.label}</Text>
            </Animated.View>
          );
        })}

        {/* ── Main bubble button ───────────────────────────────────────── */}
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity
            style={styles.bubble}
            onPress={toggleMenu}
            activeOpacity={0.9}
          >
            <Image
              source={require('../assets/godelivo_notification_logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            {menuOpen && (
              <View style={styles.closeIcon}>
                <Ionicons name="close" size={12} color="#000" />
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </>
  );
};

export default FloatingBubble;

const styles = StyleSheet.create({
  bubbleContainer: {
    position: 'absolute',
    zIndex: 9999,
    elevation: 20,
    alignItems: 'center',
    justifyContent: 'center',
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
  },

  ring: {
    position: 'absolute',
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BUBBLE_SIZE / 2,
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },

  bubble: {
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BUBBLE_SIZE / 2,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 12,
    borderWidth: 0.5,
    borderColor: '#ffffff',
  },

  logo: {
    width: BUBBLE_SIZE * 0.95,
    height: BUBBLE_SIZE * 0.95,
    borderRadius: BUBBLE_SIZE * 0.45,
  },

  closeIcon: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  menuItemWrapper: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },

  menuItem: {
    width: MENU_ITEM_SIZE,
    height: MENU_ITEM_SIZE,
    borderRadius: MENU_ITEM_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#fff',
  },

  menuLabel: {
    marginTop: 3,
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
