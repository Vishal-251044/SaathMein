/**
 * Dealer auctions and seller-led deals — /api/seller/auctions, /api/seller/deals
 * (PRD §10.5, AUC-1 to AUC-9). All money is integer paise; the server checks every rule.
 */
import { sellerApi } from '@/services/api';

/**
 * @param {{ tab: 'live'|'upcoming'|'won', page?: number }} params
 * @returns {Promise<{ groups: Object[], meta: Object }>}
 */
export const listAuctions = async ({ tab, page = 1 }) => {
  const response = await sellerApi.get('/seller/auctions', { params: { tab, page, limit: 20 } });
  return { groups: response.data.groups, meta: response.meta };
};

/** @param {string} groupId @returns {Promise<Object>} Dealer auction view */
export const getAuction = async (groupId) =>
  (await sellerApi.get(`/seller/auctions/${groupId}`)).data.auction;

/**
 * Join an auction by accepting the commitment (AUC-2).
 * @param {{ groupId: string, deliveryBy: string, priceValidityDays: number }} input
 * @returns {Promise<Object>} Dealer auction view
 */
export const joinAuction = async ({ groupId, deliveryBy, priceValidityDays }) =>
  (
    await sellerApi.post(`/seller/auctions/${groupId}/join`, {
      acceptCommitment: true,
      deliveryBy,
      priceValidityDays,
    })
  ).data.auction;

/**
 * Place a bid (all-inclusive price + breakdown that adds up to it).
 * @param {{ groupId: string, pricePerUnitPaise: number, breakdown: Object, inclusions?: string[], terms?: string }} input
 * @returns {Promise<{ rank: number, lowestPricePaise: number, endsAt: string, extended: boolean }>}
 */
export const placeBid = async ({ groupId, ...bid }) =>
  (await sellerApi.post(`/seller/auctions/${groupId}/bids`, bid)).data;

/** @param {{ groupId: string, reason: string }} input Owner only */
export const backOut = async ({ groupId, reason }) =>
  sellerApi.post(`/seller/auctions/${groupId}/back-out`, { reason });

/** @param {{ groupId: string, accept: boolean }} input @returns {Promise<Object>} Auction */
export const respondRunnerUp = async ({ groupId, accept }) =>
  (await sellerApi.post(`/seller/auctions/${groupId}/runner-up`, { accept })).data.auction;

/** @param {{ page?: number }} [params] @returns {Promise<{ deals: Object[], meta: Object }>} */
export const listDeals = async ({ page = 1 } = {}) => {
  const response = await sellerApi.get('/seller/deals', { params: { page, limit: 20 } });
  return { deals: response.data.deals, meta: response.meta };
};

/** @param {Object} deal - Deal form (paise, basis points) @returns {Promise<Object>} */
export const createDeal = async (deal) => (await sellerApi.post('/seller/deals', deal)).data.deal;

/**
 * Catalog search for the deal form (public products endpoint).
 * @param {{ q: string, cityId?: string }} params
 * @returns {Promise<Object[]>} Product cards
 */
export const searchProducts = async ({ q, cityId }) =>
  (await sellerApi.get('/products', { params: { q, cityId, limit: 10 } })).data.products;

/**
 * Product details for the deal form (variants).
 * @param {{ productId: string, cityId?: string }} params
 * @returns {Promise<Object>} Product with variants
 */
export const getProduct = async ({ productId, cityId }) =>
  (await sellerApi.get(`/products/${productId}`, { params: { cityId } })).data.product;
