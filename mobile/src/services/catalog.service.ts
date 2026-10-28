/**
 * Catalog service — public categories and cities (no login needed).
 */
import type { CategoryGroup, City, LocationMatch } from '@/types/catalog';

import { api, unwrap } from './api';

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
