/**
 * Product presenters — the shapes products take in API responses.
 * Public shapes show prices for ONE city (the buyer's); admin shapes show everything.
 */

/**
 * Headline price of a price entry: on-road (vehicles), else ex-showroom, else MRP.
 * @param {{ onRoadPaise?: number, exShowroomPaise?: number, mrpPaise?: number }} entry
 * @returns {number|null} Price in paise
 */
const headlinePrice = (entry) =>
  entry?.onRoadPaise ?? entry?.exShowroomPaise ?? entry?.mrpPaise ?? null;

/** Map / plain object → plain object (lean docs give objects, documents give Maps). */
const toPlainObject = (value) => (value instanceof Map ? Object.fromEntries(value) : value || {});

/**
 * Price entries for one city.
 * @param {Object} product - Product (document or lean)
 * @param {string|null} cityId - City id
 * @returns {Object[]} `[{ variantKey, mrpPaise, exShowroomPaise, onRoadPaise, pricePaise, updatedAt }]`
 */
const pricesForCity = (product, cityId) =>
  (product.priceByCity || [])
    .filter((entry) => cityId && String(entry.cityId) === String(cityId))
    .map((entry) => ({
      variantKey: entry.variantKey ?? null,
      mrpPaise: entry.mrpPaise ?? null,
      exShowroomPaise: entry.exShowroomPaise ?? null,
      onRoadPaise: entry.onRoadPaise ?? null,
      pricePaise: headlinePrice(entry),
      updatedAt: entry.updatedAt,
    }));

/**
 * Lowest headline price in a city ("from ₹X").
 * @param {Object[]} cityPrices - Output of pricesForCity
 * @returns {number|null} Price in paise
 */
const lowestPrice = (cityPrices) => {
  const values = cityPrices.map((entry) => entry.pricePaise).filter((value) => value != null);
  return values.length ? Math.min(...values) : null;
};

/**
 * Compact product for lists and search results.
 * @param {Object} product - Product
 * @param {string|null} cityId - Buyer's city
 * @returns {Object} Product card
 */
const toProductCard = (product, cityId) => ({
  id: String(product._id),
  slug: product.slug,
  brand: product.brand,
  model: product.model,
  name: `${product.brand} ${product.model}`,
  categoryId: String(product.categoryId),
  imageUrl: product.images?.[0]?.url || null,
  fromPricePaise: lowestPrice(pricesForCity(product, cityId)),
});

/**
 * Full product for the product page.
 * @param {Object} product - Product
 * @param {string|null} cityId - Buyer's city
 * @returns {Object} Product details with city prices
 */
const toPublicProduct = (product, cityId) => {
  const prices = pricesForCity(product, cityId);
  return {
    ...toProductCard(product, cityId),
    description: product.description || null,
    tags: product.tags || [],
    variants: (product.variants || []).map((variant) => ({
      key: variant.key,
      name: variant.name,
      attrs: toPlainObject(variant.attrs),
    })),
    specs: toPlainObject(product.specs),
    images: (product.images || []).map((image) => ({ url: image.url })),
    cityId: cityId ? String(cityId) : null,
    prices,
  };
};

/**
 * Admin product: every field, all cities' prices, review status.
 * @param {Object} product - Product
 * @returns {Object} Admin product
 */
const toAdminProduct = (product) => ({
  id: String(product._id),
  slug: product.slug,
  categoryId: String(product.categoryId),
  brand: product.brand,
  model: product.model,
  description: product.description || '',
  tags: product.tags || [],
  variants: (product.variants || []).map((variant) => ({
    key: variant.key,
    name: variant.name,
    attrs: toPlainObject(variant.attrs),
  })),
  specs: toPlainObject(product.specs),
  images: (product.images || []).map((image) => ({
    url: image.url,
    publicId: image.publicId || null,
  })),
  prices: (product.priceByCity || []).map((entry) => ({
    cityId: String(entry.cityId),
    variantKey: entry.variantKey ?? null,
    mrpPaise: entry.mrpPaise ?? null,
    exShowroomPaise: entry.exShowroomPaise ?? null,
    onRoadPaise: entry.onRoadPaise ?? null,
    updatedAt: entry.updatedAt,
  })),
  active: product.active,
  needsPriceReview: Boolean(product.needsPriceReview),
  updatedAt: product.updatedAt,
});

module.exports = { headlinePrice, pricesForCity, toProductCard, toPublicProduct, toAdminProduct };
