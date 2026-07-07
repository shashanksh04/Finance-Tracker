import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Switch,
} from 'react-native';
import { alertsApi } from '../services/api';
import { Alert, AlertPreference } from '../types';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#dc2626', high: '#f59e0b', medium: '#3b82f6', low: '#94a3b8',
};

const SEVERITY_BG: Record<string, string> = {
  critical: '#fef2f2', high: '#fef3c7', medium: '#eff6ff', low: '#f8fafc',
};

export default function AlertsScreen() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [preferences, setPreferences] = useState<AlertPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const [aRes, pRes] = await Promise.all([alertsApi.getAll({ limit: 100 }), alertsApi.getPreferences()]);
      setAlerts(aRes.data || []);
      setPreferences(pRes.data || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetch().finally(() => setLoading(false)); }, [fetch]);
  const onRefresh = async () => { setRefreshing(true); await fetch(); setRefreshing(false); };

  const handleMarkRead = async (id: string) => {
    try { await alertsApi.markRead(id); await fetch(); } catch { /* ignore */ }
  };

  const handleDismiss = async (id: string) => {
    try { await alertsApi.dismiss(id); await fetch(); } catch { /* ignore */ }
  };

  const handleGenerate = async () => {
    try {
      await alertsApi.generate();
      await fetch();
    } catch { /* ignore */ }
  };

  const togglePreference = async (type: string, enabled: boolean) => {
    try {
      await alertsApi.updatePreference(type, { enabled });
      const res = await alertsApi.getPreferences();
      setPreferences(res.data || []);
    } catch { /* ignore */ }
  };

  if (loading) return <LoadingSpinner message="Loading alerts..." />;

  const unread = alerts.filter((a) => !a.is_read && !a.is_dismissed);
  const read = alerts.filter((a) => a.is_read || a.is_dismissed);

  return (
    <View style={styles.container}>
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.genBtn} onPress={handleGenerate}>
          <Text style={styles.genBtnText}>Generate Alerts</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.prefBtn} onPress={() => setShowPrefs(true)}>
          <Text style={styles.prefBtnText}>Preferences</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={[...unread, ...read]}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={alerts.length === 0 ? { flex: 1 } : { padding: 16, paddingTop: 4 }}
        ListEmptyComponent={<EmptyState title="No alerts" subtitle="You're all caught up!" />}
        ListHeaderComponent={
          unread.length > 0 ? <Text style={styles.sectionTitle}>New ({unread.length})</Text> : null
        }
        renderItem={({ item, index }) => {
          const showHeader = index === unread.length && read.length > 0;
          return (
            <View>
              {showHeader && <Text style={styles.sectionTitle}>Earlier ({read.length})</Text>}
              <View style={[styles.card, { backgroundColor: SEVERITY_BG[item.severity] || '#fff' }]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.severityDot, { backgroundColor: SEVERITY_COLORS[item.severity] || '#94a3b8' }]} />
                  <Text style={styles.alertType}>{item.type.replace(/_/g, ' ')}</Text>
                  {!item.is_read && <View style={styles.unreadBadge} />}
                </View>
                <Text style={styles.alertTitle}>{item.title}</Text>
                <Text style={styles.alertMessage}>{item.message}</Text>
                <View style={styles.cardActions}>
                  {!item.is_read && (
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleMarkRead(item.id)}>
                      <Text style={styles.actionBtnText}>Mark Read</Text>
                    </TouchableOpacity>
                  )}
                  {!item.is_dismissed && (
                    <TouchableOpacity style={[styles.actionBtn, styles.dismissBtn]} onPress={() => handleDismiss(item.id)}>
                      <Text style={[styles.actionBtnText, styles.dismissText]}>Dismiss</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          );
        }}
      />

      <Modal visible={showPrefs} onClose={() => setShowPrefs(false)} title="Alert Preferences" size="lg">
        <View style={{ padding: 20 }}>
          {preferences.length === 0 ? (
            <Text style={{ color: '#94a3b8', textAlign: 'center' }}>No preferences available</Text>
          ) : (
            preferences.map((pref) => (
              <View key={pref.id} style={styles.prefRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.prefLabel}>{pref.alert_type.replace(/_/g, ' ')}</Text>
                  {pref.threshold && <Text style={styles.prefThreshold}>Threshold: ₹{Number(pref.threshold).toLocaleString()}</Text>}
                </View>
                <Switch
                  value={pref.enabled}
                  onValueChange={(val) => togglePreference(pref.alert_type, val)}
                  trackColor={{ false: '#e2e8f0', true: '#93c5fd' }}
                  thumbColor={pref.enabled ? '#0284c7' : '#94a3b8'}
                />
              </View>
            ))
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  actionRow: { flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 4 },
  genBtn: { flex: 1, backgroundColor: '#0284c7', padding: 12, borderRadius: 8, alignItems: 'center' },
  genBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  prefBtn: { flex: 1, backgroundColor: '#f1f5f9', padding: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  prefBtnText: { color: '#64748b', fontWeight: '600', fontSize: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a', marginTop: 8, marginBottom: 8 },
  card: { padding: 14, borderRadius: 10, marginBottom: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  severityDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  alertType: { fontSize: 12, color: '#64748b', textTransform: 'capitalize', flex: 1 },
  unreadBadge: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3b82f6' },
  alertTitle: { fontSize: 15, fontWeight: '600', color: '#0f172a', marginBottom: 4 },
  alertMessage: { fontSize: 13, color: '#475569', lineHeight: 18 },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: '#e0f2fe' },
  actionBtnText: { fontSize: 12, color: '#0284c7', fontWeight: '600' },
  dismissBtn: { backgroundColor: '#f1f5f9' },
  dismissText: { color: '#94a3b8' },
  prefRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  prefLabel: { fontSize: 15, color: '#0f172a', fontWeight: '500', textTransform: 'capitalize' },
  prefThreshold: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
});
