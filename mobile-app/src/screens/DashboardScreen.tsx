import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput,
} from 'react-native';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useSyncStore } from '../stores/syncStore';
import { useHaptics } from '../hooks/useHaptics';
import { analysisApi, transactionsApi, accountsApi } from '../services/api';
import Modal from '../components/ui/Modal';
import { formatCurrency, formatRelativeTime, getStreakLabel } from '../utils/format';
import type { DashboardSummary, Account, Category } from '../types';

export default function DashboardScreen({ navigation }: any) {
  const { isOffline } = useNetworkStatus();
  const { status, lastSyncedAt, performSync } = useSyncStore();
  const { success: hapticSuccess, light: hapticLight } = useHaptics();

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const [qaAmount, setQaAmount] = useState('');
  const [qaDescription, setQaDescription] = useState('');
  const [qaType, setQaType] = useState<'expense' | 'income'>('expense');
  const [qaSaving, setQaSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await analysisApi.dashboard();
      setSummary(res.data);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    performSync();
    fetchData();
  };

  const handleQuickAdd = async () => {
    if (!qaAmount || !qaDescription) return;
    setQaSaving(true);
    try {
      const res = await accountsApi.list();
      const accounts: Account[] = res.data?.items || res.data || [];
      const defaultAccount = accounts.find((a) => a.type === 'checking' || a.balance > 0) || accounts[0];
      if (!defaultAccount) return;

      await transactionsApi.create({
        account_id: defaultAccount.id,
        amount: parseFloat(qaAmount),
        type: qaType,
        description: qaDescription,
        date: new Date().toISOString().slice(0, 10),
      });

      hapticSuccess();
      setShowQuickAdd(false);
      setQaAmount('');
      setQaDescription('');
      fetchData();
    } catch {
    } finally {
      setQaSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0284c7" />
      </View>
    );
  }

  const balance = summary?.total_balance ?? 0;
  const income = summary?.monthly_income ?? 0;
  const expenses = summary?.monthly_expenses ?? 0;
  const streakDays = summary?.streak_days ?? 0;

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0284c7" />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Dashboard</Text>
            <Text style={styles.balance}>{formatCurrency(balance)}</Text>
            <Text style={styles.balanceLabel}>Total Balance</Text>
          </View>
          <View style={styles.headerRight}>
            {isOffline && (
              <View style={styles.offlineBadge}>
                <Text style={styles.offlineText}>Offline</Text>
              </View>
            )}
            <View style={[styles.syncDot, { backgroundColor: status === 'syncing' ? '#f59e0b' : status === 'error' ? '#dc2626' : '#10b981' }]} />
          </View>
        </View>

        <View style={styles.streakCard}>
          <Text style={styles.streakText}>{getStreakLabel(streakDays)}</Text>
        </View>

        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { borderLeftColor: '#10b981' }]}>
            <Text style={styles.summaryLabel}>Income</Text>
            <Text style={[styles.summaryValue, { color: '#10b981' }]}>{formatCurrency(income)}</Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: '#ef4444' }]}>
            <Text style={styles.summaryLabel}>Expenses</Text>
            <Text style={[styles.summaryValue, { color: '#ef4444' }]}>{formatCurrency(expenses)}</Text>
          </View>
        </View>

        {lastSyncedAt && (
          <Text style={styles.syncText}>Last synced: {formatRelativeTime(lastSyncedAt)}</Text>
        )}

        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          {summary?.recent_transactions?.slice(0, 5).map((txn) => (
            <View key={txn.id} style={styles.txnRow}>
              <View style={[styles.txnType, { backgroundColor: txn.type === 'income' ? '#dcfce7' : '#fce7f3' }]}>
                <Text style={styles.txnTypeText}>{txn.type === 'income' ? '↓' : '↑'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.txnDesc}>{txn.description}</Text>
                <Text style={styles.txnDate}>{formatRelativeTime(txn.date)}</Text>
              </View>
              <Text style={[styles.txnAmount, { color: txn.type === 'income' ? '#10b981' : '#ef4444' }]}>
                {txn.type === 'income' ? '+' : '-'}{formatCurrency(Math.abs(txn.amount))}
              </Text>
            </View>
          ))}
          {(!summary?.recent_transactions || summary.recent_transactions.length === 0) && (
            <Text style={styles.emptyText}>No transactions yet. Tap + to add one.</Text>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => { hapticLight(); setShowQuickAdd(true); }}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={showQuickAdd} onClose={() => setShowQuickAdd(false)} title="Quick Add">
        <View style={styles.qaContainer}>
          <View style={styles.qaTypeRow}>
            <TouchableOpacity
              style={[styles.qaTypeBtn, qaType === 'expense' && styles.qaTypeActiveExpense]}
              onPress={() => setQaType('expense')}
            >
              <Text style={[styles.qaTypeText, qaType === 'expense' && { color: '#fff' }]}>Expense</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.qaTypeBtn, qaType === 'income' && styles.qaTypeActiveIncome]}
              onPress={() => setQaType('income')}
            >
              <Text style={[styles.qaTypeText, qaType === 'income' && { color: '#fff' }]}>Income</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.qaInput}
            value={qaAmount}
            onChangeText={setQaAmount}
            placeholder="Amount"
            placeholderTextColor="#94a3b8"
            keyboardType="decimal-pad"
          />
          <TextInput
            style={styles.qaInput}
            value={qaDescription}
            onChangeText={setQaDescription}
            placeholder="Description"
            placeholderTextColor="#94a3b8"
          />

          <TouchableOpacity
            style={[styles.qaSaveBtn, (!qaAmount || !qaDescription || qaSaving) && { opacity: 0.5 }]}
            onPress={handleQuickAdd}
            disabled={!qaAmount || !qaDescription || qaSaving}
          >
            {qaSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.qaSaveText}>Add {qaType === 'income' ? 'Income' : 'Expense'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 20, paddingTop: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  greeting: { fontSize: 14, color: '#64748b', fontWeight: '500' },
  balance: { fontSize: 36, fontWeight: '700', color: '#0f172a', marginTop: 4 },
  balanceLabel: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  offlineBadge: { backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  offlineText: { fontSize: 11, color: '#92400e', fontWeight: '600' },
  syncDot: { width: 8, height: 8, borderRadius: 4 },
  streakCard: { backgroundColor: '#fff', margin: 16, marginBottom: 0, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#f1f5f9' },
  streakText: { fontSize: 14, color: '#0f172a', fontWeight: '600', textAlign: 'center' },
  summaryRow: { flexDirection: 'row', padding: 16, gap: 12 },
  summaryCard: { flex: 1, backgroundColor: '#fff', padding: 16, borderRadius: 12, borderLeftWidth: 4 },
  summaryLabel: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  summaryValue: { fontSize: 20, fontWeight: '700', marginTop: 4 },
  syncText: { fontSize: 11, color: '#94a3b8', textAlign: 'center', marginBottom: 4 },
  recentSection: { padding: 16, paddingTop: 0 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a', marginBottom: 12 },
  txnRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 12, borderRadius: 10, marginBottom: 8, gap: 12 },
  txnType: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  txnTypeText: { fontSize: 16, fontWeight: '700' },
  txnDesc: { fontSize: 14, color: '#0f172a', fontWeight: '500' },
  txnDate: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  txnAmount: { fontSize: 15, fontWeight: '700' },
  emptyText: { fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: 20 },
  fab: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#0284c7', justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
  fabText: { fontSize: 28, color: '#fff', fontWeight: '300', marginTop: -2 },
  qaContainer: { padding: 20 },
  qaTypeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  qaTypeBtn: { flex: 1, padding: 12, borderRadius: 10, alignItems: 'center', backgroundColor: '#f1f5f9' },
  qaTypeActiveExpense: { backgroundColor: '#ef4444' },
  qaTypeActiveIncome: { backgroundColor: '#10b981' },
  qaTypeText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  qaInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 14, fontSize: 16, color: '#0f172a', marginBottom: 12 },
  qaSaveBtn: { backgroundColor: '#0284c7', padding: 16, borderRadius: 12, alignItems: 'center' },
  qaSaveText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
