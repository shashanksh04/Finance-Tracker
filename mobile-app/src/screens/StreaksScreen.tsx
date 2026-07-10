import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { spacing, radius, fontSize, fontWeight, shadow } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { useOfflineItem } from '../hooks/useOfflineData';
import { useHaptics } from '../hooks/useHaptics';
import { CardSkeleton } from '../components/ui/SkeletonLoader';

export default function StreaksScreen() {
  const { colors } = useTheme();
  const { light: hapticLight } = useHaptics();
  const { data: summary, loading, refresh } = useOfflineItem('dashboard_summary', 'current');
  const [refreshing, setRefreshing] = useState(false);
  const styles = useMemo(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, alignItems: 'center', paddingBottom: 40 },
  headerCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    width: '100%',
    ...shadow.md,
  },
  flame: { fontSize: 56, marginBottom: spacing.xs },
  streakCount: { fontSize: fontSize.xxxxl, fontWeight: fontWeight.bold, color: colors.text },
  streakLabel: { fontSize: fontSize.md, color: colors.textSecondary, marginTop: spacing.xs },
  weekRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg, justifyContent: 'center' },
  weekDay: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tagBg,
  },
  weekDayActive: { backgroundColor: colors.primary },
  weekDayToday: { borderWidth: 2, borderColor: colors.primary },
  weekDayText: { fontSize: fontSize.xs, color: colors.textSecondary, fontWeight: fontWeight.medium },
  weekDayTextActive: { color: '#fff' },
  statsRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg, width: '100%' },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    ...shadow.sm,
  },
  statValue: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.text },
  statLabel: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs },
  lastActive: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.md },
  tipCard: {
    backgroundColor: colors.primaryLight + '20',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.lg,
    width: '100%',
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  tipTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.primary, marginBottom: spacing.xs },
  tipText: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 20 },
}), [colors, spacing, radius, fontSize, fontWeight]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  if (loading) return <CardSkeleton />;

  const streakDays = summary?.streak_days || 0;
  const longestStreak = summary?.longest_streak || 0;
  const lastActive = summary?.last_active_date || null;

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date().getDay();

  const weekActivity = weekDays.map((day, i) => ({
    day,
    active: i <= today,
    isToday: i === today,
  }));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.headerCard}>
        <Text style={styles.flame}>🔥</Text>
        <Text style={styles.streakCount}>{streakDays}</Text>
        <Text style={styles.streakLabel}>day streak</Text>
      </View>

      <View style={styles.weekRow}>
        {weekActivity.map((w) => (
          <View key={w.day} style={[styles.weekDay, w.active && styles.weekDayActive, w.isToday && styles.weekDayToday]}>
            <Text style={[styles.weekDayText, (w.active || w.isToday) && styles.weekDayTextActive]}>{w.day}</Text>
          </View>
        ))}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{longestStreak}</Text>
          <Text style={styles.statLabel}>Longest Streak</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{streakDays > 0 ? '🔥' : '❄️'}</Text>
          <Text style={styles.statLabel}>Status</Text>
        </View>
      </View>

      {lastActive && (
        <Text style={styles.lastActive}>Last active: {new Date(lastActive).toLocaleDateString('en-IN')}</Text>
      )}

      <View style={styles.tipCard}>
        <Text style={styles.tipTitle}>💡 Tip</Text>
        <Text style={styles.tipText}>
          Log in every day to build your streak. Streaks help build consistent financial tracking habits!
        </Text>
      </View>
    </ScrollView>
  );
}
