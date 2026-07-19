import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { transactionsApi, accountsApi } from '../services/api';
import { useHaptics } from '../hooks/useHaptics';
import { useOfflineList } from '../hooks/useOfflineData';
import { repository } from '../database/repository';
import { TABLES } from '../database/schema';
import { useTheme } from '../theme/ThemeContext';
import { spacing, radius, fontSize, fontWeight, shadow } from '../theme/tokens';
import type { Account } from '../types';

interface SplitLine {
  accountId: string;
  amount: string;
}

export default function QuickSplitScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { light: hapticLight, success: hapticSuccess } = useHaptics();
  const { data: accounts } = useOfflineList<Account>(TABLES.ACCOUNTS, {
    apiFetch: () => accountsApi.list(),
    mapApiResponse: (res) => res.data?.items || res.data || [],
  });

  const [description, setDescription] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [splits, setSplits] = useState<SplitLine[]>([
    { accountId: '', amount: '' },
    { accountId: '', amount: '' },
  ]);
  const [saving, setSaving] = useState(false);

  const updateSplit = (index: number, field: 'accountId' | 'amount', value: string) => {
    const updated = [...splits];
    updated[index] = { ...updated[index], [field]: value };
    setSplits(updated);
  };

  const addSplit = () => {
    setSplits([...splits, { accountId: '', amount: '' }]);
  };

  const removeSplit = (index: number) => {
    if (splits.length <= 2) return;
    setSplits(splits.filter((_, i) => i !== index));
  };

  const totalSplit = splits.reduce((s, sp) => s + (parseFloat(sp.amount) || 0), 0);

  const handleSave = async () => {
    if (!description || !totalAmount || splits.some((s) => !s.accountId || !s.amount)) {
      Alert.alert('Error', 'Fill all fields');
      return;
    }
    const total = parseFloat(totalAmount);
    if (Math.abs(totalSplit - total) > 0.01) {
      Alert.alert('Error', `Split totals (${totalSplit}) don't match total (${total})`);
      return;
    }
    setSaving(true);
    try {
      await Promise.all(splits.map(async (sp) => {
        const amount = parseFloat(sp.amount);
        const data = { amount, description, account_id: sp.accountId, date: new Date().toISOString().slice(0, 10) };
        const res = await transactionsApi.create(data);
        await repository.create(TABLES.TRANSACTIONS, res.data);
      }));
      hapticSuccess();
      Alert.alert('Done', 'Split transactions created');
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to create splits');
    } finally { setSaving(false); }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.md, paddingBottom: 40 },
    label: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.md },
    input: {
      backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1,
      borderColor: colors.border, padding: spacing.md, fontSize: fontSize.base, color: colors.text,
    },
    splitCard: {
      backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg,
      marginTop: spacing.sm, ...shadow.sm,
    },
    splitHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
    splitTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
    removeBtn: { fontSize: 16, color: colors.danger, padding: spacing.xs },
    accountChip: {
      paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.full,
      borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, marginRight: spacing.sm, marginBottom: spacing.sm,
    },
    accountChipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
    accountChipText: { fontSize: fontSize.sm, color: colors.textSecondary },
    accountChipTextActive: { color: colors.primary, fontWeight: fontWeight.semibold },
    summaryRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      backgroundColor: colors.card, padding: spacing.lg, borderRadius: radius.md, marginTop: spacing.md,
    },
    summaryLabel: { fontSize: fontSize.sm, color: colors.textTertiary },
    summaryValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },
    summaryMatch: { color: colors.success },
    summaryMismatch: { color: colors.danger },
    addBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
      padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
      borderStyle: 'dashed', marginTop: spacing.md,
    },
    addBtnText: { fontSize: fontSize.base, color: colors.primary, fontWeight: fontWeight.medium },
    saveBtn: {
      backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.lg,
      alignItems: 'center', marginTop: spacing.xl,
    },
    saveBtnText: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.textInverse },
    totalInputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    totalPrefix: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.text },
  }), [colors]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={[styles.label, { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text, marginBottom: spacing.md }]}>Split Transaction</Text>
      <Text style={styles.label}>Description</Text>
      <TextInput
        style={styles.input}
        value={description}
        onChangeText={setDescription}
        placeholder="What was this for?"
        placeholderTextColor={colors.textTertiary}
      />
      <Text style={styles.label}>Total Amount</Text>
      <View style={styles.totalInputRow}>
        <Text style={styles.totalPrefix}>₹</Text>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={totalAmount}
          onChangeText={setTotalAmount}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={colors.textTertiary}
        />
      </View>

      {splits.map((split, i) => (
        <View key={i} style={styles.splitCard}>
          <View style={styles.splitHeader}>
            <Text style={styles.splitTitle}>Split {i + 1}</Text>
            {splits.length > 2 && (
              <TouchableOpacity onPress={() => removeSplit(i)} accessibilityLabel="Remove split" accessibilityRole="button">
                <Text style={styles.removeBtn}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.label}>Account</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {accounts.map((a) => (
              <TouchableOpacity
                key={a.id}
                style={[styles.accountChip, split.accountId === a.id && styles.accountChipActive]}
                onPress={() => updateSplit(i, 'accountId', a.id)}
              >
                <Text style={[styles.accountChipText, split.accountId === a.id && styles.accountChipTextActive]}>{a.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={styles.label}>Amount</Text>
          <View style={styles.totalInputRow}>
            <Text style={styles.totalPrefix}>₹</Text>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={split.amount}
              onChangeText={(v) => updateSplit(i, 'amount', v)}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={colors.textTertiary}
            />
          </View>
        </View>
      ))}

      <TouchableOpacity style={styles.addBtn} onPress={addSplit} accessibilityLabel="Add split" accessibilityRole="button">
        <Text style={{ fontSize: 18, color: colors.primary }}>+</Text>
        <Text style={styles.addBtnText}>Add Split</Text>
      </TouchableOpacity>

      <View style={styles.summaryRow}>
        <View>
          <Text style={styles.summaryLabel}>Total Split</Text>
          <Text style={[styles.summaryValue, { color: colors.text }]}>₹{totalSplit.toFixed(2)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.summaryLabel}>Target</Text>
          <Text style={[styles.summaryValue, Math.abs(totalSplit - (parseFloat(totalAmount) || 0)) < 0.01 ? styles.summaryMatch : styles.summaryMismatch]}>
            ₹{(parseFloat(totalAmount) || 0).toFixed(2)}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, saving && { opacity: 0.5 }]}
        onPress={handleSave}
        disabled={saving}
        accessibilityLabel="Create split transactions"
        accessibilityRole="button"
      >
        {saving ? <ActivityIndicator color={colors.textInverse} /> : <Text style={styles.saveBtnText}>Create {splits.length} Transactions</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}
