import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, TextInput, Alert } from 'react-native';
import { categoriesApi } from '../services/api';
import { useHaptics } from '../hooks/useHaptics';
import { useOfflineList } from '../hooks/useOfflineData';
import { repository } from '../database/repository';
import { TABLES } from '../database/schema';
import { ListSkeleton } from '../components/ui/SkeletonLoader';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import type { Category, CategoryType } from '../types';
import { colors, spacing, radius, fontSize, fontWeight, shadow } from '../theme/tokens';

const COLORS = ['#0284c7', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'];

export default function CategoriesScreen() {
  const { success: hapticSuccess, heavy: hapticHeavy } = useHaptics();
  const [filter, setFilter] = useState<CategoryType | 'all'>('all');
  const where = filter === 'all' ? undefined : [{ field: 'type', value: filter }];
  const { data: categories, loading, refreshing, refresh, refreshFromApi } = useOfflineList<Category>(TABLES.CATEGORIES, { where, orderBy: 'name ASC', apiFetch: () => categoriesApi.list(), mapApiResponse: (res) => res.data?.items || res.data || [] });

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<CategoryType>('expense');
  const [formIcon, setFormIcon] = useState('📦');
  const [formColor, setFormColor] = useState(COLORS[0]);
  const [formSaving, setFormSaving] = useState(false);

  const openCreate = () => { setEditing(null); setFormName(''); setFormType('expense'); setFormIcon('📦'); setFormColor(COLORS[0]); setShowModal(true); };
  const openEdit = (c: Category) => { setEditing(c); setFormName(c.name); setFormType(c.type); setFormIcon(c.icon || '📦'); setFormColor(c.color || COLORS[0]); setShowModal(true); };

  const handleSave = async () => {
    if (!formName) return;
    setFormSaving(true);
    try {
      const data = { name: formName, type: formType, icon: formIcon, color: formColor };
      if (editing) { const res = await categoriesApi.update(editing.id, data); await repository.update(TABLES.CATEGORIES, editing.id, res.data); }
      else { const res = await categoriesApi.create(data); await repository.create(TABLES.CATEGORIES, res.data); }
      hapticSuccess(); setShowModal(false); refresh();
    } catch (err: any) { Alert.alert('Error', err.response?.data?.detail || 'Failed'); }
    finally { setFormSaving(false); }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Category', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await categoriesApi.delete(id); await repository.delete(TABLES.CATEGORIES, id); hapticHeavy(); refresh(); } },
    ]);
  };

  if (loading) return <ListSkeleton />;

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        {(['all', 'expense', 'income'] as const).map((f) => (
          <TouchableOpacity key={f} style={[styles.filterBtn, filter === f && { backgroundColor: colors.primary }]} onPress={() => setFilter(f)}>
            <Text style={[styles.filterBtnText, filter === f && { color: colors.textInverse }]}>{f === 'all' ? 'All' : f === 'expense' ? 'Expense' : 'Income'}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshFromApi} />}>
        {categories.length === 0 && <EmptyState icon="📂" title="No categories yet" subtitle="Categories help organize your transactions" />}
        <View style={styles.grid}>
          {categories.map((c) => (
            <TouchableOpacity key={c.id} style={[styles.card, { borderLeftColor: c.color || colors.primary }]} onPress={() => openEdit(c)} onLongPress={() => handleDelete(c.id)}>
              <Text style={styles.cardIcon}>{c.icon}</Text>
              <Text style={styles.cardName}>{c.name}</Text>
              <Text style={styles.cardType}>{c.type}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ height: 80 }} />
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={openCreate}><Text style={styles.fabText}>+</Text></TouchableOpacity>

      <Modal visible={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Category' : 'New Category'}>
        <View style={styles.form}>
          <Text style={styles.label}>Name</Text><TextInput style={styles.input} value={formName} onChangeText={setFormName} placeholder="Category name" placeholderTextColor={colors.textTertiary} />
          <Text style={styles.label}>Icon</Text><TextInput style={styles.input} value={formIcon} onChangeText={setFormIcon} placeholder="📦" placeholderTextColor={colors.textTertiary} />
          <Text style={styles.label}>Type</Text>
          <View style={styles.typeRow}>
            <TouchableOpacity style={[styles.typeBtn, formType === 'expense' && { backgroundColor: colors.danger }]} onPress={() => setFormType('expense')}>
              <Text style={[styles.typeBtnText, formType === 'expense' && { color: colors.textInverse }]}>Expense</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.typeBtn, formType === 'income' && { backgroundColor: colors.success }]} onPress={() => setFormType('income')}>
              <Text style={[styles.typeBtnText, formType === 'income' && { color: colors.textInverse }]}>Income</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.label}>Color</Text>
          <View style={styles.colorRow}>
            {COLORS.map((clr) => (
              <TouchableOpacity key={clr} style={[styles.colorSwatch, { backgroundColor: clr }, formColor === clr && styles.colorSwatchActive]} onPress={() => setFormColor(clr)} />
            ))}
          </View>
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
  filterRow: { flexDirection: 'row', padding: spacing.md, gap: spacing.sm },
  filterBtn: { flex: 1, padding: spacing.sm, borderRadius: radius.sm, alignItems: 'center', backgroundColor: colors.border },
  filterBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textSecondary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: spacing.md, gap: spacing.sm },
  card: { width: '30%', flexGrow: 1, backgroundColor: colors.card, padding: spacing.md, borderRadius: radius.md, borderLeftWidth: 3, alignItems: 'center', minWidth: 100, ...shadow.sm },
  cardIcon: { fontSize: 28, marginBottom: spacing.xs },
  cardName: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text, textAlign: 'center' },
  cardType: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 2, textTransform: 'capitalize' },
  fab: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', elevation: 4 },
  fabText: { fontSize: 28, color: colors.textInverse, fontWeight: fontWeight.regular, marginTop: -2 },
  form: { padding: spacing.xl },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textSecondary, marginBottom: spacing.sm, marginTop: spacing.xs },
  input: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: spacing.md, fontSize: fontSize.base, color: colors.text, marginBottom: spacing.sm },
  typeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  typeBtn: { flex: 1, padding: spacing.sm, borderRadius: radius.sm, alignItems: 'center', backgroundColor: colors.border },
  typeBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textSecondary },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  colorSwatch: { width: 32, height: 32, borderRadius: 16 },
  colorSwatchActive: { borderWidth: 3, borderColor: colors.text },
  formActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  saveBtn: { flex: 1, backgroundColor: colors.primary, padding: spacing.lg, borderRadius: radius.md, alignItems: 'center' },
  saveBtnText: { color: colors.textInverse, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  deleteBtn: { padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.dangerLight },
  deleteBtnText: { color: colors.danger, fontWeight: fontWeight.semibold },
});
