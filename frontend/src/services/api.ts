import axios, { AxiosError } from 'axios';
import { AuthTokens } from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

function getStoredTokens(): AuthTokens | null {
  try {
    const raw = localStorage.getItem('auth-storage');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.tokens || null;
  } catch {
    return null;
  }
}

let isAuthClearing = false;

function clearAuth() {
  isAuthClearing = true;
  localStorage.removeItem('auth-storage');
  window.location.href = '/login';
}

window.addEventListener('auth:logout', () => {
  isAuthClearing = true;
});

api.interceptors.request.use((config) => {
  const tokens = getStoredTokens();
  if (tokens?.access_token) {
    config.headers.Authorization = `Bearer ${tokens.access_token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as any;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const tokens = getStoredTokens();
      if (tokens?.refresh_token) {
        try {
          const { data } = await axios.post('/api/auth/refresh', {
            refresh_token: tokens.refresh_token,
          });
          const stored = JSON.parse(localStorage.getItem('auth-storage') || '{}');
          stored.state = { ...stored.state, tokens: data };
          localStorage.setItem('auth-storage', JSON.stringify(stored));
          originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
          return api(originalRequest);
        } catch {
          clearAuth();
        }
      }
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (email: string, password: string, full_name: string) =>
    api.post('/auth/register', { email, password, full_name }),
  refresh: (refresh_token: string) =>
    api.post('/auth/refresh', { refresh_token }),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data: any) => api.put('/auth/profile', data),
  changePassword: (current_password: string, new_password: string) =>
    api.post('/auth/change-password', { current_password, new_password }),
  logout: () => api.post('/auth/logout'),
};

export const accountsApi = {
  getAll: (includeArchived = false, page = 0, pageSize = 0) =>
    api.get(`/accounts/?include_archived=${includeArchived}&page=${page}&page_size=${pageSize}`),
  getById: (id: string) => api.get(`/accounts/${id}`),
  getSummary: (id: string) => api.get(`/accounts/${id}/summary`),
  create: (data: any) => api.post('/accounts/', data),
  update: (id: string, data: any) => api.put(`/accounts/${id}`, data),
  delete: (id: string) => api.delete(`/accounts/${id}`),
};

export const categoriesApi = {
  getAll: (type?: string, page = 0, pageSize = 0) =>
    api.get(`/categories/?type=${type || ''}&page=${page}&page_size=${pageSize}`),
  create: (data: any) => api.post('/categories/', data),
  update: (id: string, data: any) => api.put(`/categories/${id}`, data),
  delete: (id: string) => api.delete(`/categories/${id}`),
  seed: () => api.post('/categories/seed'),
};

export const categoryRulesApi = {
  getAll: () => api.get('/category-rules/'),
  create: (data: any) => api.post('/category-rules/', data),
  update: (id: string, data: any) => api.put(`/category-rules/${id}`, data),
  delete: (id: string) => api.delete(`/category-rules/${id}`),
};

export const transactionsApi = {
  getAll: (params?: any) => api.get('/transactions/', { params }),
  getById: (id: string) => api.get(`/transactions/${id}`),
  create: (data: any) => api.post('/transactions/', data),
  update: (id: string, data: any) => api.put(`/transactions/${id}`, data),
  delete: (id: string) => api.delete(`/transactions/${id}`),
};

export const budgetsApi = {
  getAll: (activeOnly = false, page = 0, pageSize = 0) =>
    api.get(`/budgets/?active_only=${activeOnly}&page=${page}&page_size=${pageSize}`),
  create: (data: any) => api.post('/budgets/', data),
  update: (id: string, data: any) => api.put(`/budgets/${id}`, data),
  delete: (id: string) => api.delete(`/budgets/${id}`),
};

export const recurringApi = {
  getAll: (activeOnly = false) => api.get(`/recurring/?active_only=${activeOnly}`),
  create: (data: any) => api.post('/recurring/', data),
  update: (id: string, data: any) => api.put(`/recurring/${id}`, data),
  delete: (id: string) => api.delete(`/recurring/${id}`),
};

export const goalsApi = {
  getAll: (status?: string, page = 0, pageSize = 0) =>
    api.get(`/goals/?status=${status || ''}&page=${page}&page_size=${pageSize}`),
  create: (data: any) => api.post('/goals/', data),
  update: (id: string, data: any) => api.put(`/goals/${id}`, data),
  delete: (id: string) => api.delete(`/goals/${id}`),
};

export const alertsApi = {
  getAll: (unreadOnly = false, limit = 50) =>
    api.get(`/alerts/?unread_only=${unreadOnly}&limit=${limit}`),
  markRead: (id: string) => api.post(`/alerts/${id}/read`),
  dismiss: (id: string) => api.post(`/alerts/${id}/dismiss`),
  getPreferences: () => api.get('/alerts/preferences'),
  updatePreference: (type: string, data: any) =>
    api.put(`/alerts/preferences/${type}`, data),
  generate: () => api.post('/alerts/generate'),
};

export const billsApi = {
  getAll: (unpaidOnly = false) => api.get(`/bills/?unpaid_only=${unpaidOnly}`),
  create: (data: any) => api.post('/bills/', data),
  update: (id: string, data: any) => api.put(`/bills/${id}`, data),
  delete: (id: string) => api.delete(`/bills/${id}`),
  upload: (id: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/bills/${id}/upload`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const memoriesApi = {
  getAll: (type?: string) => api.get(`/memories/${type ? `?memory_type=${type}` : ''}`),
  create: (data: any) => api.post('/memories/', data),
  update: (id: string, data: any) => api.put(`/memories/${id}`, data),
  delete: (id: string) => api.delete(`/memories/${id}`),
};

export const ocrApi = {
  scan: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/ocr/scan', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const analysisApi = {
  getDashboard: () => api.get('/analysis/dashboard'),
  getPeriod: (params: any) => api.get('/analysis/period', { params }),
};

export const copilotApi = {
  chat: (data: any) => api.post('/copilot/chat', data),
  chatStream: (data: any, onEvent: (event: { type: string; content: any }) => void, onDone: () => void, onError: (err: Error) => void) => {
    const token = localStorage.getItem('token');
    const controller = new AbortController();
    fetch('/api/copilot/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(data),
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok || !response.body) {
        onError(new Error(`HTTP ${response.status}`));
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(line.slice(6));
              onEvent(parsed);
              if (parsed.type === 'done') onDone();
            } catch { /* skip malformed */ }
          }
        }
      }
    }).catch((err) => {
      if (err.name !== 'AbortError') onError(err);
    });
    return controller;
  },
  simulate: (data: any) => api.post('/copilot/simulate', data),
};

export const onboardingApi = {
  complete: () => api.patch('/auth/onboarding'),
};

export const importApi = {
  preview: (file: File, options: any = {}) => {
    const form = new FormData();
    form.append('file', file);
    form.append('options', JSON.stringify(options));
    return api.post('/import/preview', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  execute: (file: File, options: any = {}) => {
    const form = new FormData();
    form.append('file', file);
    form.append('options', JSON.stringify(options));
    return api.post('/import/execute', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export default api;
