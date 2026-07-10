import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { spacing, radius, fontSize, fontWeight, shadow } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { BADGES, getUnlockedBadges, getProgress } from '../data/badges';
import { useOfflineList, useOfflineItem } from '../hooks/useOfflineData';
import { useHaptics } from '../hooks/useHaptics';
import { CardSkeleton } from '../components/ui/SkeletonLoader';
import Confetti from '../components/Confetti';

export default function BadgesScreen() {
  const { colors } = useTheme();
  const { success: hapticSuccess } = useHaptics();
  const { data: summary } = useOfflineItem('dashboard_summary', 'current');
  const styles = useMemo(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: spacing.sm },
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.text },
  subtitle: { fontSize: fontSize.sm, color: colors.textSecondary },
  progressBar: { height: 8, backgroundColor: colors.tagBg, borderRadius: radius.full, marginBottom: spacing.lg, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: radius.full },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.text, marginBottom: spacing.sm, marginTop: spacing.sm },
  badgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadow.sm,
  },
  lockedCard: { opacity: 0.7 },
  badgeIcon: { fontSize: 32, marginRight: spacing.md },
  badgeInfo: { flex: 1 },
  badgeName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  lockedText: { color: colors.textSecondary },
  badgeDesc: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  progressMini: { height: 4, backgroundColor: colors.tagBg, borderRadius: radius.full, marginTop: spacing.xs, overflow: 'hidden' },
  progressMiniFill: { height: '100%', backgroundColor: colors.primary, borderRadius: radius.full },
  emptyCard: { alignItems: 'center', padding: spacing.xl, backgroundColor: colors.card, borderRadius: radius.lg, marginBottom: spacing.sm },
  emptyIcon: { fontSize: 48, marginBottom: spacing.sm },
  emptyText: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.text },
  emptyHint: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs },
}), [colors, spacing, radius, fontSize, fontWeight]);

  if (loading) return <CardSkeleton />;

  const stats: Record<string, number> = useMemo(() => ({
    transactions: summary?.total_transactions || 0,
    streak: summary?.streak_days || 0,
    goals: Math.max(0, (summary?.savings_goals_count || 0)),
    budgets: Math.max(0, (summary?.budgets_count || 0)),
    ...(summary?.stats || {}),
  }), [summary]);

  const unlocked = useMemo(() => getUnlockedBadges(stats), [stats]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Confetti active={unlocked.length > 0} />
      <View style={styles.header}>
        <Text style={styles.title}>Badges</Text>
        <Text style={styles.subtitle}>{unlocked.length} / {BADGES.length} unlocked</Text>
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${(unlocked.length / BADGES.length) * 100}%` }]} />
      </View>

      <Text style={styles.sectionTitle}>🏅 Earned</Text>
      {unlocked.map((badge) => (
        <View key={badge.id} style={styles.badgeCard}>
          <Text style={styles.badgeIcon}>{badge.icon}</Text>
          <View style={styles.badgeInfo}>
            <Text style={styles.badgeName}>{badge.name}</Text>
            <Text style={styles.badgeDesc}>{badge.description}</Text>
          </View>
        </View>
      ))}

      {unlocked.length === 0 && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>🏆</Text>
          <Text style={styles.emptyText}>No badges yet</Text>
          <Text style={styles.emptyHint}>Keep tracking to earn your first badge!</Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>🔒 Locked</Text>
      {BADGES.filter((b) => !unlocked.find((u) => u.id === b.id)).map((badge) => {
        const progress = getProgress(badge, stats);
        return (
          <View key={badge.id} style={[styles.badgeCard, styles.lockedCard]}>
            <Text style={styles.badgeIcon}>{badge.icon}</Text>
            <View style={styles.badgeInfo}>
              <Text style={[styles.badgeName, styles.lockedText]}>{badge.name}</Text>
              <Text style={styles.badgeDesc}>{badge.description}</Text>
              <View style={styles.progressMini}>
                <View style={[styles.progressMiniFill, { width: `${Math.min(progress * 100, 100)}%` }]} />
              </View>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}
