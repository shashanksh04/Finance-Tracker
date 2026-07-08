import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { alertsApi } from '../services/api';
import { useHaptics } from '../hooks/useHaptics';
import Modal from '../components/ui/Modal';
import { formatRelativeTime } from '../utils/format';
import type { Alert as AlertType, AlertSeverity } from '../types';

const SEVERITY_COLORS: Record<AlertSeverity, { bg: string; text: string; icon: string }> = {
  info: { bg: '#e0f2fe', text: '#0284c7', icon: 'ℹ️' },
  warning: { bg: '#fef3c7', text: '#f59e0b', icon: '⚠️' },
  critical: { bg: '#fce7f3', text: '#ef4444', icon: '🚨' },
};

export default function AlertsScreen() {
  const { success: hapticSuccess, light: hapticLight } = useHaptics();
  const [alerts, setAlerts] = useState<AlertType[]>([]);
  const [preferences, setPreferences] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [aRes, pRes] = await Promise.all([alertsApi.list({ unread_only: false }), alertsApi.getPreferences()]);
      setAlerts(aRes.data?.items || aRes.data || []);
      setPreferences(pRes.data);
    } catch {
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleMarkRead = async (id: string) => {
    try { await alertsApi.read(id); hapticLight(); fetchData(); } catch {}
  };

  const handleDismiss = async (id: string) => {
    try { await alertsApi.dismiss(id); fetchData(); } catch {}
  };

  const handleGenerate = async () => {
    try {
      await alertsApi.generate();
      hapticSuccess();
      fetchData();
    } catch {}
  };

  const togglePreference = async (type: string) => {
    if (!preferences?.[type]) return;
    try {
      await alertsApi.updatePreferences(type, { enabled: !preferences[type].enabled });
      fetchData();
    } catch {}
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#0284c7" /></View>;

  const active = alerts.filter((a) => !a.is_dismissed);
  const unread = active.filter((a) => !a.is_read);

  return (
    <View style={styles.container}>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleGenerate}>
          <Text style={styles.actionBtnText}>Generate Alerts</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.prefsBtn]} onPress={() => setShowPrefs(true)}>
          <Text style={styles.actionBtnText}>Preferences</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.countRow}>
        <Text style={styles.countText}>{unread.length} unread · {active.length} active</Text>
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}>
        {active.map((a) => {
          const sev = SEVERITY_COLORS[a.severity] || SEVERITY_COLORS.info;
          return (
            <View key={a.id} style={[styles.alertCard, !a.is_read && styles.unreadCard]}>
              <View style={[styles.severityBar, { backgroundColor: sev.text }]} />
              <View style={styles.alertBody}>
                <View style={styles.alertHeader}>
                  <Text style={styles.alertIcon}>{sev.icon}</Text>
                  <Text style={styles.alertTitle}>{a.title}</Text>
                </View>
                <Text style={styles.alertMsg}>{a.message}</Text>
                <Text style={styles.alertTime}>{formatRelativeTime(a.created_at)}</Text>
                <View style={styles.alertActions}>
                  {!a.is_read && (
                    <TouchableOpacity style={styles.alertActionBtn} onPress={() => handleMarkRead(a.id)}>
                      <Text style={styles.alertActionText}>Mark Read</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={[styles.alertActionBtn, styles.dismissBtn]} onPress={() => handleDismiss(a.id)}>
                    <Text style={[styles.alertActionText, { color: '#94a3b8' }]}>Dismiss</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}
        {active.length === 0 && <Text style={styles.emptyText}>All clear! No alerts.</Text>}
        <View style={{ height: 80 }} />
      </ScrollView>

      <Modal visible={showPrefs} onClose={() => setShowPrefs(false)} title="Alert Preferences">
        <View style={styles.prefsContainer}>
          {preferences && Object.entries(preferences).map(([key, pref]: [string, any]) => (
            <View key={key} style={styles.prefRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.prefName}>{key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}</Text>
                {pref.threshold !== undefined && <Text style={styles.prefDetail}>Threshold: {pref.threshold}</Text>}
              </View>
              <TouchableOpacity
                style={[styles.toggleSwitch, pref.enabled ? styles.toggleOn : styles.toggleOff]}
                onPress={() => togglePreference(key)}
              >
                <View style={[styles.toggleKnob, pref.enabled ? styles.knobOn : styles.knobOff]} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  actions: { flexDirection: 'row', padding: 12, gap: 8 },
  actionBtn: { flex: 1, backgroundColor: '#0284c7', padding: 12, borderRadius: 10, alignItems: 'center' },
  actionBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  prefsBtn: { backgroundColor: '#64748b' },
  countRow: { paddingHorizontal: 12, paddingBottom: 4 },
  countText: { fontSize: 12, color: '#64748b' },
  alertCard: { flexDirection: 'row', backgroundColor: '#fff', margin: 12, marginBottom: 4, borderRadius: 12, overflow: 'hidden' },
  unreadCard: { borderWidth: 1, borderColor: '#93c5fd' },
  severityBar: { width: 4 },
  alertBody: { flex: 1, padding: 14 },
  alertHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  alertIcon: { fontSize: 16 },
  alertTitle: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  alertMsg: { fontSize: 13, color: '#64748b', marginTop: 4, lineHeight: 18 },
  alertTime: { fontSize: 11, color: '#94a3b8', marginTop: 6 },
  alertActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  alertActionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#e0f2fe' },
  alertActionText: { fontSize: 12, color: '#0284c7', fontWeight: '600' },
  dismissBtn: { backgroundColor: '#f1f5f9' },
  emptyText: { fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: 20 },
  prefsContainer: { padding: 20 },
  prefRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  prefName: { fontSize: 15, color: '#0f172a', fontWeight: '500', textTransform: 'capitalize' },
  prefDetail: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  toggleSwitch: { width: 48, height: 28, borderRadius: 14, justifyContent: 'center', padding: 2 },
  toggleOn: { backgroundColor: '#0284c7' },
  toggleOff: { backgroundColor: '#e2e8f0' },
  toggleKnob: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff' },
  knobOn: { alignSelf: 'flex-end' },
  knobOff: { alignSelf: 'flex-start' },
});
