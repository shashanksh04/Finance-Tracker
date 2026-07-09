import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius, fontSize, fontWeight } from '../../theme/tokens';

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
    <View style={styles.row}>
      {cards.map((card, i) => (
        <View key={i} style={[styles.card, { flex: 1 / columns }]} accessibilityLabel={`${card.label}: ${card.value}`}>
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
  row: { flexDirection: 'row', gap: spacing.sm, padding: spacing.lg },
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md + 2, alignItems: 'center', borderWidth: 1, borderColor: colors.tagBg },
  icon: { fontSize: fontSize.xl, marginBottom: spacing.xs },
  value: { fontSize: fontSize.lg + 1, fontWeight: fontWeight.bold, color: colors.text },
  label: { fontSize: fontSize.xs, color: colors.slate500, marginTop: 2, textAlign: 'center' },
});
