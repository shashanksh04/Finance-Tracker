import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { analysisApi } from '../services/api';
import { formatCurrency } from '../utils/format';
import type { PeriodAnalysis, CategorySpending, MerchantSpending } from '../types';

const PERIODS = ['monthly', 'quarterly', 'yearly'] as const;

export default function AnalysisScreen() {
  const [period, setPeriod] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [data, setData] = useState<PeriodAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await analysisApi.period({ period });
      setData(res.data);
    } catch {
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const maxCategoryAmount = Math.max(...(data?.top_categories?.map((c) => Math.abs(c.amount)) || [1]), 1);

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#0284c7" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.periodRow}>
        {PERIODS.map((p) => (
          <TouchableOpacity key={p} style={[styles.periodBtn, period === p && styles.periodActive]} onPress={() => setPeriod(p)}>
            <Text style={[styles.periodText, period === p && styles.periodTextActive]}>{p.charAt(0).toUpperCase() + p.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Income</Text>
              <Text style={[styles.summaryValue, { color: '#10b981' }]}>{formatCurrency(data?.income || 0)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Expenses</Text>
              <Text style={[styles.summaryValue, { color: '#ef4444' }]}>{formatCurrency(data?.expenses || 0)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Net</Text>
              <Text style={[styles.summaryValue, { color: (data?.net || 0) >= 0 ? '#10b981' : '#ef4444' }]}>
                {formatCurrency(data?.net || 0)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Spending by Category</Text>
          {data?.top_categories?.map((c, i) => (
            <View key={i} style={styles.barRow}>
              <View style={styles.barLabel}>
                <Text style={styles.barName}>{c.category_name}</Text>
                <Text style={styles.barPct}>{c.percentage.toFixed(1)}%</Text>
              </View>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${Math.min((Math.abs(c.amount) / maxCategoryAmount) * 100, 100)}%`, backgroundColor: c.category_color || '#0284c7' }]} />
              </View>
              <Text style={styles.barAmount}>{formatCurrency(Math.abs(c.amount))}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Merchants</Text>
          {data?.top_merchants?.map((m, i) => (
            <View key={i} style={styles.merchantRow}>
              <Text style={styles.merchantName}>{m.merchant}</Text>
              <Text style={styles.merchantCount}>{m.transaction_count} txns</Text>
              <Text style={styles.merchantAmount}>{formatCurrency(m.amount)}</Text>
            </View>
          ))}
        </View>

        {data?.insights && data.insights.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Insights</Text>
            {data.insights.map((insight, i) => (
              <View key={i} style={styles.insightCard}>
                <Text style={styles.insightText}>{insight}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  periodRow: { flexDirection: 'row', padding: 12, gap: 8 },
  periodBtn: { flex: 1, padding: 10, borderRadius: 8, alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  periodActive: { backgroundColor: '#0284c7', borderColor: '#0284c7' },
  periodText: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  periodTextActive: { color: '#fff' },
  summaryCard: { backgroundColor: '#fff', margin: 12, marginTop: 0, padding: 16, borderRadius: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around' },
  summaryItem: { alignItems: 'center' },
  summaryLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '500', textTransform: 'uppercase' },
  summaryValue: { fontSize: 18, fontWeight: '700', marginTop: 4 },
  section: { padding: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a', marginBottom: 12 },
  barRow: { marginBottom: 12 },
  barLabel: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  barName: { fontSize: 13, color: '#475569' },
  barPct: { fontSize: 12, color: '#94a3b8' },
  barTrack: { height: 8, backgroundColor: '#f1f5f9', borderRadius: 4, overflow: 'hidden', marginBottom: 2 },
  barFill: { height: '100%', borderRadius: 4 },
  barAmount: { fontSize: 12, color: '#64748b', textAlign: 'right' },
  merchantRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 6 },
  merchantName: { flex: 1, fontSize: 14, color: '#0f172a', fontWeight: '500' },
  merchantCount: { fontSize: 11, color: '#94a3b8', marginRight: 12 },
  merchantAmount: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  insightCard: { backgroundColor: '#e0f2fe', padding: 12, borderRadius: 8, marginBottom: 6 },
  insightText: { fontSize: 13, color: '#0f172a', lineHeight: 18 },
});
