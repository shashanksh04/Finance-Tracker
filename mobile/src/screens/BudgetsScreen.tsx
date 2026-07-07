import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Alert,
} from 'react-native';
import { budgetsApi, categoriesApi } from '../services/api';
import { Budget, Category } from '../types';
import { formatCurrency } from '../utils/format';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import FormField from '../components/ui/FormField';

export default function BudgetsScreen() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [categoryId, setCategoryId] = useState('');
  const [saving, setSaving] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const [bRes, cRes] = await Promise.all([
        budgetsApi.getAll({ page_size: 100 }),
        categoriesApi.getAll({ type: 'expense', page_size: 100 }),
      ]);
      setBudgets(bRes.data?.items || bRes.data || []);
      setCategories(cRes.data?.items || cRes.data || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetch().finally(() => setLoading(false)); }, [fetch]);
  const onRefresh = async () => { setRefreshing(true); await fetch(); setRefreshing(false); };

  const openCreate = () => {
    setEditing(null); setAmount(''); setPeriod('monthly'); setCategoryId('');
    setShowModal(true);
  };

  const openEdit = (b: Budget) => {
    setEditing(b); setAmount(String(b.amount)); setPeriod(b.period); setCategoryId(b.category_id || '');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!amount || parseFloat(amount) <= 0) { Alert.alert('Error', 'Enter a valid amount'); return; }
    setSaving(true);
    try {
      const data = { amount: parseFloat(amount), period, category_id: categoryId || null };
      if (editing) await budgetsApi.update(editing.id, data);
      else await budgetsApi.create(data);
      setShowModal(false);
      await fetch();
    } catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Budget', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await budgetsApi.delete(id); await fetch(); }
        catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Delete failed'); }
      }},
    ]);
  };

  const getCategoryName = (id: string | null) => {
    if (!id) return 'Overall';
    const cat = categories.find((c) => c.id === id);
    return cat ? cat.name : 'Unknown';
  };

  const getProgressColor = (pct: number) => {
    if (pct >= 90) return '#dc2626';
    if (pct >= 70) return '#f59e0b';
    return '#10b981';
  };

  if (loading) return <LoadingSpinner message="Loading budgets..." />;

  return (
    <View style={styles.container}>
      <FlatList
        data={budgets}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={budgets.length === 0 ? { flex: 1 } : { padding: 16 }}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Budgets</Text>
            <Text style={styles.subtitle}>{budgets.length} active budgets</Text>
          </View>
        }
        ListEmptyComponent={<EmptyState title="No budgets" subtitle="Set spending limits for categories" actionLabel="Create Budget" onAction={openCreate} />}
        renderItem={({ item }) => {
          const pct = Math.min(100, (Number((item as any).spent || 0) / Number(item.amount)) * 100);
          const spent = Number((item as any).spent || 0);
          return (
            <TouchableOpacity style={styles.card} onPress={() => openEdit(item)} onLongPress={() => handleDelete(item.id)}>
              <View style={styles.cardHeader}>
                <Text style={styles.catName}>{getCategoryName(item.category_id)}</Text>
                <Text style={[styles.periodBadge, { textTransform: 'capitalize' }]}>{item.period}</Text>
              </View>
              <View style={styles.progressContainer}>
                <View style={styles.progressBg}>
                  <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: getProgressColor(pct) }]} />
                </View>
              </View>
              <View style={styles.cardFooter}>
                <Text style={styles.spentText}>{formatCurrency(spent)} spent</Text>
                <Text style={styles.remainingText}>{formatCurrency(Number(item.amount) - spent)} remaining</Text>
              </View>
              {pct >= 90 && <Text style={styles.warning}>⚠️ Budget nearly exceeded!</Text>}
            </TouchableOpacity>
          );
        }}
      />

      <TouchableOpacity style={styles.fab} onPress={openCreate}><Text style={styles.fabText}>+</Text></TouchableOpacity>

      <Modal visible={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Budget' : 'New Budget'}>
        <View style={styles.modalBody}>
          <FormField label="Amount" value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="10000" />
          <Text style={styles.fieldLabel}>Period</Text>
          <View style={styles.periodRow}>
            {(['monthly', 'quarterly', 'yearly'] as const).map((p) => (
              <TouchableOpacity key={p} style={[styles.periodChip, period === p && { backgroundColor: '#0284c7' }]} onPress={() => setPeriod(p)}>
                <Text style={[styles.periodChipText, period === p && { color: '#fff' }]}>{p.charAt(0).toUpperCase() + p.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.fieldLabel}>Category (optional)</Text>
          <View style={styles.catPickerRow}>
            <TouchableOpacity style={[styles.catChip, !categoryId && { backgroundColor: '#0284c7' }]} onPress={() => setCategoryId('')}>
              <Text style={[styles.catChipText, !categoryId && { color: '#fff' }]}>Overall</Text>
            </TouchableOpacity>
            {categories.map((c) => (
              <TouchableOpacity key={c.id} style={[styles.catChip, categoryId === c.id && { backgroundColor: c.color || '#0284c7' }]} onPress={() => setCategoryId(c.id)}>
                <Text style={[styles.catChipText, categoryId === c.id && { color: '#fff' }]}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
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
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  catName: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  periodBadge: { fontSize: 12, color: '#64748b', backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  progressContainer: { marginBottom: 8 },
  progressBg: { height: 10, backgroundColor: '#f1f5f9', borderRadius: 5, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 5 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  spentText: { fontSize: 13, color: '#64748b' },
  remainingText: { fontSize: 13, fontWeight: '600', color: '#0f172a' },
  warning: { fontSize: 12, color: '#dc2626', fontWeight: '600', marginTop: 4 },
  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#0284c7',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#0284c7', shadowOpacity: 0.4, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, elevation: 4,
  },
  fabText: { fontSize: 28, color: '#fff', marginTop: -2 },
  modalBody: { padding: 20 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 8, marginTop: 4 },
  periodRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  periodChip: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', backgroundColor: '#f8fafc' },
  periodChipText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  catPickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  catChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  catChipText: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  saveBtn: { backgroundColor: '#0284c7', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
