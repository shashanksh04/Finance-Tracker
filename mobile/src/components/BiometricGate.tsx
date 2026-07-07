import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, AppState,
  ActivityIndicator,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';

interface BiometricGateProps {
  children: React.ReactNode;
}

export function isBiometricEnabled(): Promise<boolean> {
  return AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY).then((v) => v === 'true');
}

export function setBiometricEnabled(enabled: boolean): Promise<void> {
  return AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, enabled.toString());
}

export default function BiometricGate({ children }: BiometricGateProps) {
  const [biometricType, setBiometricType] = useState<LocalAuthentication.AuthenticationType | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    if (!enabled || authenticated) return;

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        authenticate();
      }
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

        if (result.success) {
          setAuthenticated(true);
        }
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
      if (result.success) {
        setAuthenticated(true);
      }
    } catch {
      // ignore
    }
  }, []);

  if (checking) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0284c7" />
      </View>
    );
  }

  if (enabled && !authenticated) {
    const typeLabel = biometricType === 1 ? 'Face ID' : biometricType === 2 ? 'Fingerprint' : 'Biometric';

    return (
      <View style={styles.container}>
        <View style={styles.lockIcon}>
          <Text style={styles.lockEmoji}>🔒</Text>
        </View>
        <Text style={styles.title}>Finance Tracker</Text>
        <Text style={styles.subtitle}>Authenticate to continue</Text>

        <TouchableOpacity style={styles.authBtn} onPress={authenticate}>
          <Text style={styles.authBtnText}>Unlock with {typeLabel}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a', padding: 24 },
  lockIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  lockEmoji: { fontSize: 36 },
  title: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#94a3b8', marginBottom: 32 },
  authBtn: { backgroundColor: '#0284c7', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 14 },
  authBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
