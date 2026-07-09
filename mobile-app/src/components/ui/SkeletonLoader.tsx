import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { colors, radius } from '../../theme/tokens';

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

export default function SkeletonLoader({ width = '100%', height = 20, borderRadius = radius.sm, style }: SkeletonLoaderProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[{ width: width as any, height, borderRadius, backgroundColor: colors.border, opacity }, style]}
    />
  );
}

export function DashboardSkeleton() {
  return (
    <View style={styles.section}>
      <SkeletonLoader height={80} borderRadius={16} style={{ marginBottom: 12 }} />
      <SkeletonLoader height={100} borderRadius={16} style={{ marginBottom: 12 }} />
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
        <SkeletonLoader height={80} borderRadius={12} style={{ flex: 1 }} />
        <SkeletonLoader height={80} borderRadius={12} style={{ flex: 1 }} />
      </View>
      <SkeletonLoader height={24} width="60%" borderRadius={4} style={{ marginBottom: 12 }} />
      {[1, 2, 3].map((i) => (
        <SkeletonLoader key={i} height={60} borderRadius={10} style={{ marginBottom: 6 }} />
      ))}
    </View>
  );
}

export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <View style={styles.section}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonLoader key={i} height={60} borderRadius={10} style={{ marginBottom: 6 }} />
      ))}
    </View>
  );
}

export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.section}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonLoader key={i} height={100} borderRadius={12} style={{ marginBottom: 8 }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { padding: 12 },
});
