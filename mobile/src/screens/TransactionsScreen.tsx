import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Alert, TextInput,
} from 'react-native';
import { transactionsApi, categoriesApi, accountsApi } from '../services/api';
import { Transaction, Category, Account } from '../types';
import { formatCurrency, formatDate } from '../utils/format';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import FormField from '../components/ui/FormField';

export default function TransactionsScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [txType, setTxType] = useState<'income' | 'expense'>('expense');
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [merchant, setMerchant] = useState('');
  const [date, setDate] = useState('');
  const [saving, setSaving] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const params: any = { page_size: 100, sort_by: 'date', sort_order: 'desc' };
      if (typeFilter !== 'all') params.type = typeFilter;
      if (search.trim()) params.search = search.trim();

      const [tRes, cRes, aRes] = await Promise.all([
        transactionsApi.getAll(params),
        categoriesApi.getAll({ page_size: 100 }),
        accountsApi.getAll(),
      ]);
      setTransactions(tRes.data?.items || tRes.data || []);
      setCategories(cRes.data?.items || cRes.data || []);
      setAccounts(aRes.data?.items || aRes.data || []);
    } catch { /* ignore */ }
  }, [typeFilter, search]);

  useEffect(() => { fetch().finally(() => setLoading(false)); }, [fetch]);
  const onRefresh = async () => { setRefreshing(true); await fetch(); setRefreshing(false); };

  const openCreate = () => {
    setEditing(null);
    setAmount(''); setDescription(''); setTxType('expense');
    setCategoryId(''); setAccountId(''); setMerchant(''); setDate(new Date().toISOString().split('T')[0]);
    setShowModal(true);
  };

  const openEdit = (t: Transaction) => {
    setEditing(t);
    setAmount(String(t.amount)); setDescription(t.description); setTxType(t.type as 'income' | 'expense');
    setCategoryId(t.category_id || ''); setAccountId(t.account_id); setMerchant(t.merchant || '');
    setDate(t.date?.split('T')[0] || t.date);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!amount || !description.trim() || !accountId) {
      Alert.alert('Error', 'Amount, description, and account are required'); return;
    }
    setSaving(true);
    try {
      const data = {
        amount: parseFloat(amount), description: description.trim(), type: txType,
        category_id: categoryId || null, account_id: accountId,
        merchant: merchant.trim() || null, date: date || new Date().toISOString(),
      };
      if (editing) await transactionsApi.update(editing.id, data);
      else await transactionsApi.create(data);
      setShowModal(false);
      await fetch();
    } catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Transaction', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await transactionsApi.delete(id); await fetch(); }
        catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Delete failed'); }
      }},
    ]);
  };

  const getCategoryName = (id: string | null) => {
    if (!id) return '';
    return categories.find((c) => c.id === id)?.name || '';
  };

  const getAccountName = (id: string) => accounts.find((a) => a.id === id)?.name || '';

  const totalIncome = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);

  if (loading) return <LoadingSpinner message="Loading transactions..." />;

  return (
    <View style={styles.container}>
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: '#16a34a' }]}>Income</Text>
          <Text style={[styles.summaryAmount, { color: '#16a34a' }]}>{formatCurrency(totalIncome)}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: '#dc2626' }]}>Expenses</Text>
          <Text style={[styles.summaryAmount, { color: '#dc2626' }]}>{formatCurrency(totalExpense)}</Text>
        </View>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search transactions..."
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={styles.filterRow}>
        {(['all', 'expense', 'income'] as const).map((f) => (
          <TouchableOpacity key={f} style={[styles.filterChip, typeFilter === f && styles.filterActive]} onPress={() => setTypeFilter(f)}>
            <Text style={[styles.filterText, typeFilter === f && { color: '#fff' }]}>{f.charAt(0).toUpperCase() + f.slice(1)}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.filterChip} onPress={openCreate}>
          <Text style={styles.filterText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={transactions.length === 0 ? { flex: 1 } : { padding: 16, paddingTop: 4 }}
        ListEmptyComponent={<EmptyState title="No transactions" subtitle="Add your first transaction to start tracking" actionLabel="Add Transaction" onAction={openCreate} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => openEdit(item)} onLongPress={() => handleDelete(item.id)}>
            <View style={styles.cardRow}>
              <View style={[styles.typeIcon, { backgroundColor: item.type === 'income' ? '#dcfce7' : '#fef2f2' }]}>
                <Text style={{ fontSize: 18 }}>{item.type === 'income' ? '↑' : '↓'}</Text>
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.desc}>{item.description}</Text>
                <Text style={styles.meta}>
                  {getCategoryName(item.category_id)}
                  {item.merchant ? ` · ${item.merchant}` : ''}
                  {` · ${getAccountName(item.account_id)}`}
                </Text>
                <Text style={styles.date}>{formatDate(item.date)}</Text>
              </View>
              <Text style={[styles.amount, { color: item.type === 'income' ? '#16a34a' : '#dc2626' }]}>
                {item.type === 'income' ? '+' : '-'}{formatCurrency(Number(item.amount))}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />

      <Modal visible={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Transaction' : 'New Transaction'}>
        <View style={styles.modalBody}>
          <FormField label="Amount" value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="1000" />
          <FormField label="Description" value={description} onChangeText={setDescription} placeholder="e.g. Grocery shopping" />
          <Text style={styles.fieldLabel}>Type</Text>
          <View style={styles.typeRow}>
            <TouchableOpacity style={[styles.typeBtn, txType === 'expense' && styles.typeActive]} onPress={() => setTxType('expense')}>
              <Text style={[styles.typeBtnText, txType === 'expense' && { color: '#fff' }]}>Expense</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.typeBtn, txType === 'income' && styles.typeActive]} onPress={() => setTxType('income')}>
              <Text style={[styles.typeBtnText, txType === 'income' && { color: '#fff' }]}>Income</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.fieldLabel}>Account</Text>
          <View style={styles.chipRow}>
            {accounts.slice(0, 8).map((a) => (
              <TouchableOpacity key={a.id} style={[styles.chip, accountId === a.id && { backgroundColor: '#0284c7' }]} onPress={() => setAccountId(a.id)}>
                <Text style={[styles.chipText, accountId === a.id && { color: '#fff' }]}>{a.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.fieldLabel}>Category</Text>
          <View style={styles.chipRow}>
            <TouchableOpacity style={[styles.chip, !categoryId && { backgroundColor: '#f1f5f9' }]} onPress={() => setCategoryId('')}>
              <Text style={styles.chipText}>None</Text>
            </TouchableOpacity>
            {categories.filter((c) => c.type === txType).slice(0, 12).map((c) => (
              <TouchableOpacity key={c.id} style={[styles.chip, categoryId === c.id && { backgroundColor: c.color || '#0284c7' }]} onPress={() => setCategoryId(c.id)}>
                <Text style={[styles.chipText, categoryId === c.id && { color: '#fff' }]}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <FormField label="Merchant (optional)" value={merchant} onChangeText={setMerchant} placeholder="e.g. Walmart" />
          <FormField label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} placeholder="2026-07-08" />
          <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving}>
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  summaryRow: { flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 4 },
  summaryItem: { flex: 1, backgroundColor: '#fff', padding: 10, borderRadius: 10, alignItems: 'center' },
  summaryLabel: { fontSize: 11, fontWeight: '600' },
  summaryAmount: { fontSize: 16, fontWeight: '700', marginTop: 2 },
  searchRow: { paddingHorizontal: 16, paddingTop: 8 },
  searchInput: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: 8, padding: 12, fontSize: 14, color: '#0f172a',
  },
  filterRow: { flexDirection: 'row', gap: 6, padding: 16, paddingVertical: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: '#f1f5f9' },
  filterActive: { backgroundColor: '#0284c7' },
  filterText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  card: { backgroundColor: '#fff', padding: 12, borderRadius: 10, marginBottom: 6 },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  typeIcon: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  cardInfo: { flex: 1 },
  desc: { fontSize: 15, fontWeight: '500', color: '#0f172a' },
  meta: { fontSize: 11, color: '#94a3b8', marginTop: 1 },
  date: { fontSize: 11, color: '#94a3b8', marginTop: 1 },
  amount: { fontSize: 15, fontWeight: '700' },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 8, marginTop: 4 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  typeActive: { backgroundColor: '#0284c7', borderColor: '#0284c7' },
  typeBtnText: { fontSize: 14, color: '#64748b', fontWeight: '500' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  chipText: { fontSize: 11, color: '#475569', fontWeight: '500' },
  modalBody: { padding: 20 },
  saveBtn: { backgroundColor: '#0284c7', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
