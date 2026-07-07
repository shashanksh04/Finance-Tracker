import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Alert, TextInput,
} from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useSyncStore } from '../stores/syncStore';
import { analysisApi, transactionsApi, accountsApi, budgetsApi, goalsApi, billsApi, categoriesApi } from '../services/api';
import { formatCurrency, getRelativeDate } from '../utils/format';
import Modal from '../components/ui/Modal';
import FormField from '../components/ui/FormField';

export default function DashboardScreen() {
  const user = useAuthStore((state) => state.user);
  const { isOffline } = useNetworkStatus();
  const { status, performSync } = useSyncStore();

  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [qaAmount, setQaAmount] = useState('');
  const [qaDesc, setQaDesc] = useState('');
  const [qaType, setQaType] = useState<'expense' | 'income'>('expense');
  const [qaCategory, setQaCategory] = useState('');
  const [qaSaving, setQaSaving] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [qaAccount, setQaAccount] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [dashRes, catRes, acctRes] = await Promise.all([
        analysisApi.getDashboard(),
        categoriesApi.getAll({ page_size: 50 }),
        accountsApi.getAll(),
      ]);
      setDashboard(dashRes.data);
      setCategories(catRes.data?.items || catRes.data || []);
      const accts = acctRes.data?.items || acctRes.data || [];
      setAccounts(accts);
      if (accts.length > 0 && !qaAccount) setQaAccount(accts[0].id);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchData().finally(() => setLoading(false)); }, [fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchData(), performSync()]);
    setRefreshing(false);
  };

  const handleQuickAdd = async () => {
    if (!qaAmount || !qaDesc.trim() || !qaAccount) {
      Alert.alert('Error', 'Amount, description, and account required'); return;
    }
    setQaSaving(true);
    try {
      await transactionsApi.create({
        amount: parseFloat(qaAmount), description: qaDesc.trim(),
        type: qaType, category_id: qaCategory || null, account_id: qaAccount,
        date: new Date().toISOString(),
      });
      setShowQuickAdd(false);
      setQaAmount(''); setQaDesc(''); setQaCategory('');
      await fetchData();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to add');
    } finally { setQaSaving(false); }
  };

  const d = dashboard || {};
  const totalBalance = d.total_balance || d.totalBalance || 0;
  const totalIncome = d.total_income || d.totalIncome || 0;
  const totalExpenses = d.total_expenses || d.totalExpenses || 0;
  const recentTxns = d.recent_transactions || d.recentTransactions || [];
  const budgets = d.budgets || d.budget_health || [];
  const goals = d.goals || d.goal_progress || [];
  const upcomingBills = d.upcoming_bills || d.upcomingBills || [];
  const recentAlerts = d.recent_alerts || d.recentAlerts || [];

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: '#94a3b8' }}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.headerBar}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.full_name?.split(' ')[0] || 'User'}</Text>
          <Text style={styles.date}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
        </View>
        {isOffline && (
          <View style={styles.offlineBadge}>
            <Text style={styles.offlineText}>Offline</Text>
          </View>
        )}
      </View>

      {status.isSyncing && (
        <View style={styles.syncBanner}><Text style={styles.syncText}>Syncing...</Text></View>
      )}

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Total Balance</Text>
        <Text style={styles.balanceAmount}>{formatCurrency(totalBalance)}</Text>
        <View style={styles.balanceRow}>
          <View>
            <Text style={styles.balanceSubLabel}>Income</Text>
            <Text style={[styles.balanceSubAmount, { color: '#bbf7d0' }]}>{formatCurrency(totalIncome)}</Text>
          </View>
          <View>
            <Text style={styles.balanceSubLabel}>Expenses</Text>
            <Text style={[styles.balanceSubAmount, { color: '#fecaca' }]}>{formatCurrency(totalExpenses)}</Text>
          </View>
        </View>
      </View>

      {budgets.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Budget Health</Text>
          {budgets.slice(0, 3).map((b: any, i: number) => {
            const pct = b.percentage || b.spent_percentage || 0;
            return (
              <View key={i} style={styles.budgetRow}>
                <Text style={styles.budgetName}>{b.category_name || b.name || 'Budget'}</Text>
                <View style={styles.budgetBar}>
                  <View style={[styles.budgetFill, { width: `${Math.min(100, pct)}%', backgroundColor: pct >= 90 ? '#dc2626' : pct >= 70 ? '#f59e0b' : '#10b981' }]} />
                </View>
                <Text style={styles.budgetPct}>{Math.round(pct)}%</Text>
              </View>
            );
          })}
        </View>
      )}

      {recentTxns.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          {recentTxns.slice(0, 5).map((t: any, i: number) => (
            <View key={i} style={styles.txnRow}>
              <View style={[styles.txnDot, { backgroundColor: t.type === 'income' ? '#16a34a' : '#dc2626' }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.txnDesc}>{t.description}</Text>
                <Text style={styles.txnMeta}>{t.merchant || ''}</Text>
              </View>
              <Text style={[styles.txnAmount, { color: t.type === 'income' ? '#16a34a' : '#dc2626' }]}>
                {t.type === 'income' ? '+' : '-'}{formatCurrency(Number(t.amount))}
              </Text>
            </View>
          ))}
        </View>
      )}

      {upcomingBills.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming Bills</Text>
          {upcomingBills.slice(0, 3).map((b: any, i: number) => (
            <View key={i} style={styles.billRow}>
              <Text style={{ flex: 1, fontSize: 14, color: '#0f172a' }}>{b.name}</Text>
              <Text style={{ fontSize: 14, fontWeight: '600', marginRight: 8 }}>{formatCurrency(Number(b.amount))}</Text>
              <Text style={{ fontSize: 12, color: daysUntil(b.due_date) <= 3 ? '#dc2626' : '#f59e0b' }}>{getRelativeDate(b.due_date)}</Text>
            </View>
          ))}
        </View>
      )}

      {goals.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Goal Progress</Text>
          {goals.slice(0, 2).map((g: any, i: number) => (
            <View key={i} style={styles.goalRow}>
              <Text style={{ flex: 1, fontSize: 14, color: '#0f172a' }}>{g.name}</Text>
              <View style={[styles.budgetBar, { flex: 1, marginHorizontal: 8 }]}>
                <View style={[styles.budgetFill, { width: `${Math.min(100, (g.current_amount / g.target_amount) * 100)}%', backgroundColor: '#3b82f6' }]} />
              </View>
              <Text style={{ fontSize: 12, color: '#64748b', width: 50, textAlign: 'right' }}>
                {Math.round((g.current_amount / g.target_amount) * 100)}%
              </Text>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity style={styles.quickAddFab} onPress={() => setShowQuickAdd(true)}>
        <Text style={styles.quickAddText}>+ Quick Add</Text>
      </TouchableOpacity>

      <View style={{ height: 80 }} />

      <Modal visible={showQuickAdd} onClose={() => setShowQuickAdd(false)} title="Quick Transaction" size="sm">
        <View style={{ padding: 20 }}>
          <Text style={styles.fieldLabel}>Type</Text>
          <View style={styles.typeRow}>
            <TouchableOpacity style={[styles.typeBtn, qaType === 'expense' && styles.typeActive]} onPress={() => setQaType('expense')}>
              <Text style={[styles.typeBtnText, qaType === 'expense' && { color: '#fff' }]}>Expense</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.typeBtn, qaType === 'income' && styles.typeActive]} onPress={() => setQaType('income')}>
              <Text style={[styles.typeBtnText, qaType === 'income' && { color: '#fff' }]}>Income</Text>
            </TouchableOpacity>
          </View>
          <FormField label="Amount" value={qaAmount} onChangeText={setQaAmount} keyboardType="numeric" placeholder="0.00" />
          <FormField label="Description" value={qaDesc} onChangeText={setQaDesc} placeholder="What was this for?" />
          <Text style={styles.fieldLabel}>Account</Text>
          <View style={[styles.chipRow, { marginBottom: 8 }]}>
            {accounts.slice(0, 5).map((a: any) => (
              <TouchableOpacity key={a.id} style={[styles.chip, qaAccount === a.id && { backgroundColor: '#0284c7' }]} onPress={() => setQaAccount(a.id)}>
                <Text style={[styles.chipText, qaAccount === a.id && { color: '#fff' }]}>{a.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.fieldLabel}>Category</Text>
          <View style={styles.chipRow}>
            {categories.filter((c: any) => c.type === qaType).slice(0, 8).map((c: any) => (
              <TouchableOpacity key={c.id} style={[styles.chip, qaCategory === c.id && { backgroundColor: c.color || '#0284c7' }]} onPress={() => setQaCategory(c.id)}>
                <Text style={[styles.chipText, qaCategory === c.id && { color: '#fff' }]}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={[styles.saveBtn, qaSaving && { opacity: 0.7 }]} onPress={handleQuickAdd} disabled={qaSaving}>
            <Text style={styles.saveBtnText}>{qaSaving ? 'Adding...' : 'Add Transaction'}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </ScrollView>
  );
}

function daysUntil(dateStr: string) {
  const now = new Date(); const target = new Date(dateStr);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  headerBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  greeting: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  date: { fontSize: 13, color: '#64748b', marginTop: 2 },
  offlineBadge: { backgroundColor: '#fef3c7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  offlineText: { fontSize: 12, fontWeight: '600', color: '#d97706' },
  syncBanner: { backgroundColor: '#e0f2fe', padding: 8, alignItems: 'center' },
  syncText: { fontSize: 13, color: '#0284c7' },
  balanceCard: { backgroundColor: '#0284c7', margin: 16, padding: 20, borderRadius: 16 },
  balanceLabel: { fontSize: 14, color: '#bae6fd' },
  balanceAmount: { fontSize: 32, fontWeight: '700', color: '#fff', marginVertical: 8 },
  balanceRow: { flexDirection: 'row', gap: 32 },
  balanceSubLabel: { fontSize: 12, color: '#bae6fd' },
  balanceSubAmount: { fontSize: 18, fontWeight: '600', marginTop: 2 },
  section: { backgroundColor: '#fff', margin: 16, marginTop: 0, marginBottom: 8, padding: 16, borderRadius: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a', marginBottom: 12 },
  budgetRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  budgetName: { width: 80, fontSize: 13, color: '#0f172a' },
  budgetBar: { flex: 1, height: 8, backgroundColor: '#f1f5f9', borderRadius: 4, overflow: 'hidden', marginHorizontal: 8 },
  budgetFill: { height: '100%', borderRadius: 4 },
  budgetPct: { width: 40, textAlign: 'right', fontSize: 12, color: '#64748b' },
  txnRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  txnDot: { width: 6, height: 6, borderRadius: 3, marginRight: 10 },
  txnDesc: { fontSize: 14, color: '#0f172a', fontWeight: '500' },
  txnMeta: { fontSize: 11, color: '#94a3b8', marginTop: 1 },
  txnAmount: { fontSize: 14, fontWeight: '700' },
  billRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  goalRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  quickAddFab: {
    marginHorizontal: 16, padding: 16, borderRadius: 12,
    backgroundColor: '#0284c7', alignItems: 'center',
  },
  quickAddText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 6, marginTop: 4 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  typeActive: { backgroundColor: '#0284c7', borderColor: '#0284c7' },
  typeBtnText: { fontSize: 14, color: '#64748b', fontWeight: '500' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  chipText: { fontSize: 11, color: '#475569', fontWeight: '500' },
  saveBtn: { backgroundColor: '#0284c7', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
