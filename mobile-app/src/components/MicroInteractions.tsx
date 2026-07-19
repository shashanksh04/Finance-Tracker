import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import Confetti from './Confetti';
import { useHaptics } from '../hooks/useHaptics';

interface MicroInteractionsProps {
  confetti?: boolean;
  haptic?: 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning' | 'selection';
  loading?: boolean;
  loadingMessage?: string;
  children?: React.ReactNode;
}

export default function MicroInteractions({ confetti: showConfetti, haptic: hapticType, loading, children }: MicroInteractionsProps) {
  const { colors } = useTheme();
  const haptics = useHaptics();

  React.useEffect(() => {
    if (hapticType && haptics[hapticType]) {
      haptics[hapticType]();
    }
  }, [hapticType]);

  return (
    <View style={styles.wrapper}>
      {showConfetti && <Confetti active={true} />}
      {loading ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  loadingOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
