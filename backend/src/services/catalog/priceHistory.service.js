/**
 * Price history service (CAT-5): records a point whenever a product's price in a city
 * changes, and reads the history for charts (Price Insights, Day 17).
 */
const PriceHistory = require('../../models/priceHistory.model');
const { headlinePrice } = require('./productPresenter');

const PRICE_FIELDS = ['mrpPaise', 'exShowroomPaise', 'onRoadPaise'];

/**
 * Stable key for a city + variant price.
 * @param {{ cityId: *, variantKey?: string|null }} entry
 * @returns {string}
 */
const priceKey = (entry) => `${entry.cityId}:${entry.variantKey ?? ''}`;

/**
 * Price entries that are new or different from before.
 * @param {Object[]} oldPrices - Previous priceByCity
 * @param {Object[]} newPrices - New priceByCity
 * @returns {Object[]} Changed entries (new values)
 */
const changedPrices = (oldPrices = [], newPrices = []) => {
  const previous = new Map(oldPrices.map((entry) => [priceKey(entry), entry]));
  return newPrices.filter((entry) => {
    const before = previous.get(priceKey(entry));
    return (
      !before || PRICE_FIELDS.some((field) => (before[field] ?? null) !== (entry[field] ?? null))
    );
  });
};

/**
 * Write one history point per changed price.
 * @param {Object} params
 * @param {string} params.productId - Product id
 * @param {Object[]} params.oldPrices - priceByCity before the change
 * @param {Object[]} params.newPrices - priceByCity after the change
 * @param {'admin'|'offer'|'tier'} params.source - Where the price came from
 * @param {string} [params.changedBy] - Staff user id
 * @returns {Promise<number>} Points written
 */
const recordPriceChanges = async ({ productId, oldPrices, newPrices, source, changedBy }) => {
  const points = changedPrices(oldPrices, newPrices)
    .filter((entry) => headlinePrice(entry) != null)
    .map((entry) => ({
      productId,
      cityId: entry.cityId,
      variantKey: entry.variantKey ?? null,
      date: new Date(),
      pricePaise: headlinePrice(entry),
      mrpPaise: entry.mrpPaise ?? undefined,
      exShowroomPaise: entry.exShowroomPaise ?? undefined,
      onRoadPaise: entry.onRoadPaise ?? undefined,
      source,
      changedBy,
    }));
  if (points.length) await PriceHistory.insertMany(points);
  return points.length;
};

/**
 * Price history for a product in a city, oldest first.
 * @param {{ productId: string, cityId: string, variantKey?: string|null, limit?: number }} params
 * @returns {Promise<Object[]>} `[{ date, variantKey, pricePaise, mrpPaise, exShowroomPaise, onRoadPaise, source }]`
 */
const getPriceHistory = async ({ productId, cityId, variantKey, limit = 200 }) => {
  const filter = { productId, cityId };
  if (variantKey !== undefined) filter.variantKey = variantKey;
  const points = await PriceHistory.find(filter).sort({ date: -1 }).limit(limit).lean();
  return points.reverse().map((point) => ({
    date: point.date,
    variantKey: point.variantKey ?? null,
    pricePaise: point.pricePaise,
    mrpPaise: point.mrpPaise ?? null,
    exShowroomPaise: point.exShowroomPaise ?? null,
    onRoadPaise: point.onRoadPaise ?? null,
    source: point.source,
  }));
};

module.exports = { priceKey, changedPrices, recordPriceChanges, getPriceHistory };
