import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Alert,
} from 'react-native';
import { accountsApi } from '../services/api';
import { Account } from '../types';
import { formatCurrency } from '../utils/format';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import FormField from '../components/ui/FormField';

const ACCOUNT_COLORS: Record<string, string> = {
  checking: '#3b82f6', savings: '#10b981', credit: '#8b5cf6',
  investment: '#f59e0b', cash: '#06b6d4',
};

export default function AccountsScreen() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<Account['type']>('checking');
  const [balance, setBalance] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [saving, setSaving] = useState(false);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await accountsApi.getAll({ include_archived: true });
      setAccounts(res.data?.items || res.data || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchAccounts().finally(() => setLoading(false)); }, [fetchAccounts]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAccounts();
    setRefreshing(false);
  };

  const openCreate = () => {
    setEditing(null);
    setName(''); setType('checking'); setBalance(''); setCurrency('INR');
    setShowModal(true);
  };

  const openEdit = (a: Account) => {
    setEditing(a);
    setName(a.name); setType(a.type); setBalance(String(a.balance)); setCurrency(a.currency);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Error', 'Name is required'); return; }
    setSaving(true);
    try {
      const data = { name: name.trim(), type, balance: parseFloat(balance) || 0, currency };
      if (editing) {
        await accountsApi.update(editing.id, data);
      } else {
        await accountsApi.create(data);
      }
      setShowModal(false);
      await fetchAccounts();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to save account');
    } finally { setSaving(false); }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Account', 'This will also delete all transactions in this account. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await accountsApi.delete(id);
          await fetchAccounts();
        } catch (e: any) {
          Alert.alert('Error', e.response?.data?.detail || 'Delete failed');
        }
      }},
    ]);
  };

  const totalBalance = accounts.reduce((sum, a) => sum + Number(a.balance), 0);

  if (loading) return <LoadingSpinner message="Loading accounts..." />;

  return (
    <View style={styles.container}>
      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Total Balance</Text>
        <Text style={styles.totalAmount}>{formatCurrency(totalBalance)}</Text>
      </View>

      <FlatList
        data={accounts}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={accounts.length === 0 ? { flex: 1 } : { padding: 16, paddingTop: 8 }}
        ListEmptyComponent={<EmptyState title="No accounts" subtitle="Create your first account to start tracking" actionLabel="Add Account" onAction={openCreate} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.accountCard} onPress={() => openEdit(item)} onLongPress={() => handleDelete(item.id)}>
            <View style={[styles.typeDot, { backgroundColor: ACCOUNT_COLORS[item.type] || '#94a3b8' }]} />
            <View style={styles.accountInfo}>
              <Text style={styles.accountName}>{item.name}</Text>
              <Text style={styles.accountType}>{item.type}</Text>
            </View>
            <Text style={[styles.accountBalance, Number(item.balance) < 0 && { color: '#dc2626' }]}>
              {formatCurrency(Number(item.balance), item.currency)}
            </Text>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={openCreate}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Account' : 'New Account'}>
        <View style={styles.modalBody}>
          <FormField label="Account Name" value={name} onChangeText={setName} placeholder="e.g. Salary Account" />
          <Text style={styles.fieldLabel}>Type</Text>
          <View style={styles.typeRow}>
            {(['checking', 'savings', 'credit', 'investment', 'cash'] as const).map((t) => (
              <TouchableOpacity key={t} style={[styles.typeChip, type === t && { backgroundColor: '#0284c7' }]} onPress={() => setType(t)}>
                <Text style={[styles.typeChipText, type === t && { color: '#fff' }]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <FormField label="Balance" value={balance} onChangeText={setBalance} keyboardType="numeric" placeholder="0.00" />
          <FormField label="Currency" value={currency} onChangeText={setCurrency} placeholder="INR" />
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
  totalCard: { backgroundColor: '#0284c7', padding: 20, paddingTop: 16 },
  totalLabel: { fontSize: 14, color: '#bae6fd' },
  totalAmount: { fontSize: 32, fontWeight: '700', color: '#fff', marginTop: 4 },
  accountCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    padding: 16, borderRadius: 12, marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.03, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4,
    elevation: 1,
  },
  typeDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  accountInfo: { flex: 1 },
  accountName: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  accountType: { fontSize: 12, color: '#94a3b8', marginTop: 2, textTransform: 'capitalize' },
  accountBalance: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#0284c7',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#0284c7', shadowOpacity: 0.4, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8,
    elevation: 4,
  },
  fabText: { fontSize: 28, color: '#fff', marginTop: -2 },
  modalBody: { padding: 20 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 8 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  typeChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc',
  },
  typeChipText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  saveBtn: {
    backgroundColor: '#0284c7', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 8,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
