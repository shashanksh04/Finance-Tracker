import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { spacing, radius, fontSize, fontWeight, shadow } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { useOfflineList, useOfflineItem } from '../hooks/useOfflineData';
import { useHaptics } from '../hooks/useHaptics';
import { CardSkeleton } from '../components/ui/SkeletonLoader';
import { BADGES, getUnlockedBadges, getProgress } from '../data/badges';
import Confetti from '../components/Confetti';

type Tab = 'badges' | 'streaks';

export default function BadgesStreaksScreen() {
  const { colors } = useTheme();
  const { light: hapticLight, success: hapticSuccess } = useHaptics();
  const { data: summary, loading, refresh } = useOfflineItem('dashboard_summary', 'current');
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('badges');
  const [showConfetti, setShowConfetti] = useState(false);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    screenTitle: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.text, padding: spacing.lg, paddingBottom: spacing.sm },
    content: { padding: spacing.md, paddingBottom: 40 },
    tabRow: { flexDirection: 'row', paddingHorizontal: spacing.md, marginBottom: spacing.md, gap: spacing.sm },
    tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md, alignItems: 'center', backgroundColor: colors.card },
    tabActive: { backgroundColor: colors.primary },
    tabText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textSecondary },
    tabTextActive: { color: colors.textInverse },
    // Badges
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: spacing.sm },
    title: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.text },
    subtitle: { fontSize: fontSize.sm, color: colors.textSecondary },
    progressBar: { height: 8, backgroundColor: colors.tagBg, borderRadius: radius.full, marginBottom: spacing.lg, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: radius.full },
    sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.text, marginBottom: spacing.sm, marginTop: spacing.sm },
    badgeCard: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
      borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, ...shadow.sm,
    },
    lockedCard: { opacity: 0.7 },
    badgeIcon: { fontSize: 32, marginRight: spacing.md },
    badgeInfo: { flex: 1 },
    badgeName: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.text },
    lockedText: { color: colors.textSecondary },
    badgeDesc: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
    progressMini: { height: 4, backgroundColor: colors.tagBg, borderRadius: radius.full, marginTop: spacing.xs, overflow: 'hidden' },
    progressMiniFill: { height: '100%', backgroundColor: colors.primary, borderRadius: radius.full },
    // Streaks
    headerCard: {
      backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.xl,
      alignItems: 'center', width: '100%', ...shadow.md,
    },
    flame: { fontSize: 56, marginBottom: spacing.xs },
    streakCount: { fontSize: fontSize.xxxl, fontWeight: fontWeight.bold, color: colors.text },
    streakLabel: { fontSize: fontSize.base, color: colors.textSecondary, marginTop: spacing.xs },
    weekRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg, justifyContent: 'center' },
    weekDay: { width: 44, height: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.tagBg },
    weekDayActive: { backgroundColor: colors.primary },
    weekDayToday: { borderWidth: 2, borderColor: colors.primary },
    weekDayText: { fontSize: fontSize.xs, color: colors.textSecondary, fontWeight: fontWeight.medium },
    weekDayTextActive: { color: '#fff' },
    longestRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg, backgroundColor: colors.tagBg, padding: spacing.md, borderRadius: radius.md, gap: spacing.sm },
    longestIcon: { fontSize: 24 },
    longestLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
    longestValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text, marginLeft: 'auto' },
  }), [colors]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const todayIdx = new Date().getDay();

  const renderBadgesTab = () => {
    const stats: Record<string, number> = summary ? {
      transactions: summary.total_transactions || 0,
      streak: summary.streak_days || 0,
      goals: summary.savings_goals_count || 0,
      goals_completed: summary.goals_completed || 0,
      budgets: summary.budgets_count || 0,
      savings: (summary.monthly_income || 0) - (summary.monthly_expenses || 0),
      no_debt: 0,
      categories_used: 0,
      bills_paid: 0,
      alerts: 0,
    } : {};
    const unlockedCount = summary ? getUnlockedBadges(stats).length : 0;
    const unlocked = summary ? getUnlockedBadges(stats) : [];
    const locked = BADGES.filter((b) => !unlocked.find((u) => u.id === b.id));
    const totalBadges = BADGES.length;

    return (
      <View>
        <View style={styles.header}>
          <Text style={styles.title}>Badges</Text>
          <Text style={styles.subtitle}>{unlockedCount}/{totalBadges} unlocked</Text>
        </View>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${totalBadges > 0 ? (unlockedCount / totalBadges) * 100 : 0}%` }]} />
        </View>

        {unlocked.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Earned</Text>
            {unlocked.map((b) => (
              <View key={b.id} style={styles.badgeCard}>
                <Text style={styles.badgeIcon}>{b.icon}</Text>
                <View style={styles.badgeInfo}>
                  <Text style={styles.badgeName}>{b.name}</Text>
                  <Text style={styles.badgeDesc}>{b.description}</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {locked.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Locked</Text>
            {locked.map((b) => {
              const pct = getProgress(b, stats) * 100;
              return (
                <View key={b.id} style={[styles.badgeCard, styles.lockedCard]}>
                  <Text style={[styles.badgeIcon, { opacity: 0.4 }]}>{b.icon}</Text>
                  <View style={styles.badgeInfo}>
                    <Text style={[styles.badgeName, styles.lockedText]}>{b.name}</Text>
                    <Text style={styles.badgeDesc}>{b.description}</Text>
                    <View style={styles.progressMini}>
                      <View style={[styles.progressMiniFill, { width: `${pct}%` }]} />
                    </View>
                  </View>
                </View>
              );
            })}
          </>
        )}
      </View>
    );
  };

  const renderStreaksTab = () => {
    const streakDays = summary?.streak_days || 0;
    const longestStreak = summary?.longest_streak || 0;

    return (
      <View style={styles.headerCard}>
        <Text style={styles.flame}>🔥</Text>
        <Text style={styles.streakCount}>{streakDays}</Text>
        <Text style={styles.streakLabel}>Day Streak</Text>

        <View style={styles.weekRow}>
          {weekDays.map((day, i) => {
            const isToday = i === todayIdx;
            const isActive = i <= todayIdx && streakDays > todayIdx - i;
            return (
              <View key={day} style={[styles.weekDay, isActive && styles.weekDayActive, isToday && styles.weekDayToday]}>
                <Text style={[styles.weekDayText, isActive && styles.weekDayTextActive]}>{day.charAt(0)}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.longestRow}>
          <Text style={styles.longestIcon}>🏆</Text>
          <Text style={styles.longestLabel}>Longest Streak</Text>
          <Text style={styles.longestValue}>{longestStreak} days</Text>
        </View>
      </View>
    );
  };

  if (loading) return <CardSkeleton />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <Confetti active={showConfetti} />
      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tab, activeTab === 'badges' && styles.tabActive]} onPress={() => setActiveTab('badges')} accessibilityLabel="Badges tab" accessibilityRole="button">
          <Text style={[styles.tabText, activeTab === 'badges' && styles.tabTextActive]}>🏅 Badges</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'streaks' && styles.tabActive]} onPress={() => setActiveTab('streaks')} accessibilityLabel="Streaks tab" accessibilityRole="button">
          <Text style={[styles.tabText, activeTab === 'streaks' && styles.tabTextActive]}>🔥 Streaks</Text>
        </TouchableOpacity>
      </View>
      {activeTab === 'badges' ? renderBadgesTab() : renderStreaksTab()}
    </ScrollView>
  );
}
