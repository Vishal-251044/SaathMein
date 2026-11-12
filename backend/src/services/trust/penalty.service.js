/**
 * Dealer penalties (TRU-5): warning, rating penalty (one 1-star in the average) and
 * suspension from auctions for N days. Used by Support decisions on disputes and reports,
 * and by a winner backing out (Day 9). Penalties are appended, never removed.
 */
const Seller = require('../../models/seller.model');
const { createLogger } = require('../../utils/logger');
const { recomputeSellerRating } = require('./rating.service');

const log = createLogger('PenaltyService');
const DAY_MS = 24 * 60 * 60 * 1000;
const TYPES = ['warning', 'rating_penalty', 'auction_suspension'];

/**
 * Add penalties to a dealer.
 * @param {string} sellerId
 * @param {string[]} types - Any of warning, rating_penalty, auction_suspension
 * @param {{ reason: string, staffId?: string, groupId?: string, disputeId?: string,
 *   suspensionDays?: number, now?: Date }} context
 * @returns {Promise<number>} Penalties added
 */
const applyPenalties = async (
  sellerId,
  types,
  { reason, staffId, groupId, disputeId, suspensionDays = 30, now = new Date() },
) => {
  const unique = [...new Set(types)].filter((type) => TYPES.includes(type));
  if (!unique.length) return 0;
  const penalties = unique.map((type) => ({
    type,
    reason,
    groupId,
    disputeId,
    createdBy: staffId,
    createdAt: now,
    ...(type === 'auction_suspension'
      ? { until: new Date(now.getTime() + suspensionDays * DAY_MS) }
      : {}),
  }));
  await Seller.updateOne({ _id: sellerId }, { $push: { penalties: { $each: penalties } } });
  if (unique.includes('rating_penalty')) await recomputeSellerRating(sellerId);
  log.warn({ sellerId: String(sellerId), types: unique, disputeId }, 'Dealer penalised');
  return penalties.length;
};

module.exports = { PENALTY_TYPES: TYPES, applyPenalties };
