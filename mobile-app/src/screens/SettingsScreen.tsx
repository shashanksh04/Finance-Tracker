import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Switch } from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { usePreferencesStore } from '../stores/preferencesStore';
import { setBiometricEnabled } from '../components/BiometricGate';
import Modal from '../components/ui/Modal';
import { spacing, radius, fontSize, fontWeight, shadow } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'SGD', 'CHF', 'CNY'];

export default function SettingsScreen() {
  const { colors, isDark, setDark } = useTheme();
  const { user } = useAuthStore();
  const { prefs, update } = usePreferencesStore();
  const [showProfile, setShowProfile] = useState(false);
  const [showCurrency, setShowCurrency] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');

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

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    section: { backgroundColor: colors.card, marginTop: spacing.md, marginHorizontal: spacing.md, borderRadius: radius.md, overflow: 'hidden', ...shadow.sm },
    sectionTitle: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', padding: spacing.lg, paddingBottom: spacing.sm, letterSpacing: 0.5 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
    rowLabel: { fontSize: fontSize.base, color: colors.text },
    rowValue: { fontSize: fontSize.sm, color: colors.textTertiary },
    rowArrow: { fontSize: 22, color: colors.textTertiary },
    logoutBtn: { margin: spacing.md, marginTop: spacing.xxl, padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.card, alignItems: 'center', borderWidth: 1, borderColor: colors.dangerLight },
    logoutText: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.danger },
    formContainer: { padding: spacing.xl },
    fieldLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textSecondary, marginBottom: spacing.sm },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: spacing.md, fontSize: fontSize.base, color: colors.text, backgroundColor: colors.background },
    saveBtn: { backgroundColor: colors.primary, padding: spacing.lg, borderRadius: radius.sm, alignItems: 'center', marginTop: spacing.lg },
    saveBtnText: { color: colors.textInverse, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
    currencyRow: { flexDirection: 'row', justifyContent: 'space-between', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
    currencyActive: { backgroundColor: colors.primaryLight },
    currencyText: { fontSize: fontSize.base, color: colors.text },
    checkmark: { fontSize: 18, color: colors.primary, fontWeight: fontWeight.bold },
  }), [colors, spacing, radius, fontSize, fontWeight]);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <TouchableOpacity style={styles.row} onPress={() => { setFullName(user?.full_name || ''); setShowProfile(true); }}>
          <Text style={styles.rowLabel}>Profile</Text>
          <Text style={styles.rowValue}>{user?.full_name}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.row} onPress={() => { setCurrentPw(''); setNewPw(''); setShowPassword(true); }} accessibilityLabel="Change password" accessibilityRole="button">
          <Text style={styles.rowLabel}>Change Password</Text>
          <Text style={styles.rowArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.row} onPress={() => setShowCurrency(true)} accessibilityLabel="Select currency" accessibilityRole="button">
          <Text style={styles.rowLabel}>Currency</Text>
          <Text style={styles.rowValue}>{prefs.currency}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Face ID / Fingerprint</Text>
          <Switch value={prefs.biometricEnabled} onValueChange={(v) => { update({ biometricEnabled: v }); setBiometricEnabled(v); }} trackColor={{ false: colors.border, true: colors.primaryLight }} thumbColor={prefs.biometricEnabled ? colors.primary : colors.textTertiary} accessibilityLabel="Face ID / Fingerprint" />
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Dark Mode</Text>
          <Switch value={isDark} onValueChange={(v) => { setDark(v); update({ darkMode: v }); }} trackColor={{ false: colors.border, true: colors.primaryLight }} thumbColor={isDark ? colors.primary : colors.textTertiary} accessibilityLabel="Dark Mode" />
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Notifications</Text>
          <Switch value={prefs.notificationsEnabled} onValueChange={(v) => update({ notificationsEnabled: v })} trackColor={{ false: colors.border, true: colors.primaryLight }} thumbColor={prefs.notificationsEnabled ? colors.primary : colors.textTertiary} accessibilityLabel="Notifications" />
        </View>
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
          <Text style={styles.rowValue}>1.0.0</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutBtn}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>

      <Modal visible={showProfile} onClose={() => setShowProfile(false)} title="Edit Profile">
        <View style={styles.formContainer}>
          <Text style={styles.fieldLabel}>Full Name</Text>
          <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="Your name" placeholderTextColor={colors.textTertiary} />
          <Text style={[styles.fieldLabel, { marginTop: spacing.sm }]}>Email</Text>
          <TextInput style={[styles.input, { backgroundColor: colors.border, color: colors.textTertiary }]} value={user?.email || ''} editable={false} />
          <TouchableOpacity style={styles.saveBtn} onPress={handleUpdateProfile}><Text style={styles.saveBtnText}>Save</Text></TouchableOpacity>
        </View>
      </Modal>

      <Modal visible={showPassword} onClose={() => setShowPassword(false)} title="Change Password">
        <View style={styles.formContainer}>
          <Text style={styles.fieldLabel}>Current Password</Text>
          <TextInput style={styles.input} value={currentPw} onChangeText={setCurrentPw} secureTextEntry placeholder="Enter current password" placeholderTextColor={colors.textTertiary} />
          <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>New Password</Text>
          <TextInput style={styles.input} value={newPw} onChangeText={setNewPw} secureTextEntry placeholder="Min 8 characters" placeholderTextColor={colors.textTertiary} />
          <TouchableOpacity style={styles.saveBtn} onPress={handleChangePassword}><Text style={styles.saveBtnText}>Change Password</Text></TouchableOpacity>
        </View>
      </Modal>

      <Modal visible={showCurrency} onClose={() => setShowCurrency(false)} title="Select Currency">
        <View style={styles.formContainer}>
          {CURRENCIES.map((c) => (
            <TouchableOpacity key={c} style={[styles.currencyRow, prefs.currency === c && styles.currencyActive]} onPress={() => { update({ currency: c }); setShowCurrency(false); }}>
              <Text style={[styles.currencyText, prefs.currency === c && { color: colors.primary, fontWeight: fontWeight.bold }]}>{c}</Text>
              {prefs.currency === c && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>
      </Modal>
    </ScrollView>
  );
}

