import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Alert,
} from 'react-native';
import { goalsApi } from '../services/api';
import { Goal } from '../types';
import { formatCurrency, formatDate, getRelativeDate, daysUntil } from '../utils/format';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import FormField from '../components/ui/FormField';

export default function GoalsScreen() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [saving, setSaving] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const res = await goalsApi.getAll({ page_size: 100 });
      setGoals(res.data?.items || res.data || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetch().finally(() => setLoading(false)); }, [fetch]);
  const onRefresh = async () => { setRefreshing(true); await fetch(); setRefreshing(false); };

  const openCreate = () => {
    setEditing(null); setName(''); setTargetAmount(''); setCurrentAmount(''); setDeadline('');
    setShowModal(true);
  };

  const openEdit = (g: Goal) => {
    setEditing(g); setName(g.name); setTargetAmount(String(g.target_amount));
    setCurrentAmount(String(g.current_amount)); setDeadline(g.deadline || '');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !targetAmount) { Alert.alert('Error', 'Name and target amount are required'); return; }
    setSaving(true);
    try {
      const data = { name: name.trim(), target_amount: parseFloat(targetAmount), current_amount: parseFloat(currentAmount) || 0, deadline: deadline || null };
      if (editing) await goalsApi.update(editing.id, data);
      else await goalsApi.create(data);
      setShowModal(false);
      await fetch();
    } catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Goal', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await goalsApi.delete(id); await fetch(); }
        catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Delete failed'); }
      }},
    ]);
  };

  if (loading) return <LoadingSpinner message="Loading goals..." />;

  return (
    <View style={styles.container}>
      <FlatList
        data={goals}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={goals.length === 0 ? { flex: 1 } : { padding: 16 }}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Financial Goals</Text>
            <Text style={styles.subtitle}>Track your savings progress</Text>
          </View>
        }
        ListEmptyComponent={<EmptyState title="No goals" subtitle="Set savings goals to track your progress" actionLabel="Create Goal" onAction={openCreate} />}
        renderItem={({ item }) => {
          const progress = item.target_amount > 0 ? (item.current_amount / item.target_amount) * 100 : 0;
          const daysLeft = item.deadline ? daysUntil(item.deadline) : null;
          const isCompleted = item.status === 'completed' || progress >= 100;
          return (
            <TouchableOpacity style={[styles.card, isCompleted && styles.cardCompleted]} onPress={() => openEdit(item)} onLongPress={() => handleDelete(item.id)}>
              <View style={styles.cardHeader}>
                <Text style={styles.goalName}>{item.name}</Text>
                {isCompleted && <View style={styles.completedBadge}><Text style={styles.completedText}>✓ Done</Text></View>}
              </View>
              <Text style={styles.goalAmount}>
                {formatCurrency(item.current_amount)} / {formatCurrency(item.target_amount)}
              </Text>
              <View style={styles.progressBg}>
                <View style={[styles.progressFill, { width: `${Math.min(100, progress)}%' }], backgroundColor: isCompleted ? '#10b981' : '#3b82f6' }]} />
              </View>
              <View style={styles.cardFooter}>
                <Text style={styles.progressText}>{Math.round(progress)}% complete</Text>
                {daysLeft !== null && !isCompleted && (
                  <Text style={[styles.daysText, daysLeft < 0 ? { color: '#dc2626' } : {}]}>
                    {daysLeft < 0 ? `${Math.abs(daysLeft)} days overdue` : `${daysLeft} days left`}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <TouchableOpacity style={styles.fab} onPress={openCreate}><Text style={styles.fabText}>+</Text></TouchableOpacity>

      <Modal visible={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Goal' : 'New Goal'}>
        <View style={styles.modalBody}>
          <FormField label="Goal Name" value={name} onChangeText={setName} placeholder="e.g. Emergency Fund" />
          <FormField label="Target Amount" value={targetAmount} onChangeText={setTargetAmount} keyboardType="numeric" placeholder="50000" />
          <FormField label="Current Amount" value={currentAmount} onChangeText={setCurrentAmount} keyboardType="numeric" placeholder="0" />
          <FormField label="Deadline (YYYY-MM-DD)" value={deadline} onChangeText={setDeadline} placeholder="2026-12-31" />
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
  cardCompleted: { opacity: 0.8, borderWidth: 1, borderColor: '#bbf7d0' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  goalName: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  completedBadge: { backgroundColor: '#dcfce7', paddingHorizontal: 10, paddingVertical: 2, borderRadius: 10 },
  completedText: { fontSize: 12, color: '#16a34a', fontWeight: '600' },
  goalAmount: { fontSize: 14, color: '#64748b', marginBottom: 10 },
  progressBg: { height: 8, backgroundColor: '#f1f5f9', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', borderRadius: 4 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  progressText: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  daysText: { fontSize: 12, color: '#f59e0b', fontWeight: '500' },
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
