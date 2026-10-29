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

/** One price for the buyer's city (integer paise; pricePaise = on-road, else ex-showroom, else MRP). */
export interface ProductPrice {
  variantKey: string | null;
  mrpPaise: number | null;
  exShowroomPaise: number | null;
  onRoadPaise: number | null;
  pricePaise: number | null;
  updatedAt: string;
}

/** Product in lists and search results. */
export interface ProductCard {
  id: string;
  slug: string;
  brand: string;
  model: string;
  name: string;
  categoryId: string;
  imageUrl: string | null;
  fromPricePaise: number | null;
}

export interface ProductVariant {
  key: string;
  name: string;
  attrs: Record<string, string>;
}

/** Product page data (GET /products/:id). */
export interface ProductDetail extends ProductCard {
  description: string | null;
  tags: string[];
  variants: ProductVariant[];
  specs: Record<string, string>;
  images: { url: string }[];
  cityId: string | null;
  prices: ProductPrice[];
}

/** One page of GET /products. */
export interface ProductPage {
  products: ProductCard[];
  meta: { page: number; limit: number; hasNextPage: boolean; cityId: string | null };
}
