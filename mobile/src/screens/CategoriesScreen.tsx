import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Alert,
} from 'react-native';
import { categoriesApi } from '../services/api';
import { Category } from '../types';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import FormField from '../components/ui/FormField';

const PRESET_COLORS = ['#ef4444','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ec4899','#06b6d4','#f97316','#6366f1','#14b8a6'];

export default function CategoriesScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'expense' | 'income'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [catType, setCatType] = useState<'expense' | 'income'>('expense');
  const [color, setColor] = useState('#ef4444');
  const [icon, setIcon] = useState('');
  const [saving, setSaving] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const params = filter !== 'all' ? { type: filter, page_size: 100 } : { page_size: 100 };
      const res = await categoriesApi.getAll(params);
      setCategories(res.data?.items || res.data || []);
    } catch { /* ignore */ }
  }, [filter]);

  useEffect(() => { fetch().finally(() => setLoading(false)); }, [fetch]);

  const onRefresh = async () => { setRefreshing(true); await fetch(); setRefreshing(false); };

  const openCreate = () => {
    setEditing(null); setName(''); setCatType('expense'); setColor(PRESET_COLORS[0]); setIcon('');
    setShowModal(true);
  };

  const openEdit = (c: Category) => {
    setEditing(c); setName(c.name); setCatType(c.type); setColor(c.color || PRESET_COLORS[0]); setIcon(c.icon || '');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Error', 'Name is required'); return; }
    setSaving(true);
    try {
      const data = { name: name.trim(), type: catType, color, icon: icon || null };
      if (editing) await categoriesApi.update(editing.id, data);
      else await categoriesApi.create(data);
      setShowModal(false);
      await fetch();
    } catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Category', 'Transactions using this category will become uncategorized.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await categoriesApi.delete(id); await fetch(); }
        catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Delete failed'); }
      }},
    ]);
  };

  if (loading) return <LoadingSpinner message="Loading categories..." />;

  const filtered = filter === 'all' ? categories : categories.filter((c) => c.type === filter);
  const expenseCats = categories.filter((c) => c.type === 'expense');
  const incomeCats = categories.filter((c) => c.type === 'income');

  return (
    <View style={styles.container}>
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryNum, { color: '#dc2626' }]}>{expenseCats.length}</Text>
          <Text style={styles.summaryLabel}>Expense</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryNum, { color: '#16a34a' }]}>{incomeCats.length}</Text>
          <Text style={styles.summaryLabel}>Income</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryNum, { color: '#0f172a' }]}>{categories.length}</Text>
          <Text style={styles.summaryLabel}>Total</Text>
        </View>
      </View>

      <View style={styles.filterRow}>
        {(['all', 'expense', 'income'] as const).map((f) => (
          <TouchableOpacity key={f} style={[styles.filterChip, filter === f && { backgroundColor: '#0284c7' }]} onPress={() => setFilter(f)}>
            <Text style={[styles.filterText, filter === f && { color: '#fff' }]}>{f.charAt(0).toUpperCase() + f.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={filtered.length === 0 ? { flex: 1 } : { padding: 16, paddingTop: 4 }}
        ListEmptyComponent={<EmptyState title="No categories" subtitle={filter === 'all' ? 'Tap + to create one' : `No ${filter} categories`} actionLabel="Add Category" onAction={openCreate} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.catCard} onPress={() => openEdit(item)} onLongPress={() => handleDelete(item.id)}>
            <View style={[styles.colorDot, { backgroundColor: item.color || '#94a3b8' }]} />
            <Text style={styles.catName}>{item.name}</Text>
            <Text style={[styles.catType, { color: item.type === 'expense' ? '#dc2626' : '#16a34a' }]}>{item.type}</Text>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={openCreate}><Text style={styles.fabText}>+</Text></TouchableOpacity>

      <Modal visible={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Category' : 'New Category'}>
        <View style={styles.modalBody}>
          <FormField label="Name" value={name} onChangeText={setName} placeholder="e.g. Groceries" />
          <Text style={styles.fieldLabel}>Type</Text>
          <View style={styles.typeRow}>
            <TouchableOpacity style={[styles.typeBtn, catType === 'expense' && styles.typeBtnActive]} onPress={() => setCatType('expense')}>
              <Text style={[styles.typeBtnText, catType === 'expense' && styles.typeBtnTextActive]}>Expense</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.typeBtn, catType === 'income' && styles.typeBtnActive]} onPress={() => setCatType('income')}>
              <Text style={[styles.typeBtnText, catType === 'income' && styles.typeBtnTextActive]}>Income</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.fieldLabel}>Color</Text>
          <View style={styles.colorRow}>
            {PRESET_COLORS.map((c) => (
              <TouchableOpacity key={c} style={[styles.colorSwatch, { backgroundColor: c }, color === c && styles.colorSwatchActive]} onPress={() => setColor(c)} />
            ))}
          </View>
          <FormField label="Icon (emoji)" value={icon} onChangeText={setIcon} placeholder="🍔" />
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
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 4 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16, backgroundColor: '#f1f5f9' },
  filterText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  catCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    padding: 14, borderRadius: 10, marginBottom: 6,
  },
  colorDot: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  catName: { flex: 1, fontSize: 15, color: '#0f172a', fontWeight: '500' },
  catType: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#0284c7',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#0284c7', shadowOpacity: 0.4, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8,
    elevation: 4,
  },
  fabText: { fontSize: 28, color: '#fff', marginTop: -2 },
  modalBody: { padding: 20 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 8, marginTop: 4 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  typeBtnActive: { backgroundColor: '#0284c7', borderColor: '#0284c7' },
  typeBtnText: { fontSize: 14, color: '#64748b', fontWeight: '500' },
  typeBtnTextActive: { color: '#fff' },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  colorSwatch: { width: 32, height: 32, borderRadius: 16 },
  colorSwatchActive: { borderWidth: 3, borderColor: '#0f172a' },
  saveBtn: { backgroundColor: '#0284c7', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
