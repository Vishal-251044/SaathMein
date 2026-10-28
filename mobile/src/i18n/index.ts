/**
 * i18next setup for English, Hindi and Marathi.
 * The first launch uses the phone's language when supported; the language picker
 * (Day 2) lets the user change it. Every user-facing string must come from these files.
 */
import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import hi from './locales/hi.json';
import mr from './locales/mr.json';

export const SUPPORTED_LANGUAGES = ['en', 'hi', 'mr'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** Language names shown in the picker, each in its own script. */
export const LANGUAGE_LABELS: Record<AppLanguage, string> = {
  en: 'English',
  hi: 'हिन्दी',
  mr: 'मराठी',
};

/**
 * Check whether a language code is one the app supports.
 * @param code - Language code, e.g. "hi"
 * @returns True for en, hi or mr
 */
export function isSupportedLanguage(code: string | null | undefined): code is AppLanguage {
  return SUPPORTED_LANGUAGES.includes(code as AppLanguage);
}

/**
 * Pick the starting language from the phone's locale list, defaulting to English.
 * @returns Supported language code
 */
function detectDeviceLanguage(): AppLanguage {
  const match = getLocales().find((locale) => isSupportedLanguage(locale.languageCode));
  return (match?.languageCode as AppLanguage) ?? 'en';
}

// A dedicated instance (not the global default) so tests and tools can create their own
const i18n = createInstance();

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, hi: { translation: hi }, mr: { translation: mr } },
  lng: detectDeviceLanguage(),
  fallbackLng: 'en',
  supportedLngs: SUPPORTED_LANGUAGES,
  interpolation: { escapeValue: false }, // React already escapes output
  returnNull: false,
});

export default i18n;
