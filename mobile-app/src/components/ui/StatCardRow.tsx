import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface StatCard {
  label: string;
  value: string;
  color?: string;
  icon?: string;
}

interface StatCardRowProps {
  cards: StatCard[];
  columns?: number;
}

export default function StatCardRow({ cards, columns = 3 }: StatCardRowProps) {
  return (
    <View style={[styles.row, { flexDirection: 'row' as const }]}>
      {cards.map((card, i) => (
        <View key={i} style={[styles.card, { flex: 1 / columns }]}>
          {card.icon ? <Text style={styles.icon}>{card.icon}</Text> : null}
          <Text style={[styles.value, card.color ? { color: card.color } : undefined]}>
            {card.value}
          </Text>
          <Text style={styles.label}>{card.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9' },
  icon: { fontSize: 20, marginBottom: 4 },
  value: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  label: { fontSize: 11, color: '#64748b', marginTop: 2, textAlign: 'center' },
});
