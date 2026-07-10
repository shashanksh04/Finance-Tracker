import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Switch } from 'react-native';
import { alertsApi } from '../services/api';
import { useHaptics } from '../hooks/useHaptics';
import { useOfflineList } from '../hooks/useOfflineData';
import { repository } from '../database/repository';
import { TABLES } from '../database/schema';
import { ListSkeleton } from '../components/ui/SkeletonLoader';
import { formatDate } from '../utils/format';
import type { Alert, AlertPreferences } from '../types';
import { spacing, radius, fontSize, fontWeight, shadow } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

export default function AlertsScreen() {
  const { colors } = useTheme();
  const SEVERITY_COLORS: Record<string, string> = { critical: colors.danger, warning: colors.warning, info: colors.primary, success: colors.success };
  const { success: hapticSuccess, light: hapticLight } = useHaptics();
  const { data: alerts, loading, refreshing, refresh, refreshFromApi } = useOfflineList<Alert>(TABLES.ALERTS, {
    orderBy: 'created_at DESC',
    apiFetch: () => alertsApi.list({ unread_only: false }),
    mapApiResponse: (res) => res.data?.items || res.data || [],
  });
  const [preferences, setPreferences] = useState<AlertPreferences | null>(null);
  const [loadingPrefs, setLoadingPrefs] = useState(true);

  const loadPreferences = useCallback(async () => {
    try { const pRes = await alertsApi.getPreferences(); setPreferences(pRes.data); } catch { setPreferences(null as any); } finally { setLoadingPrefs(false); }
  }, []);
  React.useEffect(() => { loadPreferences(); }, [loadPreferences]);

  const markRead = async (id: string) => { try { await alertsApi.read(id); await repository.update(TABLES.ALERTS, id, { is_read: true }); hapticLight(); refresh(); } catch { Alert.alert('Error', 'Failed to mark alert as read.'); } };
  const dismiss = async (id: string) => { try { await alertsApi.dismiss(id); await repository.update(TABLES.ALERTS, id, { dismissed: true }); refresh(); } catch { Alert.alert('Error', 'Failed to dismiss alert.'); } };
  const generateAlerts = async () => { try { await alertsApi.generate(); refresh(); } catch { Alert.alert('Error', 'Failed to generate alerts.'); } };
  const togglePref = async (type: string) => {
    if (!preferences) return;
    try {
      const updated = { ...preferences, [type]: { ...preferences[type], enabled: !preferences[type].enabled } };
      await alertsApi.updatePreferences(type, { enabled: !preferences[type].enabled });
      setPreferences(updated);
    } catch { Alert.alert('Error', 'Failed to update preference.'); }
  };

  const visible = useMemo(() => alerts.filter((a) => !a.dismissed), [alerts]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    generateBtn: { backgroundColor: colors.primary, padding: spacing.lg, margin: spacing.md, borderRadius: radius.md, alignItems: 'center' },
    generateBtnText: { color: colors.textInverse, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
    section: { padding: spacing.md, paddingBottom: 0 },
    sectionTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
    prefRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, padding: spacing.lg, borderRadius: radius.md, marginBottom: spacing.sm, ...shadow.sm },
    prefName: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: colors.text, textTransform: 'capitalize' },
    prefDesc: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 2 },
    alertCard: { backgroundColor: colors.card, padding: spacing.lg, borderRadius: radius.md, marginBottom: spacing.sm, borderLeftWidth: 4, ...shadow.sm },
    alertHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
    alertSeverity: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
    alertDate: { fontSize: fontSize.xs, color: colors.textTertiary },
    alertTitle: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.text },
    alertMessage: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs },
    alertActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
    alertActionBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
    alertActionText: { fontSize: fontSize.xs, color: colors.primary, fontWeight: fontWeight.semibold },
    empty: { fontSize: fontSize.sm, color: colors.textTertiary, textAlign: 'center', padding: spacing.xl },
  }), [colors, spacing, radius, fontSize, fontWeight]);

  if (loading || loadingPrefs) return <ListSkeleton />;

  return (
    <View style={styles.container}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshFromApi} />}>
        <TouchableOpacity style={styles.generateBtn} onPress={generateAlerts}>
          <Text style={styles.generateBtnText}>Generate Alerts</Text>
        </TouchableOpacity>

        {preferences && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notification Preferences</Text>
            {Object.entries(preferences).map(([key, pref]) => (
              <View key={key} style={styles.prefRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.prefName}>{key.replace(/_/g, ' ')}</Text>
                  {pref.description ? <Text style={styles.prefDesc}>{pref.description}</Text> : null}
                </View>
                <Switch value={pref.enabled} onValueChange={() => togglePref(key)} trackColor={{ false: colors.border, true: colors.primaryLight }} thumbColor={pref.enabled ? colors.primary : colors.textTertiary} />
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Alerts ({visible.filter((a) => !a.is_read).length} unread)</Text>
          {visible.map((a) => (
            <View key={a.id} style={[styles.alertCard, { borderLeftColor: SEVERITY_COLORS[a.severity] || colors.textTertiary }]}>
              <View style={styles.alertHeader}>
                <Text style={[styles.alertSeverity, { color: SEVERITY_COLORS[a.severity] || colors.textTertiary }]}>{a.severity.toUpperCase()}</Text>
                <Text style={styles.alertDate}>{formatDate(a.created_at)}</Text>
              </View>
              <Text style={styles.alertTitle}>{a.title}</Text>
              {a.message ? <Text style={styles.alertMessage}>{a.message}</Text> : null}
              <View style={styles.alertActions}>
                {!a.is_read && (
                  <TouchableOpacity style={styles.alertActionBtn} onPress={() => markRead(a.id)}>
                    <Text style={styles.alertActionText}>Mark Read</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.alertActionBtn, { borderColor: colors.dangerLight }]} onPress={() => dismiss(a.id)}>
                  <Text style={[styles.alertActionText, { color: colors.danger }]}>Dismiss</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          {visible.length === 0 && <Text style={styles.empty}>No alerts</Text>}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

