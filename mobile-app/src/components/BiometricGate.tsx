import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, AppState, ActivityIndicator,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, radius, fontSize, fontWeight } from '../theme/tokens';

const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';

export async function isBiometricEnabled(): Promise<boolean> {
  const v = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
  return v === 'true';
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, enabled.toString());
}

interface BiometricGateProps {
  children: React.ReactNode;
}

export default function BiometricGate({ children }: BiometricGateProps) {
  const [biometricType, setBiometricType] = useState<number | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => { init(); }, []);

  useEffect(() => {
    if (!enabled || authenticated) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') authenticate();
    });
    return () => sub.remove();
  }, [enabled, authenticated]);

  async function init() {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      const bioEnabled = await isBiometricEnabled();

      if (hasHardware && isEnrolled && bioEnabled) {
        setEnabled(true);
        if (supportedTypes.includes(1)) setBiometricType(1);
        else if (supportedTypes.includes(2)) setBiometricType(2);

        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Unlock Finance Tracker',
          fallbackLabel: 'Use Passcode',
          cancelLabel: 'Cancel',
          disableDeviceFallback: false,
        });

        if (result.success) setAuthenticated(true);
      } else {
        setEnabled(false);
        setAuthenticated(true);
      }
    } catch {
      setEnabled(false);
      setAuthenticated(true);
    } finally {
      setChecking(false);
    }
  }

  const authenticate = useCallback(async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Finance Tracker',
        fallbackLabel: 'Use Passcode',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });
      if (result.success) setAuthenticated(true);
    } catch {}
  }, []);

  if (checking) {
    return (
      <View style={styles.container} accessibilityLabel="Checking biometric authentication">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (enabled && !authenticated) {
    const typeLabel = biometricType === 1 ? 'Face ID' : biometricType === 2 ? 'Fingerprint' : 'Biometric';
    return (
      <View style={styles.container}>
        <View style={styles.lockIcon}><Text style={styles.lockEmoji}>🔒</Text></View>
        <Text style={styles.title}>Finance Tracker</Text>
        <Text style={styles.subtitle}>Authenticate to continue</Text>
        <TouchableOpacity style={styles.authBtn} onPress={authenticate} accessibilityLabel={`Unlock with ${typeLabel}`} accessibilityRole="button">
          <Text style={styles.authBtnText}>Unlock with {typeLabel}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.text, padding: spacing.xxl },
  lockIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.tagBg, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.xxl },
  lockEmoji: { fontSize: 36 },
  title: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.textInverse, marginBottom: spacing.sm },
  subtitle: { fontSize: fontSize.base, color: colors.textTertiary, marginBottom: spacing.xxxl },
  authBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.xxxl, paddingVertical: spacing.lg, borderRadius: radius.lg },
  authBtnText: { color: colors.textInverse, fontSize: fontSize.base + 1, fontWeight: fontWeight.semibold },
});
