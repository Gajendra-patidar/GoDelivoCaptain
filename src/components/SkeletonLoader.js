import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

const SkeletonBox = ({ width = '100%', height = 16, borderRadius = 8, style }) => {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const bgColor = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: ['#E5E7EB', '#F3F4F6'],
  });

  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: bgColor },
        style,
      ]}
    />
  );
};

/** Card-shaped skeleton with 3 lines — use as placeholder while data loads */
const SkeletonCard = () => (
  <View style={styles.card}>
    <SkeletonBox width="60%" height={14} style={styles.mb10} />
    <SkeletonBox width="90%" height={12} style={styles.mb10} />
    <SkeletonBox width="40%" height={12} />
  </View>
);

/** A list of skeleton cards */
const SkeletonList = ({ count = 4 }) => (
  <View style={styles.list}>
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonCard key={i} />
    ))}
  </View>
);

export { SkeletonBox, SkeletonCard, SkeletonList };

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  mb10: { marginBottom: 10 },
  list: { padding: 16 },
});
