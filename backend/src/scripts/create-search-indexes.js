/**
 * create-search-indexes — creates or updates the Atlas Search index for products
 * (npm run search:indexes). Needs a MongoDB Atlas cluster (the free M0 tier supports it).
 * Without it the API still works: search falls back to in-memory fuzzy matching.
 */
const Product = require('../models/product.model');
const { runScript } = require('./runScript');
const {
  SEARCH_INDEX_NAME,
  SEARCH_INDEX_DEFINITION,
} = require('../services/catalog/productSearch.service');

runScript('CreateSearchIndexes', async (log) => {
  const collection = Product.collection;
  // The collection must exist before a search index can be created on it
  await Product.createCollection().catch(() => {});

  let existing;
  try {
    existing = await collection.listSearchIndexes(SEARCH_INDEX_NAME).toArray();
  } catch (err) {
    log.error(
      { err: err.message },
      'This cluster does not support Atlas Search. Search will use the fuzzy fallback.',
    );
    return 1;
  }

  if (existing.length) {
    await collection.updateSearchIndex(SEARCH_INDEX_NAME, SEARCH_INDEX_DEFINITION);
    log.info(`Updated search index "${SEARCH_INDEX_NAME}" (Atlas rebuilds it in about a minute)`);
  } else {
    await collection.createSearchIndex({
      name: SEARCH_INDEX_NAME,
      definition: SEARCH_INDEX_DEFINITION,
    });
    log.info(`Created search index "${SEARCH_INDEX_NAME}" (ready in about a minute)`);
  }
  return 0;
});
