import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { colors, spacing, fontSize } from '../../theme/tokens';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'small' | 'large';
  color?: string;
}

export default function LoadingSpinner({ message, size = 'large', color = colors.primary }: LoadingSpinnerProps) {
  return (
    <View style={styles.container} accessibilityLabel={message || 'Loading'} aria-live="polite">
      <ActivityIndicator size={size} color={color} />
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xxl },
  message: { marginTop: spacing.md, fontSize: fontSize.sm + 1, color: colors.slate500 },
});
