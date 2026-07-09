import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { colors, spacing, radius, fontSize, fontWeight, shadow } from '../theme/tokens';
import { parseSmsTransaction } from '../services/smsParser';

export default function SmsImportScreen() {
  const [smsText, setSmsText] = useState('');
  const [result, setResult] = useState<{ amount: number; description: string; type: string; merchant?: string } | null>(null);

  const handleParse = () => {
    if (!smsText.trim()) return;
    const parsed = parseSmsTransaction(smsText);
    if (parsed) {
      setResult(parsed);
    } else {
      Alert.alert('No match', 'Could not parse a transaction from this SMS. Try a different message.');
      setResult(null);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.infoCard}>
        <Text style={styles.infoIcon}>💬</Text>
        <Text style={styles.infoTitle}>Import from SMS</Text>
        <Text style={styles.infoText}>
          Paste a bank SMS below to automatically extract the transaction details.
          Supports debit/credit messages from major Indian banks.
        </Text>
      </View>

      <Text style={styles.label}>Bank SMS</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={smsText}
        onChangeText={setSmsText}
        placeholder="Paste your bank SMS here..."
        placeholderTextColor={colors.textTertiary}
        multiline
        numberOfLines={4}
      />

      <TouchableOpacity style={styles.parseBtn} onPress={handleParse}>
        <Text style={styles.parseBtnText}>Parse Transaction</Text>
      </TouchableOpacity>

      {result && (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>Parsed Transaction</Text>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Description:</Text>
            <Text style={styles.resultValue}>{result.description}</Text>
          </View>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Amount:</Text>
            <Text style={styles.resultValue}>₹{result.amount}</Text>
          </View>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Type:</Text>
            <Text style={[styles.resultValue, { color: result.type === 'expense' ? colors.danger : colors.success }]}>{result.type}</Text>
          </View>
          {result.merchant && (
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Merchant:</Text>
              <Text style={styles.resultValue}>{result.merchant}</Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.exampleCard}>
        <Text style={styles.exampleTitle}>Example SMS</Text>
        <Text style={styles.exampleText}>
          "₹1,500 debited from HDFC Bank A/c xx1234 at SWIGGY on 15 Jan. Avl bal: ₹12,000"
        </Text>
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: 40 },
  infoCard: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.xl, alignItems: 'center', ...shadow.md, marginBottom: spacing.lg },
  infoIcon: { fontSize: 48, marginBottom: spacing.md },
  infoTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text, marginBottom: spacing.sm },
  infoText: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.textSecondary, marginBottom: spacing.xs },
  input: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, fontSize: fontSize.base, color: colors.text },
  textArea: { minHeight: 100, textAlignVertical: 'top', marginBottom: spacing.md },
  parseBtn: { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center', marginBottom: spacing.lg },
  parseBtnText: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: '#fff' },
  resultCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, ...shadow.sm, marginBottom: spacing.lg },
  resultTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text, marginBottom: spacing.md },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs },
  resultLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  resultValue: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
  exampleCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, borderLeftWidth: 3, borderLeftColor: colors.primary },
  exampleTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text, marginBottom: spacing.sm },
  exampleText: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 20, fontStyle: 'italic' },
});
