/**
 * Marketplace service — verified dealers for a city (TRU-1) and "request a missing
 * product" (CAT-5).
 */
import type { ProductRequest, ProductRequestInput, PublicSeller } from '@/types/seller';

import { api, unwrap } from './api';

/**
 * Verified dealers covering a city (and optionally a category), best rated first.
 * @param params - City, optional category and optional buyer coordinates (for distance)
 * @returns Public dealer cards
 */
export async function listVerifiedSellers(params: {
  cityId: string;
  categoryId?: string;
  latitude?: number;
  longitude?: number;
}): Promise<PublicSeller[]> {
  const data = await unwrap<{ sellers: PublicSeller[] }>(api.get('/sellers', { params }));
  return data.sellers;
}

/**
 * Ask SaathMein to add a product (10 per day).
 * @param input - Brand, model, optional category and note
 * @returns The saved request
 */
export async function requestProduct(input: ProductRequestInput): Promise<ProductRequest> {
  const data = await unwrap<{ request: ProductRequest }>(api.post('/product-requests', input));
  return data.request;
}
