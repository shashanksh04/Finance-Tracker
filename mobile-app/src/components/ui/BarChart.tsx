import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius, fontSize, fontWeight } from '../../theme/tokens';

interface BarItem {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: BarItem[];
  maxValue?: number;
  height?: number;
  showValues?: boolean;
  showLabels?: boolean;
  formatValue?: (v: number) => string;
}

export default function BarChart({
  data, maxValue, height = 180, showValues = true, showLabels = true,
  formatValue = (v) => v.toLocaleString(),
}: BarChartProps) {
  const max = maxValue ?? Math.max(...data.map((d) => d.value), 1);
  const barH = height - (showValues ? 24 : 0);

  return (
    <View style={[styles.container, { height }]}>
      <View style={styles.bars}>
        {data.map((item, i) => {
          const pct = (item.value / max) * 100;
          return (
            <View key={i} style={styles.column}>
              {showValues && (
                <Text style={[styles.value, { color: item.color || colors.primary }]}>
                  {formatValue(item.value)}
                </Text>
              )}
              <View style={[styles.barTrack, { height: barH - 20 }]}>
                <View
                  style={[
                    styles.barFill,
                    {
                      height: `${pct}%`,
                      backgroundColor: item.color || colors.primary,
                    },
                  ]}
                />
              </View>
              {showLabels && (
                <Text style={styles.label} numberOfLines={1}>
                  {item.label}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: spacing.sm },
  bars: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', gap: spacing.xs },
  column: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  value: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, marginBottom: spacing.xs },
  barTrack: {
    width: '70%',
    backgroundColor: colors.border,
    borderRadius: radius.sm,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
    borderRadius: radius.sm,
    minHeight: 4,
  },
  label: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: spacing.xs, textAlign: 'center' },
});
