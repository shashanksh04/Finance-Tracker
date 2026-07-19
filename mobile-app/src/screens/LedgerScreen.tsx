import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Alert,
} from 'react-native';
import { transactionsApi, accountsApi, categoriesApi } from '../services/api';
import { useHaptics } from '../hooks/useHaptics';
import { useOfflineList } from '../hooks/useOfflineData';
import { repository } from '../database/repository';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { TABLES } from '../database/schema';
import { ListSkeleton } from '../components/ui/SkeletonLoader';
import AdaptiveSheet from '../components/AdaptiveSheet';
import EmptyState from '../components/ui/EmptyState';
import SmartInputSuite from '../components/SmartInputSuite';
import { formatCurrency, formatTransactionAmount, isIncome } from '../utils/format';
import type { Transaction, Account, Category, TransactionType } from '../types';
import { spacing, radius, fontSize, fontWeight, shadow } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

function groupByDate(txns: Transaction[]): Record<string, Transaction[]> {
  const groups: Record<string, Transaction[]> = {};
  for (const t of txns) {
    const key = t.date || 'Unknown';
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  }
  return groups;
}

function formatSectionDate(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

export default function LedgerScreen() {
  const { colors } = useTheme();
  const { success: hapticSuccess, light: hapticLight, heavy: hapticHeavy } = useHaptics();

  const { data: transactions, loading, refreshing, refresh, refreshFromApi } = useOfflineList<Transaction>(TABLES.TRANSACTIONS, {
    orderBy: 'date DESC, created_at DESC',
    apiFetch: () => transactionsApi.list({ limit: 100 }),
    mapApiResponse: (res) => res.data?.items || res.data || [],
  });

  const { data: accounts } = useOfflineList<Account>(TABLES.ACCOUNTS, {
    apiFetch: () => accountsApi.list(),
    mapApiResponse: (res) => res.data?.items || res.data || [],
  });

  const { data: categories } = useOfflineList<Category>(TABLES.CATEGORIES, {
    apiFetch: () => categoriesApi.list(),
    mapApiResponse: (res) => res.data?.items || res.data || [],
  });

  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [formAmount, setFormAmount] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formType, setFormType] = useState<TransactionType>('expense');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formAccountId, setFormAccountId] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formSaving, setFormSaving] = useState(false);

  const toggleAccount = (id: string) => {
    setSelectedAccountIds((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const filtered = useMemo(() => {
    let result = transactions;
    if (selectedAccountIds.length > 0) {
      result = result.filter((t) => {
        const acctId = (t as any).accountId ?? t.account_id;
        return acctId && selectedAccountIds.includes(acctId.toString());
      });
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((t) =>
        t.description?.toLowerCase().includes(q) ||
        t.amount.toString().includes(q)
      );
    }
    return result;
  }, [transactions, selectedAccountIds, search]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);
  const dateKeys = useMemo(() => Object.keys(grouped).sort((a, b) => new Date(b).getTime() - new Date(a).getTime()), [grouped]);

  const accountMap = useMemo(() => {
    const m: Record<string, Account> = {};
    accounts.forEach((a) => { m[a.id] = a; });
    return m;
  }, [accounts]);

  const categoryMap = useMemo(() => {
    const m: Record<string, Category> = {};
    categories.forEach((c) => { m[c.id] = c; });
    return m;
  }, [categories]);

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

  const openCreate = (type: TransactionType) => {
    setEditing(null); setFormAmount(''); setFormDescription(''); setFormType(type);
    setFormCategoryId(''); setFormAccountId(accounts[0]?.id || '');
    setFormDate(new Date().toISOString().slice(0, 10)); setShowCreate(true);
  };

  const openEdit = (t: Transaction) => {
    setEditing(t); setFormAmount(Math.abs(t.amount).toString());
    setFormDescription(t.description || '');
    setFormType(isIncome(t) ? 'income' : 'expense');
    setFormCategoryId((t as any).categoryId ?? t.category_id ?? ''); setFormAccountId((t as any).accountId ?? t.account_id ?? '');
    setFormDate(t.date); setShowCreate(true);
  };

  const handleSave = async () => {
    if (!formAmount || !formAccountId) return;
    setFormSaving(true);
    try {
      const amount = formType === 'expense' ? -Math.abs(parseFloat(formAmount)) : Math.abs(parseFloat(formAmount));
      const data = { amount, description: formDescription, date: formDate, category_id: formCategoryId || undefined, account_id: formAccountId };
      if (editing) {
        const res = await transactionsApi.update(editing.id, data);
        await repository.update(TABLES.TRANSACTIONS, editing.id, res.data);
      } else {
        const res = await transactionsApi.create(data);
        await repository.create(TABLES.TRANSACTIONS, res.data);
      }
      hapticSuccess(); setShowCreate(false); refresh();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed');
    } finally { setFormSaving(false); }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => { await transactionsApi.delete(id); await repository.delete(TABLES.TRANSACTIONS, id); hapticHeavy(); refresh(); },
      },
    ]);
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    screenTitle: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.text, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xs },
    chipRow: {
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    },
    accountChip: {
      paddingVertical: 6, paddingHorizontal: 12,
      borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
      backgroundColor: colors.card, minWidth: 80,
    },
    accountChipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
    accountChipName: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.textSecondary },
    accountChipBalance: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
    searchRow: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
      marginHorizontal: spacing.md, marginBottom: 2,
      paddingHorizontal: spacing.md, borderRadius: radius.md,
      borderWidth: 1, borderColor: colors.border, gap: spacing.sm,
      height: 34,
    },
    searchIcon: { fontSize: 14 },
    searchInput: { flex: 1, fontSize: fontSize.sm, color: colors.text, paddingVertical: 0 },
    clearSearch: { fontSize: 14, color: colors.textTertiary, padding: spacing.xs },
    dayGroup: { marginBottom: spacing.sm },
    dayHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    },
    dayTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
    dayTotal: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
    trxRow: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
      paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
      marginHorizontal: spacing.md, marginBottom: 1, gap: spacing.md,
    },
    trxIcon: { width: 40, height: 40, borderRadius: radius.xl, justifyContent: 'center', alignItems: 'center' },
    trxIconText: { fontSize: 18 },
    trxInfo: { flex: 1 },
    trxDesc: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: colors.text },
    trxMeta: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 2 },
    trxRight: { alignItems: 'flex-end' },
    trxAmount: { fontSize: fontSize.base, fontWeight: fontWeight.bold },
    fabRow: { position: 'absolute', bottom: 20, right: 16, gap: spacing.sm },
    fab: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', elevation: 4 },
    fabIcon: { fontSize: 16 },
    form: { padding: spacing.xl, maxHeight: 500 },
    label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textSecondary, marginBottom: spacing.sm, marginTop: spacing.xs },
    input: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: spacing.md, fontSize: fontSize.base, color: colors.text, marginBottom: spacing.sm },
    typeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
    typeBtn: { flex: 1, padding: spacing.sm, borderRadius: radius.sm, alignItems: 'center', backgroundColor: colors.border },
    typeBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
    choiceChip: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, marginRight: spacing.sm, marginBottom: spacing.sm },
    choiceChipText: { fontSize: fontSize.sm, color: colors.textSecondary },
    formActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
    saveBtn: { flex: 1, backgroundColor: colors.primary, padding: spacing.lg, borderRadius: radius.md, alignItems: 'center' },
    saveBtnText: { color: colors.textInverse, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
    deleteBtn: { padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.dangerLight },
    deleteBtnText: { color: colors.danger, fontWeight: fontWeight.semibold },
  }), [colors]);

  const renderDaySection = (dateKey: string) => {
    const dayTxns = grouped[dateKey];
    const dayTotal = dayTxns.reduce((s, t) => s + t.amount, 0);
    return (
      <View key={dateKey} style={styles.dayGroup}>
        <View style={styles.dayHeader}>
          <Text style={styles.dayTitle}>{formatSectionDate(dateKey)}</Text>
          <Text style={[styles.dayTotal, { color: dayTotal >= 0 ? colors.success : colors.danger }]}>
            {dayTotal >= 0 ? '+' : ''}{formatCurrency(dayTotal)}
          </Text>
        </View>
        {dayTxns.map((t) => {
          const catId = (t as any).categoryId ?? t.category_id;
          const acctId = (t as any).accountId ?? t.account_id;
          const cat = catId ? categoryMap[catId] : undefined;
          const acct = acctId ? accountMap[acctId] : undefined;
          return (
            <TouchableOpacity key={t.id} style={styles.trxRow} onPress={() => openEdit(t)} onLongPress={() => handleDelete(t.id)}>
              <View style={[styles.trxIcon, { backgroundColor: isIncome(t) ? colors.successLight : colors.dangerLight }]}>
                <Text style={styles.trxIconText}>{isIncome(t) ? '📥' : '📤'}</Text>
              </View>
              <View style={styles.trxInfo}>
                <Text style={styles.trxDesc}>{t.description || cat?.name || 'Transaction'}</Text>
                <Text style={styles.trxMeta}>
                  {cat?.name}{acct ? ` · ${acct.name}` : ''}{t.merchant ? ` · ${t.merchant}` : ''}
                </Text>
              </View>
              <View style={styles.trxRight}>
                <Text style={[styles.trxAmount, { color: isIncome(t) ? colors.success : colors.danger }]}>
                  {formatTransactionAmount(t)}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  if (loading) return <ListSkeleton />;

  return (
    <View style={styles.container}>
      <Text style={styles.screenTitle}>Ledger</Text>

      <View style={styles.chipRow}>
        <FlatList horizontal showsHorizontalScrollIndicator={false} data={accounts} keyExtractor={(a) => a.id} contentContainerStyle={{ gap: spacing.sm }}
          renderItem={({ item: a }) => {
            const active = selectedAccountIds.includes(a.id);
            return (
              <TouchableOpacity
                style={[styles.accountChip, active && styles.accountChipActive]}
                onPress={() => toggleAccount(a.id)}
              >
                    <Text style={[styles.accountChipName, active && { color: colors.primary }]}>{a.name}</Text>
                <Text style={[styles.accountChipBalance, active && { color: colors.primary }]}>
                  {formatCurrency(a.balance)}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      <View style={styles.searchRow}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput style={styles.searchInput} value={search} onChangeText={setSearch} placeholder="Search..." placeholderTextColor={colors.textTertiary} />
        {search ? <TouchableOpacity onPress={() => setSearch('')}><Text style={styles.clearSearch}>✕</Text></TouchableOpacity> : null}
      </View>

      <FlatList
        style={{ flex: 1 }}
        data={dateKeys}
        keyExtractor={(k) => k}
        renderItem={({ item }) => renderDaySection(item)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshFromApi} />}
        ListEmptyComponent={<EmptyState icon="📭" title="No transactions" subtitle={search ? 'Try a different search' : 'Tap + to add your first transaction'} />}
        ListFooterComponent={<View style={{ height: 100 }} />}
      />

      <View style={styles.fabRow}>
        <TouchableOpacity style={[styles.fab, { backgroundColor: colors.success }]} onPress={() => { hapticLight(); openCreate('income'); }}>
          <Text style={styles.fabIcon}>+💰</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.fab, { backgroundColor: colors.danger }]} onPress={() => { hapticLight(); openCreate('expense'); }}>
          <Text style={styles.fabIcon}>-💸</Text>
        </TouchableOpacity>
      </View>

      <AdaptiveSheet visible={showCreate} onClose={() => setShowCreate(false)} title={editing ? 'Edit Transaction' : 'New Transaction'}>
        <ScrollView style={styles.form}>
          <SmartInputSuite label="Amount" value={formAmount} onChange={setFormAmount} type="currency" placeholder="0.00" />
          <SmartInputSuite label="Description" value={formDescription} onChange={setFormDescription} type="text" placeholder="What was this for?" />
          <Text style={styles.label}>Type</Text>
          <View style={styles.typeRow}>
            <TouchableOpacity style={[styles.typeBtn, formType === 'expense' && { backgroundColor: colors.danger }]} onPress={() => setFormType('expense')}>
              <Text style={[styles.typeBtnText, { color: formType === 'expense' ? colors.textInverse : colors.textSecondary }]}>Expense</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.typeBtn, formType === 'income' && { backgroundColor: colors.success }]} onPress={() => setFormType('income')}>
              <Text style={[styles.typeBtnText, { color: formType === 'income' ? colors.textInverse : colors.textSecondary }]}>Income</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.label}>Category</Text>
          <FlatList horizontal showsHorizontalScrollIndicator={false} data={categories.filter((c) => c.type === formType)} keyExtractor={(c) => c.id}
            renderItem={({ item: c }) => (
              <TouchableOpacity style={[styles.choiceChip, formCategoryId === c.id && { backgroundColor: (c.color || colors.primary) + '20', borderColor: c.color || colors.primary }]} onPress={() => setFormCategoryId(c.id)}>
                <Text style={{ fontSize: 16 }}>{c.icon}</Text>
                <Text style={[styles.choiceChipText, formCategoryId === c.id && { color: colors.text }]}>{c.name}</Text>
              </TouchableOpacity>
            )}
          />
          <Text style={styles.label}>Account</Text>
          <FlatList horizontal showsHorizontalScrollIndicator={false} data={accounts} keyExtractor={(a) => a.id}
            renderItem={({ item: a }) => (
              <TouchableOpacity key={a.id} style={[styles.choiceChip, formAccountId === a.id && { backgroundColor: colors.primaryLight, borderColor: colors.primary }]} onPress={() => setFormAccountId(a.id)}>
                <Text style={[styles.choiceChipText, formAccountId === a.id && { color: colors.primary }]}>{a.name}</Text>
              </TouchableOpacity>
            )}
          />
          <SmartInputSuite label="Date" value={formDate} onChange={setFormDate} type="date" />
          <View style={styles.formActions}>
            {editing && (<TouchableOpacity style={styles.deleteBtn} onPress={() => { setShowCreate(false); handleDelete(editing.id); }}><Text style={styles.deleteBtnText}>Delete</Text></TouchableOpacity>)}
            <TouchableOpacity style={[styles.saveBtn, formSaving && { opacity: 0.5 }]} onPress={handleSave} disabled={formSaving}>
              {formSaving ? <ActivityIndicator color={colors.textInverse} /> : <Text style={styles.saveBtnText}>{editing ? 'Update' : 'Create'}</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </AdaptiveSheet>
    </View>
  );
}
