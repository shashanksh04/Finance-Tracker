import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Alert,
} from 'react-native';
import { recurringApi, accountsApi } from '../services/api';
import { RecurringTransaction, Account } from '../types';
import { formatCurrency, formatDate } from '../utils/format';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import FormField from '../components/ui/FormField';

export default function RecurringScreen() {
  const [items, setItems] = useState<RecurringTransaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<RecurringTransaction | null>(null);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [frequency, setFrequency] = useState<string>('monthly');
  const [accountId, setAccountId] = useState('');
  const [nextDate, setNextDate] = useState('');
  const [saving, setSaving] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const [rRes, aRes] = await Promise.all([recurringApi.getAll(), accountsApi.getAll()]);
      setItems(rRes.data || []);
      setAccounts(aRes.data?.items || aRes.data || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetch().finally(() => setLoading(false)); }, [fetch]);
  const onRefresh = async () => { setRefreshing(true); await fetch(); setRefreshing(false); };

  const openCreate = () => {
    setEditing(null); setDescription(''); setAmount(''); setType('expense');
    setFrequency('monthly'); setAccountId(''); setNextDate('');
    setShowModal(true);
  };

  const openEdit = (r: RecurringTransaction) => {
    setEditing(r); setDescription(r.description); setAmount(String(r.amount));
    setType(r.type as 'income' | 'expense'); setFrequency(r.frequency);
    setAccountId(r.account_id); setNextDate(r.next_date);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!description.trim() || !amount || !accountId || !nextDate) {
      Alert.alert('Error', 'Please fill all required fields'); return;
    }
    setSaving(true);
    try {
      const data = { description: description.trim(), amount: parseFloat(amount), type, frequency, account_id: accountId, next_date: nextDate };
      if (editing) await recurringApi.update(editing.id, data);
      else await recurringApi.create(data);
      setShowModal(false); await fetch();
    } catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const toggleActive = async (item: RecurringTransaction) => {
    try {
      await recurringApi.update(item.id, { ...item, is_active: !item.is_active });
      await fetch();
    } catch (e: any) { Alert.alert('Error', 'Failed to update'); }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Recurring', 'Related future transactions will also be removed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await recurringApi.delete(id); await fetch(); }
        catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Delete failed'); }
      }},
    ]);
  };

  const getAccountName = (id: string) => accounts.find((a) => a.id === id)?.name || 'Unknown';

  if (loading) return <LoadingSpinner message="Loading recurring..." />;

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={items.length === 0 ? { flex: 1 } : { padding: 16 }}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Recurring Transactions</Text>
            <Text style={styles.subtitle}>{items.filter((i) => i.is_active).length} active templates</Text>
          </View>
        }
        ListEmptyComponent={<EmptyState title="No recurring transactions" subtitle="Set up recurring bills or income" actionLabel="Add Recurring" onAction={openCreate} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.card, !item.is_active && styles.cardInactive]} onPress={() => openEdit(item)} onLongPress={() => handleDelete(item.id)}>
            <View style={styles.cardRow}>
              <View style={[styles.typeIcon, { backgroundColor: item.type === 'income' ? '#dcfce7' : '#fef2f2' }]}>
                <Text style={styles.typeIconText}>{item.type === 'income' ? '↑' : '↓'}</Text>
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.desc}>{item.description}</Text>
                <Text style={styles.meta}>{getAccountName(item.account_id)} · {item.frequency}</Text>
                <Text style={styles.nextDate}>Next: {formatDate(item.next_date)}</Text>
              </View>
              <View style={styles.rightCol}>
                <Text style={[styles.amount, { color: item.type === 'income' ? '#16a34a' : '#dc2626' }]}>
                  {formatCurrency(Number(item.amount))}
                </Text>
                <TouchableOpacity
                  style={[styles.toggleBtn, item.is_active ? styles.toggleActive : styles.toggleInactive]}
                  onPress={() => toggleActive(item)}
                >
                  <Text style={[styles.toggleText, !item.is_active && { color: '#94a3b8' }]}>
                    {item.is_active ? 'Active' : 'Paused'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={openCreate}><Text style={styles.fabText}>+</Text></TouchableOpacity>

      <Modal visible={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Recurring' : 'New Recurring'}>
        <View style={styles.modalBody}>
          <FormField label="Description" value={description} onChangeText={setDescription} placeholder="e.g. Rent" />
          <FormField label="Amount" value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="15000" />
          <Text style={styles.fieldLabel}>Type</Text>
          <View style={styles.typeRow}>
            <TouchableOpacity style={[styles.typeBtn, type === 'expense' && styles.typeActive]} onPress={() => setType('expense')}>
              <Text style={[styles.typeBtnText, type === 'expense' && { color: '#fff' }]}>Expense</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.typeBtn, type === 'income' && styles.typeActive]} onPress={() => setType('income')}>
              <Text style={[styles.typeBtnText, type === 'income' && { color: '#fff' }]}>Income</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.fieldLabel}>Frequency</Text>
          <View style={styles.freqRow}>
            {['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'].map((f) => (
              <TouchableOpacity key={f} style={[styles.freqChip, frequency === f && { backgroundColor: '#0284c7' }]} onPress={() => setFrequency(f)}>
                <Text style={[styles.freqChipText, frequency === f && { color: '#fff' }]}>{f.charAt(0).toUpperCase() + f.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.fieldLabel}>Account</Text>
          <View style={styles.accountRow}>
            {accounts.slice(0, 10).map((a) => (
              <TouchableOpacity key={a.id} style={[styles.accChip, accountId === a.id && { backgroundColor: '#0284c7' }]} onPress={() => setAccountId(a.id)}>
                <Text style={[styles.accChipText, accountId === a.id && { color: '#fff' }]}>{a.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <FormField label="Next Date (YYYY-MM-DD)" value={nextDate} onChangeText={setNextDate} placeholder="2026-08-01" />
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
  header: { marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  subtitle: { fontSize: 14, color: '#94a3b8', marginTop: 2 },
  card: { backgroundColor: '#fff', padding: 14, borderRadius: 10, marginBottom: 8 },
  cardInactive: { opacity: 0.6 },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  typeIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  typeIconText: { fontSize: 16, fontWeight: '700' },
  cardInfo: { flex: 1 },
  desc: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  meta: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  nextDate: { fontSize: 11, color: '#64748b', marginTop: 1 },
  rightCol: { alignItems: 'flex-end' },
  amount: { fontSize: 15, fontWeight: '700' },
  toggleBtn: { marginTop: 4, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  toggleActive: { backgroundColor: '#dcfce7' },
  toggleInactive: { backgroundColor: '#f1f5f9' },
  toggleText: { fontSize: 11, color: '#16a34a', fontWeight: '600' },
  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#0284c7',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#0284c7', shadowOpacity: 0.4, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, elevation: 4,
  },
  fabText: { fontSize: 28, color: '#fff', marginTop: -2 },
  modalBody: { padding: 20 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 8, marginTop: 4 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  typeActive: { backgroundColor: '#0284c7', borderColor: '#0284c7' },
  typeBtnText: { fontSize: 14, color: '#64748b', fontWeight: '500' },
  freqRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  freqChip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  freqChipText: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  accountRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  accChip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  accChipText: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  saveBtn: { backgroundColor: '#0284c7', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
