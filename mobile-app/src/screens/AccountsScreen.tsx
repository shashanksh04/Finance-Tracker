import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Alert,
} from 'react-native';
import { accountsApi } from '../services/api';
import { useHaptics } from '../hooks/useHaptics';
import Modal from '../components/ui/Modal';
import { formatCurrency } from '../utils/format';
import type { Account, AccountType } from '../types';

const ACCOUNT_TYPES: { key: AccountType; label: string; color: string }[] = [
  { key: 'checking', label: 'Checking', color: '#0284c7' },
  { key: 'savings', label: 'Savings', color: '#10b981' },
  { key: 'credit', label: 'Credit Card', color: '#ef4444' },
  { key: 'cash', label: 'Cash', color: '#f59e0b' },
  { key: 'investment', label: 'Investment', color: '#8b5cf6' },
  { key: 'loan', label: 'Loan', color: '#ec4899' },
  { key: 'other', label: 'Other', color: '#64748b' },
];

export default function AccountsScreen() {
  const { success: hapticSuccess, light: hapticLight, heavy: hapticHeavy } = useHaptics();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [formName, setFormName] = useState('');
  const [formBalance, setFormBalance] = useState('');
  const [formType, setFormType] = useState<AccountType>('checking');
  const [formColor, setFormColor] = useState('#0284c7');
  const [formSaving, setFormSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await accountsApi.list();
      setAccounts(res.data?.items || res.data || []);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

  const openCreate = () => {
    setEditing(null);
    setFormName('');
    setFormBalance('');
    setFormType('checking');
    setFormColor('#0284c7');
    setShowModal(true);
  };

  const openEdit = (a: Account) => {
    setEditing(a);
    setFormName(a.name);
    setFormBalance(a.balance.toString());
    setFormType(a.type);
    setFormColor(a.color || '#0284c7');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formName || !formBalance) return;
    setFormSaving(true);
    try {
      const data = { name: formName, balance: parseFloat(formBalance), type: formType, color: formColor };
      if (editing) {
        await accountsApi.update(editing.id, data);
      } else {
        await accountsApi.create(data);
      }
      hapticSuccess();
      setShowModal(false);
      fetchData();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to save account');
    } finally {
      setFormSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Account', 'Transactions in this account will also be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await accountsApi.delete(id); hapticHeavy(); fetchData(); } },
    ]);
  };

  const handleSplitReminder = (amount: number, name: string) => {
    const splitAmount = (amount / 2).toFixed(0);
    Alert.alert(
      'Split Payment',
      `You spent ${formatCurrency(amount)} at ${name}. Remind someone?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'WhatsApp', onPress: () => Alert.alert('Deep Link', `whatsapp://send?text=Hey! You owe me ${formatCurrency(parseFloat(splitAmount))} for ${name}`) },
        { text: 'Telegram', onPress: () => Alert.alert('Deep Link', `tg://msg?text=Hey! You owe me ${formatCurrency(parseFloat(splitAmount))} for ${name}`) },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0284c7" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Total Balance</Text>
        <Text style={styles.totalValue}>{formatCurrency(totalBalance)}</Text>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
      >
        {accounts.map((a) => {
          const typeInfo = ACCOUNT_TYPES.find((t) => t.key === a.type) || ACCOUNT_TYPES[6];
          return (
            <TouchableOpacity key={a.id} style={styles.accountRow} onPress={() => openEdit(a)} onLongPress={() => handleSplitReminder(a.balance, a.name)}>
              <View style={[styles.accountIcon, { backgroundColor: a.color || typeInfo.color + '20' }]}>
                <Text style={[styles.accountTypeIcon, { color: a.color || typeInfo.color }]}>
                  {a.type === 'checking' ? '🏦' : a.type === 'savings' ? '💰' : a.type === 'credit' ? '💳' : a.type === 'cash' ? '💵' : a.type === 'investment' ? '📈' : a.type === 'loan' ? '🏠' : '📦'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.accountName}>{a.name}</Text>
                <Text style={styles.accountType}>{typeInfo.label}</Text>
              </View>
              <Text style={[styles.accountBalance, a.balance < 0 ? { color: '#ef4444' } : { color: '#0f172a' }]}>
                {formatCurrency(a.balance)}
              </Text>
            </TouchableOpacity>
          );
        })}
        {accounts.length === 0 && (
          <Text style={styles.emptyText}>No accounts yet. Tap + to add one.</Text>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => { hapticLight(); openCreate(); }}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Account' : 'New Account'}>
        <View style={styles.formContainer}>
          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput style={styles.fieldInput} value={formName} onChangeText={setFormName} placeholder="Account name" placeholderTextColor="#94a3b8" />

          <Text style={styles.fieldLabel}>Balance</Text>
          <TextInput style={styles.fieldInput} value={formBalance} onChangeText={setFormBalance} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#94a3b8" />

          <Text style={styles.fieldLabel}>Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {ACCOUNT_TYPES.map((t) => (
              <TouchableOpacity key={t.key} style={[styles.typeChip, formType === t.key && { backgroundColor: t.color, borderColor: t.color }]} onPress={() => { setFormType(t.key); setFormColor(t.color); }}>
                <Text style={[styles.typeChipText, formType === t.key && { color: '#fff' }]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

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
  totalCard: { backgroundColor: '#0284c7', padding: 20, alignItems: 'center' },
  totalLabel: { fontSize: 13, color: '#bfdbfe', fontWeight: '500' },
  totalValue: { fontSize: 32, fontWeight: '700', color: '#fff', marginTop: 4 },
  accountRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, marginHorizontal: 16, marginTop: 12, borderRadius: 12, gap: 14 },
  accountIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  accountTypeIcon: { fontSize: 20 },
  accountName: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  accountType: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  accountBalance: { fontSize: 17, fontWeight: '700' },
  emptyText: { fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: 20 },
  fab: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#0284c7', justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
  fabText: { fontSize: 28, color: '#fff', fontWeight: '300', marginTop: -2 },
  formContainer: { padding: 20 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6, marginTop: 4 },
  fieldInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, fontSize: 15, color: '#0f172a', marginBottom: 8 },
  typeChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff', marginRight: 8, marginBottom: 8 },
  typeChipText: { fontSize: 13, color: '#64748b' },
  formActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  saveBtn: { flex: 1, backgroundColor: '#0284c7', padding: 16, borderRadius: 10, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  deleteBtn: { padding: 16, borderRadius: 10, borderWidth: 1, borderColor: '#fecaca' },
  deleteBtnText: { color: '#dc2626', fontWeight: '600' },
});
