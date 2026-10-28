/**
 * Pick the right-language name for data from the API (categories, cities, areas).
 * Falls back to English when a translation is missing.
 */
import type { NameTranslations } from '@/types/catalog';

interface Localizable {
  name: string;
  nameTranslations?: NameTranslations;
}

/**
 * @param item - Entity with `name` (English) and optional `nameTranslations`
 * @param language - Current UI language (en, hi, mr)
 * @returns Name in that language, or the English name
 */
export function localizedName(item: Localizable | null | undefined, language: string): string {
  if (!item) return '';
  if (language === 'hi' || language === 'mr') {
    return item.nameTranslations?.[language] || item.name;
  }
  return item.name;
}
