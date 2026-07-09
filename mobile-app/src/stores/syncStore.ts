import { create } from 'zustand';
import { fullSync, getLastPulledAt } from '../database/sync';
import { getDatabase } from '../database';
import type { SyncStatus } from '../types';

interface SyncState {
  status: SyncStatus;
  lastSyncedAt: string | null;
  pendingChanges: number;
  error: string | null;

  performSync: () => Promise<void>;
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
      await getDatabase();
      const result = await fullSync();

      const lastPulledAt = await getLastPulledAt();
      set({
        status: result.conflicts > 0 ? 'error' : 'success',
        lastSyncedAt: lastPulledAt,
        pendingChanges: 0,
        error: result.conflicts > 0 ? `${result.conflicts} conflicts resolved` : null,
      });
    } catch (err: any) {
      set({
        status: 'error',
        error: err.response?.data?.detail || err.message || 'Sync failed',
      });
    }
  },

  loadSyncState: async () => {
    const lastSyncedAt = await getLastPulledAt();
    const isEpoch = lastSyncedAt === '1970-01-01T00:00:00Z';
    set({
      lastSyncedAt: isEpoch ? null : lastSyncedAt,
      pendingChanges: 0,
    });
  },
}));
