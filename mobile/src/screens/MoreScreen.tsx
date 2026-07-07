import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { useSyncStore } from '../stores/syncStore';

const menuSections = [
  {
    title: 'Financial',
    items: [
      { name: 'Budgets', icon: '📊', screen: 'Budgets' },
      { name: 'Goals', icon: '🎯', screen: 'Goals' },
      { name: 'Bills', icon: '📄', screen: 'Bills' },
      { name: 'Recurring', icon: '🔄', screen: 'Recurring' },
    ],
  },
  {
    title: 'Insights',
    items: [
      { name: 'Analysis', icon: '📈', screen: 'Analysis' },
      { name: 'AI Copilot', icon: '🤖', screen: 'Copilot' },
      { name: 'Scan Receipt', icon: '📷', screen: 'CameraOCR' },
      { name: 'Alerts', icon: '🔔', screen: 'Alerts' },
    ],
  },
  {
    title: 'Data',
    items: [
      { name: 'Categories', icon: '🏷️', screen: 'Categories' },
      { name: 'Settings', icon: '⚙️', screen: 'Settings' },
    ],
  },
];

export default function MoreScreen({ navigation }: any) {
  const { user, logout } = useAuthStore();
  const { status, performSync } = useSyncStore();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.profileName}>{user?.full_name || 'User'}</Text>
          <Text style={styles.profileEmail}>{user?.email || ''}</Text>
        </View>
      </View>

      <View style={styles.syncStatus}>
        <View style={styles.syncDot} />
        <Text style={styles.syncText}>
          {status.isSyncing ? 'Syncing...' : status.lastSyncedAt ? `Last synced: ${new Date(status.lastSyncedAt).toLocaleTimeString()}` : 'Not synced yet'}
        </Text>
        <TouchableOpacity onPress={() => performSync()} style={styles.syncBtn}>
          <Text style={styles.syncBtnText}>Sync Now</Text>
        </TouchableOpacity>
      </View>

      {menuSections.map((section, si) => (
        <View key={si} style={styles.menuSection}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.items.map((item) => (
            <TouchableOpacity
              key={item.name}
              style={styles.menuItem}
              onPress={() => navigation.navigate(item.screen)}
            >
              <Text style={styles.menuIcon}>{item.icon}</Text>
              <Text style={styles.menuName}>{item.name}</Text>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}

      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: '#fff', padding: 20, borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#0284c7', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 20, fontWeight: '700', color: '#fff' },
  profileName: { fontSize: 18, fontWeight: '600', color: '#0f172a' },
  profileEmail: { fontSize: 13, color: '#64748b', marginTop: 2 },
  syncStatus: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    padding: 12, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  syncDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981', marginRight: 8 },
  syncText: { flex: 1, fontSize: 12, color: '#64748b' },
  syncBtn: { paddingHorizontal: 12, paddingVertical: 4, backgroundColor: '#e0f2fe', borderRadius: 12 },
  syncBtnText: { fontSize: 12, color: '#0284c7', fontWeight: '600' },
  menuSection: { backgroundColor: '#fff', marginTop: 12, marginHorizontal: 16, borderRadius: 12, overflow: 'hidden' },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#64748b', textTransform: 'uppercase', padding: 16, paddingBottom: 8, paddingTop: 12 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  menuIcon: { fontSize: 18, marginRight: 12 },
  menuName: { flex: 1, fontSize: 15, color: '#0f172a' },
  menuArrow: { fontSize: 20, color: '#94a3b8' },
  logoutButton: { margin: 16, marginTop: 24, padding: 16, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', borderWidth: 1, borderColor: '#fecaca' },
  logoutText: { fontSize: 16, fontWeight: '600', color: '#dc2626' },
});
