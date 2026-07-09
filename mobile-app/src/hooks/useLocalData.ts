import { useState, useEffect, useCallback } from 'react';
import { repository } from '../database/repository';
import { mapRowsToCamelCase, mapRowToCamelCase } from '../database';

interface UseLocalListOptions {
  orderBy?: string;
  where?: { field: string; op?: string; value: any }[];
}

interface UseLocalListResult<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

interface UseLocalItemResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useLocalList<T = any>(
  table: string,
  options?: UseLocalListOptions
): UseLocalListResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await repository.list(table, options?.where, options?.orderBy);
      setData(mapRowsToCamelCase(rows) as T[]);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [table, JSON.stringify(options)]);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, loading, error, refresh };
}

export function useLocalItem<T = any>(
  table: string,
  id: string | null
): UseLocalItemResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!id) { setData(null); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const row = await repository.getById(table, id);
      setData(row ? (mapRowToCamelCase(row) as T) : null);
    } catch (err: any) {
      setError(err.message || 'Failed to load item');
    } finally {
      setLoading(false);
    }
  }, [table, id]);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, loading, error, refresh };
}

export function useLocalSearch<T = any>(
  table: string,
  query: string,
  fields: string[]
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) { setData([]); return; }
    setLoading(true);
    repository.search(table, query, fields)
      .then((rows) => setData(mapRowsToCamelCase(rows) as T[]))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [table, query, JSON.stringify(fields)]);

  return { data, loading };
}
