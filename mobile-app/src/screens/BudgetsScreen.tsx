import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, TextInput, Alert } from 'react-native';
import { budgetsApi, categoriesApi } from '../services/api';
import { useHaptics } from '../hooks/useHaptics';
import Modal from '../components/ui/Modal';
import { formatCurrency, formatProgress } from '../utils/format';
import type { Budget, Category, BudgetPeriod } from '../types';

const PERIODS: BudgetPeriod[] = ['weekly', 'monthly', 'quarterly', 'yearly'];

export default function BudgetsScreen() {
  const { success: hapticSuccess, heavy: hapticHeavy } = useHaptics();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formPeriod, setFormPeriod] = useState<BudgetPeriod>('monthly');
  const [formSaving, setFormSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [bRes, cRes] = await Promise.all([budgetsApi.list(), categoriesApi.list()]);
      setBudgets(bRes.data?.items || bRes.data || []);
      setCategories(cRes.data?.items || cRes.data || []);
    } catch {
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => {
    setEditing(null); setFormCategoryId(''); setFormAmount(''); setFormPeriod('monthly'); setShowModal(true);
  };

  const openEdit = (b: Budget) => {
    setEditing(b); setFormCategoryId(b.category_id); setFormAmount(b.amount.toString()); setFormPeriod(b.period); setShowModal(true);
  };

  const handleSave = async () => {
    if (!formCategoryId || !formAmount) return;
    setFormSaving(true);
    try {
      const data = { category_id: formCategoryId, amount: parseFloat(formAmount), period: formPeriod };
      if (editing) { await budgetsApi.update(editing.id, data); }
      else { await budgetsApi.create(data); }
      hapticSuccess(); setShowModal(false); fetchData();
    } catch (err: any) { Alert.alert('Error', err.response?.data?.detail || 'Failed'); }
    finally { setFormSaving(false); }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Budget', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await budgetsApi.delete(id); hapticHeavy(); fetchData(); } },
    ]);
  };

  const getProgressColor = (pct: number) => {
    if (pct >= 100) return '#ef4444';
    if (pct >= 80) return '#f59e0b';
    return '#10b981';
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#0284c7" /></View>;

  return (
    <View style={styles.container}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}>
        {budgets.map((b) => {
          const pct = formatProgress(b.spent || 0, b.amount);
          const color = getProgressColor(pct);
          const category = categories.find((c) => c.id === b.category_id);
          return (
            <TouchableOpacity key={b.id} style={styles.budgetCard} onPress={() => openEdit(b)} onLongPress={() => handleDelete(b.id)}>
              <View style={styles.budgetHeader}>
                <Text style={styles.budgetCategory}>{category?.name || 'Unknown'}</Text>
                <Text style={[styles.budgetPct, { color }]}>{pct}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressBar, { width: `${pct}%`, backgroundColor: color }]} />
              </View>
              <View style={styles.budgetFooter}>
                <Text style={styles.budgetSpent}>{formatCurrency(b.spent || 0)}</Text>
                <Text style={styles.budgetTotal}>of {formatCurrency(b.amount)}</Text>
              </View>
              <Text style={styles.budgetPeriod}>{b.period}</Text>
            </TouchableOpacity>
          );
        })}
        {budgets.length === 0 && <Text style={styles.emptyText}>No budgets yet. Tap + to create one.</Text>}
        <View style={{ height: 80 }} />
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={openCreate}><Text style={styles.fabText}>+</Text></TouchableOpacity>

      <Modal visible={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Budget' : 'New Budget'}>
        <View style={styles.form}>
          <Text style={styles.label}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            {categories.filter((c) => c.type === 'expense').map((c) => (
              <TouchableOpacity key={c.id} style={[styles.chip, formCategoryId === c.id && styles.chipActive]} onPress={() => setFormCategoryId(c.id)}>
                <Text style={[styles.chipText, formCategoryId === c.id && styles.chipTextActive]}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>Budget Amount</Text>
          <TextInput style={styles.input} value={formAmount} onChangeText={setFormAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#94a3b8" />

          <Text style={styles.label}>Period</Text>
          <View style={styles.periodRow}>{PERIODS.map((p) => (
            <TouchableOpacity key={p} style={[styles.periodBtn, formPeriod === p && styles.periodActive]} onPress={() => setFormPeriod(p)}>
              <Text style={[styles.periodText, formPeriod === p && styles.periodTextActive]}>{p.charAt(0).toUpperCase() + p.slice(1)}</Text>
            </TouchableOpacity>
          ))}</View>

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
  budgetCard: { backgroundColor: '#fff', margin: 12, marginBottom: 4, padding: 16, borderRadius: 12 },
  budgetHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  budgetCategory: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  budgetPct: { fontSize: 15, fontWeight: '700' },
  progressTrack: { height: 8, backgroundColor: '#f1f5f9', borderRadius: 4, overflow: 'hidden' },
  progressBar: { height: '100%', borderRadius: 4 },
  budgetFooter: { flexDirection: 'row', gap: 4, marginTop: 6, alignItems: 'baseline' },
  budgetSpent: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  budgetTotal: { fontSize: 12, color: '#94a3b8' },
  budgetPeriod: { fontSize: 11, color: '#94a3b8', marginTop: 4, textTransform: 'capitalize' },
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
  periodRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  periodBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  periodActive: { backgroundColor: '#0284c7', borderColor: '#0284c7' },
  periodText: { fontSize: 13, color: '#64748b' },
  periodTextActive: { color: '#fff' },
  formActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  saveBtn: { flex: 1, backgroundColor: '#0284c7', padding: 16, borderRadius: 10, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  deleteBtn: { padding: 16, borderRadius: 10, borderWidth: 1, borderColor: '#fecaca' },
  deleteBtnText: { color: '#dc2626', fontWeight: '600' },
});
