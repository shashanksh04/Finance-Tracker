import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { spacing, radius, fontSize, fontWeight } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import BarChart from './ui/BarChart';

type ChartType = 'bar' | 'ring' | 'progress';

interface DataPoint {
  label: string;
  value: number;
  color?: string;
}

interface DataVisualizationHubProps {
  type: ChartType;
  data: DataPoint[];
  maxValue?: number;
  height?: number;
  formatValue?: (v: number) => string;
  total?: number;
  label?: string;
}

function ProgressRing({ value, total, color, size = 80, thickness = 8 }: { value: number; total: number; color: string; size?: number; thickness?: number }) {
  const { colors } = useTheme();
  const pct = total > 0 ? Math.min(value / total, 1) : 0;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: thickness, borderColor: colors.tagBg, justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
      <View style={{
        position: 'absolute', top: -thickness, left: -thickness,
        width: size, height: size, borderRadius: size / 2,
        borderWidth: thickness, borderColor: 'transparent',
        borderTopColor: color, borderRightColor: pct > 0.25 ? color : 'transparent',
        borderBottomColor: pct > 0.5 ? color : 'transparent',
        borderLeftColor: pct > 0.75 ? color : 'transparent',
        transform: [{ rotate: '-90deg' }],
      }} />
      <Text style={{ fontSize: fontSize.sm + 2, fontWeight: fontWeight.bold, color: colors.text }}>{Math.round(pct * 100)}%</Text>
    </View>
  );
}

export default function DataVisualizationHub({ type, data, maxValue, height, formatValue, total, label }: DataVisualizationHubProps) {
  const { colors } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    container: { alignItems: 'center' },
    label: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: spacing.xs, fontWeight: fontWeight.medium },
  }), [colors]);

  if (type === 'bar') {
    return <BarChart data={data} maxValue={maxValue} height={height} formatValue={formatValue} />;
  }

  if (type === 'ring') {
    const color = data[0]?.color || colors.primary;
    const val = data[0]?.value || 0;
    const tot = total || val;
    return (
      <View style={styles.container}>
        <ProgressRing value={val} total={tot} color={color} />
        {label ? <Text style={styles.label}>{label}</Text> : null}
      </View>
    );
  }

  if (type === 'progress') {
    const max = maxValue || Math.max(...data.map((d) => d.value), 1);
    return (
      <View style={{ width: '100%', gap: spacing.sm }}>
        {data.map((d, i) => {
          const pct = max > 0 ? (d.value / max) * 100 : 0;
          return (
            <View key={i} style={{ gap: spacing.xs }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary }}>{d.label}</Text>
                <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text }}>
                  {formatValue ? formatValue(d.value) : d.value}
                </Text>
              </View>
              <View style={{ height: 8, backgroundColor: colors.tagBg, borderRadius: radius.full, overflow: 'hidden' }}>
                <View style={{ width: `${pct}%`, height: '100%', backgroundColor: d.color || colors.primary, borderRadius: radius.full }} />
              </View>
            </View>
          );
        })}
      </View>
    );
  }

  return null;
}
