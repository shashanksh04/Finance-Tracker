import { useState, useCallback } from 'react';

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseApiReturn<T> extends UseApiState<T> {
  execute: (...args: any[]) => Promise<T | null>;
  reset: () => void;
}

export function useApi<T = any>(
  apiFunc: (...args: any[]) => Promise<{ data: T }>
): UseApiReturn<T> {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(async (...args: any[]): Promise<T | null> => {
    setState({ data: null, loading: true, error: null });
    try {
      const res = await apiFunc(...args);
      setState({ data: res.data, loading: false, error: null });
      return res.data;
    } catch (err: any) {
      const message = err.response?.data?.detail || err.message || 'An error occurred';
      setState({ data: null, loading: false, error: message });
      return null;
    }
  }, [apiFunc]);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return { ...state, execute, reset };
}
