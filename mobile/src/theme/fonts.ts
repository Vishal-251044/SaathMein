/**
 * Font loading and weight → family mapping.
 * Native platforms need the exact font name per weight, so text weight is chosen with
 * a family class (font-bold, font-deva-bold...) instead of fontWeight.
 * Plus Jakarta Sans for Latin UI, Noto Sans Devanagari for Hindi/Marathi, JetBrains Mono
 * for deal codes and prices in tickets.
 */
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { JetBrainsMono_500Medium, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';
import {
  NotoSansDevanagari_400Regular,
  NotoSansDevanagari_500Medium,
  NotoSansDevanagari_600SemiBold,
  NotoSansDevanagari_700Bold,
  NotoSansDevanagari_800ExtraBold,
} from '@expo-google-fonts/noto-sans-devanagari';

/** Every font the app uses, passed to expo-font's useFonts() in the root layout. */
export const appFonts = {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  NotoSansDevanagari_400Regular,
  NotoSansDevanagari_500Medium,
  NotoSansDevanagari_600SemiBold,
  NotoSansDevanagari_700Bold,
  NotoSansDevanagari_800ExtraBold,
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
};

export type FontWeight = 'regular' | 'medium' | 'semibold' | 'bold' | 'extrabold';

/** Tailwind font class per weight, for Latin and Devanagari scripts. */
const FONT_CLASS: Record<'latin' | 'devanagari', Record<FontWeight, string>> = {
  latin: {
    regular: 'font-regular',
    medium: 'font-medium',
    semibold: 'font-semibold',
    bold: 'font-bold',
    extrabold: 'font-extrabold',
  },
  devanagari: {
    regular: 'font-deva-regular',
    medium: 'font-deva-medium',
    semibold: 'font-deva-semibold',
    bold: 'font-deva-bold',
    extrabold: 'font-deva-extrabold',
  },
};

/** Languages written in Devanagari script. */
const DEVANAGARI_LANGUAGES = new Set(['hi', 'mr']);

/**
 * Pick the font class for a weight in the current UI language.
 * @param weight - Text weight
 * @param language - Current i18n language code (en, hi, mr)
 * @returns Tailwind font-family class
 */
export function fontClassFor(weight: FontWeight, language: string): string {
  const script = DEVANAGARI_LANGUAGES.has(language) ? 'devanagari' : 'latin';
  return FONT_CLASS[script][weight];
}
