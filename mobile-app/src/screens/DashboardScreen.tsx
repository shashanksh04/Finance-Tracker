import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Animated,
} from 'react-native';
import { analysisApi, transactionsApi, accountsApi } from '../services/api';
import { useOfflineList } from '../hooks/useOfflineData';
import { repository } from '../database/repository';
import { TABLES } from '../database/schema';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useHaptics } from '../hooks/useHaptics';
import Modal from '../components/ui/Modal';
import { DashboardSkeleton } from '../components/ui/SkeletonLoader';
import BarChart from '../components/ui/BarChart';
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

function formatCategoryData(dashboard: DashboardSummary | null) {
  if (!dashboard?.spending_by_category) return [];
  return dashboard.spending_by_category.slice(0, 6).map((c: any) => ({
    label: c.category_name?.slice(0, 8),
    value: c.amount,
    color: c.category_color || colors.primary,
  }));
}

export default function DashboardScreen() {
  const { colors } = useTheme();
  const { light: hapticLight, success: hapticSuccess, heavy: hapticHeavy } = useHaptics();
  const logout = useAuthStore((s) => s.logout);
  const navigation = useNavigation();
  const { isOffline } = useNetworkStatus();
  const user = useAuthStore((s) => s.user);

  const { data: accounts, refresh: refreshAccounts } = useOfflineList<Account>(TABLES.ACCOUNTS, {
    apiFetch: () => accountsApi.list(),
    mapApiResponse: (res) => res.data?.items || res.data || [],
  });

  const { data: recentTransactions, refresh: refreshTxns } = useOfflineList<Transaction>(TABLES.TRANSACTIONS, {
    orderBy: 'date DESC, created_at DESC',
    apiFetch: () => transactionsApi.list({ limit: 5 }),
    mapApiResponse: (res) => res.data?.items || res.data || [],
  });

  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [qaAmount, setQaAmount] = useState('');
  const [qaDescription, setQaDescription] = useState('');
  const [qaAccountId, setQaAccountId] = useState('');
  const [qaSaving, setQaSaving] = useState(false);

  const fetchDashboard = useCallback(async () => {
    if (isOffline) return;
    try {
      const res = await analysisApi.dashboard();
      setDashboard(res.data);
    } catch { if (!isOffline) setLoading(false); } finally { setLoading(false); }
  }, [isOffline]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchDashboard(), refreshAccounts(), refreshTxns()]);
    setRefreshing(false);
  }, [fetchDashboard, refreshAccounts, refreshTxns]);

  const handleQuickAdd = async () => {
    if (!qaAmount || !qaAccountId) return;
    setQaSaving(true);
    try {
      const amount = -Math.abs(parseFloat(qaAmount));
      await transactionsApi.create({ amount, description: qaDescription, account_id: qaAccountId });
      hapticSuccess(); setShowQuickAdd(false); setQaAmount(''); setQaDescription('');
      refreshTxns();
    } catch {} finally { setQaSaving(false); }
  };

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const catData = formatCategoryData(dashboard);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    greetingCard: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      padding: spacing.xl, backgroundColor: colors.primary,
    },
    greeting: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.textInverse },
    subGreeting: { fontSize: fontSize.sm, color: '#bfdbfe', marginTop: spacing.xs },
    greetingActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    offlineBadge: { backgroundColor: colors.warningLight, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full },
    offlineText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.warning },
    logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.2)' },
    logoutIcon: { fontSize: 14 },
    logoutLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.textInverse },
    balanceCard: {
      backgroundColor: colors.card, margin: spacing.md, padding: spacing.xl,
      borderRadius: radius.lg, alignItems: 'center', ...shadow.md,
    },
    balanceLabel: { fontSize: fontSize.sm, color: colors.textTertiary, fontWeight: fontWeight.medium },
    balanceValue: { fontSize: fontSize.hero, fontWeight: fontWeight.bold, color: colors.text, marginTop: spacing.xs },
    balanceMeta: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.md },
    balanceMetaItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    dot: { width: 8, height: 8, borderRadius: 4 },
    balanceMetaText: { fontSize: fontSize.xs, color: colors.textSecondary },
    section: { padding: spacing.md, paddingBottom: 0 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
    sectionTitle: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.text, textTransform: 'uppercase', letterSpacing: 0.5 },
    seeAll: { fontSize: fontSize.sm, color: colors.primary, fontWeight: fontWeight.semibold },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    statCard: {
      width: '48%', padding: spacing.md, borderRadius: radius.md,
    },
    statLabel: { fontSize: fontSize.xs, color: colors.textTertiary, fontWeight: fontWeight.medium, textTransform: 'uppercase', letterSpacing: 0.5 },
    statValue: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, marginTop: spacing.xs },
    chartCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, ...shadow.sm },
    trxRow: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
      padding: spacing.lg, borderRadius: radius.md, marginBottom: spacing.sm, gap: spacing.md, ...shadow.sm,
    },
    trxIcon: { width: 40, height: 40, borderRadius: radius.xl, justifyContent: 'center', alignItems: 'center' },
    trxIconText: { fontSize: 18 },
    trxInfo: { flex: 1 },
    trxDesc: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: colors.text },
    trxDate: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 2 },
    trxAmount: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
    emptyState: { alignItems: 'center', padding: spacing.xxxl },
    emptyIcon: { fontSize: 48, marginBottom: spacing.md },
    emptyTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.text },
    emptySubtitle: { fontSize: fontSize.sm, color: colors.textTertiary, marginTop: spacing.xs },
    fab: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', elevation: 4 },
    fabText: { fontSize: 28, color: colors.textInverse, fontWeight: fontWeight.regular, marginTop: -2 },
    form: { padding: spacing.xl },
    label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textSecondary, marginBottom: spacing.sm, marginTop: spacing.xs },
    input: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: spacing.md, fontSize: fontSize.base, color: colors.text, marginBottom: spacing.sm },
    choiceChip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, marginRight: spacing.sm, marginBottom: spacing.sm },
    choiceChipText: { fontSize: fontSize.sm, color: colors.textSecondary },
    saveBtn: { backgroundColor: colors.primary, padding: spacing.lg, borderRadius: radius.md, alignItems: 'center', marginTop: spacing.md },
    saveBtnText: { color: colors.textInverse, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  }), [colors, spacing, radius, fontSize, fontWeight]);

  if (loading) return <DashboardSkeleton />;

  return (
    <View style={styles.container}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={styles.greetingCard}>
          <View>
            <Text style={styles.greeting}>Hi{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : user?.email ? `, ${user.email.split('@')[0]}` : ''}</Text>
            <Text style={styles.subGreeting}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
          </View>
          <View style={styles.greetingActions}>
            {isOffline && <View style={styles.offlineBadge}><Text style={styles.offlineText}>Offline</Text></View>}
            <TouchableOpacity style={styles.logoutBtn} onPress={() => { hapticHeavy(); logout(); }} accessibilityLabel="Sign out" accessibilityRole="button">
              <Text style={styles.logoutIcon}>🚪</Text>
              <Text style={styles.logoutLabel}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Total Balance</Text>
          <AnimatedNumber value={totalBalance} />
          {dashboard && (
            <View style={styles.balanceMeta}>
              <View style={styles.balanceMetaItem}>
                <View style={[styles.dot, { backgroundColor: colors.success }]} />
                <Text style={styles.balanceMetaText}>Income {formatCurrency(dashboard.monthly_income || 0)}</Text>
              </View>
              <View style={styles.balanceMetaItem}>
                <View style={[styles.dot, { backgroundColor: colors.danger }]} />
                <Text style={styles.balanceMetaText}>Expenses {formatCurrency(dashboard.monthly_expenses || 0)}</Text>
              </View>
            </View>
          )}
        </View>

        {dashboard && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Monthly Summary</Text>
              <View style={styles.statsGrid}>
                <View style={[styles.statCard, { backgroundColor: colors.successLight }]}>
                  <Text style={styles.statLabel}>Income</Text>
                  <Text style={[styles.statValue, { color: colors.success }]}>{formatCurrency(dashboard.monthly_income || 0)}</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.dangerLight }]}>
                  <Text style={styles.statLabel}>Expenses</Text>
                  <Text style={[styles.statValue, { color: colors.danger }]}>{formatCurrency(dashboard.monthly_expenses || 0)}</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.infoLight }]}>
                  <Text style={styles.statLabel}>Net Savings</Text>
                  <Text style={[styles.statValue, { color: colors.info }]}>{formatCurrency((dashboard.monthly_income || 0) - (dashboard.monthly_expenses || 0))}</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.warningLight }]}>
                  <Text style={styles.statLabel}>Day Streak</Text>
                  <Text style={[styles.statValue, { color: colors.warning }]}>{dashboard.streak_days || 0}</Text>
                </View>
              </View>
            </View>

            {catData.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Spending by Category</Text>
                <View style={styles.chartCard}>
                  <BarChart data={catData} formatValue={(v) => formatCurrency(v)} />
                </View>
              </View>
            )}
          </>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Transactions' as never)} accessibilityLabel="See all transactions" accessibilityRole="button"><Text style={styles.seeAll}>See All</Text></TouchableOpacity>
          </View>
          {recentTransactions.slice(0, 5).map((t, i) => (
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
          {recentTransactions.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyTitle}>No transactions yet</Text>
              <Text style={styles.emptySubtitle}>Tap + to add your first expense</Text>
            </View>
          )}
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => { hapticLight(); setQaAccountId(accounts[0]?.id || ''); setShowQuickAdd(true); }} accessibilityLabel="Add quick expense" accessibilityRole="button">
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={showQuickAdd} onClose={() => setShowQuickAdd(false)} title="Quick Expense">
        <View style={styles.form}>
          <Text style={styles.label}>Amount</Text>
          <TextInput style={styles.input} value={qaAmount} onChangeText={setQaAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.textTertiary} />
          <Text style={styles.label}>Description</Text>
          <TextInput style={styles.input} value={qaDescription} onChangeText={setQaDescription} placeholder="What was this for?" placeholderTextColor={colors.textTertiary} />
          <Text style={styles.label}>Account</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {accounts.map((a) => (
              <TouchableOpacity key={a.id} style={[styles.choiceChip, qaAccountId === a.id && { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => setQaAccountId(a.id)}>
                <Text style={[styles.choiceChipText, qaAccountId === a.id && { color: colors.textInverse }]}>{a.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={[styles.saveBtn, qaSaving && { opacity: 0.5 }]} onPress={handleQuickAdd} disabled={qaSaving}>
            {qaSaving ? <ActivityIndicator color={colors.textInverse} /> : <Text style={styles.saveBtnText}>Add Expense</Text>}
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

