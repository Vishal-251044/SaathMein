/**
 * Settings store (Zustand) — client-side UI preferences.
 * Day 1: current language. Persisting the choice comes with the language picker (Day 2).
 */
import { create } from 'zustand';

import i18n, { type AppLanguage, isSupportedLanguage } from '@/i18n';

interface SettingsState {
  language: AppLanguage;
  /** Change the app language and update every translated screen. */
  setLanguage: (language: AppLanguage) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  language: isSupportedLanguage(i18n.language) ? i18n.language : 'en',
  setLanguage: (language) => {
    i18n.changeLanguage(language);
    set({ language });
  },
}));
