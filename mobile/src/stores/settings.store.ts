/**
 * Settings store (Zustand) — client-side preferences.
 * The language is chosen on first launch (Day 2) and saved, so the picker shows only once.
 */
import { create } from 'zustand';

import i18n, { type AppLanguage, isSupportedLanguage } from '@/i18n';
import { getItem, setItem, STORAGE_KEYS } from '@/lib/secureStorage';

interface SettingsState {
  language: AppLanguage;
  /** False until the user picks a language on first launch. */
  hasChosenLanguage: boolean;
  /** True once saved settings have been read at startup. */
  isHydrated: boolean;
  /** Load saved settings (call once at startup). */
  hydrate: () => Promise<void>;
  /** Change and save the app language; every translated screen updates. */
  setLanguage: (language: AppLanguage) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  language: isSupportedLanguage(i18n.language) ? i18n.language : 'en',
  hasChosenLanguage: false,
  isHydrated: false,

  hydrate: async () => {
    const saved = await getItem(STORAGE_KEYS.LANGUAGE);
    if (isSupportedLanguage(saved)) {
      await i18n.changeLanguage(saved);
      set({ language: saved, hasChosenLanguage: true, isHydrated: true });
      return;
    }
    set({ isHydrated: true });
  },

  setLanguage: async (language) => {
    await i18n.changeLanguage(language);
    set({ language, hasChosenLanguage: true });
    await setItem(STORAGE_KEYS.LANGUAGE, language);
  },
}));
