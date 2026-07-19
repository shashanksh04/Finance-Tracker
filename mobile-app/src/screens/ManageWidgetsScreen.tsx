import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { usePreferencesStore, WidgetId } from '../stores/preferencesStore';
import { spacing, radius, fontSize, fontWeight, shadow } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { useHaptics } from '../hooks/useHaptics';

interface WidgetDef {
  id: WidgetId;
  label: string;
  icon: string;
  description: string;
}

const ALL_WIDGETS: WidgetDef[] = [
  { id: 'balance', label: 'Total Balance', icon: '💰', description: 'Your overall balance with income/expense breakdown' },
  { id: 'recent', label: 'Recent Transactions', icon: '📋', description: 'Last 5 transactions at a glance' },
  { id: 'streaks', label: 'Active Streaks', icon: '🔥', description: 'Daily logging streak tracker' },
  { id: 'goals', label: 'Goal Progress', icon: '🎯', description: 'Progress ring for savings goals' },
  { id: 'budgets', label: 'Top Budget', icon: '📊', description: 'Budget spending progress bar' },
];

const WIDGET_ORDER: WidgetId[] = ['balance', 'recent', 'streaks', 'goals', 'budgets'];

export default function ManageWidgetsScreen() {
  const { colors } = useTheme();
  const { light: hapticLight } = useHaptics();
  const { prefs, update } = usePreferencesStore();

  const enabledWidgets = useMemo(() => new Set(prefs.dashboardLayout), [prefs.dashboardLayout]);

  const toggleWidget = (id: WidgetId) => {
    hapticLight();
    const current = prefs.dashboardLayout;
    const updated = current.includes(id)
      ? current.filter((w) => w !== id)
      : [...current, id];
    update({ dashboardLayout: updated });
  };

  const moveUp = (id: WidgetId) => {
    hapticLight();
    const current = [...prefs.dashboardLayout];
    const idx = current.indexOf(id);
    if (idx > 0) {
      [current[idx - 1], current[idx]] = [current[idx], current[idx - 1]];
      update({ dashboardLayout: current });
    }
  };

  const moveDown = (id: WidgetId) => {
    hapticLight();
    const current = [...prefs.dashboardLayout];
    const idx = current.indexOf(id);
    if (idx < current.length - 1) {
      [current[idx], current[idx + 1]] = [current[idx + 1], current[idx]];
      update({ dashboardLayout: current });
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.md, paddingBottom: spacing.xxxl },
    introCard: {
      backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.xl,
      marginBottom: spacing.lg, ...shadow.md,
    },
    introTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text, marginBottom: spacing.sm },
    introText: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 20 },
    widgetRow: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
      padding: spacing.lg, borderRadius: radius.lg, marginBottom: spacing.sm,
      gap: spacing.md, ...shadow.sm,
    },
    widgetIcon: { fontSize: 24, width: 36, textAlign: 'center' },
    widgetInfo: { flex: 1 },
    widgetName: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.text },
    widgetDesc: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 2 },
    moveBtn: { fontSize: 20, color: colors.textTertiary, padding: spacing.xs },
    disabledBtn: { opacity: 0.3 },
    orderIndicator: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: spacing.xs },
  }), [colors]);

  const displayedWidgets = WIDGET_ORDER.filter((w) => prefs.dashboardLayout.includes(w) || !prefs.dashboardLayout.includes(w));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.introCard}>
        <Text style={styles.introTitle}>🧩 Customize Your Feed</Text>
        <Text style={styles.introText}>
          Toggle widgets on or off to control what appears on your Home screen.
          Use the arrow buttons to reorder them.
        </Text>
      </View>

      {ALL_WIDGETS.map((widget) => {
        const isEnabled = enabledWidgets.has(widget.id);
        const orderIdx = prefs.dashboardLayout.indexOf(widget.id);
        const canMoveUp = orderIdx > 0;
        const canMoveDown = orderIdx < prefs.dashboardLayout.length - 1;

        return (
          <View key={widget.id} style={[styles.widgetRow, !isEnabled && { opacity: 0.6 }]}>
            <Text style={styles.widgetIcon}>{widget.icon}</Text>
            <View style={styles.widgetInfo}>
              <Text style={styles.widgetName}>{widget.label}</Text>
              <Text style={styles.widgetDesc}>{widget.description}</Text>
              {isEnabled && (
                <Text style={styles.orderIndicator}>Position {orderIdx + 1} of {prefs.dashboardLayout.length}</Text>
              )}
            </View>
            {isEnabled && (
              <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                <TouchableOpacity onPress={() => moveUp(widget.id)} disabled={!canMoveUp} accessibilityLabel="Move up" accessibilityRole="button">
                  <Text style={[styles.moveBtn, !canMoveUp && styles.disabledBtn]}>▲</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => moveDown(widget.id)} disabled={!canMoveDown} accessibilityLabel="Move down" accessibilityRole="button">
                  <Text style={[styles.moveBtn, !canMoveDown && styles.disabledBtn]}>▼</Text>
                </TouchableOpacity>
              </View>
            )}
            <Switch
              value={isEnabled}
              onValueChange={() => toggleWidget(widget.id)}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={isEnabled ? colors.primary : colors.textTertiary}
              accessibilityLabel={`Toggle ${widget.label}`}
            />
          </View>
        );
      })}
    </ScrollView>
  );
}
