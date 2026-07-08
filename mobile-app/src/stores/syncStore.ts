import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncApi } from '../services/api';
import type { SyncStatus } from '../types';

const LAST_SYNC_KEY = 'last_synced_at';
const PENDING_CHANGES_KEY = 'pending_changes';

interface SyncState {
  status: SyncStatus;
  lastSyncedAt: string | null;
  pendingChanges: number;
  error: string | null;

  performSync: () => Promise<void>;
  markSynced: (timestamp: string) => Promise<void>;
  addPendingChange: () => Promise<void>;
  clearPendingChanges: () => Promise<void>;
  loadSyncState: () => Promise<void>;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  status: 'idle',
  lastSyncedAt: null,
  pendingChanges: 0,
  error: null,

  performSync: async () => {
    set({ status: 'syncing', error: null });
    try {
      const lastPulledAt = get().lastSyncedAt || '1970-01-01T00:00:00Z';
      const pullRes = await syncApi.pull({ last_pulled_at: lastPulledAt });

      const pendingRaw = await AsyncStorage.getItem(PENDING_CHANGES_KEY);
      if (pendingRaw) {
        const pending = JSON.parse(pendingRaw);
        if (pending.length > 0) {
          await syncApi.push({ changes: pending, last_pulled_at: lastPulledAt });
        }
      }

      const now = new Date().toISOString();
      await AsyncStorage.setItem(LAST_SYNC_KEY, now);
      await AsyncStorage.setItem(PENDING_CHANGES_KEY, JSON.stringify([]));

      set({
        status: 'success',
        lastSyncedAt: now,
        pendingChanges: 0,
        error: null,
      });
    } catch (err: any) {
      set({
        status: 'error',
        error: err.response?.data?.detail || err.message || 'Sync failed',
      });
    }
  },

  markSynced: async (timestamp) => {
    await AsyncStorage.setItem(LAST_SYNC_KEY, timestamp);
    set({ lastSyncedAt: timestamp, pendingChanges: 0 });
  },

  addPendingChange: async () => {
    const count = get().pendingChanges + 1;
    set({ pendingChanges: count });
  },

  clearPendingChanges: async () => {
    await AsyncStorage.setItem(PENDING_CHANGES_KEY, JSON.stringify([]));
    set({ pendingChanges: 0 });
  },

  loadSyncState: async () => {
    const lastSyncedAt = await AsyncStorage.getItem(LAST_SYNC_KEY);
    const pendingRaw = await AsyncStorage.getItem(PENDING_CHANGES_KEY);
    const pendingChanges = pendingRaw ? JSON.parse(pendingRaw).length : 0;
    set({ lastSyncedAt, pendingChanges });
  },
}));
