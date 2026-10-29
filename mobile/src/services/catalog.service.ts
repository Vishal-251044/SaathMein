/**
 * Catalog service — public categories, cities and products (browsing needs no login;
 * when logged in, the API remembers views and searches for recommendations).
 */
import type {
  CategoryGroup,
  City,
  LocationMatch,
  ProductDetail,
  ProductPage,
} from '@/types/catalog';

import { api, type ApiEnvelope, unwrap } from './api';

/** @returns Active category tree */
export async function getCategories(): Promise<CategoryGroup[]> {
  const data = await unwrap<{ categories: CategoryGroup[] }>(api.get('/categories'));
  return data.categories;
}

/** @returns Active launch cities with areas */
export async function getCities(): Promise<City[]> {
  const data = await unwrap<{ cities: City[] }>(api.get('/cities'));
  return data.cities;
}

/**
 * Match a detected location to a launch city and area.
 * @param location - Coordinates and/or pincode from the phone
 * @returns City and area, or nulls when outside launch cities
 */
export function matchLocation(location: {
  latitude?: number;
  longitude?: number;
  pincode?: string;
}): Promise<LocationMatch> {
  return unwrap(api.get('/cities/match', { params: location }));
}

export interface ProductQuery {
  q?: string;
  categoryId?: string;
  cityId?: string | null;
  page?: number;
  limit?: number;
}

/**
 * List or search products (typo-tolerant search, DIS-2).
 * @param query - Search text, category, buyer city and page
 * @returns One page of products with `hasNextPage`
 */
export async function listProducts({
  q,
  categoryId,
  cityId,
  page = 1,
  limit = 20,
}: ProductQuery): Promise<ProductPage> {
  const response = await api.get<ApiEnvelope<{ products: ProductPage['products'] }>>('/products', {
    params: { q: q || undefined, categoryId, cityId: cityId || undefined, page, limit },
  });
  return { products: response.data.data.products, meta: response.data.meta as ProductPage['meta'] };
}

/**
 * Most wanted products in the buyer's city (Home rail).
 * @param cityId - Buyer's city (defaults to the launch city on the server)
 * @param limit - How many cards
 * @returns Product cards, most popular first
 */
export async function listPopularProducts(
  cityId: string | null,
  limit = 10,
): Promise<ProductPage['products']> {
  const data = await unwrap<{ products: ProductPage['products'] }>(
    api.get('/products', { params: { sort: 'popular', cityId: cityId || undefined, limit } }),
  );
  return data.products;
}

/**
 * Product page data with prices for the buyer's city.
 * @param productId - Product id
 * @param cityId - Buyer's city (defaults to the launch city on the server)
 * @returns Product details
 */
export async function getProduct(
  productId: string,
  cityId?: string | null,
): Promise<ProductDetail> {
  const data = await unwrap<{ product: ProductDetail }>(
    api.get(`/products/${productId}`, { params: { cityId: cityId || undefined } }),
  );
  return data.product;
}

/**
 * "I want this" — records demand for a product until group creation opens (Day 6).
 * @param productId - Product id
 */
export async function registerProductInterest(productId: string): Promise<void> {
  await api.post(`/products/${productId}/interest`);
}
