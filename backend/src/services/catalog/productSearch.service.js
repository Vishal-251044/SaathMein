/**
 * Product search (DIS-2): typo-tolerant search over brand, model and tags.
 *
 * 1. Atlas Search (`product_search` index, fuzzy matching) when the cluster supports it —
 *    create the index with `npm run search:indexes`.
 * 2. Fallback (local MongoDB, index missing, Atlas Search outage): in-memory fuzzy matching
 *    over active products, cached for 60 s. Fine up to a few thousand products.
 */
const { Types } = require('mongoose');
const Product = require('../../models/product.model');
const { createLogger } = require('../../utils/logger');
const { tokenize, matchScore } = require('../../helpers/fuzzy');

const log = createLogger('ProductSearch');

const SEARCH_INDEX_NAME = 'product_search';
const ATLAS_RETRY_AFTER_MS = 10 * 60 * 1000;
const FALLBACK_CACHE_MS = 60 * 1000;

let atlasUnavailableUntil = 0;
let fallbackCache = null; // { loadedAt, items: [{ id, categoryId, words, name }] }

/** Atlas Search index definition (used by scripts/create-search-indexes.js). */
const SEARCH_INDEX_DEFINITION = {
  mappings: {
    dynamic: false,
    fields: {
      brand: [{ type: 'string' }, { type: 'autocomplete', minGrams: 2, maxGrams: 15 }],
      model: [{ type: 'string' }, { type: 'autocomplete', minGrams: 2, maxGrams: 15 }],
      tags: { type: 'string' },
      active: { type: 'boolean' },
      categoryId: { type: 'objectId' },
    },
  },
};

/**
 * Whether an error means "Atlas Search is not available here" (vs. a real failure).
 * @param {Error} err - Error from an aggregation with $search
 * @returns {boolean}
 */
const isSearchUnavailableError = (err) =>
  /\$search|search index|Unrecognized pipeline stage|SearchNotEnabled|not supported|Atlas/i.test(
    err?.message || '',
  );

/**
 * Search with Atlas Search.
 * @param {{ q: string, categoryId?: string, skip: number, limit: number }} params
 * @returns {Promise<string[]>} Product ids in relevance order (limit + 1 to detect a next page)
 */
const searchWithAtlas = async ({ q, categoryId, skip, limit }) => {
  const fuzzy = { maxEdits: q.length > 5 ? 2 : 1, prefixLength: 1 };
  const filter = [{ equals: { path: 'active', value: true } }];
  if (categoryId)
    filter.push({ equals: { path: 'categoryId', value: new Types.ObjectId(String(categoryId)) } });

  const results = await Product.aggregate([
    {
      $search: {
        index: SEARCH_INDEX_NAME,
        compound: {
          should: [
            { text: { query: q, path: ['brand', 'model', 'tags'], fuzzy } },
            { autocomplete: { query: q, path: 'model', fuzzy: { maxEdits: 1 } } },
            { autocomplete: { query: q, path: 'brand', fuzzy: { maxEdits: 1 } } },
          ],
          minimumShouldMatch: 1,
          filter,
        },
      },
    },
    { $skip: skip },
    { $limit: limit + 1 },
    { $project: { _id: 1 } },
  ]);
  return results.map((result) => String(result._id));
};

/**
 * Load (or reuse) the fallback search list.
 * @returns {Promise<Object[]>} Active products with tokenized text
 */
const getFallbackItems = async () => {
  if (fallbackCache && Date.now() - fallbackCache.loadedAt < FALLBACK_CACHE_MS)
    return fallbackCache.items;
  const products = await Product.find({ active: true })
    .select('brand model tags categoryId')
    .lean();
  const items = products.map((product) => ({
    id: String(product._id),
    categoryId: String(product.categoryId),
    name: `${product.brand} ${product.model}`,
    words: tokenize(`${product.brand} ${product.model} ${(product.tags || []).join(' ')}`),
  }));
  fallbackCache = { loadedAt: Date.now(), items };
  return items;
};

/**
 * Search with in-memory fuzzy matching.
 * @param {{ q: string, categoryId?: string, skip: number, limit: number }} params
 * @returns {Promise<string[]>} Product ids, best match first (limit + 1)
 */
const searchWithFallback = async ({ q, categoryId, skip, limit }) => {
  const queryWords = tokenize(q);
  const items = await getFallbackItems();
  return items
    .filter((item) => !categoryId || item.categoryId === String(categoryId))
    .map((item) => ({ item, score: matchScore(queryWords, item.words) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
    .slice(skip, skip + limit + 1)
    .map(({ item }) => item.id);
};

/**
 * Find product ids matching a search query.
 * @param {{ q: string, categoryId?: string, skip: number, limit: number }} params
 * @returns {Promise<{ ids: string[], hasNextPage: boolean, engine: 'atlas'|'fallback' }>}
 */
const searchProductIds = async (params) => {
  let ids;
  let engine = 'fallback';

  if (Date.now() >= atlasUnavailableUntil) {
    try {
      ids = await searchWithAtlas(params);
      engine = 'atlas';
    } catch (err) {
      if (!isSearchUnavailableError(err)) throw err;
      atlasUnavailableUntil = Date.now() + ATLAS_RETRY_AFTER_MS;
      log.warn(
        { err: err.message },
        'Atlas Search unavailable, using fuzzy fallback for 10 minutes',
      );
    }
  }
  if (!ids) ids = await searchWithFallback(params);

  return { ids: ids.slice(0, params.limit), hasNextPage: ids.length > params.limit, engine };
};

/** Forget cached search data after catalog changes. */
const invalidateSearchCache = () => {
  fallbackCache = null;
};

module.exports = {
  SEARCH_INDEX_NAME,
  SEARCH_INDEX_DEFINITION,
  searchProductIds,
  searchWithFallback,
  invalidateSearchCache,
};
