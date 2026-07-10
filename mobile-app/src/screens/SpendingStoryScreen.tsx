import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { spacing, radius, fontSize, fontWeight, shadow } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { useOfflineList, useOfflineItem } from '../hooks/useOfflineData';
import { useHaptics } from '../hooks/useHaptics';
import { CardSkeleton } from '../components/ui/SkeletonLoader';
import { calculatePersonality } from '../data/personalities';

type Slide = {
  emoji: string;
  title: string;
  lines: string[];
};

export default function SpendingStoryScreen() {
  const { colors } = useTheme();
  const { light: hapticLight } = useHaptics();
  const { data: summary, loading, refresh } = useOfflineItem('dashboard_summary', 'current');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const styles = useMemo(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, justifyContent: 'center', flexGrow: 1 },
  slideCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.xl,
    ...shadow.lg,
    minHeight: 300,
    justifyContent: 'center',
  },
  slideEmoji: { fontSize: 64, textAlign: 'center', marginBottom: spacing.lg },
  slideTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.text, textAlign: 'center', marginBottom: spacing.lg },
  lineRow: { flexDirection: 'row', marginBottom: spacing.sm, paddingHorizontal: spacing.md },
  bullet: { fontSize: fontSize.md, color: colors.primary, marginRight: spacing.sm, lineHeight: 22 },
  lineText: { fontSize: fontSize.md, color: colors.textSecondary, lineHeight: 22, flex: 1 },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    paddingBottom: spacing.lg,
  },
  navBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, backgroundColor: colors.primary, borderRadius: radius.md },
  navBtnDisabled: { backgroundColor: colors.tagBg },
  navBtnText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: '#fff' },
  navBtnTextDisabled: { color: colors.textSecondary },
  dots: { fontSize: fontSize.sm, color: colors.textSecondary, letterSpacing: 4 },
}), [colors, spacing, radius, fontSize, fontWeight]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  if (loading) return <CardSkeleton />;

  const personality = useMemo(() => calculatePersonality({
    income: summary?.total_income || 0,
    expenses: summary?.total_expenses || 0,
    transactions: summary?.total_transactions || 0,
    streak: summary?.streak_days || 0,
    goals: summary?.savings_goals_count || 0,
    budgets: summary?.budgets_count || 0,
    ...(summary?.stats || {}),
  }), [summary]);

  const slides: Slide[] = useMemo(() => {
    const income = summary?.total_income || 0;
    const expenses = summary?.total_expenses || 0;
    const balance = income - expenses;
    const txnCount = summary?.total_transactions || 0;
    const streak = summary?.streak_days || 0;

    return [
      {
        emoji: '📊',
        title: 'Your Month at a Glance',
        lines: [
          `Total Income: ₹${income.toLocaleString('en-IN')}`,
          `Total Expenses: ₹${expenses.toLocaleString('en-IN')}`,
          `Net Balance: ₹${balance.toLocaleString('en-IN')}`,
        ],
      },
      {
        emoji: '💳',
        title: 'Transaction Activity',
        lines: [
          `You made ${txnCount} transactions this period.`,
          income > expenses
            ? `You saved ${Math.round(((income - expenses) / income) * 100)}% of your income!`
            : 'Your expenses exceeded income. Time to review!',
        ],
      },
      {
        emoji: '🔥',
        title: 'Consistency Check',
        lines: [
          streak > 0
            ? `Current streak: ${streak} days`
            : 'Start building a streak by logging daily!',
          streak > 7 ? 'Great consistency! You are building a strong habit 🌟' : 'Every day counts — keep going!',
        ],
      },
      {
        emoji: personality.emoji,
        title: 'Your Spending Personality',
        lines: [personality.label, personality.description],
      },
      {
        emoji: '🏆',
        title: 'Badges Earned',
        lines: [`${summary?.total_transactions || 0 > 0 ? 'You are on your way to earning badges!' : 'Start tracking to earn badges!'}`],
      },
    ];
  }, [summary, personality]);

  const slide = slides[currentSlide];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={styles.slideCard}>
          <Text style={styles.slideEmoji}>{slide.emoji}</Text>
          <Text style={styles.slideTitle}>{slide.title}</Text>
          {slide.lines.map((line, i) => (
            <View key={i} style={styles.lineRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.lineText}>{line}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.navRow}>
        <TouchableOpacity
          onPress={() => { hapticLight(); setCurrentSlide(Math.max(0, currentSlide - 1)); }}
          disabled={currentSlide === 0}
          style={[styles.navBtn, currentSlide === 0 && styles.navBtnDisabled]}
        >
          <Text style={[styles.navBtnText, currentSlide === 0 && styles.navBtnTextDisabled]}>Previous</Text>
        </TouchableOpacity>

        <Text style={styles.dots}>
          {slides.map((_, i) => (i === currentSlide ? '●' : '○')).join(' ')}
        </Text>

        <TouchableOpacity
          onPress={() => { hapticLight(); setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1)); }}
          disabled={currentSlide === slides.length - 1}
          style={[styles.navBtn, currentSlide === slides.length - 1 && styles.navBtnDisabled]}
        >
          <Text style={[styles.navBtnText, currentSlide === slides.length - 1 && styles.navBtnTextDisabled]}>Next</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
