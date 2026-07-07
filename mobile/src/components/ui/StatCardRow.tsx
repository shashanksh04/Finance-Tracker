import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatCurrency } from '../../utils/format';

interface StatItem {
  label: string;
  amount: number;
  color: string;
  bgColor: string;
}

export default function StatCardRow({ items }: { items: StatItem[] }) {
  return (
    <View style={styles.row}>
      {items.map((item, idx) => (
        <View key={idx} style={[styles.card, { backgroundColor: item.bgColor }]}>
          <Text style={styles.label}>{item.label}</Text>
          <Text style={[styles.amount, { color: item.color }]}>
            {formatCurrency(item.amount)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, paddingHorizontal: 16 },
  card: { flex: 1, padding: 16, borderRadius: 12 },
  label: { fontSize: 13, color: '#475569', marginBottom: 4 },
  amount: { fontSize: 20, fontWeight: '700' },
});
