import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { spacing, radius, fontSize, fontWeight, shadow } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { PersonalityDef } from '../data/personalities';

interface PersonalityCardProps {
  personality: PersonalityDef;
}

export default function PersonalityCard({ personality }: PersonalityCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    ...shadow.md,
  },
  emoji: { fontSize: 48, marginBottom: spacing.sm },
  label: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text, marginBottom: spacing.xs },
  description: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
}), [colors, spacing, radius, fontSize, fontWeight, shadow]);
  return (
    <View style={styles.card}>
      <Text style={styles.emoji}>{personality.emoji}</Text>
      <Text style={styles.label}>{personality.label}</Text>
      <Text style={styles.description}>{personality.description}</Text>
    </View>
  );
}


