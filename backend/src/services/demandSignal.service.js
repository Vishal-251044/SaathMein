/**
 * Demand signal service — records what buyers want and where (feeds AI on Days 16–19).
 */
const DemandSignal = require('../models/demandSignal.model');
const { createLogger } = require('../utils/logger');

const log = createLogger('DemandSignalService');

/**
 * Replace a user's onboarding interest signals with their current interests.
 * One signal per chosen category, plus one per chosen brand (with its category when known).
 * Never throws: demand data must not break onboarding.
 * @param {Object} params
 * @param {Object} params.user - User document (city, area)
 * @param {Object[]} params.categories - Chosen categories (lean docs with featuredBrands)
 * @param {Object} params.interests - `{ brands, budgetMinPaise, budgetMaxPaise, timeline }`
 * @returns {Promise<number>} Number of signals written
 */
const recordInterestSignals = async ({ user, categories, interests }) => {
  try {
    const base = {
      userId: user._id,
      type: 'interest',
      cityId: user.cityId,
      area: user.area,
      budgetMinPaise: interests.budgetMinPaise,
      budgetMaxPaise: interests.budgetMaxPaise,
      timeline: interests.timeline,
    };

    const signals = categories.map((category) => ({ ...base, categoryId: category._id }));
    (interests.brands || []).forEach((brand) => {
      const category = categories.find((c) => (c.featuredBrands || []).includes(brand));
      signals.push({ ...base, brand, categoryId: category?._id });
    });

    await DemandSignal.deleteMany({ userId: user._id, type: 'interest' });
    if (signals.length) await DemandSignal.insertMany(signals);
    return signals.length;
  } catch (err) {
    log.error({ err: err.message, userId: String(user._id) }, 'Could not record interest signals');
    return 0;
  }
};

/**
 * Record one view / search / interest signal (fire and forget — never throws).
 * @param {Object} signal - `{ userId, type, productId?, categoryId?, query?, cityId?, area? }`
 * @returns {Promise<void>}
 */
const recordSignal = async (signal) => {
  try {
    await DemandSignal.create(signal);
  } catch (err) {
    log.error({ err: err.message, type: signal.type }, 'Could not record demand signal');
  }
};

/**
 * Remove all signals of a user (account deletion).
 * @param {string} userId - User id
 * @returns {Promise<void>}
 */
const deleteUserSignals = async (userId) => {
  await DemandSignal.deleteMany({ userId });
};

module.exports = { recordInterestSignals, recordSignal, deleteUserSignals };
