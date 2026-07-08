import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { transactionsApi, accountsApi, categoriesApi } from '../services/api';
import { useHaptics } from '../hooks/useHaptics';
import Modal from '../components/ui/Modal';
import { formatCurrency, formatRelativeTime, formatDate } from '../utils/format';
import type { Transaction, Account, Category } from '../types';

export default function TransactionsScreen() {
  const { success: hapticSuccess, light: hapticLight, heavy: hapticHeavy } = useHaptics();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  const [formAmount, setFormAmount] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formMerchant, setFormMerchant] = useState('');
  const [formType, setFormType] = useState<'expense' | 'income'>('expense');
  const [formAccountId, setFormAccountId] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formSaving, setFormSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const params: Record<string, any> = {};
      if (typeFilter !== 'all') params.type = typeFilter;
      if (search) params.search = search;

      const [txnRes, acctRes, catRes] = await Promise.all([
        transactionsApi.list(params),
        accountsApi.list(),
        categoriesApi.list(),
      ]);
      setTransactions(txnRes.data?.items || txnRes.data || []);
      setAccounts(acctRes.data?.items || acctRes.data || []);
      setCategories(catRes.data?.items || catRes.data || []);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, typeFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => {
    setEditing(null);
    setFormAmount('');
    setFormDescription('');
    setFormMerchant('');
    setFormType('expense');
    setFormAccountId(accounts[0]?.id || '');
    setFormCategoryId('');
    setFormDate(new Date().toISOString().slice(0, 10));
    setShowModal(true);
  };

  const openEdit = (txn: Transaction) => {
    setEditing(txn);
    setFormAmount(Math.abs(txn.amount).toString());
    setFormDescription(txn.description);
    setFormMerchant(txn.merchant || '');
    setFormType(txn.type as 'expense' | 'income');
    setFormAccountId(txn.account_id);
    setFormCategoryId(txn.category_id || '');
    setFormDate(txn.date.slice(0, 10));
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formAmount || !formDescription || !formAccountId) return;
    setFormSaving(true);
    try {
      const data = {
        account_id: formAccountId,
        category_id: formCategoryId || undefined,
        amount: parseFloat(formAmount),
        type: formType,
        description: formDescription,
        merchant: formMerchant || undefined,
        date: formDate,
      };

      if (editing) {
        await transactionsApi.update(editing.id, data);
      } else {
        await transactionsApi.create(data);
      }

      hapticSuccess();
      setShowModal(false);
      fetchData();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to save transaction');
    } finally {
      setFormSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Transaction', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await transactionsApi.delete(id);
            hapticHeavy();
            fetchData();
          } catch {}
        },
      },
    ]);
  };

  const handleSwipeCreate = (type: 'income' | 'expense') => {
    hapticLight();
    setFormType(type);
    setEditing(null);
    setFormAmount('');
    setFormDescription('');
    setFormMerchant('');
    setFormAccountId(accounts[0]?.id || '');
    setFormCategoryId('');
    setFormDate(new Date().toISOString().slice(0, 10));
    setShowModal(true);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0284c7" />
      </View>
    );
  }

  const filteredCategories = categories.filter((c) => c.type === formType);

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search transactions..."
          placeholderTextColor="#94a3b8"
        />
      </View>

      <View style={styles.filterRow}>
        {(['all', 'expense', 'income'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, typeFilter === f && styles.filterActive]}
            onPress={() => setTypeFilter(f)}
          >
            <Text style={[styles.filterText, typeFilter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
      >
        {transactions.map((txn) => (
          <TouchableOpacity key={txn.id} style={styles.txnRow} onPress={() => openEdit(txn)} onLongPress={() => handleDelete(txn.id)}>
            <View style={[styles.txnTypeBadge, { backgroundColor: txn.type === 'income' ? '#dcfce7' : '#fce7f3' }]}>
              <Text style={[styles.txnTypeIcon, { color: txn.type === 'income' ? '#10b981' : '#ef4444' }]}>
                {txn.type === 'income' ? '↓' : '↑'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.txnDesc}>{txn.description}</Text>
              <Text style={styles.txnMeta}>
                {txn.merchant ? `${txn.merchant} · ` : ''}{formatDate(txn.date)}
                {txn.category ? ` · ${txn.category.name}` : ''}
              </Text>
            </View>
            <Text style={[styles.txnAmount, { color: txn.type === 'income' ? '#10b981' : '#ef4444' }]}>
              {txn.type === 'income' ? '+' : '-'}{formatCurrency(Math.abs(txn.amount))}
            </Text>
          </TouchableOpacity>
        ))}
        {transactions.length === 0 && (
          <Text style={styles.emptyText}>No transactions found</Text>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.swipeBar}>
        <TouchableOpacity style={[styles.swipeBtn, { backgroundColor: '#ef4444' }]} onPress={() => handleSwipeCreate('expense')}>
          <Text style={styles.swipeBtnText}>+ Expense</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.swipeBtn, { backgroundColor: '#10b981' }]} onPress={() => handleSwipeCreate('income')}>
          <Text style={styles.swipeBtnText}>+ Income</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Transaction' : 'New Transaction'}>
        <View style={styles.formContainer}>
          <View style={styles.formTypeRow}>
            <TouchableOpacity
              style={[styles.formTypeBtn, formType === 'expense' && { backgroundColor: '#ef4444' }]}
              onPress={() => setFormType('expense')}
            >
              <Text style={[styles.formTypeText, { color: formType === 'expense' ? '#fff' : '#64748b' }]}>Expense</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.formTypeBtn, formType === 'income' && { backgroundColor: '#10b981' }]}
              onPress={() => setFormType('income')}
            >
              <Text style={[styles.formTypeText, { color: formType === 'income' ? '#fff' : '#64748b' }]}>Income</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.fieldLabel}>Amount</Text>
          <TextInput style={styles.fieldInput} value={formAmount} onChangeText={setFormAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#94a3b8" />

          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput style={styles.fieldInput} value={formDescription} onChangeText={setFormDescription} placeholder="What was this for?" placeholderTextColor="#94a3b8" />

          <Text style={styles.fieldLabel}>Merchant (optional)</Text>
          <TextInput style={styles.fieldInput} value={formMerchant} onChangeText={setFormMerchant} placeholder="Store name" placeholderTextColor="#94a3b8" />

          <Text style={styles.fieldLabel}>Account</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {accounts.map((a) => (
              <TouchableOpacity key={a.id} style={[styles.chip, formAccountId === a.id && styles.chipActive]} onPress={() => setFormAccountId(a.id)}>
                <Text style={[styles.chipText, formAccountId === a.id && styles.chipTextActive]}>{a.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.fieldLabel}>Category (optional)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {filteredCategories.map((c) => (
              <TouchableOpacity key={c.id} style={[styles.chip, formCategoryId === c.id && styles.chipActive, c.color ? { borderColor: c.color } : undefined]} onPress={() => setFormCategoryId(formCategoryId === c.id ? '' : c.id)}>
                <Text style={[styles.chipText, formCategoryId === c.id && styles.chipTextActive]}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.fieldLabel}>Date</Text>
          <TextInput style={styles.fieldInput} value={formDate} onChangeText={setFormDate} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" />

          <View style={styles.formActions}>
            {editing && (
              <TouchableOpacity style={styles.deleteBtn} onPress={() => { setShowModal(false); handleDelete(editing.id); }}>
                <Text style={styles.deleteBtnText}>Delete</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.saveBtn, formSaving && { opacity: 0.5 }]} onPress={handleSave} disabled={formSaving}>
              {formSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{editing ? 'Update' : 'Create'}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchRow: { padding: 12, paddingBottom: 4 },
  searchInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 10, fontSize: 14, color: '#0f172a' },
  filterRow: { flexDirection: 'row', padding: 12, paddingTop: 4, gap: 8 },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  filterActive: { backgroundColor: '#0284c7', borderColor: '#0284c7' },
  filterText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  filterTextActive: { color: '#fff' },
  txnRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 14, marginHorizontal: 12, marginBottom: 8, borderRadius: 12, gap: 12 },
  txnTypeBadge: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  txnTypeIcon: { fontSize: 18, fontWeight: '700' },
  txnDesc: { fontSize: 15, color: '#0f172a', fontWeight: '500' },
  txnMeta: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  txnAmount: { fontSize: 16, fontWeight: '700' },
  emptyText: { fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: 20 },
  swipeBar: { flexDirection: 'row', position: 'absolute', bottom: 20, left: 12, right: 12, gap: 8 },
  swipeBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  swipeBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  formContainer: { padding: 20 },
  formTypeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  formTypeBtn: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center', backgroundColor: '#f1f5f9' },
  formTypeText: { fontSize: 14, fontWeight: '600' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6, marginTop: 4 },
  fieldInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, fontSize: 15, color: '#0f172a', marginBottom: 8 },
  chipRow: { marginBottom: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff', marginRight: 8 },
  chipActive: { backgroundColor: '#0284c7', borderColor: '#0284c7' },
  chipText: { fontSize: 13, color: '#64748b' },
  chipTextActive: { color: '#fff' },
  formActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  saveBtn: { flex: 1, backgroundColor: '#0284c7', padding: 16, borderRadius: 10, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  deleteBtn: { padding: 16, borderRadius: 10, borderWidth: 1, borderColor: '#fecaca' },
  deleteBtnText: { color: '#dc2626', fontWeight: '600' },
});
