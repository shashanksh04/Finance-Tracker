import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Alert, Switch,
} from 'react-native';
import { recurringApi, accountsApi, categoriesApi } from '../services/api';
import { useHaptics } from '../hooks/useHaptics';
import { useOfflineList } from '../hooks/useOfflineData';
import { repository } from '../database/repository';
import { TABLES } from '../database/schema';
import { ListSkeleton } from '../components/ui/SkeletonLoader';
import Modal from '../components/ui/Modal';
import { formatCurrency, formatTransactionAmount, isIncome } from '../utils/format';
import type { RecurringTransaction, Account, Category } from '../types';
import { spacing, radius, fontSize, fontWeight, shadow } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

export default function RecurringScreen() {
  const { colors } = useTheme();
  const { success: hapticSuccess, light: hapticLight, heavy: hapticHeavy } = useHaptics();
  const { data: recurring, loading, refreshing, refresh, refreshFromApi } = useOfflineList<RecurringTransaction>(TABLES.RECURRING, {
    orderBy: 'next_date ASC',
    apiFetch: () => recurringApi.list(),
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

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<RecurringTransaction | null>(null);
  const [formDescription, setFormDescription] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formType, setFormType] = useState<'income' | 'expense'>('expense');
  const [formFrequency, setFormFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [formInterval, setFormInterval] = useState('1');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formAccountId, setFormAccountId] = useState('');
  const [formSaving, setFormSaving] = useState(false);

  const accountMap = useMemo(() => { const m: Record<string, Account> = {}; accounts.forEach((a) => { m[a.id] = a; }); return m; }, [accounts]);
  const categoryMap = useMemo(() => { const m: Record<string, Category> = {}; categories.forEach((c) => { m[c.id] = c; }); return m; }, [categories]);

  const openCreate = () => {
    setEditing(null); setFormDescription(''); setFormAmount(''); setFormType('expense');
    setFormFrequency('monthly'); setFormInterval('1'); setFormCategoryId(''); setFormAccountId(accounts[0]?.id || ''); setShowModal(true);
  };
  const openEdit = (r: RecurringTransaction) => {
    setEditing(r); setFormDescription(r.description || ''); setFormAmount(Math.abs(r.amount).toString());
    setFormType(isIncome(r) ? 'income' : 'expense'); setFormFrequency(r.frequency);
    setFormInterval(r.interval_value?.toString() || '1'); setFormCategoryId(r.category_id || '');
    setFormAccountId(r.account_id || ''); setShowModal(true);
  };

  const handleSave = async () => {
    if (!formAmount || !formAccountId) return;
    setFormSaving(true);
    try {
      const amount = formType === 'expense' ? -Math.abs(parseFloat(formAmount)) : Math.abs(parseFloat(formAmount));
      const data = { description: formDescription, amount, frequency: formFrequency, interval_value: parseInt(formInterval) || 1, category_id: formCategoryId || undefined, account_id: formAccountId };
      if (editing) { const res = await recurringApi.update(editing.id, data); await repository.update(TABLES.RECURRING, editing.id, res.data); }
      else { const res = await recurringApi.create(data); await repository.create(TABLES.RECURRING, res.data); }
      hapticSuccess(); setShowModal(false); refresh();
    } catch (err: any) { Alert.alert('Error', err.response?.data?.detail || 'Failed'); }
    finally { setFormSaving(false); }
  };

  const toggleActive = async (r: RecurringTransaction) => {
    try { await recurringApi.update(r.id, { is_active: !r.is_active }); await repository.update(TABLES.RECURRING, r.id, { is_active: !r.is_active }); hapticLight(); refresh(); } catch {}
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await recurringApi.delete(id); await repository.delete(TABLES.RECURRING, id); hapticHeavy(); refresh(); } },
    ]);
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    card: { backgroundColor: colors.card, margin: spacing.md, marginBottom: 0, padding: spacing.lg, borderRadius: radius.md, ...shadow.sm },
    cardRow: { flexDirection: 'row', justifyContent: 'space-between' },
    cardLeft: { flex: 1 },
    cardDesc: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.text },
    cardMeta: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 2 },
    cardNext: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
    cardRight: { alignItems: 'flex-end', gap: spacing.sm },
    cardAmount: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
    emptyState: { alignItems: 'center', padding: spacing.xxxl, paddingTop: 80 },
    emptyIcon: { fontSize: 48, marginBottom: spacing.md },
    emptyTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.text },
    emptySubtitle: { fontSize: fontSize.sm, color: colors.textTertiary, marginTop: spacing.xs },
    emptyAction: { marginTop: spacing.xl, backgroundColor: colors.primary, paddingHorizontal: spacing.xxl, paddingVertical: spacing.md, borderRadius: radius.md },
    emptyActionText: { color: colors.textInverse, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
    fab: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', elevation: 4 },
    fabText: { fontSize: 28, color: colors.textInverse, fontWeight: fontWeight.regular, marginTop: -2 },
    form: { padding: spacing.xl, maxHeight: 500 },
    label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textSecondary, marginBottom: spacing.sm, marginTop: spacing.xs },
    input: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: spacing.md, fontSize: fontSize.base, color: colors.text, marginBottom: spacing.sm },
    typeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
    typeBtn: { flex: 1, padding: spacing.sm, borderRadius: radius.sm, alignItems: 'center', backgroundColor: colors.border },
    typeBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
    freqRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
    freqBtn: { flex: 1, padding: spacing.sm, borderRadius: radius.sm, alignItems: 'center', backgroundColor: colors.border, borderWidth: 1, borderColor: colors.border },
    freqBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textSecondary },
    choiceChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, marginRight: spacing.sm, marginBottom: spacing.sm },
    choiceChipText: { fontSize: fontSize.sm, color: colors.textSecondary },
    formActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
    saveBtn: { flex: 1, backgroundColor: colors.primary, padding: spacing.lg, borderRadius: radius.md, alignItems: 'center' },
    saveBtnText: { color: colors.textInverse, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
    deleteBtn: { padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.dangerLight },
    deleteBtnText: { color: colors.danger, fontWeight: fontWeight.semibold },
  }), [colors, spacing, radius, fontSize, fontWeight]);

  if (loading) return <ListSkeleton />;

  return (
    <View style={styles.container}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshFromApi} />}>
        {recurring.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔄</Text>
            <Text style={styles.emptyTitle}>No recurring transactions</Text>
            <Text style={styles.emptySubtitle}>Set up recurring income or expenses</Text>
            <TouchableOpacity style={styles.emptyAction} onPress={openCreate}><Text style={styles.emptyActionText}>Add First</Text></TouchableOpacity>
          </View>
        )}
        {recurring.map((r) => {
          const cat = r.category_id ? categoryMap[r.category_id] : undefined;
          const acct = r.account_id ? accountMap[r.account_id] : undefined;
          return (
            <TouchableOpacity key={r.id} style={styles.card} onPress={() => openEdit(r)} onLongPress={() => handleDelete(r.id)}>
              <View style={styles.cardRow}>
                <View style={styles.cardLeft}>
                  <Text style={styles.cardDesc}>{r.description || 'Untitled'}</Text>
                  <Text style={styles.cardMeta}>
                    {r.frequency}{r.interval_value && r.interval_value > 1 ? ` (every ${r.interval_value})` : ''}
                    {acct ? ` · ${acct.name}` : ''}{cat ? ` · ${cat.name}` : ''}
                  </Text>
                  <Text style={styles.cardNext}>Next: {r.next_date || 'N/A'}</Text>
                </View>
                <View style={styles.cardRight}>
                  <Text style={[styles.cardAmount, { color: isIncome(r) ? colors.success : colors.danger }]}>
                    {formatTransactionAmount(r)}
                  </Text>
                  <Switch value={r.is_active} onValueChange={() => toggleActive(r)} trackColor={{ false: colors.border, true: colors.primaryLight }} thumbColor={r.is_active ? colors.primary : colors.textTertiary} />
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
        <View style={{ height: 80 }} />
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => { hapticLight(); openCreate(); }}><Text style={styles.fabText}>+</Text></TouchableOpacity>

      <Modal visible={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Recurring' : 'New Recurring'}>
        <ScrollView style={styles.form}>
          <Text style={styles.label}>Description</Text><TextInput style={styles.input} value={formDescription} onChangeText={setFormDescription} placeholder="Description" placeholderTextColor={colors.textTertiary} />
          <Text style={styles.label}>Amount</Text><TextInput style={styles.input} value={formAmount} onChangeText={setFormAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.textTertiary} />
          <Text style={styles.label}>Type</Text>
          <View style={styles.typeRow}>
            <TouchableOpacity style={[styles.typeBtn, formType === 'expense' && { backgroundColor: colors.danger }]} onPress={() => setFormType('expense')}>
              <Text style={[styles.typeBtnText, { color: formType === 'expense' ? colors.textInverse : colors.textSecondary }]}>Expense</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.typeBtn, formType === 'income' && { backgroundColor: colors.success }]} onPress={() => setFormType('income')}>
              <Text style={[styles.typeBtnText, { color: formType === 'income' ? colors.textInverse : colors.textSecondary }]}>Income</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.label}>Frequency</Text>
          <View style={styles.freqRow}>
            {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((f) => (
              <TouchableOpacity key={f} style={[styles.freqBtn, formFrequency === f && { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => setFormFrequency(f)}>
                <Text style={[styles.freqBtnText, formFrequency === f && { color: colors.textInverse }]}>{f.charAt(0).toUpperCase() + f.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.label}>Every (interval)</Text>
          <TextInput style={styles.input} value={formInterval} onChangeText={setFormInterval} keyboardType="number-pad" placeholder="1" placeholderTextColor={colors.textTertiary} />
          <Text style={styles.label}>Account</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {accounts.map((a) => (
              <TouchableOpacity key={a.id} style={[styles.choiceChip, formAccountId === a.id && { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => setFormAccountId(a.id)}>
                <Text style={[styles.choiceChipText, formAccountId === a.id && { color: colors.textInverse }]}>{a.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={styles.label}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {categories.filter((c) => c.type === formType).map((c) => (
              <TouchableOpacity key={c.id} style={[styles.choiceChip, formCategoryId === c.id && { backgroundColor: c.color || colors.primary, borderColor: c.color || colors.primary }]} onPress={() => setFormCategoryId(c.id)}>
                <Text style={[styles.choiceChipText, formCategoryId === c.id && { color: colors.textInverse }]}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.formActions}>
            {editing && (<TouchableOpacity style={styles.deleteBtn} onPress={() => { setShowModal(false); handleDelete(editing.id); }}><Text style={styles.deleteBtnText}>Delete</Text></TouchableOpacity>)}
            <TouchableOpacity style={[styles.saveBtn, formSaving && { opacity: 0.5 }]} onPress={handleSave} disabled={formSaving}>
              {formSaving ? <ActivityIndicator color={colors.textInverse} /> : <Text style={styles.saveBtnText}>{editing ? 'Update' : 'Create'}</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Modal>
    </View>
  );
}

