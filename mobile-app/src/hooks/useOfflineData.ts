import { useState, useEffect, useCallback, useRef } from 'react';
import { repository } from '../database/repository';
import { mapRowsToCamelCase, mapRowToCamelCase } from '../database';
import { stripUnknownFields } from '../database/schema';
import { pullChanges } from '../database/sync';
import { useNetworkStatus } from './useNetworkStatus';
import { useAuthStore } from '../stores/authStore';

interface UseOfflineListOptions {
  orderBy?: string;
  where?: { field: string; op?: string; value: any }[];
  apiFetch?: () => Promise<{ data: any }>;
  mapApiResponse?: (res: any) => any[];
}

interface UseOfflineListResult<T> {
  data: T[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  refreshFromApi: () => Promise<void>;
}

export function useOfflineList<T = any>(
  table: string,
  options?: UseOfflineListOptions
): UseOfflineListResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isOffline } = useNetworkStatus();
  const mountedRef = useRef(true);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const serializedKey = JSON.stringify({ where: options?.where, orderBy: options?.orderBy });

  const loadFromDb = useCallback(async () => {
    const opts = optionsRef.current;
    try {
      const rows = await repository.list(table, opts?.where, opts?.orderBy);
      if (mountedRef.current) {
        setData(mapRowsToCamelCase(rows) as T[]);
      }
    } catch {}
  }, [table, serializedKey]);

  const refreshFromApi = useCallback(async () => {
    const opts = optionsRef.current;
    if (!opts?.apiFetch) return;
    setRefreshing(true);
    try {
      const res = await opts.apiFetch();
      const items = opts.mapApiResponse
        ? opts.mapApiResponse(res)
        : res.data?.items || res.data || [];

      if (items.length > 0) {
        const batchData = items.map((item: any) => {
          const cleaned = stripUnknownFields(table, {
            ...item,
            tags: typeof item.tags === 'object' ? JSON.stringify(item.tags) : item.tags,
            location: typeof item.location === 'object' ? JSON.stringify(item.location) : item.location,
            metadata: typeof item.metadata === 'object' ? JSON.stringify(item.metadata) : item.metadata,
          });
          return cleaned;
        });
        await repository.upsertBatch(table, batchData);
      }

      await loadFromDb();
    } catch (err: any) {
      if (!isOffline && mountedRef.current) {
        setError(err.message || 'Failed to refresh');
        if (err.response?.status === 401) {
          useAuthStore.getState().logout();
          return;
        }
        try {
          await pullChanges();
          await loadFromDb();
        } catch (e: any) {
          if (e.response?.status === 401) {
            useAuthStore.getState().logout();
            return;
          }
        }
      }
    } finally {
      if (mountedRef.current) setRefreshing(false);
    }
  }, [table, isOffline]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    await loadFromDb();
    if (!isOffline) {
      const opts = optionsRef.current;
      if (opts?.apiFetch) {
        await refreshFromApi();
      }
      try {
        await pullChanges();
        await loadFromDb();
      } catch (e: any) {
        if (e.response?.status === 401) {
          useAuthStore.getState().logout();
          return;
        }
      }
    }
    if (mountedRef.current) setLoading(false);
  }, [isOffline, loadFromDb, refreshFromApi]);

  useEffect(() => {
    mountedRef.current = true;
    refresh();
    return () => { mountedRef.current = false; };
  }, [refresh]);

  return { data, loading, refreshing, error, refresh, refreshFromApi };
}

export function useOfflineItem<T = any>(
  table: string,
  id: string | null,
  apiFetch?: () => Promise<{ data: any }>
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isOffline } = useNetworkStatus();
  const apiFetchRef = useRef(apiFetch);
  apiFetchRef.current = apiFetch;

  const loadFromDb = useCallback(async () => {
    if (!id) { setData(null); return; }
    try {
      const row = await repository.getById(table, id);
      if (row) setData(mapRowToCamelCase(row) as T);
    } catch {}
  }, [table, id]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    await loadFromDb();
    if (!isOffline && apiFetchRef.current) {
      try {
        const res = await apiFetchRef.current();
        if (res.data) {
          const raw = res.data;
          const cleaned = stripUnknownFields(table, {
            ...raw,
            tags: typeof raw.tags === 'object' ? JSON.stringify(raw.tags) : raw.tags,
            location: typeof raw.location === 'object' ? JSON.stringify(raw.location) : raw.location,
          });
          await repository.create(table, cleaned);
          await loadFromDb();
        }
      } catch (err: any) {
        if (!isOffline) setError(err.message || 'Failed to refresh');
      }
    }
    setLoading(false);
  }, [table, id, isOffline, loadFromDb]);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, loading, error, refresh };
}
