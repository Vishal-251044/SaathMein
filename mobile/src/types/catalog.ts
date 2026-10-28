/**
 * Catalog types (mirror GET /categories and GET /cities).
 */

/** Hindi / Marathi names; English is the main `name`. */
export interface NameTranslations {
  hi?: string;
  mr?: string;
}

export interface Category {
  id: string;
  name: string;
  nameTranslations: NameTranslations;
  slug: string;
  icon: string | null;
  parentId: string | null;
  featuredBrands: string[];
  rules: { minSize?: number; maxSize?: number; tokenAmountPaise?: number };
}

/** Top-level category with its children (GET /categories). */
export interface CategoryGroup extends Category {
  children: Category[];
}

export interface Area {
  id: string;
  name: string;
  nameTranslations: NameTranslations;
  slug: string;
  pincodes: string[];
}

export interface City {
  id: string;
  name: string;
  nameTranslations: NameTranslations;
  slug: string;
  state: string;
  areas: Area[];
}

/** GET /cities/match result. */
export interface LocationMatch {
  city: City | null;
  area: Area | null;
}
