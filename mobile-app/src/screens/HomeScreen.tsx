import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Animated } from 'react-native';
import { analysisApi, transactionsApi, accountsApi } from '../services/api';
import { useOfflineList, useOfflineItem } from '../hooks/useOfflineData';
import { TABLES } from '../database/schema';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useHaptics } from '../hooks/useHaptics';
import { usePreferencesStore, WidgetId } from '../stores/preferencesStore';
import WidgetContainer from '../components/WidgetContainer';
import DataVisualizationHub from '../components/DataVisualizationHub';
import { formatCurrency, formatTransactionAmount, isIncome } from '../utils/format';
import type { Account, DashboardSummary, Transaction } from '../types';
import { useAuthStore } from '../stores/authStore';
import { useNavigation } from '@react-navigation/native';
import { spacing, radius, fontSize, fontWeight, shadow } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

function AnimatedNumber({ value, duration = 600 }: { value: number; duration?: number }) {
  const { colors } = useTheme();
  const animated = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState('0');

  const aidStyles = useMemo(() => ({
    balanceValue: { fontSize: fontSize.hero, fontWeight: fontWeight.bold, color: colors.text, marginTop: spacing.xs },
  }), [colors]);

  useEffect(() => {
    animated.setValue(0);
    Animated.timing(animated, { toValue: 1, duration, useNativeDriver: false }).start();
    const listener = animated.addListener(({ value: v }) => {
      setDisplay(formatCurrency(Math.round(v * value)));
    });
    return () => animated.removeListener(listener);
  }, [value]);

  return <Text style={aidStyles.balanceValue}>{display}</Text>;
}

export default function HomeScreen() {
  const { colors } = useTheme();
  const { light: hapticLight, heavy: hapticHeavy } = useHaptics();
  const navigation = useNavigation<any>();
  const { isOffline } = useNetworkStatus();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { prefs } = usePreferencesStore();

  const { data: accounts, loading: acctsLoading, refresh: refreshAccounts } = useOfflineList<Account>(TABLES.ACCOUNTS, {
    apiFetch: () => accountsApi.list(),
    mapApiResponse: (res) => res.data?.items || res.data || [],
  });

  const { data: recentTransactions, refresh: refreshTxns } = useOfflineList<Transaction>(TABLES.TRANSACTIONS, {
    orderBy: 'date DESC, created_at DESC',
    apiFetch: () => transactionsApi.list({ limit: 5 }),
    mapApiResponse: (res) => res.data?.items || res.data || [],
  });

  const { data: summary, refresh: refreshSummary } = useOfflineItem('dashboard_summary', 'current');
  const [refreshing, setRefreshing] = useState(false);

  const widgets = useMemo(() => prefs.dashboardLayout, [prefs.dashboardLayout]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshAccounts(), refreshTxns(), refreshSummary()]);
    setRefreshing(false);
  }, [refreshAccounts, refreshTxns, refreshSummary]);

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { paddingBottom: spacing.xxxl },
    greetingCard: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      backgroundColor: colors.card, marginHorizontal: spacing.md, marginTop: spacing.md,
      padding: spacing.lg, borderRadius: radius.lg, ...shadow.sm,
    },
    greeting: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },
    subGreeting: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 2 },
    greetingActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    offlineBadge: { backgroundColor: colors.warningLight, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full },
    offlineText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.warning },
    heroCard: {
      backgroundColor: colors.card, margin: spacing.md, padding: spacing.xl,
      borderRadius: radius.lg, alignItems: 'center', ...shadow.md,
    },
    heroLabel: { fontSize: fontSize.sm, color: colors.textTertiary, fontWeight: fontWeight.medium },
    heroMeta: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.md },
    heroMetaItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    dot: { width: 8, height: 8, borderRadius: 4 },
    heroMetaText: { fontSize: fontSize.xs, color: colors.textSecondary },
    actionRow: {
      flexDirection: 'row', paddingHorizontal: spacing.md, gap: spacing.sm,
      paddingTop: spacing.md, marginBottom: spacing.md,
    },
    actionBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      padding: spacing.md, borderRadius: radius.md, gap: spacing.sm,
    },
    actionBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textInverse },
    widgetArea: { paddingHorizontal: spacing.md },
    trxRow: {
      flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.md,
    },
    trxIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    trxIconText: { fontSize: 14 },
    trxInfo: { flex: 1 },
    trxDesc: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.text },
    trxDate: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 1 },
    trxAmount: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
    statRow: { flexDirection: 'row', gap: spacing.sm },
    statBox: { flex: 1, padding: spacing.sm, borderRadius: radius.sm, alignItems: 'center' },
    statBoxValue: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, marginTop: spacing.xs },
    statBoxLabel: { fontSize: fontSize.xs, color: colors.textTertiary },
    logoutBtn: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
      borderRadius: radius.full, backgroundColor: colors.dangerLight,
    },
    logoutIcon: { fontSize: 12 },
    logoutLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.danger },
  }), [colors]);

  const renderWidget = (id: WidgetId) => {
    switch (id) {
      case 'balance':
        return (
          <WidgetContainer key="balance" title="Total Balance" icon="💰" loading={acctsLoading}>
            <AnimatedNumber value={totalBalance} />
            {summary && (
              <View style={styles.heroMeta}>
                <View style={styles.heroMetaItem}>
                  <View style={[styles.dot, { backgroundColor: colors.success }]} />
                  <Text style={styles.heroMetaText}>Income {formatCurrency(summary.monthly_income || 0)}</Text>
                </View>
                <View style={styles.heroMetaItem}>
                  <View style={[styles.dot, { backgroundColor: colors.danger }]} />
                  <Text style={styles.heroMetaText}>Expenses {formatCurrency(summary.monthly_expenses || 0)}</Text>
                </View>
              </View>
            )}
          </WidgetContainer>
        );
      case 'recent':
        return (
          <WidgetContainer key="recent" title="Recent Transactions" icon="📋" empty={recentTransactions.length === 0} emptyMessage="No transactions yet">
            {recentTransactions.slice(0, 5).map((t) => (
              <View key={t.id} style={styles.trxRow}>
                <View style={[styles.trxIcon, { backgroundColor: isIncome(t) ? colors.successLight : colors.dangerLight }]}>
                  <Text style={styles.trxIconText}>{isIncome(t) ? '📥' : '📤'}</Text>
                </View>
                <View style={styles.trxInfo}>
                  <Text style={styles.trxDesc}>{t.description || 'Transaction'}</Text>
                  <Text style={styles.trxDate}>{new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
                </View>
                <Text style={[styles.trxAmount, { color: isIncome(t) ? colors.success : colors.danger }]}>
                  {formatTransactionAmount(t)}
                </Text>
              </View>
            ))}
          </WidgetContainer>
        );
      case 'streaks':
        return (
          <WidgetContainer key="streaks" title="Active Streaks" icon="🔥" empty={!summary?.streak_days} emptyMessage="Start a streak by logging daily">
            <View style={styles.statRow}>
              <View style={[styles.statBox, { backgroundColor: colors.warningLight }]}>
                <Text style={{ fontSize: 24 }}>🔥</Text>
                <Text style={[styles.statBoxValue, { color: colors.warning }]}>{summary?.streak_days || 0}</Text>
                <Text style={styles.statBoxLabel}>Day Streak</Text>
              </View>
              <View style={[styles.statBox, { backgroundColor: colors.successLight }]}>
                <Text style={{ fontSize: 24 }}>🏆</Text>
                <Text style={[styles.statBoxValue, { color: colors.success }]}>{summary?.longest_streak || 0}</Text>
                <Text style={styles.statBoxLabel}>Best Streak</Text>
              </View>
            </View>
          </WidgetContainer>
        );
      case 'goals':
        return (
          <WidgetContainer key="goals" title="Goal Progress" icon="🎯" empty={!summary?.savings_goals_count} emptyMessage="Set a savings goal to get started">
            <DataVisualizationHub
              type="ring"
              data={[{ label: 'Progress', value: summary?.goals_progress_value || 0 }]}
              total={summary?.goals_progress_total || 100}
              label={`${summary?.savings_goals_count || 0} active goals`}
            />
          </WidgetContainer>
        );
      case 'budgets':
        return (
          <WidgetContainer key="budgets" title="Top Budget" icon="📊" empty={!summary?.budgets_count} emptyMessage="Create a budget to track spending limits">
            <DataVisualizationHub
              type="progress"
              data={[
                { label: 'Spent', value: summary?.budgets_spent || 0, color: colors.primary },
                { label: 'Remaining', value: Math.max((summary?.budgets_allocated || 0) - (summary?.budgets_spent || 0), 0), color: colors.success },
              ]}
              formatValue={(v) => formatCurrency(v)}
            />
          </WidgetContainer>
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.greetingCard}>
          <View>
            <Text style={styles.greeting}>Hi{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}</Text>
            <Text style={styles.subGreeting}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
          </View>
          <View style={styles.greetingActions}>
            {isOffline && <View style={styles.offlineBadge}><Text style={styles.offlineText}>Offline</Text></View>}
            <TouchableOpacity style={styles.logoutBtn} onPress={() => { hapticHeavy(); logout(); }} accessibilityLabel="Sign out" accessibilityRole="button">
              <Text style={styles.logoutIcon}>⏻</Text>
              <Text style={styles.logoutLabel}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            onPress={() => { hapticLight(); navigation.navigate('AddTransaction'); }}
            accessibilityLabel="Add transaction" accessibilityRole="button"
          >
            <Text style={{ fontSize: 16, color: colors.textInverse }}>+</Text>
            <Text style={styles.actionBtnText}>Add</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.info }]}
            onPress={() => { hapticLight(); navigation.navigate('AddTransaction', { tab: 'scan' }); }}
            accessibilityLabel="Scan receipt" accessibilityRole="button"
          >
            <Text style={{ fontSize: 16, color: colors.textInverse }}>📷</Text>
            <Text style={styles.actionBtnText}>Scan</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.warning }]}
            onPress={() => { hapticLight(); navigation.navigate('System'); }}
            accessibilityLabel="AI Copilot" accessibilityRole="button"
          >
            <Text style={{ fontSize: 16, color: colors.textInverse }}>🤖</Text>
            <Text style={styles.actionBtnText}>AI</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.widgetArea}>
          {widgets.map((id) => renderWidget(id))}
        </View>
      </ScrollView>
    </View>
  );
}
