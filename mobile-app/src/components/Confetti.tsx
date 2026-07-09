import React, { useEffect, useRef } from 'react';
import { View, Animated, Dimensions, StyleSheet } from 'react-native';

const { width, height } = Dimensions.get('window');
const COLORS = ['#0284c7', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1'];
const PIECES = 30;

interface ConfettiPiece {
  x: Animated.Value;
  y: Animated.Value;
  rotation: Animated.Value;
  color: string;
  size: number;
}

export default function Confetti({ active }: { active: boolean }) {
  const pieces = useRef<ConfettiPiece[]>([]);

  useEffect(() => {
    if (!active) return;
    pieces.current = Array.from({ length: PIECES }, () => ({
      x: new Animated.Value(Math.random() * width),
      y: new Animated.Value(-50),
      rotation: new Animated.Value(0),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: 6 + Math.random() * 8,
    }));

    const animations = pieces.current.map((p) =>
      Animated.parallel([
        Animated.timing(p.y, { toValue: height + 50, duration: 2000 + Math.random() * 1000, useNativeDriver: true }),
        Animated.timing(p.x, { toValue: p.x._value + (Math.random() - 0.5) * 200, duration: 2000 + Math.random() * 1000, useNativeDriver: true }),
        Animated.timing(p.rotation, { toValue: Math.random() * 10, duration: 2000 + Math.random() * 1000, useNativeDriver: true }),
      ])
    );

    Animated.parallel(animations).start();
  }, [active]);

  if (!active || pieces.current.length === 0) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {pieces.current.map((p, i) => (
        <Animated.View
          key={i}
          style={[
            styles.piece,
            {
              width: p.size,
              height: p.size * 1.5,
              backgroundColor: p.color,
              transform: [
                { translateX: p.x },
                { translateY: p.y },
                { rotate: p.rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFillObject, zIndex: 9999 },
  piece: { position: 'absolute', borderRadius: 2 },
});
