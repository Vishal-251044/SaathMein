/**
 * Dealer Payouts page (PRD §10.10): Route transfers of buyers' tokens to the dealer
 * (on hold / released / taken back), Razorpay settlements to the bank, and commission
 * invoices. Read-only; amounts in paise.
 */
const mongoose = require('mongoose');
const Payment = require('../../models/payment.model');
const Settlement = require('../../models/settlement.model');
const { getPagination, buildPaginationMeta } = require('../../helpers/genericFunctions');
const { listInvoices } = require('../payments/commission.service');

/** Transfer state shown to the dealer. */
const payoutState = (transfer) => {
  if (transfer.status === 'released') return 'released';
  if (transfer.status === 'reversed') return 'reversed';
  if (transfer.status === 'failed') return 'failed';
  return 'on_hold';
};

/**
 * Totals by transfer state for one dealer.
 * @param {string} sellerId
 * @returns {Promise<{ onHoldPaise: number, releasedPaise: number, reversedPaise: number, commissionPaise: number }>}
 */
const payoutTotals = async (sellerId) => {
  const rows = await Payment.aggregate([
    { $match: { 'transfer.sellerId': new mongoose.Types.ObjectId(String(sellerId)) } },
    {
      $group: {
        _id: '$transfer.status',
        amountPaise: { $sum: '$transfer.amountPaise' },
        commissionPaise: { $sum: '$transfer.commissionPaise' },
      },
    },
  ]);
  const sum = (statuses, field = 'amountPaise') =>
    rows
      .filter((row) => statuses.includes(row._id))
      .reduce((total, row) => total + (row[field] || 0), 0);
  return {
    onHoldPaise: sum(['pending', 'processed']),
    releasedPaise: sum(['released']),
    reversedPaise: sum(['reversed']),
    // Kept from tokens on transfers that stood (held or released)
    commissionPaise: sum(['pending', 'processed', 'released'], 'commissionPaise'),
  };
};

/**
 * Payouts page data.
 * @param {string} sellerId
 * @param {{ page?: string, limit?: string }} query - Pages the transfers list
 */
const getPayouts = async (sellerId, query) => {
  const pagination = getPagination(query);
  const filter = { 'transfer.sellerId': sellerId };
  const [totals, payments, total, settlements, invoices] = await Promise.all([
    payoutTotals(sellerId),
    Payment.find(filter)
      .sort({ updatedAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .populate({
        path: 'groupId',
        select: 'productId',
        populate: { path: 'productId', select: 'brand model' },
      })
      .lean(),
    Payment.countDocuments(filter),
    Settlement.find({ sellerId }).sort({ settledAt: -1 }).limit(20).lean(),
    listInvoices({ sellerId, limit: '24' }),
  ]);
  return {
    totals,
    transfers: payments.map((payment) => ({
      id: String(payment._id),
      groupId: String(payment.groupId?._id || payment.groupId),
      productName: payment.groupId?.productId
        ? `${payment.groupId.productId.brand} ${payment.groupId.productId.model}`
        : null,
      tokenPaise: payment.amountPaise,
      amountPaise: payment.transfer.amountPaise,
      commissionPaise: payment.transfer.commissionPaise || 0,
      state: payoutState(payment.transfer),
      releasedAt: payment.transfer.releasedAt || null,
      updatedAt: payment.updatedAt,
    })),
    settlements: settlements.map((settlement) => ({
      id: String(settlement._id),
      amountPaise: settlement.amountPaise,
      utr: settlement.utr || null,
      status: settlement.status || null,
      settledAt: settlement.settledAt || null,
    })),
    invoices: invoices.invoices,
    meta: buildPaginationMeta(total, pagination),
  };
};

module.exports = { payoutState, payoutTotals, getPayouts };
