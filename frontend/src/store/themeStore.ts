import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ThemeState {
  darkMode: boolean;
  toggleDarkMode: () => void;
  setDarkMode: (on: boolean) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      darkMode: false,
      toggleDarkMode: () => set((s) => {
        const next = !s.darkMode;
        document.documentElement.classList.toggle('dark', next);
        return { darkMode: next };
      }),
      setDarkMode: (on) => {
        document.documentElement.classList.toggle('dark', on);
        set({ darkMode: on });
      },
    }),
    { name: 'theme-storage', partialize: (s) => ({ darkMode: s.darkMode }) }
  )
);
