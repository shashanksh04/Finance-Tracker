import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../stores/authStore';
import { useSyncStore } from '../stores/syncStore';
import { formatRelativeTime } from '../utils/format';
import { shareText, formatSummaryShare } from '../services/share';
import { useOfflineItem } from '../hooks/useOfflineData';
import { calculatePersonality } from '../data/personalities';
import PersonalityCard from '../components/PersonalityCard';
import { spacing, radius, fontSize, fontWeight, shadow } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { useHaptics } from '../hooks/useHaptics';

const menuSections = [
  {
    title: 'Manage',
    items: [
      { name: 'New Transaction', icon: '➕', screen: 'AddTransaction', desc: 'Add income or expense' },
      { name: 'Categories', icon: '🏷️', screen: 'Categories', desc: 'Organize your spending' },
      { name: 'Budgets', icon: '📊', screen: 'Budgets', desc: 'Set monthly limits' },
      { name: 'Goals', icon: '🎯', screen: 'Goals', desc: 'Track savings targets' },
      { name: 'Bills', icon: '📄', screen: 'Bills', desc: 'Manage payments' },
      { name: 'Recurring', icon: '🔄', screen: 'Recurring', desc: 'Automated transactions' },
    ],
  },
  {
    title: 'Insights',
    items: [
      { name: 'Analysis', icon: '📈', screen: 'Analysis', desc: 'Visual spending breakdown' },
      { name: 'AI Copilot', icon: '🤖', screen: 'Copilot', desc: 'Ask about your finances' },
      { name: 'Scan Receipt', icon: '📷', screen: 'CameraOCR', desc: 'Import from photo' },
      { name: 'Import from SMS', icon: '💬', screen: 'SmsImport', desc: 'Parse bank messages' },
      { name: 'Alerts', icon: '🔔', screen: 'Alerts', desc: 'Smart notifications' },
    ],
  },
  {
    title: 'Engagement',
    items: [
      { name: 'Streaks', icon: '🔥', screen: 'Streaks', desc: 'Consistency tracker' },
      { name: 'Badges', icon: '🏅', screen: 'Badges', desc: 'Achievements unlocked' },
      { name: 'Your Month', icon: '📖', screen: 'SpendingStory', desc: 'Personal finance story' },
    ],
  },
  {
    title: 'Platform',
    items: [
      { name: 'Sync Calendar', icon: '📅', screen: 'CalendarSync', desc: 'Add bill reminders' },
      { name: 'Share Summary', icon: '📤', action: 'share', desc: 'Share your stats' },
    ],
  },
];

export default function MoreScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const { light: hapticLight } = useHaptics();
  const { user, logout } = useAuthStore();
  const { status, lastSyncedAt, performSync } = useSyncStore();
  const { data: summary } = useOfflineItem('dashboard_summary', 'current');

  const personality = useMemo(() => calculatePersonality({
    income: summary?.total_income || 0,
    expenses: summary?.total_expenses || 0,
    transactions: summary?.total_transactions || 0,
    streak: summary?.streak_days || 0,
    goals: summary?.savings_goals_count || 0,
    budgets: summary?.budgets_count || 0,
    ...(summary?.stats || {}),
  }), [summary]);

  const styles = useMemo(() => StyleSheet.create({
    screenTitle: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.text, padding: spacing.lg, paddingBottom: spacing.sm, paddingTop: spacing.lg },
    container: { flex: 1, backgroundColor: colors.background },
    profileCard: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.lg,
      backgroundColor: colors.card, padding: spacing.lg, marginHorizontal: spacing.md, marginTop: spacing.sm,
      borderRadius: radius.xl,
    },
    avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
    avatarText: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.textInverse },
    profileInfo: { flex: 1 },
    profileName: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.text },
    profileEmail: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
    personalityWrapper: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
    syncStatus: {
      flexDirection: 'row', alignItems: 'center',
      marginHorizontal: spacing.md, marginTop: spacing.sm,
      padding: spacing.md, borderRadius: radius.md,
      backgroundColor: colors.card,
    },
    syncDot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.sm },
    syncText: { flex: 1, fontSize: fontSize.xs, color: colors.textSecondary },
    syncBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, backgroundColor: colors.primaryLight, borderRadius: radius.full },
    syncBtnText: { fontSize: fontSize.xs, color: colors.primary, fontWeight: fontWeight.semibold },
    menuSection: { marginHorizontal: spacing.md, marginTop: spacing.md, borderRadius: radius.lg, overflow: 'hidden' },
    sectionTitle: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', padding: spacing.md, paddingBottom: spacing.xs, letterSpacing: 0.5 },
    menuItem: {
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: spacing.md + 2, paddingHorizontal: spacing.lg,
      backgroundColor: colors.card,
      borderBottomWidth: 1, borderBottomColor: colors.background,
    },
    menuIcon: { fontSize: 22, width: 32, textAlign: 'center', marginRight: spacing.md, opacity: 0.9 },
    menuContent: { flex: 1 },
    menuName: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: colors.text },
    menuDesc: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 1 },
    menuArrow: { fontSize: 18, color: colors.textTertiary, opacity: 0.5 },
    logoutBtn: {
      marginHorizontal: spacing.md, marginTop: spacing.xxl, marginBottom: spacing.xxxl,
      padding: spacing.md, borderRadius: radius.md,
      backgroundColor: colors.dangerLight,
      alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: spacing.sm,
    },
    logoutText: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.danger },
    logoutIcon: { fontSize: 16 },
  }), [colors]);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => { hapticLight(); logout(); } },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.screenTitle}>More</Text>

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.full_name?.charAt(0)?.toUpperCase() || 'U'}</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{user?.full_name || 'User'}</Text>
          <Text style={styles.profileEmail}>{user?.email || ''}</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.getParent()?.navigate('Settings')} accessibilityLabel="Settings" accessibilityRole="button">
          <Text style={{ fontSize: 22, color: colors.textTertiary }}>⚙️</Text>
        </TouchableOpacity>
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
        <View key={si}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.items.map((item) => (
            <TouchableOpacity
              key={item.name}
              style={styles.menuItem}
              accessibilityLabel={item.name}
              accessibilityRole="button"
              onPress={() => {
                hapticLight();
                if ((item as any).action === 'share') {
                  shareText(formatSummaryShare(0, 0, 0));
                } else {
                  navigation.getParent()?.navigate((item as any).screen);
                }
              }}
            >
              <Text style={styles.menuIcon}>{item.icon}</Text>
              <View style={styles.menuContent}>
                <Text style={styles.menuName}>{item.name}</Text>
                {item.desc ? <Text style={styles.menuDesc}>{item.desc}</Text> : null}
              </View>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} accessibilityLabel="Sign out" accessibilityRole="button">
        <Text style={styles.logoutIcon}>🚪</Text>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}