import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://finance.shashankakumar.com/api';
const WS_URL = process.env.EXPO_PUBLIC_WS_URL || 'wss://finance.shashankakumar.com/ws';

const TOKEN_KEY = 'auth_tokens';

interface TokenData {
  access_token: string;
  refresh_token: string;
}

let pendingRefresh: Promise<string | null> | null = null;
let refreshQueue: Array<{
  resolve: (token: string | null) => void;
  reject: (err: any) => void;
}> = [];

async function getTokens(): Promise<TokenData | null> {
  try {
    const raw = await AsyncStorage.getItem(TOKEN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function setTokens(tokens: TokenData | null): Promise<void> {
  if (tokens) {
    await AsyncStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  } else {
    await AsyncStorage.removeItem(TOKEN_KEY);
  }
}

async function refreshAccessToken(): Promise<string | null> {
  if (pendingRefresh) return pendingRefresh;

  pendingRefresh = (async () => {
    try {
      const tokens = await getTokens();
      if (!tokens?.refresh_token) return null;

      const res = await axios.post(`${BASE_URL}/auth/refresh`, {
        refresh_token: tokens.refresh_token,
      });

      const newTokens: TokenData = {
        access_token: res.data.access_token,
        refresh_token: res.data.refresh_token || tokens.refresh_token,
      };

      await setTokens(newTokens);
      return newTokens.access_token;
    } catch {
      await setTokens(null);
      return null;
    } finally {
      pendingRefresh = null;
    }
  })();

  return pendingRefresh;
}

function processQueue(token: string | null, error: any = null) {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  refreshQueue = [];
}

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const tokens = await getTokens();
  if (tokens?.access_token) {
    config.headers.Authorization = `Bearer ${tokens.access_token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (originalRequest.url?.includes('/auth/refresh') || originalRequest.url?.includes('/auth/login')) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      const newToken = await refreshAccessToken();

      if (newToken) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      }

      return new Promise((resolve, reject) => {
        refreshQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      });
    }

    return Promise.reject(error);
  }
);

export const authApi = {
  login: (data: { email: string; password: string }) => api.post('/auth/login', data),
  register: (data: { email: string; password: string; full_name: string }) => api.post('/auth/register', data),
  refresh: (data: { refresh_token: string }) => api.post('/auth/refresh', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  updateProfile: (data: { full_name?: string; settings?: Record<string, any> }) => api.put('/auth/profile', data),
  changePassword: (current_password: string, new_password: string) =>
    api.post('/auth/change-password', { current_password, new_password }),
};

export const accountsApi = {
  list: (params?: Record<string, any>) => api.get('/accounts/', { params }),
  get: (id: string) => api.get(`/accounts/${id}`),
  getSummary: (id: string) => api.get(`/accounts/${id}/summary`),
  create: (data: Record<string, any>) => api.post('/accounts/', data),
  update: (id: string, data: Record<string, any>) => api.put(`/accounts/${id}`, data),
  delete: (id: string) => api.delete(`/accounts/${id}`),
};

export const transactionsApi = {
  list: (params?: Record<string, any>) => api.get('/transactions/', { params }),
  get: (id: string) => api.get(`/transactions/${id}`),
  create: (data: Record<string, any>) => api.post('/transactions/', data),
  update: (id: string, data: Record<string, any>) => api.put(`/transactions/${id}`, data),
  delete: (id: string) => api.delete(`/transactions/${id}`),
};

export const categoriesApi = {
  list: (params?: Record<string, any>) => api.get('/categories/', { params }),
  get: (id: string) => api.get(`/categories/${id}`),
  create: (data: Record<string, any>) => api.post('/categories/', data),
  update: (id: string, data: Record<string, any>) => api.put(`/categories/${id}`, data),
  delete: (id: string) => api.delete(`/categories/${id}`),
};

export const budgetsApi = {
  list: (params?: Record<string, any>) => api.get('/budgets/', { params }),
  get: (id: string) => api.get(`/budgets/${id}`),
  create: (data: Record<string, any>) => api.post('/budgets/', data),
  update: (id: string, data: Record<string, any>) => api.put(`/budgets/${id}`, data),
  delete: (id: string) => api.delete(`/budgets/${id}`),
};

export const goalsApi = {
  list: (params?: Record<string, any>) => api.get('/goals/', { params }),
  get: (id: string) => api.get(`/goals/${id}`),
  create: (data: Record<string, any>) => api.post('/goals/', data),
  update: (id: string, data: Record<string, any>) => api.put(`/goals/${id}`, data),
  delete: (id: string) => api.delete(`/goals/${id}`),
};

export const billsApi = {
  list: (params?: Record<string, any>) => api.get('/bills/', { params }),
  get: (id: string) => api.get(`/bills/${id}`),
  create: (data: Record<string, any>) => api.post('/bills/', data),
  update: (id: string, data: Record<string, any>) => api.put(`/bills/${id}`, data),
  delete: (id: string) => api.delete(`/bills/${id}`),
};

export const alertsApi = {
  list: (params?: Record<string, any>) => api.get('/alerts/', { params }),
  read: (id: string) => api.post(`/alerts/${id}/read`),
  dismiss: (id: string) => api.post(`/alerts/${id}/dismiss`),
  getPreferences: () => api.get('/alerts/preferences'),
  updatePreferences: (alertType: string, data: Record<string, any>) =>
    api.put(`/alerts/preferences/${alertType}`, data),
  generate: () => api.post('/alerts/generate'),
};

export const recurringApi = {
  list: (params?: Record<string, any>) => api.get('/recurring/', { params }),
  get: (id: string) => api.get(`/recurring/${id}`),
  create: (data: Record<string, any>) => api.post('/recurring/', data),
  update: (id: string, data: Record<string, any>) => api.put(`/recurring/${id}`, data),
  delete: (id: string) => api.delete(`/recurring/${id}`),
};

export const analysisApi = {
  dashboard: (params?: Record<string, any>) => api.get('/analysis/dashboard', { params }),
  period: (params?: Record<string, any>) => api.get('/analysis/period', { params }),
};

export const copilotApi = {
  chat: (data: { message: string; session_id?: string }) => api.post('/copilot/chat', data),
  chatStream: (data: { message: string; session_id?: string }) => api.post('/copilot/chat/stream', data),
  simulate: (data: Record<string, any>) => api.post('/copilot/simulate', data),
};

export const ocrApi = {
  scan: (file: any) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/ocr/scan', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const syncApi = {
  pull: (params?: Record<string, any>) => api.get('/sync/pull', { params }),
  push: (data: Record<string, any>) => api.post('/sync/push', data),
};

export const categoryRulesApi = {
  list: (params?: Record<string, any>) => api.get('/category-rules/', { params }),
  create: (data: Record<string, any>) => api.post('/category-rules/', data),
  update: (id: string, data: Record<string, any>) => api.put(`/category-rules/${id}`, data),
  delete: (id: string) => api.delete(`/category-rules/${id}`),
};

export const importApi = {
  preview: (file: any) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/import/preview', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  execute: (file: any) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/import/execute', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export { getTokens as getStoredTokens, setTokens as storeTokens, BASE_URL, WS_URL };
export default api;
