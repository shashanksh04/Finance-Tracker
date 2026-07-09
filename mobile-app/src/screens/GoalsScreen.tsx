import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Alert,
} from 'react-native';
import { goalsApi } from '../services/api';
import { useHaptics } from '../hooks/useHaptics';
import { useOfflineList } from '../hooks/useOfflineData';
import { repository } from '../database/repository';
import { TABLES } from '../database/schema';
import { CardSkeleton } from '../components/ui/SkeletonLoader';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import { formatCurrency, daysUntil } from '../utils/format';
import type { Goal } from '../types';
import Confetti from '../components/Confetti';
import { colors, spacing, radius, fontSize, fontWeight, shadow } from '../theme/tokens';

const STATUS_COLORS: Record<string, string> = { active: colors.primary, completed: colors.success, cancelled: colors.danger, paused: colors.warning };

export default function GoalsScreen() {
  const { success: hapticSuccess, light: hapticLight, heavy: hapticHeavy } = useHaptics();
  const { data: goals, loading, refreshing, refresh, refreshFromApi } = useOfflineList<Goal>(TABLES.GOALS, {
    orderBy: 'target_date ASC',
    apiFetch: () => goalsApi.list(),
    mapApiResponse: (res) => res.data?.items || res.data || [],
  });

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [formName, setFormName] = useState('');
  const [formTarget, setFormTarget] = useState('');
  const [formCurrent, setFormCurrent] = useState('0');
  const [formDate, setFormDate] = useState('');
  const [formSaving, setFormSaving] = useState(false);

  const openCreate = () => {
    setEditing(null); setFormName(''); setFormTarget(''); setFormCurrent('0');
    const future = new Date(); future.setFullYear(future.getFullYear() + 1);
    setFormDate(future.toISOString().slice(0, 10)); setShowModal(true);
  };
  const openEdit = (g: Goal) => {
    setEditing(g); setFormName(g.name); setFormTarget(g.target_amount.toString());
    setFormCurrent(g.current_amount.toString()); setFormDate(g.target_date); setShowModal(true);
  };

  const handleSave = async () => {
    if (!formName || !formTarget) return;
    setFormSaving(true);
    try {
      const data = { name: formName, target_amount: parseFloat(formTarget), current_amount: parseFloat(formCurrent) || 0, target_date: formDate };
      if (editing) {
        const res = await goalsApi.update(editing.id, data);
        await repository.update(TABLES.GOALS, editing.id, res.data);
      } else {
        const res = await goalsApi.create(data);
        await repository.create(TABLES.GOALS, res.data);
      }
      hapticSuccess(); setShowModal(false); refresh();
    } catch (err: any) { Alert.alert('Error', err.response?.data?.detail || 'Failed'); }
    finally { setFormSaving(false); }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Goal', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await goalsApi.delete(id); await repository.delete(TABLES.GOALS, id); hapticHeavy(); refresh(); } },
    ]);
  };

  if (loading) return <CardSkeleton />;

  return (
    <View style={styles.container}>
      <Confetti active={goals.some((g) => g.target_amount > 0 && g.current_amount >= g.target_amount)} />
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshFromApi} />}>
        {goals.length === 0 && <EmptyState icon="🎯" title="No goals yet" subtitle="Set a savings goal to track your progress" actionLabel="Create Goal" onAction={openCreate} />}

        {goals.map((g) => {
          const pct = g.target_amount > 0 ? Math.min((g.current_amount / g.target_amount) * 100, 100) : 0;
          const remain = g.target_amount - g.current_amount;
          const days = g.target_date ? daysUntil(g.target_date) : 0;
          const isOverdue = days < 0;
          const barColor = pct >= 100 ? colors.success : isOverdue ? colors.danger : colors.primary;
          return (
            <TouchableOpacity key={g.id} style={styles.card} onPress={() => openEdit(g)} onLongPress={() => handleDelete(g.id)}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardName}>{g.name}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[g.status] || colors.textTertiary) + '20' }]}>
                    <Text style={[styles.statusText, { color: STATUS_COLORS[g.status] || colors.textTertiary }]}>{g.status}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.progressBg}>
                <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: barColor }]} />
              </View>
              <View style={styles.statsRow}>
                <Text style={styles.statItem}>{formatCurrency(g.current_amount)} of {formatCurrency(g.target_amount)}</Text>
                <Text style={[styles.statItem, { color: isOverdue ? colors.danger : colors.textSecondary }]}>
                  {pct >= 100 ? '✅ Complete' : isOverdue ? 'Overdue' : `${Math.abs(days)}d left`}
                </Text>
              </View>
              {remain > 0 && pct < 100 && <Text style={styles.remain}>{formatCurrency(remain)} remaining</Text>}
            </TouchableOpacity>
          );
        })}
        <View style={{ height: 80 }} />
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => { hapticLight(); openCreate(); }}><Text style={styles.fabText}>+</Text></TouchableOpacity>

      <Modal visible={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Goal' : 'New Goal'}>
        <View style={styles.form}>
          <Text style={styles.label}>Name</Text><TextInput style={styles.input} value={formName} onChangeText={setFormName} placeholder="Goal name" placeholderTextColor={colors.textTertiary} />
          <Text style={styles.label}>Target Amount</Text><TextInput style={styles.input} value={formTarget} onChangeText={setFormTarget} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.textTertiary} />
          <Text style={styles.label}>Current Amount</Text><TextInput style={styles.input} value={formCurrent} onChangeText={setFormCurrent} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.textTertiary} />
          <Text style={styles.label}>Target Date</Text><TextInput style={styles.input} value={formDate} onChangeText={setFormDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textTertiary} />
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
  card: { backgroundColor: colors.card, margin: spacing.md, marginBottom: 0, padding: spacing.lg, borderRadius: radius.md, ...shadow.sm },
  cardHeader: { marginBottom: spacing.md },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardName: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.text, flex: 1 },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.sm },
  statusText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, textTransform: 'capitalize' },
  progressBg: { height: 10, backgroundColor: colors.border, borderRadius: radius.sm, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radius.sm },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  statItem: { fontSize: fontSize.xs, color: colors.textSecondary, fontWeight: fontWeight.medium },
  remain: { fontSize: fontSize.xs, color: colors.warning, fontWeight: fontWeight.semibold, marginTop: spacing.xs },
  fab: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', elevation: 4 },
  fabText: { fontSize: 28, color: colors.textInverse, fontWeight: fontWeight.regular, marginTop: -2 },
  form: { padding: spacing.xl },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textSecondary, marginBottom: spacing.sm, marginTop: spacing.xs },
  input: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: spacing.md, fontSize: fontSize.base, color: colors.text, marginBottom: spacing.sm },
  formActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  saveBtn: { flex: 1, backgroundColor: colors.primary, padding: spacing.lg, borderRadius: radius.md, alignItems: 'center' },
  saveBtnText: { color: colors.textInverse, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  deleteBtn: { padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.dangerLight },
  deleteBtnText: { color: colors.danger, fontWeight: fontWeight.semibold },
});
