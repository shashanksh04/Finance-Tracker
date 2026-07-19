import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { spacing, radius, fontSize, fontWeight, shadow } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import SkeletonLoader from './ui/SkeletonLoader';

interface WidgetContainerProps {
  title: string;
  icon?: string;
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  onToggle?: () => void;
  children: React.ReactNode;
}

export default function WidgetContainer({ title, icon, loading, empty, emptyMessage, onToggle, children }: WidgetContainerProps) {
  const { colors } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    wrapper: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      ...shadow.sm,
    },
    header: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: spacing.md,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    headerIcon: { fontSize: 18 },
    headerTitle: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.text },
    toggleBtn: { fontSize: 16, color: colors.textTertiary, padding: spacing.xs },
    emptyText: { fontSize: fontSize.sm, color: colors.textTertiary, textAlign: 'center', paddingVertical: spacing.lg },
  }), [colors]);

  if (loading) return <View style={styles.wrapper}><SkeletonLoader height={80} borderRadius={radius.md} /></View>;

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {icon ? <Text style={styles.headerIcon}>{icon}</Text> : null}
          <Text style={styles.headerTitle}>{title}</Text>
        </View>
        {onToggle && (
          <TouchableOpacity onPress={onToggle} accessibilityLabel={`Toggle ${title} settings`} accessibilityRole="button">
            <Text style={styles.toggleBtn}>⋯</Text>
          </TouchableOpacity>
        )}
      </View>
      {empty ? (
        <Text style={styles.emptyText}>{emptyMessage || 'No data available'}</Text>
      ) : children}
    </View>
  );
}
