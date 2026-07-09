import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing, radius, fontSize, fontWeight } from '../../theme/tokens';

interface EmptyStateProps {
  icon?: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({ icon = '📭', title, subtitle, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.container} accessibilityLabel={title}>
      <View style={styles.iconWrap}>
        <Text style={styles.icon} accessibilityLabel={icon}>{icon}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {actionLabel && onAction ? (
        <TouchableOpacity style={styles.action} onPress={onAction} accessibilityLabel={actionLabel} accessibilityRole="button">
          <Text style={styles.actionText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xxxl, minHeight: 200 },
  iconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center',
    marginBottom: spacing.lg,
  },
  icon: { fontSize: 36 },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: fontSize.sm, color: colors.textTertiary, textAlign: 'center', marginTop: spacing.sm, lineHeight: 20 },
  action: {
    marginTop: spacing.xl, backgroundColor: colors.primary,
    paddingHorizontal: spacing.xxl, paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  actionText: { color: colors.textInverse, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
});
