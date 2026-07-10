import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { analysisApi } from '../services/api';
import { useOfflineList } from '../hooks/useOfflineData';
import { TABLES } from '../database/schema';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { ListSkeleton } from '../components/ui/SkeletonLoader';
import BarChart from '../components/ui/BarChart';
import { formatCurrency, isIncome } from '../utils/format';
import type { Transaction, PeriodAnalysis } from '../types';
import { spacing, radius, fontSize, fontWeight, shadow } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

const PERIODS = [
  { key: '1m', label: '1M' },
  { key: '3m', label: '3M' },
  { key: '6m', label: '6M' },
  { key: '1y', label: '1Y' },
  { key: 'all', label: 'All' },
] as const;

export default function AnalysisScreen() {
  const { colors } = useTheme();
  const { isOffline } = useNetworkStatus();
  const [period, setPeriod] = useState<string>('1m');
  const [analysis, setAnalysis] = useState<PeriodAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const { data: transactions } = useOfflineList<Transaction>(TABLES.TRANSACTIONS, {
    orderBy: 'date DESC',
  });

  const fetchAnalysis = useCallback(async () => {
    if (isOffline) return;
    try {
      const res = await analysisApi.period({ period: period as any });
      setAnalysis(res.data);
    } catch { setAnalysis(null); } finally { setLoading(false); }
  }, [period, isOffline]);

  useEffect(() => { fetchAnalysis(); }, [fetchAnalysis]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAnalysis();
    setRefreshing(false);
  }, [fetchAnalysis]);

  const totalExpenses = useMemo(
    () => transactions.filter((t) => !isIncome(t)).reduce((s, t) => s + Math.abs(t.amount), 0),
    [transactions]
  );
  const totalIncome = useMemo(
    () => transactions.filter((t) => isIncome(t)).reduce((s, t) => s + Math.abs(t.amount), 0),
    [transactions]
  );

  const categoryChartData = useMemo(() => {
    if (!analysis?.top_categories) return [];
    return analysis.top_categories.slice(0, 8).map((c: any) => ({
      label: (c.name || c.category_name || 'Other').slice(0, 10),
      value: c.amount,
      color: c.category_color || c.color || colors.primary,
    }));
  }, [analysis]);

  const merchantData = useMemo(() => {
    if (!analysis?.top_merchants) return [];
    return analysis.top_merchants.slice(0, 6).map((m: any) => ({
      label: (m.name || m.merchant || 'Other').slice(0, 12),
      value: m.total || m.amount || 0,
      color: colors.info,
    }));
  }, [analysis]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    periodRow: { flexDirection: 'row', padding: spacing.md, gap: spacing.sm },
    periodBtn: { flex: 1, padding: spacing.sm, borderRadius: radius.sm, alignItems: 'center', backgroundColor: colors.border },
    periodBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textSecondary },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
    statCard: {
      flex: 1, minWidth: '45%', backgroundColor: colors.card, padding: spacing.lg,
      borderRadius: radius.md, borderLeftWidth: 3, ...shadow.sm,
    },
    statLabel: { fontSize: fontSize.xs, color: colors.textTertiary, fontWeight: fontWeight.medium, textTransform: 'uppercase', letterSpacing: 0.5 },
    statValue: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, marginTop: spacing.xs },
    section: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
    sectionTitle: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.text, marginBottom: spacing.md, textTransform: 'uppercase', letterSpacing: 0.5 },
    chartCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, ...shadow.sm },
    catRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md, gap: spacing.md },
    catInfo: { flex: 1 },
    catLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
    catDot: { width: 8, height: 8, borderRadius: 4 },
    catName: { fontSize: fontSize.sm, color: colors.text, fontWeight: fontWeight.medium },
    catPct: { fontSize: fontSize.xs, color: colors.textTertiary },
    catBarBg: { height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' },
    catBarFill: { height: '100%', borderRadius: 3 },
    catAmount: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text, minWidth: 70, textAlign: 'right' },
    merchantRow: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
      padding: spacing.md, borderRadius: radius.sm, marginBottom: spacing.xs, gap: spacing.md, ...shadow.sm,
    },
    merchantRank: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
    merchantRankText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.primary },
    merchantName: { flex: 1, fontSize: fontSize.base, color: colors.text },
    merchantAmount: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
    merchantCount: { fontSize: fontSize.xs, color: colors.textTertiary, minWidth: 24, textAlign: 'right' },
    localGrid: { gap: spacing.sm },
    localCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, padding: spacing.lg, borderRadius: radius.md, gap: spacing.md, ...shadow.sm },
    localIcon: { fontSize: 28 },
    localLabel: { fontSize: fontSize.xs, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
    localValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginTop: 2 },
  }), [colors, spacing, radius, fontSize, fontWeight]);

  if (loading) return <ListSkeleton />;

  return (
    <View style={styles.container}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={styles.periodRow}>
          {PERIODS.map((p) => (
            <TouchableOpacity
              key={p.key}
              style={[styles.periodBtn, period === p.key && { backgroundColor: colors.primary }]}
              onPress={() => { setPeriod(p.key); setLoading(true); }}
            >
              <Text style={[styles.periodBtnText, period === p.key && { color: colors.textInverse }]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {analysis && (
          <>
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { borderLeftColor: colors.danger }]}>
                <Text style={styles.statLabel}>Total Spent</Text>
                <Text style={[styles.statValue, { color: colors.danger }]}>{formatCurrency(analysis.expenses || 0)}</Text>
              </View>
              <View style={[styles.statCard, { borderLeftColor: colors.success }]}>
                <Text style={styles.statLabel}>Total Earned</Text>
                <Text style={[styles.statValue, { color: colors.success }]}>{formatCurrency(analysis.income || 0)}</Text>
              </View>
              <View style={[styles.statCard, { borderLeftColor: colors.info }]}>
                <Text style={styles.statLabel}>Net</Text>
                <Text style={[styles.statValue, { color: (analysis.net || 0) >= 0 ? colors.success : colors.danger }]}>
                  {formatCurrency(analysis.net || 0)}
                </Text>
              </View>
              <View style={[styles.statCard, { borderLeftColor: colors.primary }]}>
                <Text style={styles.statLabel}>Period</Text>
                <Text style={[styles.statValue, { color: colors.primary, fontSize: fontSize.base }]}>{analysis.period}</Text>
              </View>
            </View>

            {categoryChartData.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Spending by Category</Text>
                <View style={styles.chartCard}>
                  <BarChart data={categoryChartData} formatValue={(v) => formatCurrency(v)} height={160} />
                </View>
                {analysis.top_categories.map((cat: any, i: number) => {
                  const pct = analysis.expenses > 0 ? (cat.amount / analysis.expenses) * 100 : 0;
                  return (
                    <View key={i} style={styles.catRow}>
                      <View style={styles.catInfo}>
                        <View style={styles.catLabelRow}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                            <View style={[styles.catDot, { backgroundColor: cat.category_color || cat.color || colors.primary }]} />
                            <Text style={styles.catName}>{cat.name || cat.category_name}</Text>
                          </View>
                          <Text style={styles.catPct}>{pct.toFixed(0)}%</Text>
                        </View>
                        <View style={styles.catBarBg}>
                          <View style={[styles.catBarFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: cat.category_color || cat.color || colors.primary }]} />
                        </View>
                      </View>
                      <Text style={styles.catAmount}>{formatCurrency(cat.amount)}</Text>
                    </View>
                  );
                })}
              </View>
            )}

            {merchantData.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Top Merchants</Text>
                <View style={styles.chartCard}>
                  <BarChart data={merchantData} formatValue={(v) => formatCurrency(v)} height={140} />
                </View>
                {analysis.top_merchants.map((m: any, i: number) => (
                  <View key={i} style={styles.merchantRow}>
                    <View style={styles.merchantRank}>
                      <Text style={styles.merchantRankText}>#{i + 1}</Text>
                    </View>
                    <Text style={styles.merchantName}>{m.name || m.merchant}</Text>
                    <Text style={styles.merchantAmount}>{formatCurrency(m.total || m.amount)}</Text>
                    <Text style={styles.merchantCount}>{m.count || m.transaction_count}x</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Local Summary</Text>
          <View style={styles.localGrid}>
            <View style={styles.localCard}>
              <Text style={styles.localIcon}>📊</Text>
              <View>
                <Text style={styles.localLabel}>All Expenses (Local)</Text>
                <Text style={[styles.localValue, { color: colors.danger }]}>{formatCurrency(totalExpenses)}</Text>
              </View>
            </View>
            <View style={styles.localCard}>
              <Text style={styles.localIcon}>📈</Text>
              <View>
                <Text style={styles.localLabel}>All Income (Local)</Text>
                <Text style={[styles.localValue, { color: colors.success }]}>{formatCurrency(totalIncome)}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

