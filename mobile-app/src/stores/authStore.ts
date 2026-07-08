import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi, storeTokens, getStoredTokens } from '../services/api';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, full_name: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  token: null,

  login: async (email, password) => {
    const res = await authApi.login({ email, password });
    const { access_token, refresh_token, user } = res.data;
    await storeTokens({ access_token, refresh_token });
    set({ user, isAuthenticated: true, token: access_token });
  },

  register: async (email, password, full_name) => {
    const res = await authApi.register({ email, password, full_name });
    const { access_token, refresh_token, user } = res.data;
    await storeTokens({ access_token, refresh_token });
    set({ user, isAuthenticated: true, token: access_token });
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
    } finally {
      await storeTokens(null);
      await AsyncStorage.removeItem('auth_tokens');
      set({ user: null, isAuthenticated: false, token: null });
    }
  },

  loadUser: async () => {
    try {
      const tokens = await getStoredTokens();
      if (!tokens?.access_token) {
        set({ isLoading: false });
        return;
      }
      set({ token: tokens.access_token });
      const res = await authApi.me();
      set({ user: res.data, isAuthenticated: true, isLoading: false });
    } catch {
      await storeTokens(null);
      set({ user: null, isAuthenticated: false, isLoading: false, token: null });
    }
  },
}));
