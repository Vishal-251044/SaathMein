/**
 * Purchases (PRD §10.6, PUR-1 to PUR-4): the last step of a won group.
 * - The dealer scans or types a member's deal code and confirms the sale → completed.
 * - Or the buyer uploads the invoice → completed after 48 h unless the dealer objects
 *   (decided 9 Nov 2026; the AI invoice check is added in front of this on Day 19).
 * - Completion: member marked purchased, commission recorded, the Route hold on that
 *   member's token released to the dealer (PAY-4), buyer asked for a review and shown a
 *   "You saved ₹X" card. When no purchase is open any more the group is completed.
 * - Price validity ends unused → expired: the hold is reversed and the token refunded
 *   minus the back-out fee (decided 9 Nov 2026), with a reminder 48 h before.
 * Money steps are idempotent and retried by the minute sweep.
 */
const Group = require('../../models/group.model');
const GroupMember = require('../../models/groupMember.model');
const Payment = require('../../models/payment.model');
const Purchase = require('../../models/purchase.model');
const Category = require('../../models/category.model');
const Product = require('../../models/product.model');
const ApiError = require('../../utils/ApiError');
const { createLogger } = require('../../utils/logger');
const { withTransaction } = require('../../utils/transaction');
const { formatINR } = require('../../utils/money');
const {
  getPagination,
  buildPaginationMeta,
  firstNameOnly,
} = require('../../helpers/genericFunctions');
const { getPurchaseSettings } = require('../settings.service');
const { transition } = require('../groups/stateMachine');
const { notifyAboutGroup } = require('../groups/groupLive');
const {
  createHeldTransfer,
  releaseHold,
  reverseHeldTransfer,
} = require('../payments/route.service');
const { queueRefund, REFUND_REASON } = require('../payments/refund.service');
const { recordCommission } = require('../payments/commission.service');
const uploadService = require('../upload.service');
const { phoneForDealer } = require('../trust/privacy');
const { notifyDealer } = require('../auction/winner.service');
const { OPEN_PURCHASE, qrPayloadFor, parseDealCodeInput } = require('../auction/dealCode.service');
const {
  GROUP_STATUS,
  MEMBER_STATUS,
  NOTIFICATION_TYPE,
  PAYMENT_STATUS,
  PURCHASE_STATUS: P,
} = require('../../constants/enums');

const log = createLogger('PurchaseService');
const HOUR_MS = 60 * 60 * 1000;
const BATCH = 50;
const LIVE_TRANSFER = ['pending', 'processed'];
const PRODUCT_FIELDS = 'brand model variants images';

/* -------------------------------- Presenters -------------------------------- */

/** Market price the group started from (for "you saved"). */
const marketPriceOf = (group) => group?.auction?.ceilingPricePaise ?? group?.basePricePaise ?? null;

/**
 * Buyer view of a purchase (deal-code ticket, invoice, review, saved card).
 * @param {Object} purchase - Lean purchase
 * @param {Object} [group] - Lean group (for the saving)
 */
const toBuyerPurchase = (purchase, group) => {
  const market = marketPriceOf(group);
  return {
    id: String(purchase._id),
    groupId: String(purchase.groupId),
    status: purchase.status,
    dealCode: purchase.dealCode,
    // Only open codes carry a scannable QR
    qrPayload: OPEN_PURCHASE.includes(purchase.status) ? qrPayloadFor(purchase.dealCode) : null,
    pricePaise: purchase.pricePaise,
    tokenPaise: purchase.tokenPaise,
    // Token is part-payment of the bill (decided 8 Nov 2026)
    payAtShopPaise: Math.max(0, purchase.pricePaise - purchase.tokenPaise),
    savedPaise: market ? Math.max(0, market - purchase.pricePaise) : null,
    validUntil: purchase.validUntil,
    invoiceUploadedAt: purchase.invoice?.uploadedAt || null,
    autoCompleteAt: purchase.status === P.INVOICE_UPLOADED ? purchase.autoCompleteAt : null,
    completedAt: purchase.completedAt || null,
    canReview: purchase.status === P.COMPLETED && !purchase.reviewedAt,
    reviewedAt: purchase.reviewedAt || null,
  };
};

/**
 * Dealer view (Purchases page, scan result).
 * @param {Object} purchase - Lean purchase with groupId (product populated) and userId (name)
 */
const toSellerPurchase = (purchase) => {
  const group = purchase.groupId?._id ? purchase.groupId : null;
  const product = group?.productId?._id ? group.productId : null;
  const variant = product?.variants?.find((item) => item.key === group?.variantKey);
  return {
    id: String(purchase._id),
    groupId: String(group?._id || purchase.groupId),
    status: purchase.status,
    dealCode: purchase.dealCode,
    buyerFirstName: firstNameOnly(purchase.userId?.name) || null,
    // Masked until the exit window ends (privacy, decided 12 Nov 2026)
    ...phoneForDealer(purchase.userId?.phone, group?.exitWindowEndsAt),
    productName: product ? `${product.brand} ${product.model}` : null,
    variantName: variant?.name || null,
    pricePaise: purchase.pricePaise,
    tokenPaise: purchase.tokenPaise,
    payAtShopPaise: Math.max(0, purchase.pricePaise - purchase.tokenPaise),
    validUntil: purchase.validUntil,
    hasInvoice: Boolean(purchase.invoice?.publicId),
    autoCompleteAt: purchase.status === P.INVOICE_UPLOADED ? purchase.autoCompleteAt : null,
    objection: purchase.objection?.at
      ? { reason: purchase.objection.reason, at: purchase.objection.at }
      : null,
    completedAt: purchase.completedAt || null,
    completedVia: purchase.completedVia || null,
  };
};

/** Populate what the dealer view needs. */
const populateForSeller = (query) =>
  query
    .populate({
      path: 'groupId',
      select: 'productId variantKey exitWindowEndsAt',
      populate: { path: 'productId', select: PRODUCT_FIELDS },
    })
    .populate('userId', 'name phone');

/* ------------------------------- Buyer reads -------------------------------- */

/**
 * The viewer's purchase in a group (group page), or null.
 * @param {Object} group - Lean group
 * @param {string} userId
 */
const getMyPurchase = async (group, userId) => {
  if (!userId) return null;
  const purchase = await Purchase.findOne({ groupId: group._id, userId }).lean();
  return purchase ? toBuyerPurchase(purchase, group) : null;
};

/**
 * My deal codes (GET /me/deal-codes): open and recently completed purchases.
 * @param {string} userId
 */
const listMyDealCodes = async (userId) => {
  const purchases = await Purchase.find({
    userId,
    status: { $in: [...OPEN_PURCHASE, P.COMPLETED] },
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  const groups = await Group.find({ _id: { $in: purchases.map((p) => p.groupId) } })
    .select('auction.ceilingPricePaise basePricePaise')
    .lean();
  const byId = new Map(groups.map((group) => [String(group._id), group]));
  return purchases.map((purchase) => toBuyerPurchase(purchase, byId.get(String(purchase.groupId))));
};

/* ---------------------------- Group progression ----------------------------- */

/**
 * Move the group along: first sale → purchasing; no open purchase left → completed.
 * Never throws (called after money steps).
 * @param {string} groupId
 */
const advanceGroup = async (groupId) => {
  try {
    let group = await Group.findById(groupId);
    if (!group || ![GROUP_STATUS.WON, GROUP_STATUS.PURCHASING].includes(group.status)) return;
    const [open, completed] = await Promise.all([
      Purchase.countDocuments({ groupId, status: { $in: OPEN_PURCHASE } }),
      Purchase.countDocuments({ groupId, status: P.COMPLETED }),
    ]);
    if (group.status === GROUP_STATUS.WON && (completed > 0 || open === 0)) {
      group = await transition(group, GROUP_STATUS.PURCHASING, { reason: 'first_purchase' });
    }
    if (open === 0 && group.status === GROUP_STATUS.PURCHASING) {
      await transition(group, GROUP_STATUS.COMPLETED, { reason: 'all_purchases_closed' });
      // Leader bonus (REF-2); loaded here to keep the wallet out of the purchase import cycle
      const { onGroupCompleted } = require('../wallet/referral.service');
      await onGroupCompleted(groupId);
    }
  } catch (err) {
    if (err.code !== 'GROUP_CHANGED') {
      log.error(
        { err: err.message, groupId: String(groupId) },
        '[PurchaseService] advance group failed',
      );
    }
  }
};

/* --------------------------------- Money ------------------------------------ */

/**
 * Release the dealer's hold for a completed purchase; creates the held transfer first when
 * the win-time transfer failed. Marks `holdReleasedAt`. Throws on failure (sweep retries).
 * @param {Object} purchase - Completed purchase (lean)
 */
const releaseForPurchase = async (purchase) => {
  const payment = purchase.paymentId ? await Payment.findById(purchase.paymentId).lean() : null;
  if (!payment) {
    await Purchase.updateOne({ _id: purchase._id }, { $set: { holdReleasedAt: new Date() } });
    return;
  }
  if (payment.status === PAYMENT_STATUS.PAID && !LIVE_TRANSFER.includes(payment.transfer?.status)) {
    const group = await Group.findById(purchase.groupId).select('categoryId').lean();
    const category = await Category.findById(group?.categoryId).select('commission').lean();
    await createHeldTransfer(payment._id, {
      sellerId: purchase.sellerId,
      pricePerUnitPaise: purchase.pricePaise,
      commissionRule: category?.commission,
    });
  }
  await releaseHold(payment._id);
  await Purchase.updateOne({ _id: purchase._id }, { $set: { holdReleasedAt: new Date() } });
};

/**
 * Complete a purchase (dealer confirmed, or invoice stood 48 h). Idempotent.
 * @param {string} purchaseId
 * @param {{ via: 'seller'|'invoice', by?: string, now?: Date }} options
 * @returns {Promise<{ outcome: 'completed'|'already' }>}
 */
const completePurchase = async (purchaseId, { via, by, now = new Date() }) => {
  const purchase = await Purchase.findById(purchaseId).lean();
  if (!purchase) throw ApiError.notFound('Purchase not found');
  if (purchase.status === P.COMPLETED) return { outcome: 'already' };

  const [group, payment] = await Promise.all([
    Group.findById(purchase.groupId).lean(),
    purchase.paymentId ? Payment.findById(purchase.paymentId).lean() : null,
  ]);
  const [category, product] = await Promise.all([
    Category.findById(group?.categoryId).select('commission').lean(),
    Product.findById(group?.productId).select('brand model').lean(),
  ]);
  const productName = product ? `${product.brand} ${product.model}` : 'Group purchase';

  const done = await withTransaction(async (session) => {
    const updated = await Purchase.findOneAndUpdate(
      { _id: purchaseId, status: { $in: OPEN_PURCHASE } },
      {
        $set: {
          status: P.COMPLETED,
          completedAt: now,
          completedVia: via,
          ...(by ? { confirmedBy: by } : {}),
        },
      },
      { new: true, session },
    ).lean();
    if (!updated) return null;
    await GroupMember.updateOne(
      { _id: purchase.memberId, status: MEMBER_STATUS.ACTIVE },
      { $set: { status: MEMBER_STATUS.PURCHASED } },
      { session },
    );
    // Commission is earned at completion (F17)
    await recordCommission(updated, { group, category, payment, productName }, session);
    return updated;
  });
  if (!done) {
    throw ApiError.conflict('This deal code can no longer be used', { code: 'PURCHASE_CLOSED' });
  }

  try {
    await releaseForPurchase(done);
  } catch (err) {
    log.warn(
      { err: err.message, purchaseId: String(purchaseId) },
      'Hold release failed (will retry)',
    );
  }
  await advanceGroup(purchase.groupId);
  const market = marketPriceOf(group);
  await notifyAboutGroup(purchase.userId, group, NOTIFICATION_TYPE.PURCHASE_COMPLETED, {
    saved: formatINR(market ? Math.max(0, market - purchase.pricePaise) : 0),
  });
  // Referral credits on the buyer's first completed purchase (REF-1)
  const { onPurchaseCompleted } = require('../wallet/referral.service');
  await onPurchaseCompleted(done);
  log.info({ purchaseId: String(purchaseId), via }, 'Purchase completed');
  return { outcome: 'completed' };
};

/* ------------------------------- Dealer actions ------------------------------ */

/**
 * Find the purchase for a scanned / typed code at this dealer.
 * @param {string} sellerId
 * @param {string} input - QR payload or code
 * @returns {Promise<Object>} Lean purchase (populated for the dealer view)
 * @throws {ApiError} 400 bad QR, 404 not this dealer's code
 */
const findForSeller = async (sellerId, input) => {
  const { code, scanned } = parseDealCodeInput(input);
  if (!code) {
    throw ApiError.badRequest(
      scanned
        ? 'This QR code is not a valid SaathMein deal code'
        : 'Enter the 10-character deal code',
      { code: 'INVALID_DEAL_CODE' },
    );
  }
  const purchase = await populateForSeller(Purchase.findOne({ dealCode: code, sellerId })).lean();
  // Same answer for "no such code" and "another dealer's code": nothing to guess
  if (!purchase) throw ApiError.notFound('No purchase with this deal code for your business');
  return purchase;
};

/**
 * Scan / type a code to see the buyer and price before confirming.
 * @param {string} sellerId
 * @param {string} input
 */
const lookupPurchase = async (sellerId, input) =>
  toSellerPurchase(await findForSeller(sellerId, input));

/**
 * Dealer confirms the sale (PUR-2).
 * @param {{ sellerId: string, userId: string }} dealer
 * @param {string} input - QR payload or code
 * @param {Date} [now]
 */
const confirmPurchase = async ({ sellerId, userId }, input, now = new Date()) => {
  const purchase = await findForSeller(sellerId, input);
  if (purchase.status === P.COMPLETED) {
    throw ApiError.conflict('This purchase is already confirmed', { code: 'ALREADY_PURCHASED' });
  }
  if (!OPEN_PURCHASE.includes(purchase.status)) {
    throw ApiError.conflict('This deal code is no longer valid', { code: 'PURCHASE_CLOSED' });
  }
  if (purchase.status === P.PENDING && new Date(purchase.validUntil) <= now) {
    throw ApiError.conflict('This deal code expired with the price validity', {
      code: 'DEAL_CODE_EXPIRED',
    });
  }
  await completePurchase(purchase._id, { via: 'seller', by: userId, now });
  return toSellerPurchase(await populateForSeller(Purchase.findById(purchase._id)).lean());
};

/**
 * Dealer objects to an uploaded invoice within the window (goes to disputes, Day 12).
 * @param {{ sellerId: string, userId: string }} dealer
 * @param {string} purchaseId
 * @param {string} reason
 */
const objectToInvoice = async ({ sellerId, userId }, purchaseId, reason, now = new Date()) => {
  const updated = await Purchase.findOneAndUpdate(
    { _id: purchaseId, sellerId, status: P.INVOICE_UPLOADED, autoCompleteAt: { $gt: now } },
    {
      $set: { status: P.OBJECTED, objection: { reason, by: userId, at: now } },
      $unset: { autoCompleteAt: 1 },
    },
    { new: true },
  ).lean();
  if (!updated) {
    throw ApiError.conflict('This invoice can no longer be objected to', { code: 'CANNOT_OBJECT' });
  }
  log.warn({ purchaseId: String(purchaseId), sellerId }, 'Dealer objected to invoice');
  // Goes to the Disputes queue for Support (TRU-4); loaded here to avoid an import cycle
  const { openFromInvoiceObjection } = require('../trust/dispute.service');
  await openFromInvoiceObjection(updated, { reason, userId }, now);
  return toSellerPurchase(await populateForSeller(Purchase.findById(purchaseId)).lean());
};

/**
 * Dealer's purchases list.
 * @param {string} sellerId
 * @param {{ status?: string, page?: string, limit?: string }} query
 */
const listSellerPurchases = async (sellerId, { status, ...query }) => {
  const pagination = getPagination(query);
  const filter = {
    sellerId,
    ...(status === 'open' ? { status: { $in: OPEN_PURCHASE } } : status ? { status } : {}),
  };
  const [rows, total] = await Promise.all([
    populateForSeller(
      Purchase.find(filter).sort({ updatedAt: -1 }).skip(pagination.skip).limit(pagination.limit),
    ).lean(),
    Purchase.countDocuments(filter),
  ]);
  return { purchases: rows.map(toSellerPurchase), meta: buildPaginationMeta(total, pagination) };
};

/**
 * Short-lived link to the buyer's invoice for the dealer.
 * @param {string} sellerId
 * @param {string} purchaseId
 */
const sellerInvoiceUrl = async (sellerId, purchaseId) => {
  const purchase = await Purchase.findOne({ _id: purchaseId, sellerId }).select('invoice').lean();
  if (!purchase?.invoice?.publicId) throw ApiError.notFound('No invoice for this purchase');
  return uploadService.privateFileUrl(purchase.invoice);
};

/* ------------------------------- Buyer actions ------------------------------- */

/** Buyer's own open purchase or 404 / 409. */
const ownOpenPurchase = async (userId, purchaseId, now) => {
  const purchase = await Purchase.findOne({ _id: purchaseId, userId }).lean();
  if (!purchase) throw ApiError.notFound('Purchase not found');
  if (purchase.status !== P.PENDING) {
    throw ApiError.conflict('An invoice can be added only before the purchase is completed', {
      code: 'PURCHASE_CLOSED',
    });
  }
  if (new Date(purchase.validUntil) <= now) {
    throw ApiError.conflict('This deal code expired with the price validity', {
      code: 'DEAL_CODE_EXPIRED',
    });
  }
  return purchase;
};

/**
 * Signed private upload for the invoice photo / PDF.
 * @param {string} userId
 * @param {string} purchaseId
 */
const getInvoiceUploadParams = async (userId, purchaseId, now = new Date()) => {
  await ownOpenPurchase(userId, purchaseId, now);
  return uploadService.createInvoiceUploadParams(purchaseId);
};

/**
 * Buyer adds the invoice (PUR-2): completes in 48 h unless the dealer objects (PUR-3).
 * @param {string} userId
 * @param {string} purchaseId
 * @param {{ publicId: string, version: number, signature: string, format?: string }} upload
 */
const submitInvoice = async (userId, purchaseId, upload, now = new Date()) => {
  const purchase = await ownOpenPurchase(userId, purchaseId, now);
  uploadService.verifyInvoiceUpload(purchaseId, upload);
  const settings = await getPurchaseSettings();
  const autoCompleteAt = new Date(now.getTime() + settings.invoiceObjectionHours * HOUR_MS);
  const updated = await Purchase.findOneAndUpdate(
    { _id: purchaseId, status: P.PENDING },
    {
      $set: {
        status: P.INVOICE_UPLOADED,
        invoice: {
          publicId: upload.publicId,
          version: upload.version,
          format: upload.format,
          uploadedAt: now,
        },
        autoCompleteAt,
      },
    },
    { new: true },
  ).lean();
  if (!updated)
    throw ApiError.conflict('This purchase changed a moment ago', { code: 'PURCHASE_CLOSED' });

  const group = await Group.findById(purchase.groupId).lean();
  const product = await Product.findById(group?.productId).select('brand model').lean();
  await notifyDealer(purchase.sellerId, NOTIFICATION_TYPE.DEALER_INVOICE_UPLOADED, {
    productName: product ? `${product.brand} ${product.model}` : 'SaathMein group',
    hours: settings.invoiceObjectionHours,
    url: '/purchases',
  });
  return toBuyerPurchase(updated, group);
};

/**
 * Member left in the exit window: their open purchase is cancelled.
 * @param {string} memberId
 */
const cancelMemberPurchase = async (memberId) => {
  const purchase = await Purchase.findOneAndUpdate(
    { memberId, status: { $in: OPEN_PURCHASE } },
    { $set: { status: P.CANCELLED } },
    { new: true },
  ).lean();
  if (purchase) await advanceGroup(purchase.groupId);
};

/* ---------------------------------- Sweep ------------------------------------ */

/** Reminder 48 h before the price validity ends. */
const sendExpiryReminders = async (now, settings) => {
  const due = await Purchase.find({
    status: P.PENDING,
    reminderSentAt: { $exists: false },
    validUntil: {
      $gt: now,
      $lte: new Date(now.getTime() + settings.expiryReminderHours * HOUR_MS),
    },
  })
    .limit(BATCH)
    .lean();
  let sent = 0;
  for (const purchase of due) {
    const claimed = await Purchase.updateOne(
      { _id: purchase._id, reminderSentAt: { $exists: false } },
      { $set: { reminderSentAt: now } },
    );
    if (!claimed.modifiedCount) continue;
    await notifyAboutGroup(
      purchase.userId,
      purchase.groupId,
      NOTIFICATION_TYPE.DEAL_CODE_EXPIRING,
      {
        date: new Date(purchase.validUntil).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
        }),
      },
    );
    sent += 1;
  }
  return sent;
};

/**
 * Money for one expired purchase: take the hold back, refund the token minus the
 * back-out fee, mark the member refunded. Throws on failure (retried).
 * @param {Object} purchase - Expired purchase (lean)
 */
const settleExpiredPurchase = async (purchase) => {
  const payment = purchase.paymentId ? await Payment.findById(purchase.paymentId).lean() : null;
  if (payment) {
    if (
      payment.status === PAYMENT_STATUS.TRANSFERRED &&
      LIVE_TRANSFER.includes(payment.transfer?.status)
    ) {
      await reverseHeldTransfer(payment._id, 'price_validity_expired');
    }
    const group = await Group.findById(purchase.groupId).select('backoutFeePaise').lean();
    const feePaise = Math.min(group?.backoutFeePaise ?? 0, payment.amountPaise);
    await queueRefund(payment._id, {
      reason: REFUND_REASON.PRICE_VALIDITY_EXPIRED,
      amountPaise: payment.amountPaise - feePaise,
      feePaise,
    });
  }
  await GroupMember.updateOne(
    { _id: purchase.memberId, status: MEMBER_STATUS.ACTIVE },
    { $set: { status: MEMBER_STATUS.REFUNDED, leftAt: new Date() } },
  );
  await Purchase.updateOne({ _id: purchase._id }, { $set: { refundQueuedAt: new Date() } });
  await notifyAboutGroup(
    purchase.userId,
    purchase.groupId,
    NOTIFICATION_TYPE.DEAL_CODE_EXPIRED,
    {},
  );
};

/**
 * Minute sweep: reminders, expiries (+ their refunds), invoice auto-completion and hold
 * releases that failed earlier.
 * @param {Date} [now]
 * @returns {Promise<Object>} Counts
 */
const processPurchaseTimers = async (now = new Date()) => {
  const settings = await getPurchaseSettings();
  const counts = { reminders: 0, expired: 0, refunds: 0, autoCompleted: 0, released: 0 };
  counts.reminders = await sendExpiryReminders(now, settings);
  // Purchases with an open dispute wait for Support: no expiry, no auto-completion
  const { purchasesUnderDispute } = require('../trust/dispute.service');
  const disputed = await purchasesUnderDispute();

  // 1. Price validity over without a purchase → expired (claim first, then money)
  const ending = await Purchase.find({
    status: P.PENDING,
    validUntil: { $lte: now },
    _id: { $nin: disputed },
  })
    .limit(BATCH)
    .lean();
  for (const purchase of ending) {
    const claimed = await Purchase.updateOne(
      { _id: purchase._id, status: P.PENDING },
      { $set: { status: P.EXPIRED } },
    );
    if (claimed.modifiedCount) counts.expired += 1;
  }

  // 2. Expired purchases whose money step has not happened yet
  const unsettled = await Purchase.find({ status: P.EXPIRED, refundQueuedAt: { $exists: false } })
    .limit(BATCH)
    .lean();
  for (const purchase of unsettled) {
    try {
      await settleExpiredPurchase(purchase);
      counts.refunds += 1;
      await advanceGroup(purchase.groupId);
    } catch (err) {
      log.error(
        { err: err.message, purchaseId: String(purchase._id) },
        '[PurchaseService] expiry refund failed (will retry)',
      );
    }
  }

  // 3. Invoice stood 48 h without objection → completed (PUR-3)
  const invoices = await Purchase.find({
    status: P.INVOICE_UPLOADED,
    autoCompleteAt: { $lte: now },
    _id: { $nin: disputed },
  })
    .limit(BATCH)
    .lean();
  for (const purchase of invoices) {
    try {
      await completePurchase(purchase._id, { via: 'invoice', now });
      counts.autoCompleted += 1;
    } catch (err) {
      if (err.code !== 'PURCHASE_CLOSED') {
        log.error(
          { err: err.message, purchaseId: String(purchase._id) },
          '[PurchaseService] auto-complete failed',
        );
      }
    }
  }

  // 4. Completed purchases whose hold is not released yet
  const unreleased = await Purchase.find({
    status: P.COMPLETED,
    holdReleasedAt: { $exists: false },
  })
    .limit(BATCH)
    .lean();
  for (const purchase of unreleased) {
    try {
      await releaseForPurchase(purchase);
      counts.released += 1;
    } catch (err) {
      log.warn({ err: err.message, purchaseId: String(purchase._id) }, 'Hold release retry failed');
    }
  }
  return counts;
};

module.exports = {
  toBuyerPurchase,
  toSellerPurchase,
  getMyPurchase,
  listMyDealCodes,
  advanceGroup,
  releaseForPurchase,
  completePurchase,
  lookupPurchase,
  confirmPurchase,
  objectToInvoice,
  listSellerPurchases,
  sellerInvoiceUrl,
  getInvoiceUploadParams,
  submitInvoice,
  cancelMemberPurchase,
  processPurchaseTimers,
};
