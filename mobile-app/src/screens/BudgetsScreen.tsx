import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Alert,
} from 'react-native';
import { budgetsApi, categoriesApi } from '../services/api';
import { useHaptics } from '../hooks/useHaptics';
import { useOfflineList } from '../hooks/useOfflineData';
import { repository } from '../database/repository';
import { TABLES } from '../database/schema';
import { CardSkeleton } from '../components/ui/SkeletonLoader';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import { formatCurrency } from '../utils/format';
import type { Budget, Category } from '../types';
import { spacing, radius, fontSize, fontWeight, shadow } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

export default function BudgetsScreen() {
  const { colors } = useTheme();
  const { success: hapticSuccess, light: hapticLight, heavy: hapticHeavy } = useHaptics();
  const { data: budgets, loading, refreshing, refresh, refreshFromApi } = useOfflineList<Budget>(TABLES.BUDGETS, {
    orderBy: 'created_at DESC',
    apiFetch: () => budgetsApi.list(),
    mapApiResponse: (res) => res.data?.items || res.data || [],
  });
  const { data: categories } = useOfflineList<Category>(TABLES.CATEGORIES, {
    orderBy: 'name ASC',
    apiFetch: () => categoriesApi.list(),
    mapApiResponse: (res) => res.data?.items || res.data || [],
  });

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [formName, setFormName] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formPeriod, setFormPeriod] = useState<'monthly' | 'weekly' | 'yearly'>('monthly');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formSaving, setFormSaving] = useState(false);

  const categoryMap = useMemo(() => {
    const m: Record<string, Category> = {}; categories.forEach((c) => { m[c.id] = c; }); return m;
  }, [categories]);

  const openCreate = () => {
    setEditing(null); setFormName(''); setFormAmount(''); setFormPeriod('monthly'); setFormCategoryId(''); setShowModal(true);
  };
  const openEdit = (b: Budget) => {
    setEditing(b); setFormName(b.name); setFormAmount(b.amount.toString()); setFormPeriod(b.period); setFormCategoryId(b.category_id || ''); setShowModal(true);
  };

  const handleSave = async () => {
    if (!formName || !formAmount) return;
    setFormSaving(true);
    try {
      const data = { name: formName, amount: parseFloat(formAmount), period: formPeriod, category_id: formCategoryId || undefined };
      if (editing) {
        const res = await budgetsApi.update(editing.id, data);
        await repository.update(TABLES.BUDGETS, editing.id, res.data);
      } else {
        const res = await budgetsApi.create(data);
        await repository.create(TABLES.BUDGETS, res.data);
      }
      hapticSuccess(); setShowModal(false); refresh();
    } catch (err: any) { Alert.alert('Error', err.response?.data?.detail || 'Failed'); }
    finally { setFormSaving(false); }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await budgetsApi.delete(id); await repository.delete(TABLES.BUDGETS, id); hapticHeavy(); refresh(); } },
    ]);
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    card: { backgroundColor: colors.card, margin: spacing.md, marginBottom: 0, padding: spacing.lg, borderRadius: radius.md, ...shadow.sm },
    cardHeader: { marginBottom: spacing.md },
    cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
    cardName: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.text },
    categoryBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm },
    categoryBadgeText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
    cardAmount: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: fontWeight.medium },
    progressBg: { height: 10, backgroundColor: colors.border, borderRadius: radius.sm, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: radius.sm },
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
    progressText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
    periodLabel: { fontSize: fontSize.xs, color: colors.textTertiary, textTransform: 'capitalize' },
    fab: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', elevation: 4 },
    fabText: { fontSize: 28, color: colors.textInverse, fontWeight: fontWeight.regular, marginTop: -2 },
    form: { padding: spacing.xl },
    label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textSecondary, marginBottom: spacing.sm, marginTop: spacing.xs },
    input: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: spacing.md, fontSize: fontSize.base, color: colors.text, marginBottom: spacing.sm },
    periodRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
    periodBtn: { flex: 1, padding: spacing.sm, borderRadius: radius.sm, alignItems: 'center', backgroundColor: colors.border, borderWidth: 1, borderColor: colors.border },
    periodBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textSecondary },
    choiceChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, marginRight: spacing.sm, marginBottom: spacing.sm },
    choiceChipText: { fontSize: fontSize.sm, color: colors.textSecondary },
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
        {budgets.length === 0 && <EmptyState icon="📊" title="No budgets yet" subtitle="Create a budget to track your spending" actionLabel="Create Budget" onAction={openCreate} />}

        {budgets.map((b) => {
          const pct = b.spent && b.amount > 0 ? Math.min((b.spent / b.amount) * 100, 100) : 0;
          const barColor = pct >= 100 ? colors.danger : pct >= 80 ? colors.warning : colors.success;
          const cat = b.category_id ? categoryMap[b.category_id] : undefined;
          return (
            <TouchableOpacity key={b.id} style={styles.card} onPress={() => openEdit(b)} onLongPress={() => handleDelete(b.id)}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardName}>{b.name}</Text>
                  {cat && <View style={[styles.categoryBadge, { backgroundColor: (cat.color || colors.primary) + '20' }]}><Text style={[styles.categoryBadgeText, { color: cat.color || colors.primary }]}>{cat.name}</Text></View>}
                </View>
                <Text style={styles.cardAmount}>{formatCurrency(b.spent || 0)} / {formatCurrency(b.amount)}</Text>
              </View>
              <View style={styles.progressBg}>
                <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: barColor }]} />
              </View>
              <View style={styles.cardFooter}>
                <Text style={[styles.progressText, { color: barColor }]}>{pct.toFixed(0)}% used</Text>
                <Text style={styles.periodLabel}>{b.period}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
        <View style={{ height: 80 }} />
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => { hapticLight(); openCreate(); }}><Text style={styles.fabText}>+</Text></TouchableOpacity>

      <Modal visible={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Budget' : 'New Budget'}>
        <View style={styles.form}>
          <Text style={styles.label}>Name</Text><TextInput style={styles.input} value={formName} onChangeText={setFormName} placeholder="Budget name" placeholderTextColor={colors.textTertiary} />
          <Text style={styles.label}>Amount</Text><TextInput style={styles.input} value={formAmount} onChangeText={setFormAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.textTertiary} />
          <Text style={styles.label}>Period</Text>
          <View style={styles.periodRow}>
            {(['weekly', 'monthly', 'yearly'] as const).map((p) => (
              <TouchableOpacity key={p} style={[styles.periodBtn, formPeriod === p && { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => setFormPeriod(p)}>
                <Text style={[styles.periodBtnText, formPeriod === p && { color: colors.textInverse }]}>{p.charAt(0).toUpperCase() + p.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.label}>Category (optional)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity style={[styles.choiceChip, !formCategoryId && { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => setFormCategoryId('')}>
              <Text style={[styles.choiceChipText, !formCategoryId && { color: colors.textInverse }]}>All</Text>
            </TouchableOpacity>
            {categories.filter((c) => c.type === 'expense').map((c) => (
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
        </View>
      </Modal>
    </View>
  );
}

