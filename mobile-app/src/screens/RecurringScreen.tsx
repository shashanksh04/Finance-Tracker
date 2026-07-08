import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, TextInput, Alert, Switch } from 'react-native';
import { recurringApi, accountsApi, categoriesApi } from '../services/api';
import { useHaptics } from '../hooks/useHaptics';
import Modal from '../components/ui/Modal';
import { formatCurrency, formatDate } from '../utils/format';
import type { RecurringTransaction, Account, Category, RecurrenceType, TransactionType } from '../types';

const RECURRENCE_OPTIONS: RecurrenceType[] = ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'];

export default function RecurringScreen() {
  const { success: hapticSuccess, light: hapticLight, heavy: hapticHeavy } = useHaptics();
  const [items, setItems] = useState<RecurringTransaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<RecurringTransaction | null>(null);
  const [formDescription, setFormDescription] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formType, setFormType] = useState<TransactionType>('expense');
  const [formFrequency, setFormFrequency] = useState<RecurrenceType>('monthly');
  const [formAccountId, setFormAccountId] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formNextDate, setFormNextDate] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [formSaving, setFormSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [rRes, aRes, cRes] = await Promise.all([recurringApi.list(), accountsApi.list(), categoriesApi.list()]);
      setItems(rRes.data?.items || rRes.data || []);
      setAccounts(aRes.data?.items || aRes.data || []);
      setCategories(cRes.data?.items || cRes.data || []);
    } catch {
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => {
    setEditing(null); setFormDescription(''); setFormAmount(''); setFormType('expense'); setFormFrequency('monthly');
    setFormAccountId(accounts[0]?.id || ''); setFormCategoryId(''); setFormNextDate(''); setFormActive(true); setShowModal(true);
  };

  const openEdit = (r: RecurringTransaction) => {
    setEditing(r); setFormDescription(r.description); setFormAmount(Math.abs(r.amount).toString()); setFormType(r.type);
    setFormFrequency(r.frequency); setFormAccountId(r.account_id); setFormCategoryId(r.category_id || '');
    setFormNextDate(r.next_date.slice(0, 10)); setFormActive(r.is_active); setShowModal(true);
  };

  const handleSave = async () => {
    if (!formDescription || !formAmount || !formAccountId) return;
    setFormSaving(true);
    try {
      const data = { description: formDescription, amount: parseFloat(formAmount), type: formType, frequency: formFrequency, account_id: formAccountId, category_id: formCategoryId || undefined, next_date: formNextDate || new Date().toISOString().slice(0, 10), is_active: formActive };
      if (editing) { await recurringApi.update(editing.id, data); }
      else { await recurringApi.create(data); }
      hapticSuccess(); setShowModal(false); fetchData();
    } catch (err: any) { Alert.alert('Error', err.response?.data?.detail || 'Failed'); }
    finally { setFormSaving(false); }
  };

  const toggleActive = async (r: RecurringTransaction) => {
    try { await recurringApi.update(r.id, { is_active: !r.is_active }); hapticLight(); fetchData(); }
    catch {}
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await recurringApi.delete(id); hapticHeavy(); fetchData(); } },
    ]);
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#0284c7" /></View>;

  return (
    <View style={styles.container}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}>
        {items.map((r) => (
          <TouchableOpacity key={r.id} style={styles.card} onPress={() => openEdit(r)} onLongPress={() => handleDelete(r.id)}>
            <View style={styles.cardHeader}>
              <View style={[styles.typeBadge, { backgroundColor: r.type === 'income' ? '#dcfce7' : '#fce7f3' }]}>
                <Text style={[styles.typeIcon, { color: r.type === 'income' ? '#10b981' : '#ef4444' }]}>{r.type === 'income' ? '↓' : '↑'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardDesc}>{r.description}</Text>
                <Text style={styles.cardMeta}>{r.frequency} · Next: {formatDate(r.next_date)}</Text>
              </View>
              <Switch value={r.is_active} onValueChange={() => toggleActive(r)} trackColor={{ false: '#e2e8f0', true: '#93c5fd' }} thumbColor={r.is_active ? '#0284c7' : '#94a3b8'} />
            </View>
            <View style={styles.cardFooter}>
              <Text style={[styles.cardAmount, { color: r.type === 'income' ? '#10b981' : '#ef4444' }]}>
                {r.type === 'income' ? '+' : '-'}{formatCurrency(Math.abs(r.amount))}
              </Text>
              {r.account && <Text style={styles.cardAccount}>{r.account.name}</Text>}
            </View>
          </TouchableOpacity>
        ))}
        {items.length === 0 && <Text style={styles.emptyText}>No recurring transactions yet. Tap + to create one.</Text>}
        <View style={{ height: 80 }} />
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => { hapticLight(); openCreate(); }}><Text style={styles.fabText}>+</Text></TouchableOpacity>

      <Modal visible={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Recurring' : 'New Recurring'}>
        <View style={styles.form}>
          <View style={styles.typeRow}>
            <TouchableOpacity style={[styles.typeBtn, formType === 'expense' && { backgroundColor: '#ef4444' }]} onPress={() => setFormType('expense')}>
              <Text style={[styles.typeBtnText, { color: formType === 'expense' ? '#fff' : '#64748b' }]}>Expense</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.typeBtn, formType === 'income' && { backgroundColor: '#10b981' }]} onPress={() => setFormType('income')}>
              <Text style={[styles.typeBtnText, { color: formType === 'income' ? '#fff' : '#64748b' }]}>Income</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.label}>Description</Text>
          <TextInput style={styles.input} value={formDescription} onChangeText={setFormDescription} placeholder="e.g. Salary" placeholderTextColor="#94a3b8" />
          <Text style={styles.label}>Amount</Text>
          <TextInput style={styles.input} value={formAmount} onChangeText={setFormAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#94a3b8" />
          <Text style={styles.label}>Frequency</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>{RECURRENCE_OPTIONS.map((f) => (
            <TouchableOpacity key={f} style={[styles.chip, formFrequency === f && styles.chipActive]} onPress={() => setFormFrequency(f)}>
              <Text style={[styles.chipText, formFrequency === f && styles.chipTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}</ScrollView>
          <Text style={styles.label}>Next Date</Text>
          <TextInput style={styles.input} value={formNextDate} onChangeText={setFormNextDate} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" />
          <Text style={styles.label}>Account</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>{accounts.map((a) => (
            <TouchableOpacity key={a.id} style={[styles.chip, formAccountId === a.id && styles.chipActive]} onPress={() => setFormAccountId(a.id)}>
              <Text style={[styles.chipText, formAccountId === a.id && styles.chipTextActive]}>{a.name}</Text>
            </TouchableOpacity>
          ))}</ScrollView>
          <Text style={styles.label}>Category (optional)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>{categories.filter((c) => c.type === formType).map((c) => (
            <TouchableOpacity key={c.id} style={[styles.chip, formCategoryId === c.id && styles.chipActive]} onPress={() => setFormCategoryId(formCategoryId === c.id ? '' : c.id)}>
              <Text style={[styles.chipText, formCategoryId === c.id && styles.chipTextActive]}>{c.name}</Text>
            </TouchableOpacity>
          ))}</ScrollView>
          <View style={styles.activeRow}>
            <Text style={styles.label}>Active</Text>
            <Switch value={formActive} onValueChange={setFormActive} trackColor={{ false: '#e2e8f0', true: '#93c5fd' }} thumbColor={formActive ? '#0284c7' : '#94a3b8'} />
          </View>
          <View style={styles.formActions}>
            {editing && (<TouchableOpacity style={styles.deleteBtn} onPress={() => { setShowModal(false); handleDelete(editing.id); }}><Text style={styles.deleteBtnText}>Delete</Text></TouchableOpacity>)}
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
  card: { backgroundColor: '#fff', margin: 12, marginBottom: 4, padding: 16, borderRadius: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  typeBadge: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  typeIcon: { fontSize: 16, fontWeight: '700' },
  cardDesc: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  cardMeta: { fontSize: 11, color: '#94a3b8', marginTop: 2, textTransform: 'capitalize' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  cardAmount: { fontSize: 17, fontWeight: '700' },
  cardAccount: { fontSize: 12, color: '#64748b' },
  emptyText: { fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: 20 },
  fab: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#0284c7', justifyContent: 'center', alignItems: 'center', elevation: 4 },
  fabText: { fontSize: 28, color: '#fff', fontWeight: '300', marginTop: -2 },
  form: { padding: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6, marginTop: 4 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, fontSize: 15, color: '#0f172a', marginBottom: 8 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  typeBtn: { flex: 1, padding: 10, borderRadius: 8, alignItems: 'center', backgroundColor: '#f1f5f9' },
  typeBtnText: { fontSize: 14, fontWeight: '600' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff', marginRight: 8, marginBottom: 8 },
  chipActive: { backgroundColor: '#0284c7', borderColor: '#0284c7' },
  chipText: { fontSize: 13, color: '#64748b' },
  chipTextActive: { color: '#fff' },
  activeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  formActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  saveBtn: { flex: 1, backgroundColor: '#0284c7', padding: 16, borderRadius: 10, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  deleteBtn: { padding: 16, borderRadius: 10, borderWidth: 1, borderColor: '#fecaca' },
  deleteBtnText: { color: '#dc2626', fontWeight: '600' },
});
