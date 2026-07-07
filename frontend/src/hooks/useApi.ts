import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';

interface UseApiState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
}

export function useApi<T>() {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    isLoading: false,
    error: null,
  });

  const execute = useCallback(async (apiCall: () => Promise<{ data: T }>, options?: { showSuccess?: string }) => {
    setState({ data: null, isLoading: true, error: null });
    try {
      const { data } = await apiCall();
      setState({ data, isLoading: false, error: null });
      if (options?.showSuccess) toast.success(options.showSuccess);
      return data;
    } catch (err: any) {
      const message = err?.response?.data?.detail || err?.message || 'An error occurred';
      setState({ data: null, isLoading: false, error: message });
      toast.error(message);
      throw err;
    }
  }, []);

  return { ...state, execute };
}
