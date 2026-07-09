import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { useSyncStore } from '../stores/syncStore';
import { formatRelativeTime, formatCurrency } from '../utils/format';
import { shareText, formatSummaryShare } from '../services/share';
import { useOfflineItem } from '../hooks/useOfflineData';
import { calculatePersonality } from '../data/personalities';
import PersonalityCard from '../components/PersonalityCard';
import { colors, spacing, radius, fontSize, fontWeight, shadow } from '../theme/tokens';

const menuSections = [
  {
    title: 'Financial',
    items: [
      { name: 'New Transaction', icon: '➕', screen: 'AddTransaction' },
      { name: 'Categories', icon: '🏷️', screen: 'Categories' },
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
    title: 'Engagement',
    items: [
      { name: 'Streaks', icon: '🔥', screen: 'Streaks' },
      { name: 'Badges', icon: '🏅', screen: 'Badges' },
      { name: 'Your Month', icon: '📖', screen: 'SpendingStory' },
    ],
  },
  {
    title: 'Platform',
    items: [
      { name: 'Import from SMS', icon: '💬', screen: 'SmsImport' },
      { name: 'Share Summary', icon: '📤', action: 'share' },
      { name: 'Sync Calendar', icon: '📅', screen: 'CalendarSync' },
    ],
  },
  {
    title: 'App',
    items: [
      { name: 'Settings', icon: '⚙️', screen: 'Settings' },
    ],
  },
];

export default function MoreScreen({ navigation }: any) {
  const { user, logout } = useAuthStore();
  const { status, lastSyncedAt, performSync } = useSyncStore();
  const { data: summary } = useOfflineItem('dashboard_summary', 'current');
  const personality = calculatePersonality({
    income: summary?.total_income || 0,
    expenses: summary?.total_expenses || 0,
    transactions: summary?.total_transactions || 0,
    streak: summary?.streak_days || 0,
    goals: summary?.savings_goals_count || 0,
    budgets: summary?.budgets_count || 0,
    ...(summary?.stats || {}),
  });

  return (
    <ScrollView style={styles.container}>
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.full_name?.charAt(0)?.toUpperCase() || 'U'}</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{user?.full_name || 'User'}</Text>
          <Text style={styles.profileEmail}>{user?.email || ''}</Text>
        </View>
      </View>

      {summary && <View style={styles.personalityWrapper}><PersonalityCard personality={personality} /></View>}

      <View style={styles.syncStatus}>
        <View style={[styles.syncDot, { backgroundColor: status === 'syncing' ? colors.warning : status === 'error' ? colors.danger : colors.success }]} />
        <Text style={styles.syncText}>
          {status === 'syncing' ? 'Syncing...' : lastSyncedAt ? `Last synced: ${formatRelativeTime(lastSyncedAt)}` : 'Not synced yet'}
        </Text>
        <TouchableOpacity onPress={performSync} style={styles.syncBtn} accessibilityLabel="Sync now" accessibilityRole="button">
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
              accessibilityLabel={item.name}
              accessibilityRole="button"
              onPress={() => {
                if ((item as any).action === 'share') {
                  shareText(formatSummaryShare(0, 0, 0));
                } else {
                  navigation.navigate((item as any).screen);
                }
              }}
            >
              <Text style={styles.menuIcon}>{item.icon}</Text>
              <Text style={styles.menuName}>{item.name}</Text>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}

      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  personalityWrapper: { padding: spacing.md, paddingBottom: 0 },
  container: { flex: 1, backgroundColor: colors.background },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, backgroundColor: colors.card, padding: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.border },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.textInverse },
  profileInfo: { flex: 1 },
  profileName: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.text },
  profileEmail: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  syncStatus: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, padding: spacing.md, paddingHorizontal: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.border },
  syncDot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.sm },
  syncText: { flex: 1, fontSize: fontSize.xs, color: colors.textSecondary },
  syncBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, backgroundColor: colors.primaryLight, borderRadius: radius.full },
  syncBtnText: { fontSize: fontSize.xs, color: colors.primary, fontWeight: fontWeight.semibold },
  menuSection: { backgroundColor: colors.card, marginTop: spacing.md, marginHorizontal: spacing.md, borderRadius: radius.md, overflow: 'hidden', ...shadow.sm },
  sectionTitle: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', padding: spacing.lg, paddingBottom: spacing.sm, letterSpacing: 0.5 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
  menuIcon: { fontSize: 20, marginRight: spacing.md },
  menuName: { flex: 1, fontSize: fontSize.base, color: colors.text },
  menuArrow: { fontSize: 22, color: colors.textTertiary },
  logoutBtn: { margin: spacing.md, marginTop: spacing.xxl, padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.card, alignItems: 'center', borderWidth: 1, borderColor: colors.dangerLight },
  logoutText: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.danger },
});
