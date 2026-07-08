import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, TextInput, Alert } from 'react-native';
import { goalsApi } from '../services/api';
import { useHaptics } from '../hooks/useHaptics';
import Modal from '../components/ui/Modal';
import { formatCurrency, formatDate, daysUntil, formatProgress } from '../utils/format';
import type { Goal, GoalStatus } from '../types';

const STATUS_OPTIONS: GoalStatus[] = ['active', 'completed', 'cancelled', 'paused'];

export default function GoalsScreen() {
  const { success: hapticSuccess, heavy: hapticHeavy } = useHaptics();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [formName, setFormName] = useState('');
  const [formTarget, setFormTarget] = useState('');
  const [formCurrent, setFormCurrent] = useState('');
  const [formDeadline, setFormDeadline] = useState('');
  const [formSaving, setFormSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await goalsApi.list();
      setGoals(res.data?.items || res.data || []);
    } catch {
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => {
    setEditing(null); setFormName(''); setFormTarget(''); setFormCurrent(''); setFormDeadline(''); setShowModal(true);
  };

  const openEdit = (g: Goal) => {
    setEditing(g); setFormName(g.name); setFormTarget(g.target_amount.toString()); setFormCurrent(g.current_amount.toString()); setFormDeadline(g.deadline || ''); setShowModal(true);
  };

  const handleSave = async () => {
    if (!formName || !formTarget) return;
    setFormSaving(true);
    try {
      const data = { name: formName, target_amount: parseFloat(formTarget), current_amount: parseFloat(formCurrent) || 0, deadline: formDeadline || undefined };
      if (editing) { await goalsApi.update(editing.id, data); }
      else { await goalsApi.create(data); }
      hapticSuccess(); setShowModal(false); fetchData();
    } catch (err: any) { Alert.alert('Error', err.response?.data?.detail || 'Failed'); }
    finally { setFormSaving(false); }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Goal', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await goalsApi.delete(id); hapticHeavy(); fetchData(); } },
    ]);
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#0284c7" /></View>;

  return (
    <View style={styles.container}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}>
        {goals.map((g) => {
          const pct = formatProgress(g.current_amount, g.target_amount);
          const isComplete = pct >= 100;
          const deadline = g.deadline ? daysUntil(g.deadline) : null;
          return (
            <TouchableOpacity key={g.id} style={styles.goalCard} onPress={() => openEdit(g)} onLongPress={() => handleDelete(g.id)}>
              <View style={styles.goalHeader}>
                <View style={[styles.goalIcon, { backgroundColor: (g.color || '#0284c7') + '20' }]}>
                  <Text style={{ fontSize: 20 }}>{g.icon || '🎯'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.goalName}>{g.name}</Text>
                  <Text style={styles.goalCategory}>{g.category || 'General'}</Text>
                </View>
                {isComplete && <View style={styles.completedBadge}><Text style={styles.completedText}>🎉 Done!</Text></View>}
              </View>

              <View style={styles.progressTrack}>
                <View style={[styles.progressBar, { width: `${Math.min(pct, 100)}%`, backgroundColor: isComplete ? '#10b981' : '#0284c7' }]} />
              </View>

              <View style={styles.goalFooter}>
                <Text style={styles.goalAmount}>{formatCurrency(g.current_amount)} / {formatCurrency(g.target_amount)}</Text>
                <Text style={styles.goalPct}>{pct}%</Text>
              </View>

              {deadline !== null && !isComplete && (
                <Text style={[styles.deadline, deadline < 0 && { color: '#ef4444' }]}>
                  {deadline >= 0 ? `${deadline} days left` : `Overdue by ${Math.abs(deadline)} days`}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
        {goals.length === 0 && <Text style={styles.emptyText}>No goals yet. Tap + to create one.</Text>}
        <View style={{ height: 80 }} />
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={openCreate}><Text style={styles.fabText}>+</Text></TouchableOpacity>

      <Modal visible={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Goal' : 'New Goal'}>
        <View style={styles.form}>
          <Text style={styles.label}>Goal Name</Text>
          <TextInput style={styles.input} value={formName} onChangeText={setFormName} placeholder="e.g. Emergency Fund" placeholderTextColor="#94a3b8" />

          <Text style={styles.label}>Target Amount</Text>
          <TextInput style={styles.input} value={formTarget} onChangeText={setFormTarget} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#94a3b8" />

          <Text style={styles.label}>Current Amount</Text>
          <TextInput style={styles.input} value={formCurrent} onChangeText={setFormCurrent} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#94a3b8" />

          <Text style={styles.label}>Deadline (optional)</Text>
          <TextInput style={styles.input} value={formDeadline} onChangeText={setFormDeadline} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" />

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
  goalCard: { backgroundColor: '#fff', margin: 12, marginBottom: 4, padding: 16, borderRadius: 12 },
  goalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  goalIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  goalName: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  goalCategory: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  completedBadge: { backgroundColor: '#dcfce7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  completedText: { fontSize: 12, fontWeight: '600', color: '#10b981' },
  progressTrack: { height: 8, backgroundColor: '#f1f5f9', borderRadius: 4, overflow: 'hidden' },
  progressBar: { height: '100%', borderRadius: 4 },
  goalFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  goalAmount: { fontSize: 13, color: '#64748b' },
  goalPct: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  deadline: { fontSize: 12, color: '#64748b', marginTop: 4 },
  emptyText: { fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: 20 },
  fab: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#0284c7', justifyContent: 'center', alignItems: 'center', elevation: 4 },
  fabText: { fontSize: 28, color: '#fff', fontWeight: '300', marginTop: -2 },
  form: { padding: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6, marginTop: 4 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, fontSize: 15, color: '#0f172a', marginBottom: 8 },
  formActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  saveBtn: { flex: 1, backgroundColor: '#0284c7', padding: 16, borderRadius: 10, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  deleteBtn: { padding: 16, borderRadius: 10, borderWidth: 1, borderColor: '#fecaca' },
  deleteBtnText: { color: '#dc2626', fontWeight: '600' },
});
