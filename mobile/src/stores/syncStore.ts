import { create } from 'zustand';
import { SyncStatus, SyncPullResponse, SyncPushResponse } from '../types';
import { syncApi } from '../services/api';
import { useAuthStore } from './authStore';

interface SyncState {
  status: SyncStatus;
  pendingChanges: Map<string, any[]>;

  setSyncing: (syncing: boolean) => void;
  setError: (error: string | null) => void;
  addPendingChange: (table: string, operation: string, record: any) => void;
  clearPendingChanges: () => void;
  performSync: () => Promise<void>;
  pushPendingChanges: () => Promise<void>;
  pullChanges: (lastPulledAt?: string) => Promise<SyncPullResponse | null>;
}

export const useSyncStore = create<SyncState>()((set, get) => ({
  status: {
    isSyncing: false,
    lastSyncedAt: null,
    pendingCount: 0,
    error: null,
  },
  pendingChanges: new Map(),

  setSyncing: (isSyncing) =>
    set((state) => ({
      status: { ...state.status, isSyncing },
    })),

  setError: (error) =>
    set((state) => ({
      status: { ...state.status, error },
    })),

  addPendingChange: (table, operation, record) => {
    set((state) => {
      const pending = new Map(state.pendingChanges);
      const changes = pending.get(table) || [];
      changes.push({ operation, record, timestamp: new Date().toISOString() });
      pending.set(table, changes);
      return {
        pendingChanges: pending,
        status: {
          ...state.status,
          pendingCount: Array.from(pending.values()).reduce(
            (sum, arr) => sum + arr.length,
            0
          ),
        },
      };
    });
  },

  clearPendingChanges: () =>
    set((state) => ({
      pendingChanges: new Map(),
      status: { ...state.status, pendingCount: 0 },
    })),

  performSync: async () => {
    const { isAuthenticated } = useAuthStore.getState();
    if (!isAuthenticated) return;

    set((state) => ({
      status: { ...state.status, isSyncing: true, error: null },
    }));

    try {
      await get().pushPendingChanges();
      const lastSyncedAt = get().status.lastSyncedAt || undefined;
      await get().pullChanges(lastSyncedAt);
      set((state) => ({
        status: {
          ...state.status,
          isSyncing: false,
          lastSyncedAt: new Date().toISOString(),
          pendingCount: 0,
        },
      }));
    } catch (err: any) {
      const message = err.response?.data?.detail || err.message || 'Sync failed';
      set((state) => ({
        status: { ...state.status, isSyncing: false, error: message },
      }));
    }
  },

  pushPendingChanges: async () => {
    const { pendingChanges } = get();
    if (pendingChanges.size === 0) return;

    const changes: Record<string, any> = {};

    pendingChanges.forEach((items, table) => {
      const created: any[] = [];
      const updated: any[] = [];
      const deleted: any[] = [];

      items.forEach((item: any) => {
        if (item.operation === 'create') created.push(item.record);
        else if (item.operation === 'update') updated.push(item.record);
        else if (item.operation === 'delete') deleted.push(item.record);
      });

      changes[table] = { created, updated, deleted };
    });

    try {
      await syncApi.push(changes);
      get().clearPendingChanges();
    } catch (err) {
      throw err;
    }
  },

  pullChanges: async (lastPulledAt?) => {
    try {
      const response = await syncApi.pull(lastPulledAt);
      const data = response.data as SyncPullResponse;
      return data;
    } catch (err) {
      throw err;
    }
  },
}));
