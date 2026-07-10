import React, { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppState, AppStateStatus, StyleSheet } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import BiometricGate from './src/components/BiometricGate';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { useNetworkStatus } from './src/hooks/useNetworkStatus';
import { useSyncStore } from './src/stores/syncStore';
import { setupNotifications, scheduleAllNotifications } from './src/services/notifications';
import { registerBackgroundSync } from './src/services/backgroundSync';

function SyncManager({ children }: { children: React.ReactNode }) {
  const { isOffline } = useNetworkStatus();
  const { performSync } = useSyncStore();
  const wasOffline = useRef(isOffline);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    if (wasOffline.current && !isOffline) {
      performSync();
    }
    wasOffline.current = isOffline;
  }, [isOffline, performSync]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        performSync();
      }
      appState.current = nextAppState;
    });
    return () => subscription.remove();
  }, [performSync]);

  return <>{children}</>;
}

function AppServices() {
  const { isOffline } = useNetworkStatus();
  const { performSync } = useSyncStore();
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    (async () => {
      await setupNotifications();
      await registerBackgroundSync();
      if (!isOffline) {
        await performSync();
        await scheduleAllNotifications();
      }
    })();
  }, []);

  return null;
}

function AppInner() {
  const { isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AppServices />
      <BiometricGate>
        <SyncManager>
          <AppNavigator />
        </SyncManager>
      </BiometricGate>
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider>
        <AppInner />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
