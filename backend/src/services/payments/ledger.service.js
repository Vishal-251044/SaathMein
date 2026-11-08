/**
 * Ledger service (PAY-5) — the append-only record of every money movement. Entries are
 * only ever added (never updated or deleted); mistakes are corrected with new entries.
 *
 * Types and their meaning (amounts are always positive paise):
 * - token_held: buyer paid a token (money now with SaathMein / Razorpay)
 * - refund: token (or part of it) sent back to the buyer
 * - fee: back-out fee SaathMein kept from a token
 * - transfer: token minus commission sent to the dealer (Route, on hold)
 * - commission: SaathMein's commission taken from a token
 * - hold_release: a held transfer released to the dealer
 * - transfer_reversal: a transfer taken back from the dealer
 * - commission_reversal: commission given back when its transfer is reversed
 */
const Ledger = require('../../models/ledger.model');
const { LEDGER_TYPE } = require('../../constants/enums');
const { isValidPaise } = require('../../utils/money');

/**
 * Add ledger entries (inside the caller's transaction when `session` is given).
 * Zero amounts are skipped.
 * @param {Object[]} entries - `{ type, amountPaise, userId?, sellerId?, groupId?, paymentId?, ref?, note?, createdBy? }`
 * @param {import('mongoose').ClientSession} [session]
 * @returns {Promise<Object[]>} Created entries
 * @throws {TypeError} When an amount is not integer paise
 */
const recordLedger = async (entries, session) => {
  const rows = entries.filter((entry) => entry.amountPaise !== 0);
  rows.forEach((entry) => {
    if (!isValidPaise(entry.amountPaise)) {
      throw new TypeError(`[LedgerService] invalid amount ${entry.amountPaise} for ${entry.type}`);
    }
  });
  if (!rows.length) return [];
  return Ledger.create(rows, { session, ordered: true });
};

/**
 * What SaathMein still holds for one payment, from its ledger entries (paise).
 * held = token − refunds − fees kept − transfers − commission + reversals
 * @param {Object[]} entries - Ledger entries of one payment
 * @returns {number}
 */
const heldBalance = (entries) =>
  entries.reduce((total, entry) => {
    switch (entry.type) {
      case LEDGER_TYPE.TOKEN_HELD:
      case LEDGER_TYPE.TRANSFER_REVERSAL:
      case LEDGER_TYPE.COMMISSION_REVERSAL:
        return total + entry.amountPaise;
      case LEDGER_TYPE.REFUND:
      case LEDGER_TYPE.FEE:
      case LEDGER_TYPE.TRANSFER:
      case LEDGER_TYPE.COMMISSION:
        return total - entry.amountPaise;
      default:
        return total; // hold_release moves nothing: the money already went with the transfer
    }
  }, 0);

/**
 * Ledger entries of one payment, oldest first.
 * @param {string} paymentId - Payment id
 * @returns {Promise<Object[]>}
 */
const entriesForPayment = (paymentId) => Ledger.find({ paymentId }).sort({ createdAt: 1 }).lean();

module.exports = { recordLedger, heldBalance, entriesForPayment };
