import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Alert,
} from 'react-native';
import { accountsApi } from '../services/api';
import { useHaptics } from '../hooks/useHaptics';
import { useOfflineList } from '../hooks/useOfflineData';
import { repository } from '../database/repository';
import { TABLES } from '../database/schema';
import { ListSkeleton } from '../components/ui/SkeletonLoader';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import { formatCurrency } from '../utils/format';
import type { Account, AccountType } from '../types';
import { colors, spacing, radius, fontSize, fontWeight, shadow } from '../theme/tokens';

const ACCOUNT_TYPES: { key: AccountType; label: string; color: string; icon: string }[] = [
  { key: 'checking', label: 'Checking', color: '#0284c7', icon: '🏦' },
  { key: 'savings', label: 'Savings', color: '#10b981', icon: '💰' },
  { key: 'credit', label: 'Credit Card', color: '#ef4444', icon: '💳' },
  { key: 'cash', label: 'Cash', color: '#f59e0b', icon: '💵' },
  { key: 'investment', label: 'Investment', color: '#8b5cf6', icon: '📈' },
  { key: 'loan', label: 'Loan', color: '#ec4899', icon: '🏠' },
  { key: 'other', label: 'Other', color: '#64748b', icon: '📦' },
];

export default function AccountsScreen() {
  const { success: hapticSuccess, light: hapticLight, heavy: hapticHeavy } = useHaptics();
  const { data: accounts, loading, refreshing, refresh, refreshFromApi } = useOfflineList<Account>(TABLES.ACCOUNTS, {
    orderBy: 'balance DESC',
    apiFetch: () => accountsApi.list(),
    mapApiResponse: (res) => res.data?.items || res.data || [],
  });

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [formName, setFormName] = useState('');
  const [formBalance, setFormBalance] = useState('');
  const [formType, setFormType] = useState<AccountType>('checking');
  const [formColor, setFormColor] = useState('#0284c7');
  const [formSaving, setFormSaving] = useState(false);

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

  const openCreate = () => {
    setEditing(null); setFormName(''); setFormBalance(''); setFormType('checking'); setFormColor('#0284c7'); setShowModal(true);
  };
  const openEdit = (a: Account) => {
    setEditing(a); setFormName(a.name); setFormBalance(a.balance.toString()); setFormType(a.type); setFormColor(a.color || '#0284c7'); setShowModal(true);
  };

  const handleSave = async () => {
    if (!formName || !formBalance) return;
    setFormSaving(true);
    try {
      const data = { name: formName, balance: parseFloat(formBalance), type: formType, color: formColor };
      if (editing) {
        const res = await accountsApi.update(editing.id, data);
        await repository.update(TABLES.ACCOUNTS, editing.id, res.data);
      } else {
        const res = await accountsApi.create(data);
        await repository.create(TABLES.ACCOUNTS, res.data);
      }
      hapticSuccess(); setShowModal(false); refresh();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to save account');
    } finally { setFormSaving(false); }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Account', 'Transactions in this account will also be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await accountsApi.delete(id); await repository.delete(TABLES.ACCOUNTS, id); hapticHeavy(); refresh(); } },
    ]);
  };

  if (loading) return <ListSkeleton />;

  return (
    <View style={styles.container}>
      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Total Balance</Text>
        <Text style={styles.totalValue}>{formatCurrency(totalBalance)}</Text>
        <Text style={styles.totalCount}>{accounts.length} account{accounts.length !== 1 ? 's' : ''}</Text>
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshFromApi} />}>
        {accounts.map((a) => {
          const typeInfo = ACCOUNT_TYPES.find((t) => t.key === a.type) || ACCOUNT_TYPES[6];
          return (
            <TouchableOpacity key={a.id} style={styles.accountRow} onPress={() => openEdit(a)}>
              <View style={[styles.accountIcon, { backgroundColor: (a.color || typeInfo.color) + '20' }]}>
                <Text style={styles.accountIconText}>{typeInfo.icon}</Text>
              </View>
              <View style={styles.accountInfo}>
                <Text style={styles.accountName}>{a.name}</Text>
                <Text style={styles.accountType}>{typeInfo.label}</Text>
              </View>
              <Text style={[styles.accountBalance, a.balance < 0 ? { color: colors.danger } : { color: colors.text }]}>
                {formatCurrency(a.balance)}
              </Text>
            </TouchableOpacity>
          );
        })}
        {accounts.length === 0 && <EmptyState icon="🏦" title="No accounts yet" subtitle="Tap + to add your first account" actionLabel="Add Account" onAction={openCreate} />}
        <View style={{ height: 100 }} />
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => { hapticLight(); openCreate(); }}><Text style={styles.fabText}>+</Text></TouchableOpacity>

      <Modal visible={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Account' : 'New Account'}>
        <View style={styles.form}>
          <Text style={styles.label}>Name</Text>
          <TextInput style={styles.input} value={formName} onChangeText={setFormName} placeholder="Account name" placeholderTextColor={colors.textTertiary} />
          <Text style={styles.label}>Balance</Text>
          <TextInput style={styles.input} value={formBalance} onChangeText={setFormBalance} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.textTertiary} />
          <Text style={styles.label}>Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {ACCOUNT_TYPES.map((t) => (
              <TouchableOpacity key={t.key} style={[styles.typeChip, formType === t.key && { backgroundColor: t.color, borderColor: t.color }]} onPress={() => { setFormType(t.key); setFormColor(t.color); }}>
                <Text style={styles.typeChipIcon}>{t.icon}</Text>
                <Text style={[styles.typeChipText, formType === t.key && { color: colors.textInverse }]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.formActions}>
            {editing && (<TouchableOpacity style={styles.deleteBtn} onPress={() => { setShowModal(false); handleDelete(editing.id); }}><Text style={styles.deleteBtnText}>Delete</Text></TouchableOpacity>)}
            <TouchableOpacity style={[styles.saveBtn, formSaving && { opacity: 0.5 }]} onPress={handleSave} disabled={formSaving}>
              {formSaving ? <ActivityIndicator color={colors.textInverse} /> : <Text style={styles.saveBtnText}>{editing ? 'Update' : 'Create'}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  totalCard: { backgroundColor: colors.primary, padding: spacing.xl, alignItems: 'center' },
  totalLabel: { fontSize: fontSize.sm, color: '#bfdbfe', fontWeight: fontWeight.medium },
  totalValue: { fontSize: fontSize.hero, fontWeight: fontWeight.bold, color: colors.textInverse, marginTop: spacing.xs },
  totalCount: { fontSize: fontSize.xs, color: '#bfdbfe', marginTop: spacing.xs },
  accountRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    padding: spacing.lg, marginHorizontal: spacing.md, marginTop: spacing.md,
    borderRadius: radius.md, gap: spacing.lg, ...shadow.sm,
  },
  accountIcon: { width: 48, height: 48, borderRadius: radius.xl, justifyContent: 'center', alignItems: 'center' },
  accountIconText: { fontSize: 22 },
  accountInfo: { flex: 1 },
  accountName: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.text },
  accountType: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 2 },
  accountBalance: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  fab: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', elevation: 4 },
  fabText: { fontSize: 28, color: colors.textInverse, fontWeight: fontWeight.regular, marginTop: -2 },
  form: { padding: spacing.xl },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textSecondary, marginBottom: spacing.sm, marginTop: spacing.xs },
  input: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: spacing.md, fontSize: fontSize.base, color: colors.text, marginBottom: spacing.sm },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, marginRight: spacing.sm, marginBottom: spacing.sm },
  typeChipIcon: { fontSize: 16 },
  typeChipText: { fontSize: fontSize.sm, color: colors.textSecondary },
  formActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  saveBtn: { flex: 1, backgroundColor: colors.primary, padding: spacing.lg, borderRadius: radius.md, alignItems: 'center' },
  saveBtnText: { color: colors.textInverse, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  deleteBtn: { padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.dangerLight },
  deleteBtnText: { color: colors.danger, fontWeight: fontWeight.semibold },
});
