import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Switch } from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { usePreferencesStore } from '../stores/preferencesStore';
import { setBiometricEnabled } from '../components/BiometricGate';
import Modal from '../components/ui/Modal';

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'SGD', 'CHF', 'CNY'];

export default function SettingsScreen() {
  const { user, logout } = useAuthStore();
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
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Update failed');
    }
  };

  const handleChangePassword = async () => {
    if (!currentPw || !newPw) { Alert.alert('Error', 'Fill both fields'); return; }
    if (newPw.length < 8) { Alert.alert('Error', 'Password must be 8+ characters'); return; }
    try {
      const { authApi } = require('../services/api');
      await authApi.changePassword(currentPw, newPw);
      setShowPassword(false);
      setCurrentPw(''); setNewPw('');
      Alert.alert('Success', 'Password changed');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Change failed');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <TouchableOpacity style={styles.row} onPress={() => { setFullName(user?.full_name || ''); setShowProfile(true); }}>
          <Text style={styles.rowLabel}>Profile</Text>
          <Text style={styles.rowValue}>{user?.full_name}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.row} onPress={() => { setCurrentPw(''); setNewPw(''); setShowPassword(true); }}>
          <Text style={styles.rowLabel}>Change Password</Text>
          <Text style={styles.rowArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.row} onPress={() => setShowCurrency(true)}>
          <Text style={styles.rowLabel}>Currency</Text>
          <Text style={styles.rowValue}>{prefs.currency}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Face ID / Fingerprint</Text>
          <Switch value={prefs.biometricEnabled} onValueChange={(v) => { update({ biometricEnabled: v }); setBiometricEnabled(v); }} trackColor={{ false: '#e2e8f0', true: '#93c5fd' }} thumbColor={prefs.biometricEnabled ? '#0284c7' : '#94a3b8'} />
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Dark Mode</Text>
          <Switch value={prefs.darkMode} onValueChange={(v) => update({ darkMode: v })} trackColor={{ false: '#e2e8f0', true: '#93c5fd' }} thumbColor={prefs.darkMode ? '#0284c7' : '#94a3b8'} />
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Auto Dark Mode</Text>
          <Switch value={prefs.darkModeAutoSchedule} onValueChange={(v) => update({ darkModeAutoSchedule: v })} trackColor={{ false: '#e2e8f0', true: '#93c5fd' }} thumbColor={prefs.darkModeAutoSchedule ? '#0284c7' : '#94a3b8'} />
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Notifications</Text>
          <Switch value={prefs.notificationsEnabled} onValueChange={(v) => update({ notificationsEnabled: v })} trackColor={{ false: '#e2e8f0', true: '#93c5fd' }} thumbColor={prefs.notificationsEnabled ? '#0284c7' : '#94a3b8'} />
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

      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>

      <Modal visible={showProfile} onClose={() => setShowProfile(false)} title="Edit Profile">
        <View style={styles.formContainer}>
          <Text style={styles.fieldLabel}>Full Name</Text>
          <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="Your name" placeholderTextColor="#94a3b8" />
          <Text style={[styles.fieldLabel, { marginTop: 8 }]}>Email</Text>
          <TextInput style={[styles.input, { backgroundColor: '#f1f5f9', color: '#94a3b8' }]} value={user?.email || ''} editable={false} />
          <TouchableOpacity style={styles.saveBtn} onPress={handleUpdateProfile}><Text style={styles.saveBtnText}>Save</Text></TouchableOpacity>
        </View>
      </Modal>

      <Modal visible={showPassword} onClose={() => setShowPassword(false)} title="Change Password">
        <View style={styles.formContainer}>
          <Text style={styles.fieldLabel}>Current Password</Text>
          <TextInput style={styles.input} value={currentPw} onChangeText={setCurrentPw} secureTextEntry placeholder="Enter current password" placeholderTextColor="#94a3b8" />
          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>New Password</Text>
          <TextInput style={styles.input} value={newPw} onChangeText={setNewPw} secureTextEntry placeholder="Min 8 characters" placeholderTextColor="#94a3b8" />
          <TouchableOpacity style={styles.saveBtn} onPress={handleChangePassword}><Text style={styles.saveBtnText}>Change Password</Text></TouchableOpacity>
        </View>
      </Modal>

      <Modal visible={showCurrency} onClose={() => setShowCurrency(false)} title="Select Currency">
        <View style={styles.formContainer}>
          {CURRENCIES.map((c) => (
            <TouchableOpacity key={c} style={[styles.currencyRow, prefs.currency === c && styles.currencyActive]} onPress={() => { update({ currency: c }); setShowCurrency(false); }}>
              <Text style={[styles.currencyText, prefs.currency === c && { color: '#0284c7', fontWeight: '700' }]}>{c}</Text>
              {prefs.currency === c && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  section: { backgroundColor: '#fff', marginTop: 16, marginHorizontal: 16, borderRadius: 12, overflow: 'hidden' },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#64748b', textTransform: 'uppercase', padding: 16, paddingBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  rowLabel: { fontSize: 16, color: '#0f172a' },
  rowValue: { fontSize: 14, color: '#94a3b8' },
  rowArrow: { fontSize: 20, color: '#94a3b8' },
  logoutBtn: { margin: 16, marginTop: 24, padding: 16, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', borderWidth: 1, borderColor: '#fecaca' },
  logoutText: { fontSize: 16, fontWeight: '600', color: '#dc2626' },
  formContainer: { padding: 20 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 14, fontSize: 16, color: '#0f172a', backgroundColor: '#f8fafc' },
  saveBtn: { backgroundColor: '#0284c7', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 16 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  currencyRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  currencyActive: { backgroundColor: '#f0f9ff' },
  currencyText: { fontSize: 16, color: '#0f172a' },
  checkmark: { fontSize: 18, color: '#0284c7', fontWeight: '700' },
});
