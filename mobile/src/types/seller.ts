/**
 * Dealer types as buyers see them (GET /sellers) and product requests (POST /product-requests).
 */

/** Verified dealer card — no phone, documents or bank details before acceptance. */
export interface PublicSeller {
  id: string;
  businessName: string;
  area: string | null;
  cityId: string | null;
  /** Average rating, or null until the dealer has reviews. */
  rating: number | null;
  ratingCount: number;
  verified: boolean;
  /** Distance from the buyer in km, when a location was sent. */
  distanceKm: number | null;
}

export interface ProductRequestInput {
  brand: string;
  model: string;
  categoryId?: string;
  note?: string;
}

export interface ProductRequest extends ProductRequestInput {
  id: string;
  status: 'open' | 'added' | 'rejected';
  createdAt: string;
}
