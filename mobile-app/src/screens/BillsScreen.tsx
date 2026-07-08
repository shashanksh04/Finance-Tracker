import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, TextInput, Alert } from 'react-native';
import { billsApi } from '../services/api';
import { useHaptics } from '../hooks/useHaptics';
import Modal from '../components/ui/Modal';
import { formatCurrency, formatDate, daysUntil, isOverdue } from '../utils/format';
import type { Bill, RecurrenceType } from '../types';

const RECURRENCE: RecurrenceType[] = ['monthly', 'weekly', 'quarterly', 'yearly'];

export default function BillsScreen() {
  const { success: hapticSuccess, heavy: hapticHeavy } = useHaptics();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showUnpaid, setShowUnpaid] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Bill | null>(null);
  const [formName, setFormName] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formDueDate, setFormDueDate] = useState('');
  const [formRecurrence, setFormRecurrence] = useState<RecurrenceType>('monthly');
  const [formReminder, setFormReminder] = useState('3');
  const [formSaving, setFormSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await billsApi.list({ unpaid_only: showUnpaid ? undefined : undefined });
      setBills(res.data?.items || res.data || []);
    } catch {
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [showUnpaid]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => {
    setEditing(null); setFormName(''); setFormAmount(''); setFormDueDate(''); setFormRecurrence('monthly'); setFormReminder('3'); setShowModal(true);
  };

  const openEdit = (b: Bill) => {
    setEditing(b); setFormName(b.name); setFormAmount(b.amount.toString()); setFormDueDate(b.due_date.slice(0, 10)); setFormRecurrence(b.recurrence || 'monthly'); setFormReminder(b.reminder_days_before.toString()); setShowModal(true);
  };

  const handleSave = async () => {
    if (!formName || !formAmount || !formDueDate) return;
    setFormSaving(true);
    try {
      const data = { name: formName, amount: parseFloat(formAmount), due_date: formDueDate, recurrence: formRecurrence, reminder_days_before: parseInt(formReminder) || 3 };
      if (editing) { await billsApi.update(editing.id, data); }
      else { await billsApi.create(data); }
      hapticSuccess(); setShowModal(false); fetchData();
    } catch (err: any) { Alert.alert('Error', err.response?.data?.detail || 'Failed'); }
    finally { setFormSaving(false); }
  };

  const handleMarkPaid = async (id: string) => {
    try { await billsApi.update(id, { is_paid: true, paid_date: new Date().toISOString().slice(0, 10) }); hapticSuccess(); fetchData(); }
    catch {}
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Bill', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await billsApi.delete(id); hapticHeavy(); fetchData(); } },
    ]);
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#0284c7" /></View>;

  const filtered = showUnpaid ? bills.filter((b) => !b.is_paid) : bills;

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.toggleRow} onPress={() => setShowUnpaid(!showUnpaid)}>
        <Text style={styles.toggleText}>{showUnpaid ? 'Showing unpaid only' : 'Showing all bills'}</Text>
        <Text style={styles.toggleAction}>{showUnpaid ? 'Show All' : 'Show Unpaid'}</Text>
      </TouchableOpacity>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}>
        {filtered.map((b) => {
          const overdue = !b.is_paid && isOverdue(b.due_date);
          const dueIn = !b.is_paid ? daysUntil(b.due_date) : null;
          return (
            <TouchableOpacity key={b.id} style={[styles.billCard, overdue && styles.overdueCard]} onPress={() => openEdit(b)} onLongPress={() => handleDelete(b.id)}>
              <View style={styles.billHeader}>
                <Text style={styles.billName}>{b.name}</Text>
                {b.is_paid ? (
                  <View style={styles.paidBadge}><Text style={styles.paidText}>Paid</Text></View>
                ) : overdue ? (
                  <View style={styles.overdueBadge}><Text style={styles.overdueText}>Overdue</Text></View>
                ) : dueIn !== null && dueIn <= 3 ? (
                  <View style={styles.dueSoonBadge}><Text style={styles.dueSoonText}>Due Soon</Text></View>
                ) : null}
              </View>
              <Text style={[styles.billAmount, b.is_paid && { color: '#94a3b8' }]}>{formatCurrency(b.amount)}</Text>
              <Text style={styles.billDue}>
                {b.is_paid ? `Paid on ${formatDate(b.paid_date!)}` : overdue ? `Was due ${formatDate(b.due_date)}` : `Due ${formatDate(b.due_date)}${dueIn !== null ? ` (${dueIn} days)` : ''}`}
              </Text>
              {b.recurrence && <Text style={styles.billRecurrence}>Recurring: {b.recurrence}</Text>}
              {!b.is_paid && (
                <TouchableOpacity style={styles.payBtn} onPress={() => handleMarkPaid(b.id)}>
                  <Text style={styles.payBtnText}>Mark as Paid</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        })}
        {filtered.length === 0 && <Text style={styles.emptyText}>No bills found</Text>}
        <View style={{ height: 80 }} />
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={openCreate}><Text style={styles.fabText}>+</Text></TouchableOpacity>

      <Modal visible={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Bill' : 'New Bill'}>
        <View style={styles.form}>
          <Text style={styles.label}>Bill Name</Text>
          <TextInput style={styles.input} value={formName} onChangeText={setFormName} placeholder="e.g. Electricity" placeholderTextColor="#94a3b8" />
          <Text style={styles.label}>Amount</Text>
          <TextInput style={styles.input} value={formAmount} onChangeText={setFormAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#94a3b8" />
          <Text style={styles.label}>Due Date</Text>
          <TextInput style={styles.input} value={formDueDate} onChangeText={setFormDueDate} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" />
          <Text style={styles.label}>Recurrence</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>{RECURRENCE.map((r) => (
            <TouchableOpacity key={r} style={[styles.chip, formRecurrence === r && styles.chipActive]} onPress={() => setFormRecurrence(r)}>
              <Text style={[styles.chipText, formRecurrence === r && styles.chipTextActive]}>{r}</Text>
            </TouchableOpacity>
          ))}</ScrollView>
          <Text style={styles.label}>Remind (days before)</Text>
          <TextInput style={styles.input} value={formReminder} onChangeText={setFormReminder} keyboardType="number-pad" placeholder="3" placeholderTextColor="#94a3b8" />
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
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, paddingBottom: 4 },
  toggleText: { fontSize: 13, color: '#64748b' },
  toggleAction: { fontSize: 13, color: '#0284c7', fontWeight: '600' },
  billCard: { backgroundColor: '#fff', margin: 12, marginBottom: 4, padding: 16, borderRadius: 12 },
  overdueCard: { borderLeftWidth: 4, borderLeftColor: '#ef4444' },
  billHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  billName: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  paidBadge: { backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  paidText: { fontSize: 11, color: '#10b981', fontWeight: '600' },
  overdueBadge: { backgroundColor: '#fce7f3', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  overdueText: { fontSize: 11, color: '#ef4444', fontWeight: '600' },
  dueSoonBadge: { backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  dueSoonText: { fontSize: 11, color: '#f59e0b', fontWeight: '600' },
  billAmount: { fontSize: 20, fontWeight: '700', color: '#0f172a', marginTop: 6 },
  billDue: { fontSize: 12, color: '#64748b', marginTop: 4 },
  billRecurrence: { fontSize: 11, color: '#94a3b8', marginTop: 2, textTransform: 'capitalize' },
  payBtn: { marginTop: 10, backgroundColor: '#10b981', padding: 10, borderRadius: 8, alignItems: 'center' },
  payBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  emptyText: { fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: 20 },
  fab: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#0284c7', justifyContent: 'center', alignItems: 'center', elevation: 4 },
  fabText: { fontSize: 28, color: '#fff', fontWeight: '300', marginTop: -2 },
  form: { padding: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6, marginTop: 4 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, fontSize: 15, color: '#0f172a', marginBottom: 8 },
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
