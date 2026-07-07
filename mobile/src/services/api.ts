import axios from 'axios';
import { useAuthStore } from '../stores/authStore';
import { AuthTokens } from '../types';

const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const state = useAuthStore.getState();
  if (state.tokens?.access_token) {
    config.headers.Authorization = `Bearer ${state.tokens.access_token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = useAuthStore.getState().tokens?.refresh_token;
      if (!refreshToken) {
        useAuthStore.getState().logout();
        isRefreshing = false;
        return Promise.reject(error);
      }

      try {
        const response = await axios.post<AuthTokens>(
          `${api.defaults.baseURL}/auth/refresh`,
          { refresh_token: refreshToken }
        );
        const tokens = response.data;
        useAuthStore.getState().setTokens(tokens);
        processQueue(null, tokens.access_token);
        originalRequest.headers.Authorization = `Bearer ${tokens.access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
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
  updateProfile: (data: Record<string, any>) =>
    api.put('/auth/profile', data),
  changePassword: (current_password: string, new_password: string) =>
    api.post('/auth/change-password', { current_password, new_password }),
  completeOnboarding: () => api.patch('/auth/onboarding'),
  logout: () => api.post('/auth/logout'),
};

export const syncApi = {
  pull: (lastPulledAt?: string) =>
    api.get('/sync/pull', {
      params: lastPulledAt ? { last_pulled_at: lastPulledAt } : {},
    }),
  push: (changes: any) => api.post('/sync/push', { changes }),
};

export const accountsApi = {
  getAll: (params?: Record<string, any>) => api.get('/accounts/', { params }),
  getById: (id: string) => api.get(`/accounts/${id}`),
  create: (data: Record<string, any>) => api.post('/accounts/', data),
  update: (id: string, data: Record<string, any>) =>
    api.put(`/accounts/${id}`, data),
  delete: (id: string) => api.delete(`/accounts/${id}`),
};

export const transactionsApi = {
  getAll: (params?: Record<string, any>) => api.get('/transactions/', { params }),
  getById: (id: string) => api.get(`/transactions/${id}`),
  create: (data: Record<string, any>) => api.post('/transactions/', data),
  update: (id: string, data: Record<string, any>) =>
    api.put(`/transactions/${id}`, data),
  delete: (id: string) => api.delete(`/transactions/${id}`),
};

export const categoriesApi = {
  getAll: (params?: Record<string, any>) => api.get('/categories/', { params }),
  create: (data: Record<string, any>) => api.post('/categories/', data),
  update: (id: string, data: Record<string, any>) =>
    api.put(`/categories/${id}`, data),
  delete: (id: string) => api.delete(`/categories/${id}`),
};

export const budgetsApi = {
  getAll: (params?: Record<string, any>) => api.get('/budgets/', { params }),
  create: (data: Record<string, any>) => api.post('/budgets/', data),
  update: (id: string, data: Record<string, any>) =>
    api.put(`/budgets/${id}`, data),
  delete: (id: string) => api.delete(`/budgets/${id}`),
};

export const goalsApi = {
  getAll: (params?: Record<string, any>) => api.get('/goals/', { params }),
  create: (data: Record<string, any>) => api.post('/goals/', data),
  update: (id: string, data: Record<string, any>) =>
    api.put(`/goals/${id}`, data),
  delete: (id: string) => api.delete(`/goals/${id}`),
};

export const billsApi = {
  getAll: (params?: Record<string, any>) => api.get('/bills/', { params }),
  create: (data: Record<string, any>) => api.post('/bills/', data),
  update: (id: string, data: Record<string, any>) =>
    api.put(`/bills/${id}`, data),
  delete: (id: string) => api.delete(`/bills/${id}`),
  upload: (id: string, file: any) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/bills/${id}/upload`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const alertsApi = {
  getAll: (params?: Record<string, any>) => api.get('/alerts/', { params }),
  markRead: (id: string) => api.post(`/alerts/${id}/read`),
  dismiss: (id: string) => api.post(`/alerts/${id}/dismiss`),
  getPreferences: () => api.get('/alerts/preferences'),
  updatePreference: (type: string, data: Record<string, any>) =>
    api.put(`/alerts/preferences/${type}`, data),
  generate: () => api.post('/alerts/generate'),
};

export const analysisApi = {
  getDashboard: () => api.get('/analysis/dashboard'),
  getPeriod: (params: Record<string, any>) => api.get('/analysis/period', { params }),
};

export const copilotApi = {
  chat: (data: Record<string, any>) => api.post('/copilot/chat', data),
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

export default api;
