import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, TextInput, Alert } from 'react-native';
import { categoriesApi } from '../services/api';
import { useHaptics } from '../hooks/useHaptics';
import Modal from '../components/ui/Modal';
import type { Category, CategoryType } from '../types';

const COLORS = ['#0284c7', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'];

export default function CategoriesScreen() {
  const { success: hapticSuccess, heavy: hapticHeavy } = useHaptics();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<CategoryType | 'all'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<CategoryType>('expense');
  const [formColor, setFormColor] = useState('#0284c7');
  const [formSaving, setFormSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const params: Record<string, any> = {};
      if (filter !== 'all') params.type = filter;
      const res = await categoriesApi.list(params);
      setCategories(res.data?.items || res.data || []);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => {
    setEditing(null); setFormName(''); setFormType('expense'); setFormColor('#0284c7'); setShowModal(true);
  };

  const openEdit = (c: Category) => {
    setEditing(c); setFormName(c.name); setFormType(c.type); setFormColor(c.color || '#0284c7'); setShowModal(true);
  };

  const handleSave = async () => {
    if (!formName) return;
    setFormSaving(true);
    try {
      const data = { name: formName, type: formType, color: formColor };
      if (editing) { await categoriesApi.update(editing.id, data); }
      else { await categoriesApi.create(data); }
      hapticSuccess(); setShowModal(false); fetchData();
    } catch (err: any) { Alert.alert('Error', err.response?.data?.detail || 'Failed'); }
    finally { setFormSaving(false); }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await categoriesApi.delete(id); hapticHeavy(); fetchData(); } },
    ]);
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#0284c7" /></View>;

  const expenseCount = categories.filter((c) => c.type === 'expense').length;
  const incomeCount = categories.filter((c) => c.type === 'income').length;

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        {(['all', 'expense', 'income'] as const).map((f) => (
          <TouchableOpacity key={f} style={[styles.filterBtn, filter === f && styles.filterActive]} onPress={() => setFilter(f)}>
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f.charAt(0).toUpperCase() + f.slice(1)} {f === 'all' ? `(${categories.length})` : f === 'expense' ? `(${expenseCount})` : `(${incomeCount})`}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}>
        {categories.map((c) => (
          <TouchableOpacity key={c.id} style={styles.catRow} onPress={() => openEdit(c)} onLongPress={() => !c.is_default && handleDelete(c.id)}>
            <View style={[styles.catIcon, { backgroundColor: (c.color || '#0284c7') + '20' }]}>
              <Text style={{ fontSize: 18 }}>{c.icon || '📁'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.catName}>{c.name}</Text>
              <Text style={styles.catType}>{c.type}</Text>
            </View>
            <Text style={[styles.catBadge, { color: c.type === 'expense' ? '#ef4444' : '#10b981' }]}>{c.type === 'expense' ? '↓' : '↑'}</Text>
          </TouchableOpacity>
        ))}
        <View style={{ height: 80 }} />
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={openCreate}><Text style={styles.fabText}>+</Text></TouchableOpacity>

      <Modal visible={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Category' : 'New Category'}>
        <View style={styles.form}>
          <Text style={styles.label}>Name</Text>
          <TextInput style={styles.input} value={formName} onChangeText={setFormName} placeholder="Category name" placeholderTextColor="#94a3b8" />

          <Text style={styles.label}>Type</Text>
          <View style={styles.typeRow}>
            <TouchableOpacity style={[styles.typeBtn, formType === 'expense' && { backgroundColor: '#ef4444' }]} onPress={() => setFormType('expense')}>
              <Text style={[styles.typeBtnText, { color: formType === 'expense' ? '#fff' : '#64748b' }]}>Expense</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.typeBtn, formType === 'income' && { backgroundColor: '#10b981' }]} onPress={() => setFormType('income')}>
              <Text style={[styles.typeBtnText, { color: formType === 'income' ? '#fff' : '#64748b' }]}>Income</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Color</Text>
          <View style={styles.colorRow}>{COLORS.map((c) => (
            <TouchableOpacity key={c} style={[styles.colorDot, { backgroundColor: c }, formColor === c && styles.colorActive]} onPress={() => setFormColor(c)} />
          ))}</View>

          <View style={styles.formActions}>
            {editing && !editing.is_default && (
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
  filterRow: { flexDirection: 'row', padding: 12, gap: 8 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  filterActive: { backgroundColor: '#0284c7', borderColor: '#0284c7' },
  filterText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  filterTextActive: { color: '#fff' },
  catRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 14, marginHorizontal: 12, marginBottom: 8, borderRadius: 12, gap: 12 },
  catIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  catName: { fontSize: 15, color: '#0f172a', fontWeight: '500' },
  catType: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  catBadge: { fontSize: 16, fontWeight: '700' },
  fab: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#0284c7', justifyContent: 'center', alignItems: 'center', elevation: 4 },
  fabText: { fontSize: 28, color: '#fff', fontWeight: '300', marginTop: -2 },
  form: { padding: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6, marginTop: 4 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, fontSize: 15, color: '#0f172a', marginBottom: 8 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  typeBtn: { flex: 1, padding: 10, borderRadius: 8, alignItems: 'center', backgroundColor: '#f1f5f9' },
  typeBtnText: { fontSize: 14, fontWeight: '600' },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
  colorActive: { borderWidth: 3, borderColor: '#0f172a' },
  formActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  saveBtn: { flex: 1, backgroundColor: '#0284c7', padding: 16, borderRadius: 10, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  deleteBtn: { padding: 16, borderRadius: 10, borderWidth: 1, borderColor: '#fecaca' },
  deleteBtnText: { color: '#dc2626', fontWeight: '600' },
});
