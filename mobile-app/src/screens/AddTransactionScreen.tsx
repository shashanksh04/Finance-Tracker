import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Switch, KeyboardAvoidingView, Platform } from 'react-native';
import { colors, spacing, radius, fontSize, fontWeight, shadow } from '../theme/tokens';
import LocationPicker from '../components/LocationPicker';

export default function AddTransactionScreen({ route, navigation }: any) {
  const prefill = route?.params?.prefill || {};
  const [description, setDescription] = useState(prefill.description || '');
  const [amount, setAmount] = useState(prefill.amount?.toString() || '');
  const [isExpense, setIsExpense] = useState(prefill.is_expense !== false);
  const [category, setCategory] = useState(prefill.category || '');
  const [date, setDate] = useState(prefill.date || new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState<{ latitude: number; longitude: number; address?: string; name?: string } | null>(null);

  const handleSave = () => {
    const txn = {
      description,
      amount: parseFloat(amount) || 0,
      type: isExpense ? 'expense' : 'income',
      category,
      date,
      notes,
      location,
    };
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.typeToggle}>
        <TouchableOpacity
          style={[styles.typeBtn, isExpense && styles.typeBtnActive]}
          onPress={() => setIsExpense(true)}
        >
          <Text style={[styles.typeBtnText, isExpense && styles.typeBtnTextActive]}>Expense</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.typeBtn, !isExpense && styles.typeBtnActive]}
          onPress={() => setIsExpense(false)}
        >
          <Text style={[styles.typeBtnText, !isExpense && styles.typeBtnTextActive]}>Income</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Description</Text>
      <TextInput style={styles.input} value={description} onChangeText={setDescription} placeholder="e.g., Groceries" placeholderTextColor={colors.textTertiary} />

      <Text style={styles.label}>Amount (₹)</Text>
      <TextInput style={styles.input} value={amount} onChangeText={setAmount} placeholder="0.00" placeholderTextColor={colors.textTertiary} keyboardType="decimal-pad" />

      <Text style={styles.label}>Category</Text>
      <TextInput style={styles.input} value={category} onChangeText={setCategory} placeholder="e.g., Food" placeholderTextColor={colors.textTertiary} />

      <Text style={styles.label}>Date</Text>
      <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textTertiary} />

      <Text style={styles.label}>Notes</Text>
      <TextInput style={[styles.input, styles.textArea]} value={notes} onChangeText={setNotes} placeholder="Optional notes..." placeholderTextColor={colors.textTertiary} multiline numberOfLines={3} />

      <Text style={styles.label}>Location</Text>
      <LocationPicker location={location} onLocationChange={setLocation} />

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
        <Text style={styles.saveBtnText}>Save Transaction</Text>
      </TouchableOpacity>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: 40 },
  typeToggle: { flexDirection: 'row', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', marginBottom: spacing.lg },
  typeBtn: { flex: 1, paddingVertical: spacing.md, alignItems: 'center', backgroundColor: colors.card },
  typeBtnActive: { backgroundColor: colors.primary },
  typeBtnText: { fontSize: fontSize.md, fontWeight: fontWeight.medium, color: colors.textSecondary },
  typeBtnTextActive: { color: '#fff' },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.md },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    fontSize: fontSize.base,
    color: colors.text,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  saveBtnText: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: '#fff' },
});
