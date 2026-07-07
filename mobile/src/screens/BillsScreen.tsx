import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Alert,
} from 'react-native';
import { billsApi } from '../services/api';
import { Bill } from '../types';
import { formatCurrency, formatDate, getRelativeDate, daysUntil } from '../utils/format';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import FormField from '../components/ui/FormField';

export default function BillsScreen() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Bill | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const res = await billsApi.getAll();
      setBills(res.data || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetch().finally(() => setLoading(false)); }, [fetch]);
  const onRefresh = async () => { setRefreshing(true); await fetch(); setRefreshing(false); };

  const openCreate = () => { setEditing(null); setName(''); setAmount(''); setDueDate(''); setShowModal(true); };
  const openEdit = (b: Bill) => { setEditing(b); setName(b.name); setAmount(String(b.amount)); setDueDate(b.due_date); setShowModal(true); };

  const handleSave = async () => {
    if (!name.trim() || !amount || !dueDate) { Alert.alert('Error', 'All fields required'); return; }
    setSaving(true);
    try {
      const data = { name: name.trim(), amount: parseFloat(amount), due_date: dueDate };
      if (editing) await billsApi.update(editing.id, data);
      else await billsApi.create(data);
      setShowModal(false);
      await fetch();
    } catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleMarkPaid = async (bill: Bill) => {
    try {
      await billsApi.update(bill.id, { ...bill, is_paid: true, paid_date: new Date().toISOString().split('T')[0] });
      await fetch();
    } catch (e: any) { Alert.alert('Error', 'Failed to mark as paid'); }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Bill', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await billsApi.delete(id); await fetch(); }
        catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Delete failed'); }
      }},
    ]);
  };

  const unpaid = bills.filter((b) => !b.is_paid);
  const paid = bills.filter((b) => b.is_paid);

  if (loading) return <LoadingSpinner message="Loading bills..." />;

  const renderBill = (item: Bill) => {
    const days = daysUntil(item.due_date);
    const isOverdue = days < 0 && !item.is_paid;
    const isDueSoon = days >= 0 && days <= 7 && !item.is_paid;
    return (
      <TouchableOpacity
        style={[styles.card, isOverdue && styles.cardOverdue, isDueSoon && styles.cardDueSoon]}
        onPress={() => openEdit(item)}
        onLongPress={() => handleDelete(item.id)}
      >
        <View style={styles.cardRow}>
          <View style={[styles.statusDot, { backgroundColor: item.is_paid ? '#10b981' : isOverdue ? '#dc2626' : isDueSoon ? '#f59e0b' : '#94a3b8' }]} />
          <View style={styles.billInfo}>
            <Text style={[styles.billName, item.is_paid && styles.textMuted]}>{item.name}</Text>
            <Text style={styles.dueDate}>{item.is_paid ? `Paid ${formatDate(item.paid_date || '')}` : getRelativeDate(item.due_date)}</Text>
          </View>
          <View style={styles.rightCol}>
            <Text style={[styles.billAmount, item.is_paid && styles.textMuted]}>{formatCurrency(Number(item.amount))}</Text>
            {!item.is_paid && (
              <TouchableOpacity style={styles.payBtn} onPress={() => handleMarkPaid(item)}>
                <Text style={styles.payBtnText}>Pay</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryNum, { color: '#dc2626' }]}>{unpaid.length}</Text>
          <Text style={styles.summaryLabel}>Unpaid</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryNum, { color: '#16a34a' }]}>{paid.length}</Text>
          <Text style={styles.summaryLabel}>Paid</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryNum, { color: '#0f172a' }]}>{bills.length}</Text>
          <Text style={styles.summaryLabel}>Total</Text>
        </View>
      </View>

      <FlatList
        data={[...unpaid, ...paid]}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={bills.length === 0 ? { flex: 1 } : { padding: 16, paddingTop: 4 }}
        ListEmptyComponent={<EmptyState title="No bills" subtitle="Track your recurring bills and never miss a payment" actionLabel="Add Bill" onAction={openCreate} />}
        ListHeaderComponent={
          unpaid.length > 0 ? (
            <Text style={styles.sectionTitle}>Upcoming ({unpaid.length})</Text>
          ) : null
        }
        renderItem={({ item, index }) => {
          if (index === unpaid.length && paid.length > 0) {
            return (
              <View>
                <Text style={styles.sectionTitle}>Paid ({paid.length})</Text>
                {renderBill(item)}
              </View>
            );
          }
          return renderBill(item);
        }}
      />

      <TouchableOpacity style={styles.fab} onPress={openCreate}><Text style={styles.fabText}>+</Text></TouchableOpacity>

      <Modal visible={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Bill' : 'New Bill'}>
        <View style={styles.modalBody}>
          <FormField label="Bill Name" value={name} onChangeText={setName} placeholder="e.g. Electricity Bill" />
          <FormField label="Amount" value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="1500" />
          <FormField label="Due Date (YYYY-MM-DD)" value={dueDate} onChangeText={setDueDate} placeholder="2026-08-15" />
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
  summaryRow: { flexDirection: 'row', padding: 16, paddingBottom: 8, gap: 12 },
  summaryItem: { flex: 1, backgroundColor: '#fff', padding: 12, borderRadius: 10, alignItems: 'center' },
  summaryNum: { fontSize: 20, fontWeight: '700' },
  summaryLabel: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a', marginTop: 8, marginBottom: 8 },
  card: { backgroundColor: '#fff', padding: 14, borderRadius: 10, marginBottom: 6 },
  cardOverdue: { borderLeftWidth: 3, borderLeftColor: '#dc2626' },
  cardDueSoon: { borderLeftWidth: 3, borderLeftColor: '#f59e0b' },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
  billInfo: { flex: 1 },
  billName: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  dueDate: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  rightCol: { alignItems: 'flex-end' },
  billAmount: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  payBtn: { marginTop: 4, backgroundColor: '#dcfce7', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10 },
  payBtnText: { fontSize: 12, color: '#16a34a', fontWeight: '600' },
  textMuted: { opacity: 0.5 },
  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#0284c7',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#0284c7', shadowOpacity: 0.4, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, elevation: 4,
  },
  fabText: { fontSize: 28, color: '#fff', marginTop: -2 },
  modalBody: { padding: 20 },
  saveBtn: { backgroundColor: '#0284c7', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
