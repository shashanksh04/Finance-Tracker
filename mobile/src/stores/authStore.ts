import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, AuthTokens } from '../types';
import { authApi } from '../services/api';

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, full_name: string) => Promise<void>;
  logout: () => void;
  setTokens: (tokens: AuthTokens) => void;
  loadUser: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authApi.login(email, password);
          const tokens = response.data as AuthTokens;
          set({ tokens, isAuthenticated: true, isLoading: false });

          const meResponse = await authApi.getMe();
          set({ user: meResponse.data as User });
        } catch (err: any) {
          const message =
            err.response?.data?.detail || err.message || 'Login failed';
          set({ error: message, isLoading: false });
          throw err;
        }
      },

      register: async (email, password, full_name) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authApi.register(email, password, full_name);
          const tokens = response.data as AuthTokens;
          set({ tokens, isAuthenticated: true, isLoading: false });

          const meResponse = await authApi.getMe();
          set({ user: meResponse.data as User });
        } catch (err: any) {
          const message =
            err.response?.data?.detail || err.message || 'Registration failed';
          set({ error: message, isLoading: false });
          throw err;
        }
      },

      logout: () => {
        authApi.logout().catch(() => {});
        set({
          user: null,
          tokens: null,
          isAuthenticated: false,
          error: null,
        });
      },

      setTokens: (tokens) => set({ tokens, isAuthenticated: true }),

      loadUser: async () => {
        const state = get();
        if (!state.tokens?.access_token) return;

        set({ isLoading: true });
        try {
          const response = await authApi.getMe();
          set({ user: response.data as User, isAuthenticated: true, isLoading: false });
        } catch {
          set({ user: null, tokens: null, isAuthenticated: false, isLoading: false });
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        tokens: state.tokens,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
