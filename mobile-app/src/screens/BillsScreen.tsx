import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Alert, Switch,
} from 'react-native';
import { billsApi } from '../services/api';
import { useHaptics } from '../hooks/useHaptics';
import { useOfflineList } from '../hooks/useOfflineData';
import { repository } from '../database/repository';
import { TABLES } from '../database/schema';
import { CardSkeleton } from '../components/ui/SkeletonLoader';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import { formatCurrency, formatDate, daysUntil } from '../utils/format';
import type { Bill } from '../types';
import { spacing, radius, fontSize, fontWeight, shadow } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

export default function BillsScreen() {
  const { colors } = useTheme();
  const { success: hapticSuccess, light: hapticLight, heavy: hapticHeavy } = useHaptics();
  const { data: bills, loading, refreshing, refresh, refreshFromApi } = useOfflineList<Bill>(TABLES.BILLS, {
    orderBy: 'due_date ASC',
    apiFetch: () => billsApi.list(),
    mapApiResponse: (res) => res.data?.items || res.data || [],
  });

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Bill | null>(null);
  const [formName, setFormName] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formDueDate, setFormDueDate] = useState('');
  const [formRecurrence, setFormRecurrence] = useState<string>('');
  const [formReminderDays, setFormReminderDays] = useState('3');
  const [formSaving, setFormSaving] = useState(false);

  const openCreate = () => {
    setEditing(null); setFormName(''); setFormAmount(''); setFormDueDate(new Date().toISOString().slice(0, 10));
    setFormRecurrence(''); setFormReminderDays('3'); setShowModal(true);
  };
  const openEdit = (b: Bill) => {
    setEditing(b); setFormName(b.name); setFormAmount(b.amount.toString());
    setFormDueDate(b.due_date); setFormRecurrence(b.recurrence || ''); setFormReminderDays(b.reminder_days_before.toString()); setShowModal(true);
  };

  const handleSave = async () => {
    if (!formName || !formAmount || !formDueDate) return;
    setFormSaving(true);
    try {
      const data = { name: formName, amount: parseFloat(formAmount), due_date: formDueDate, recurrence: formRecurrence || undefined, reminder_days_before: parseInt(formReminderDays) || 3 };
      if (editing) {
        const res = await billsApi.update(editing.id, data);
        await repository.update(TABLES.BILLS, editing.id, res.data);
      } else {
        const res = await billsApi.create(data);
        await repository.create(TABLES.BILLS, res.data);
      }
      hapticSuccess(); setShowModal(false); refresh();
    } catch (err: any) { Alert.alert('Error', err.response?.data?.detail || 'Failed'); }
    finally { setFormSaving(false); }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Bill', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await billsApi.delete(id); await repository.delete(TABLES.BILLS, id); hapticHeavy(); refresh(); } },
    ]);
  };

  const handleTogglePaid = async (bill: Bill) => {
    if (!bill.id) return;
    try {
      const res = await billsApi.update(bill.id, { is_paid: bill.is_paid ? 0 : 1, paid_date: bill.is_paid ? null : new Date().toISOString().slice(0, 10) });
      await repository.update(TABLES.BILLS, bill.id, res.data);
      hapticSuccess(); refresh();
    } catch { Alert.alert('Error', 'Failed to toggle bill status.'); }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    card: { backgroundColor: colors.card, margin: spacing.md, marginBottom: 0, padding: spacing.lg, borderRadius: radius.md, ...shadow.sm },
    cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    cardInfo: { flex: 1 },
    cardName: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.text },
    cardMeta: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 2 },
    cardAmount: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, minWidth: 80, textAlign: 'right' },
    cardActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
    dueBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm },
    dueText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
    editLink: { fontSize: fontSize.sm, color: colors.primary, fontWeight: fontWeight.medium },
    fab: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', elevation: 4 },
    fabText: { fontSize: 28, color: colors.textInverse, fontWeight: fontWeight.regular, marginTop: -2 },
    form: { padding: spacing.xl },
    label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textSecondary, marginBottom: spacing.sm, marginTop: spacing.xs },
    input: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: spacing.md, fontSize: fontSize.base, color: colors.text, marginBottom: spacing.sm },
    periodRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
    periodBtn: { flex: 1, padding: spacing.sm, borderRadius: radius.sm, alignItems: 'center', backgroundColor: colors.border },
    periodBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textSecondary, textTransform: 'capitalize' },
    formActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
    saveBtn: { flex: 1, backgroundColor: colors.primary, padding: spacing.lg, borderRadius: radius.md, alignItems: 'center' },
    saveBtnText: { color: colors.textInverse, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
    deleteBtn: { padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.dangerLight },
    deleteBtnText: { color: colors.danger, fontWeight: fontWeight.semibold },
  }), [colors, spacing, radius, fontSize, fontWeight]);

  if (loading) return <CardSkeleton />;

  return (
    <View style={styles.container}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshFromApi} />}>
        {bills.length === 0 && <EmptyState icon="📄" title="No bills yet" subtitle="Add bills to get reminders before they're due" actionLabel="Add Bill" onAction={openCreate} />}

        {bills.map((b) => {
          const days = b.due_date ? daysUntil(b.due_date) : 0;
          const isOverdue = days < 0 && !b.is_paid;
          const isDueSoon = days >= 0 && days <= b.reminder_days_before && !b.is_paid;
          return (
            <View key={b.id} style={[styles.card, b.is_paid && { opacity: 0.6 }]}>
              <View style={styles.cardRow}>
                <Switch value={!!b.is_paid} onValueChange={() => handleTogglePaid(b)} />
                <View style={styles.cardInfo}>
                  <Text style={[styles.cardName, b.is_paid && { textDecorationLine: 'line-through' }]}>{b.name}</Text>
                  <Text style={styles.cardMeta}>
                    {b.is_paid ? `Paid ${b.paid_date ? formatDate(b.paid_date) : ''}` : `Due ${formatDate(b.due_date)}`}
                    {b.recurrence ? ` · ${b.recurrence}` : ''}
                  </Text>
                </View>
                <Text style={[styles.cardAmount, b.is_paid ? { color: colors.success } : { color: colors.text }]}>
                  {formatCurrency(b.amount)}
                </Text>
              </View>
              {!b.is_paid && (
                <View style={styles.cardActions}>
                  <View style={[styles.dueBadge, { backgroundColor: isOverdue ? colors.dangerLight : isDueSoon ? colors.warningLight : colors.successLight }]}>
                    <Text style={[styles.dueText, { color: isOverdue ? colors.danger : isDueSoon ? colors.warning : colors.success }]}>
                      {isOverdue ? `${Math.abs(days)}d overdue` : isDueSoon ? `${days}d left` : `${days}d away`}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => openEdit(b)}><Text style={styles.editLink}>Edit</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(b.id)}><Text style={[styles.editLink, { color: colors.danger }]}>Delete</Text></TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
        <View style={{ height: 80 }} />
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => { hapticLight(); openCreate(); }}><Text style={styles.fabText}>+</Text></TouchableOpacity>

      <Modal visible={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Bill' : 'New Bill'}>
        <View style={styles.form}>
          <Text style={styles.label}>Name</Text><TextInput style={styles.input} value={formName} onChangeText={setFormName} placeholder="Bill name" placeholderTextColor={colors.textTertiary} />
          <Text style={styles.label}>Amount</Text><TextInput style={styles.input} value={formAmount} onChangeText={setFormAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.textTertiary} />
          <Text style={styles.label}>Due Date</Text><TextInput style={styles.input} value={formDueDate} onChangeText={setFormDueDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textTertiary} />
          <Text style={styles.label}>Recurrence (optional)</Text>
          <View style={styles.periodRow}>
            {['', 'monthly', 'quarterly', 'yearly'].map((r) => (
              <TouchableOpacity key={r} style={[styles.periodBtn, formRecurrence === r && { backgroundColor: colors.primary }]} onPress={() => setFormRecurrence(r)}>
                <Text style={[styles.periodBtnText, formRecurrence === r && { color: colors.textInverse }]}>{r || 'One-time'}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.label}>Reminder days before</Text>
          <TextInput style={styles.input} value={formReminderDays} onChangeText={setFormReminderDays} keyboardType="number-pad" placeholder="3" placeholderTextColor={colors.textTertiary} />
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

