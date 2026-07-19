import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFS_KEY = 'app_preferences';

export type WidgetId = 'balance' | 'recent' | 'streaks' | 'goals' | 'budgets';

interface AppPreferences {
  currency: string;
  darkMode: boolean;
  darkModeAutoSchedule: boolean;
  biometricEnabled: boolean;
  notificationsEnabled: boolean;
  budgetAlertThreshold: number;
  billReminderDays: number;
  dashboardLayout: WidgetId[];
  compactMode: boolean;
}

interface PreferencesState {
  prefs: AppPreferences;
  load: () => Promise<void>;
  update: (partial: Partial<AppPreferences>) => Promise<void>;
  reset: () => Promise<void>;
}

const DEFAULTS: AppPreferences = {
  currency: 'INR',
  darkMode: false,
  darkModeAutoSchedule: true,
  biometricEnabled: false,
  notificationsEnabled: true,
  budgetAlertThreshold: 80,
  billReminderDays: 3,
  dashboardLayout: ['balance', 'recent', 'streaks', 'goals', 'budgets'],
  compactMode: false,
};

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  prefs: DEFAULTS,

  load: async () => {
    try {
      const raw = await AsyncStorage.getItem(PREFS_KEY);
      if (raw) {
        const stored = JSON.parse(raw);
        set({ prefs: { ...DEFAULTS, ...stored } });
      }
    } catch {
      set({ prefs: DEFAULTS });
    }
  },

  update: async (partial) => {
    const updated = { ...get().prefs, ...partial };
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(updated));
    set({ prefs: updated });
  },

  reset: async () => {
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(DEFAULTS));
    set({ prefs: DEFAULTS });
  },
}));
