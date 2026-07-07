import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, AuthTokens } from '../types';
import { authApi } from '../services/api';

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, full_name: string) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: true,
      login: async (email, password) => {
        const { data } = await authApi.login(email, password);
        set({ tokens: data, isAuthenticated: true });
        await get().loadUser();
      },
      register: async (email, password, full_name) => {
        const { data } = await authApi.register(email, password, full_name);
        set({ tokens: data, isAuthenticated: true });
        await get().loadUser();
      },
      logout: async () => {
        try { await authApi.logout(); } catch {}
        localStorage.removeItem('auth-storage');
        set({ user: null, tokens: null, isAuthenticated: false });
        window.dispatchEvent(new CustomEvent('auth:logout'));
      },
      loadUser: async () => {
        const { tokens } = get();
        if (!tokens?.access_token) {
          set({ user: null, isAuthenticated: false, isLoading: false });
          return;
        }
        try {
          set({ isLoading: true });
          const { data } = await authApi.getMe();
          set({ user: data, isAuthenticated: true });
        } catch {
          set({ user: null, tokens: null, isAuthenticated: false });
          localStorage.removeItem('auth-storage');
        } finally {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, tokens: state.tokens, isAuthenticated: state.isAuthenticated }),
    }
  )
);
