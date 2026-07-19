import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, TextInput, Switch } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../stores/authStore';
import { useSyncStore } from '../stores/syncStore';
import { usePreferencesStore } from '../stores/preferencesStore';
import { formatRelativeTime } from '../utils/format';
import { shareText, formatSummaryShare } from '../services/share';
import { useOfflineItem } from '../hooks/useOfflineData';
import { calculatePersonality } from '../data/personalities';
import PersonalityCard from '../components/PersonalityCard';
import AdaptiveSheet from '../components/AdaptiveSheet';
import { setBiometricEnabled } from '../components/BiometricGate';
import { spacing, radius, fontSize, fontWeight, shadow } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { useHaptics } from '../hooks/useHaptics';

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'SGD', 'CHF', 'CNY'];

const menuSections = [
  {
    title: 'Tools',
    items: [
      { name: 'Categories', icon: '🏷️', screen: 'Categories', desc: 'Organize your spending' },
      { name: 'Alerts', icon: '🔔', screen: 'Alerts', desc: 'Smart notifications' },
      { name: 'Analysis', icon: '📈', screen: 'Analysis', desc: 'Visual spending breakdown' },
    ],
  },
  {
    title: 'Data',
    items: [
      { name: 'Calendar Sync', icon: '📅', screen: 'CalendarSync', desc: 'Add bill reminders' },
      { name: 'Spending Story', icon: '📖', screen: 'SpendingStory', desc: 'Personal finance story' },
      { name: 'Badges & Streaks', icon: '🏅', screen: 'BadgesStreaks', desc: 'Achievements unlocked' },
      { name: 'Manage Widgets', icon: '🧩', screen: 'ManageWidgets', desc: 'Customize your Home feed' },
    ],
  },
  {
    title: 'Share',
    items: [
      { name: 'Share Summary', icon: '📤', action: 'share', desc: 'Share your stats' },
    ],
  },
];

export default function SystemScreen() {
  const navigation = useNavigation<any>();
  const { colors, isDark, setDark, toggleTheme } = useTheme();
  const { light: hapticLight } = useHaptics();
  const { user, logout } = useAuthStore();
  const { status, lastSyncedAt, pendingChanges, error: syncError, performSync } = useSyncStore();
  const { prefs, update } = usePreferencesStore();
  const { data: summary } = useOfflineItem('dashboard_summary', 'current');

  // Chat state (inline Copilot)
  const [chatExpanded, setChatExpanded] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // Settings modals
  const [showProfile, setShowProfile] = useState(false);
  const [showCurrency, setShowCurrency] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');

  const personality = useMemo(() => calculatePersonality({
    income: summary?.total_income || 0,
    expenses: summary?.total_expenses || 0,
    transactions: summary?.total_transactions || 0,
    streak: summary?.streak_days || 0,
    goals: summary?.savings_goals_count || 0,
    budgets: summary?.budgets_count || 0,
    ...(summary?.stats || {}),
  }), [summary]);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => { hapticLight(); logout(); } },
    ]);
  };

  const handleUpdateProfile = async () => {
    if (!fullName.trim()) { Alert.alert('Error', 'Name cannot be empty'); return; }
    try {
      const { authApi } = require('../services/api');
      await authApi.updateProfile({ full_name: fullName.trim() });
      setShowProfile(false);
      Alert.alert('Success', 'Profile updated');
    } catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Update failed'); }
  };

  const handleChangePassword = async () => {
    if (!currentPw || !newPw) { Alert.alert('Error', 'Fill both fields'); return; }
    if (newPw.length < 8) { Alert.alert('Error', 'Password must be 8+ characters'); return; }
    try {
      const { authApi } = require('../services/api');
      await authApi.changePassword(currentPw, newPw);
      setShowPassword(false); setCurrentPw(''); setNewPw('');
      Alert.alert('Success', 'Password changed');
    } catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Change failed'); }
  };

  const handleChatSend = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.trim();
    setChatMessages((prev) => [...prev, { role: 'user', content: msg }]);
    setChatInput('');
    setChatLoading(true);
    try {
      const { copilotApi } = require('../services/api');
      const res = await copilotApi.chat({ message: msg });
      setChatMessages((prev) => [...prev, { role: 'assistant', content: res.data?.response || res.data?.message || 'Got it.' }]);
    } catch {
      setChatMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, I had trouble connecting.' }]);
    } finally { setChatLoading(false); }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    screenTitle: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.text, padding: spacing.lg, paddingBottom: spacing.sm },
    profileCard: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.lg,
      backgroundColor: colors.card, padding: spacing.lg, marginHorizontal: spacing.md, marginTop: spacing.xs,
      borderRadius: radius.xl,
    },
    avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
    avatarText: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.textInverse },
    profileInfo: { flex: 1 },
    profileName: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.text },
    profileEmail: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
    personalityWrapper: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
    section: { backgroundColor: colors.card, marginTop: spacing.md, marginHorizontal: spacing.md, borderRadius: radius.md, overflow: 'hidden', ...shadow.sm },
    sectionTitle: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', padding: spacing.lg, paddingBottom: spacing.sm, letterSpacing: 0.5 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
    rowLabel: { fontSize: fontSize.base, color: colors.text },
    rowValue: { fontSize: fontSize.sm, color: colors.textTertiary },
    rowArrow: { fontSize: 22, color: colors.textTertiary },
    menuSection: { marginHorizontal: spacing.md, marginTop: spacing.md, borderRadius: radius.lg, overflow: 'hidden' },
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
    syncStatus: {
      marginHorizontal: spacing.md, marginTop: spacing.sm,
      padding: spacing.lg, borderRadius: radius.xl,
      backgroundColor: colors.card,
    },
    syncHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
    syncTitle: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.text },
    syncDot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing.sm },
    syncRow: { flexDirection: 'row', alignItems: 'center' },
    syncText: { fontSize: fontSize.sm, color: colors.textSecondary, flex: 1 },
    syncErrorText: { fontSize: fontSize.sm, color: colors.danger, marginTop: spacing.xs },
    syncActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md },
    syncBtn: {
      paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2,
      backgroundColor: colors.primary, borderRadius: radius.full,
      flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    },
    syncBtnText: { fontSize: fontSize.sm, color: colors.textInverse, fontWeight: fontWeight.semibold },
    syncBtnSpinner: { marginRight: spacing.xs },
    syncPending: { fontSize: fontSize.sm, color: colors.textTertiary },
    chatSection: { marginHorizontal: spacing.md, marginTop: spacing.sm, borderRadius: radius.xl, backgroundColor: colors.card, overflow: 'hidden', ...shadow.sm },
    chatHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      padding: spacing.lg,
    },
    chatHeaderTitle: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.text },
    chatExpandBtn: { fontSize: fontSize.sm, color: colors.primary, fontWeight: fontWeight.semibold },
    chatMessages: { paddingHorizontal: spacing.lg, gap: spacing.sm, maxHeight: 200 },
    chatBubble: { padding: spacing.md, borderRadius: radius.lg, maxWidth: '85%' },
    chatUserBubble: { backgroundColor: colors.primary, alignSelf: 'flex-end', borderBottomRightRadius: radius.xs },
    chatAssistantBubble: { backgroundColor: colors.background, alignSelf: 'flex-start', borderBottomLeftRadius: radius.xs },
    chatBubbleText: { fontSize: fontSize.sm, color: colors.text, lineHeight: 20 },
    chatBubbleUserText: { color: colors.textInverse },
    chatInputBar: { flexDirection: 'row', padding: spacing.lg, gap: spacing.sm, alignItems: 'center' },
    chatInput: {
      flex: 1, backgroundColor: colors.background, borderRadius: radius.xl,
      paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
      fontSize: fontSize.sm, color: colors.text, borderWidth: 1, borderColor: colors.border,
    },
    chatSendBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.xl },
    chatSendText: { color: colors.textInverse, fontWeight: fontWeight.semibold, fontSize: fontSize.sm },
    logoutBtn: {
      marginHorizontal: spacing.md, marginTop: spacing.xxl, marginBottom: spacing.xxxl,
      padding: spacing.md, borderRadius: radius.md,
      backgroundColor: colors.dangerLight,
      alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: spacing.sm,
    },
    logoutText: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.danger },
    logoutIcon: { fontSize: 16 },
    formContainer: { padding: spacing.xl },
    fieldLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textSecondary, marginBottom: spacing.sm },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: spacing.md, fontSize: fontSize.base, color: colors.text, backgroundColor: colors.background },
    saveBtn: { backgroundColor: colors.primary, padding: spacing.lg, borderRadius: radius.sm, alignItems: 'center', marginTop: spacing.lg },
    saveBtnText: { color: colors.textInverse, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
    currencyRow: { flexDirection: 'row', justifyContent: 'space-between', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
    currencyActive: { backgroundColor: colors.primaryLight },
    currencyText: { fontSize: fontSize.base, color: colors.text },
    checkmark: { fontSize: 18, color: colors.primary, fontWeight: fontWeight.bold },
  }), [colors]);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.screenTitle}>System</Text>

      {/* Profile Card */}
      <TouchableOpacity style={styles.profileCard} onPress={() => { hapticLight(); setFullName(user?.full_name || ''); setShowProfile(true); }} accessibilityLabel="Edit profile" accessibilityRole="button">
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.full_name?.charAt(0)?.toUpperCase() || 'U'}</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{user?.full_name || 'User'}</Text>
          <Text style={styles.profileEmail}>{user?.email || ''}</Text>
        </View>
        <Text style={{ fontSize: 22, color: colors.textTertiary }}>›</Text>
      </TouchableOpacity>

      {summary && <View style={styles.personalityWrapper}><PersonalityCard personality={personality} /></View>}

      {/* Sync Status Card */}
      <View style={styles.syncStatus}>
        <View style={styles.syncHeaderRow}>
          <View style={styles.syncRow}>
            <Text style={{ fontSize: 16, marginRight: spacing.sm }}>🔄</Text>
            <Text style={styles.syncTitle}>Sync Status</Text>
          </View>
          <View style={[styles.syncDot, { backgroundColor: status === 'syncing' ? colors.warning : status === 'error' ? colors.danger : colors.success }]} />
        </View>
        <Text style={styles.syncText}>
          {status === 'syncing' ? 'Syncing your data...' : lastSyncedAt ? `Last synced ${formatRelativeTime(lastSyncedAt)}` : 'Not synced yet'}
        </Text>
        {syncError && <Text style={styles.syncErrorText}>{syncError}</Text>}
        <View style={styles.syncActions}>
          <TouchableOpacity onPress={performSync} style={[styles.syncBtn, status === 'syncing' && { opacity: 0.6 }]} disabled={status === 'syncing'} accessibilityLabel="Sync now" accessibilityRole="button">
            {status === 'syncing' ? <ActivityIndicator size="small" color={colors.textInverse} style={styles.syncBtnSpinner} /> : <Text style={{ fontSize: 14 }}>↻</Text>}
            <Text style={styles.syncBtnText}>{status === 'syncing' ? 'Syncing' : 'Sync Now'}</Text>
          </TouchableOpacity>
          {pendingChanges > 0 && <Text style={styles.syncPending}>{pendingChanges} pending</Text>}
        </View>
      </View>

      {/* Inline Copilot Chat */}
      <View style={styles.chatSection}>
        <TouchableOpacity style={styles.chatHeader} onPress={() => setChatExpanded(!chatExpanded)} accessibilityLabel="Toggle AI Copilot" accessibilityRole="button">
          <Text style={styles.chatHeaderTitle}>🤖 AI Copilot</Text>
          <Text style={styles.chatExpandBtn}>{chatExpanded ? 'Collapse' : 'Expand'}</Text>
        </TouchableOpacity>
        {chatExpanded && (
          <>
            <View style={styles.chatMessages}>
              {chatMessages.length === 0 && (
                <Text style={[styles.chatBubbleText, { color: colors.textTertiary, alignSelf: 'center', padding: spacing.sm }]}>
                  Ask about your finances...
                </Text>
              )}
              {chatMessages.slice(-4).map((m, i) => (
                <View key={i} style={[styles.chatBubble, m.role === 'user' ? styles.chatUserBubble : styles.chatAssistantBubble]}>
                  <Text style={[styles.chatBubbleText, m.role === 'user' && styles.chatBubbleUserText]}>{m.content}</Text>
                </View>
              ))}
              {chatLoading && <Text style={[styles.chatBubbleText, { color: colors.textTertiary, alignSelf: 'flex-start' }]}>Thinking...</Text>}
            </View>
            <View style={styles.chatInputBar}>
              <TextInput
                style={styles.chatInput}
                value={chatInput}
                onChangeText={setChatInput}
                placeholder="Ask a question..."
                placeholderTextColor={colors.textTertiary}
                onSubmitEditing={handleChatSend}
                accessibilityLabel="Chat input"
              />
              <TouchableOpacity style={styles.chatSendBtn} onPress={handleChatSend} disabled={!chatInput.trim() || chatLoading} accessibilityLabel="Send" accessibilityRole="button">
                <Text style={styles.chatSendText}>Send</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* Quick Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Settings</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Dark Mode</Text>
          <Switch value={isDark} onValueChange={(v) => { setDark(v); update({ darkMode: v }); }} trackColor={{ false: colors.border, true: colors.primaryLight }} thumbColor={isDark ? colors.primary : colors.textTertiary} accessibilityLabel="Dark Mode" />
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Notifications</Text>
          <Switch value={prefs.notificationsEnabled} onValueChange={(v) => update({ notificationsEnabled: v })} trackColor={{ false: colors.border, true: colors.primaryLight }} thumbColor={prefs.notificationsEnabled ? colors.primary : colors.textTertiary} accessibilityLabel="Notifications" />
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Compact Mode</Text>
          <Switch value={prefs.compactMode} onValueChange={(v) => update({ compactMode: v })} trackColor={{ false: colors.border, true: colors.primaryLight }} thumbColor={prefs.compactMode ? colors.primary : colors.textTertiary} accessibilityLabel="Compact Mode" />
        </View>
        <TouchableOpacity style={styles.row} onPress={() => { hapticLight(); setShowCurrency(true); }} accessibilityLabel="Select currency" accessibilityRole="button">
          <Text style={styles.rowLabel}>Currency</Text>
          <Text style={styles.rowValue}>{prefs.currency}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.row} onPress={() => { hapticLight(); setShowPassword(true); }} accessibilityLabel="Change password" accessibilityRole="button">
          <Text style={styles.rowLabel}>Change Password</Text>
          <Text style={styles.rowArrow}>›</Text>
        </TouchableOpacity>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Budget Alert at</Text>
          <Text style={styles.rowValue}>{prefs.budgetAlertThreshold}%</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Bill Reminder</Text>
          <Text style={styles.rowValue}>{prefs.billReminderDays} days before</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Version</Text>
          <Text style={styles.rowValue}>2.0.0</Text>
        </View>
      </View>

      {/* Menu Sections */}
      {menuSections.map((section, si) => (
        <View key={si} style={styles.menuSection}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.items.map((item) => (
            <TouchableOpacity
              key={item.name}
              style={styles.menuItem}
              onPress={() => {
                hapticLight();
                if ((item as any).action === 'share') {
                  shareText(formatSummaryShare(0, 0, 0));
                } else {
                  navigation.navigate((item as any).screen);
                }
              }}
              accessibilityLabel={item.name}
              accessibilityRole="button"
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

      {/* Sign Out */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} accessibilityLabel="Sign out" accessibilityRole="button">
        <Text style={styles.logoutIcon}>⏻</Text>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>

      {/* Profile Modal */}
      <AdaptiveSheet visible={showProfile} onClose={() => setShowProfile(false)} title="Edit Profile">
        <View style={styles.formContainer}>
          <Text style={styles.fieldLabel}>Full Name</Text>
          <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="Your name" placeholderTextColor={colors.textTertiary} />
          <Text style={[styles.fieldLabel, { marginTop: spacing.sm }]}>Email</Text>
          <TextInput style={[styles.input, { backgroundColor: colors.border, color: colors.textTertiary }]} value={user?.email || ''} editable={false} />
          <TouchableOpacity style={styles.saveBtn} onPress={handleUpdateProfile}><Text style={styles.saveBtnText}>Save</Text></TouchableOpacity>
        </View>
      </AdaptiveSheet>

      {/* Password Modal */}
      <AdaptiveSheet visible={showPassword} onClose={() => setShowPassword(false)} title="Change Password">
        <View style={styles.formContainer}>
          <Text style={styles.fieldLabel}>Current Password</Text>
          <TextInput style={styles.input} value={currentPw} onChangeText={setCurrentPw} secureTextEntry placeholder="Enter current password" placeholderTextColor={colors.textTertiary} />
          <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>New Password</Text>
          <TextInput style={styles.input} value={newPw} onChangeText={setNewPw} secureTextEntry placeholder="Min 8 characters" placeholderTextColor={colors.textTertiary} />
          <TouchableOpacity style={styles.saveBtn} onPress={handleChangePassword}><Text style={styles.saveBtnText}>Change Password</Text></TouchableOpacity>
        </View>
      </AdaptiveSheet>

      {/* Currency Modal */}
      <AdaptiveSheet visible={showCurrency} onClose={() => setShowCurrency(false)} title="Select Currency">
        <View style={styles.formContainer}>
          {CURRENCIES.map((c) => (
            <TouchableOpacity key={c} style={[styles.currencyRow, prefs.currency === c && styles.currencyActive]} onPress={() => { update({ currency: c }); setShowCurrency(false); }} accessibilityLabel={`Select ${c}`} accessibilityRole="button">
              <Text style={[styles.currencyText, prefs.currency === c && { color: colors.primary, fontWeight: fontWeight.bold }]}>{c}</Text>
              {prefs.currency === c && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>
      </AdaptiveSheet>
    </ScrollView>
  );
}
