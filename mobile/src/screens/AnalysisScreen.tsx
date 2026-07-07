import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Dimensions,
} from 'react-native';
import { analysisApi } from '../services/api';
import { formatCurrency } from '../utils/format';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_HEIGHT = 180;

function Bar({ height, color, label, value, max }: { height: number; color: string; label: string; value: number; max: number }) {
  const pct = max > 0 ? (height / max) * CHART_HEIGHT * 0.8 : 0;
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ fontSize: 9, color: '#64748b', marginBottom: 2 }}>{formatCurrency(value).slice(0, 6)}</Text>
      <View style={{ width: 24, height: CHART_HEIGHT * 0.8, backgroundColor: '#f1f5f9', borderRadius: 4, justifyContent: 'flex-end', overflow: 'hidden' }}>
        <View style={{ width: '100%', height: Math.max(4, pct), backgroundColor: color, borderRadius: 4 }} />
      </View>
      <Text style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>{label}</Text>
    </View>
  );
}

function PieChart({ categories }: { categories: { name: string; amount: number; color: string }[] }) {
  const total = categories.reduce((s, c) => s + c.amount, 0);
  if (total === 0) return <Text style={{ textAlign: 'center', color: '#94a3b8', padding: 20 }}>No data</Text>;

  return (
    <View style={{ gap: 8 }}>
      {categories.slice(0, 7).map((cat, i) => {
        const pct = (cat.amount / total) * 100;
        return (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: cat.color, marginRight: 8 }} />
            <Text style={{ flex: 1, fontSize: 13, color: '#0f172a' }}>{cat.name}</Text>
            <View style={{ width: 80, height: 6, backgroundColor: '#f1f5f9', borderRadius: 3, marginRight: 8, overflow: 'hidden' }}>
              <View style={{ width: `${pct}%`, height: '100%', backgroundColor: cat.color, borderRadius: 3 }} />
            </View>
            <Text style={{ width: 70, textAlign: 'right', fontSize: 12, fontWeight: '600', color: '#0f172a' }}>{pct.toFixed(0)}%</Text>
          </View>
        );
      })}
      {categories.length > 7 && <Text style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>+{categories.length - 7} more</Text>}
    </View>
  );
}

export default function AnalysisScreen() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [dashboard, setDashboard] = useState<any>(null);

  const fetch = useCallback(async () => {
    try {
      const [dashRes, periodRes] = await Promise.all([
        analysisApi.getDashboard(),
        analysisApi.getPeriod({ period }),
      ]);
      setDashboard(dashRes.data);
      setData(periodRes.data);
    } catch { /* ignore */ }
  }, [period]);

  useEffect(() => { fetch().finally(() => setLoading(false)); }, [fetch]);
  const onRefresh = async () => { setRefreshing(true); await fetch(); setRefreshing(false); };

  if (loading) return <LoadingSpinner message="Loading analysis..." />;

  const monthlyTrend = data?.trends || dashboard?.monthly_summary || [];
  const categoryBreakdown = data?.breakdown || dashboard?.category_breakdown || [];
  const topMerchants = data?.top_merchants || [];
  const insights = data?.insights || dashboard?.insights || [];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.periodRow}>
        {(['monthly', 'quarterly', 'yearly'] as const).map((p) => (
          <TouchableOpacity key={p} style={[styles.periodBtn, period === p && styles.periodActive]} onPress={() => setPeriod(p)}>
            <Text style={[styles.periodText, period === p && styles.periodTextActive]}>{p.charAt(0).toUpperCase() + p.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {dashboard && (
        <View style={styles.statRow}>
          <View style={styles.statCard}><Text style={styles.statLabel}>Balance</Text><Text style={styles.statValue}>{formatCurrency(dashboard.total_balance || 0)}</Text></View>
          <View style={styles.statCard}><Text style={styles.statLabel}>Income</Text><Text style={[styles.statValue, { color: '#16a34a' }]}>{formatCurrency(dashboard.total_income || 0)}</Text></View>
          <View style={styles.statCard}><Text style={styles.statLabel}>Expenses</Text><Text style={[styles.statValue, { color: '#dc2626' }]}>{formatCurrency(dashboard.total_expenses || 0)}</Text></View>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Income vs Expenses</Text>
        <View style={styles.chartContainer}>
          {monthlyTrend.length > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: CHART_HEIGHT, paddingTop: 20 }}>
              {monthlyTrend.slice(-6).map((item: any, i: number) => {
                const maxVal = Math.max(...monthlyTrend.slice(-6).map((m: any) => Math.max(m.income || 0, m.expenses || 0)));
                return (
                  <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                    <Bar height={item.income || 0} color="#16a34a" label={item.month || item.label || ''} value={item.income || 0} max={maxVal} />
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={{ textAlign: 'center', color: '#94a3b8', padding: 20 }}>No trend data available</Text>
          )}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Spending by Category</Text>
        <PieChart
          categories={(categoryBreakdown || []).map((c: any) => ({
            name: c.category_name || c.name || 'Unknown',
            amount: c.amount || c.total || 0,
            color: c.color || '#3b82f6',
          }))}
        />
      </View>

      {topMerchants.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Top Merchants</Text>
          {topMerchants.slice(0, 5).map((m: any, i: number) => (
            <View key={i} style={styles.merchantRow}>
              <Text style={styles.merchantName}>{i + 1}. {m.merchant || m.name}</Text>
              <Text style={styles.merchantAmount}>{formatCurrency(m.amount || m.total || 0)}</Text>
            </View>
          ))}
        </View>
      )}

      {insights.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Insights</Text>
          {insights.map((insight: any, i: number) => (
            <View key={i} style={styles.insightRow}>
              <Text style={styles.insightIcon}>💡</Text>
              <Text style={styles.insightText}>{insight.message || insight}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  periodRow: { flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 8 },
  periodBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#f1f5f9', alignItems: 'center' },
  periodActive: { backgroundColor: '#0284c7' },
  periodText: { fontSize: 14, color: '#64748b', fontWeight: '500' },
  periodTextActive: { color: '#fff' },
  statRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: '#fff', padding: 12, borderRadius: 10, alignItems: 'center' },
  statLabel: { fontSize: 11, color: '#94a3b8' },
  statValue: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginTop: 2 },
  card: { backgroundColor: '#fff', margin: 16, marginTop: 0, marginBottom: 8, padding: 16, borderRadius: 12 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a', marginBottom: 12 },
  chartContainer: { minHeight: CHART_HEIGHT },
  merchantRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  merchantName: { fontSize: 14, color: '#0f172a' },
  merchantAmount: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  insightRow: { flexDirection: 'row', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  insightIcon: { fontSize: 16 },
  insightText: { flex: 1, fontSize: 13, color: '#475569', lineHeight: 18 },
});
