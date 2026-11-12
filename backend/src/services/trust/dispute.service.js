/**
 * Disputes (TRU-4, PAY-6): a buyer opens one with evidence (private photos / invoice and
 * chat messages); the dealer answers within 48 h (else escalated); Support decides:
 * - refund: token still with SaathMein or on hold at the dealer → hold reversed, full
 *   token refunded to the bank, deal code cancelled (PAY-6 "dealer failed to honour");
 * - credit: token already released to the dealer → SaathMein wallet credits (up to the
 *   token) to the buyer, recorded as owed by the dealer on the next commission invoice
 *   (decided 12 Nov 2026);
 * - no refund; and in every case optional penalties (warning, rating penalty, suspension).
 * Every step is appended to the timeline; staff decisions are also audited.
 */
const Dispute = require('../../models/dispute.model');
const Group = require('../../models/group.model');
const GroupMember = require('../../models/groupMember.model');
const Message = require('../../models/message.model');
const Payment = require('../../models/payment.model');
const Product = require('../../models/product.model');
const Purchase = require('../../models/purchase.model');
const SellerDue = require('../../models/sellerDue.model');
const User = require('../../models/user.model');
const ApiError = require('../../utils/ApiError');
const { createLogger } = require('../../utils/logger');
const { formatINR } = require('../../utils/money');
const {
  firstNameOnly,
  getPagination,
  buildPaginationMeta,
} = require('../../helpers/genericFunctions');
const { getDisputeSettings } = require('../settings.service');
const uploadService = require('../upload.service');
const { notifyUsers } = require('../notifications/notification.service');
const { reverseHeldTransfer } = require('../payments/route.service');
const { queueRefund, REFUND_REASON } = require('../payments/refund.service');
const { creditWallet } = require('../wallet/wallet.service');
const { applyPenalties } = require('./penalty.service');
const {
  DISPUTE_OUTCOME,
  DISPUTE_STATUS: S,
  DISPUTE_TYPE,
  MEMBER_STATUS,
  NOTIFICATION_TYPE,
  PAYMENT_STATUS,
  PURCHASE_STATUS,
  WALLET_TXN_TYPE,
} = require('../../constants/enums');

const log = createLogger('DisputeService');
const HOUR_MS = 60 * 60 * 1000;
const OPEN = [S.AWAITING_SELLER, S.SELLER_RESPONDED, S.SELLER_MISSED];
const DISPUTABLE = [
  PURCHASE_STATUS.PENDING,
  PURCHASE_STATUS.INVOICE_UPLOADED,
  PURCHASE_STATUS.OBJECTED,
  PURCHASE_STATUS.COMPLETED,
];
const LIVE_TRANSFER = ['pending', 'processed'];

/** Owner keys for private evidence folders. */
const buyerKey = (userId) => `u_${userId}`;
const sellerKey = (sellerId) => `s_${sellerId}`;

/**
 * Where the buyer's token is now (decides refund vs credit).
 * @param {Object|null} payment
 * @returns {'with_saathmein'|'on_hold'|'released'|'refunded'|'none'}
 */
const tokenState = (payment) => {
  if (!payment) return 'none';
  if (payment.status === PAYMENT_STATUS.PAID) return 'with_saathmein';
  if (payment.status === PAYMENT_STATUS.TRANSFERRED) {
    if (payment.transfer?.status === 'released') return 'released';
    if (LIVE_TRANSFER.includes(payment.transfer?.status)) return 'on_hold';
  }
  return 'refunded';
};

/** Product name for texts. */
const productNameOf = async (groupId) => {
  const group = await Group.findById(groupId).select('productId').lean();
  const product = group
    ? await Product.findById(group.productId).select('brand model').lean()
    : null;
  return product ? `${product.brand} ${product.model}` : 'your group';
};

/* -------------------------------- Presenters -------------------------------- */

/**
 * Evidence with short-lived signed links (staff and the two parties only).
 * @param {Object[]} evidence
 */
const evidenceView = (evidence = []) =>
  evidence.map((item) => ({
    addedBy: item.addedBy,
    addedAt: item.addedAt,
    format: item.format || null,
    url: uploadService.privateFileUrl(item),
  }));

/** Shared view; `audience` hides staff-only notes from buyers and dealers. */
const toDisputeView = (dispute, { audience, extra = {} }) => ({
  id: String(dispute._id),
  groupId: String(dispute.groupId),
  purchaseId: String(dispute.purchaseId),
  type: dispute.type,
  status: dispute.status,
  description: dispute.description,
  quotedPricePaise: dispute.quotedPricePaise ?? null,
  evidence: evidenceView(dispute.evidence),
  sellerDueAt: dispute.sellerDueAt || null,
  sellerResponse: dispute.sellerResponse?.at
    ? { text: dispute.sellerResponse.text, at: dispute.sellerResponse.at }
    : null,
  decision: dispute.decision?.at
    ? {
        outcome: dispute.decision.outcome,
        refundPaise: dispute.decision.refundPaise ?? null,
        creditPaise: dispute.decision.creditPaise ?? null,
        // Penalties are shown to the dealer and staff, not the buyer
        penalties: audience === 'buyer' ? [] : dispute.decision.penalties || [],
        note: dispute.decision.note,
        at: dispute.decision.at,
      }
    : null,
  timeline: (dispute.timeline || []).map((entry) => ({
    at: entry.at,
    actorType: entry.actorType,
    action: entry.action,
    note:
      audience === 'buyer' && entry.actorType === 'staff' && entry.action !== 'decided'
        ? null
        : entry.note || null,
  })),
  createdAt: dispute.createdAt,
  ...extra,
});

/* ---------------------------------- Buyer ----------------------------------- */

/** @param {string} userId @returns Signed upload for one evidence file */
const buyerEvidenceUploadParams = (userId) =>
  uploadService.createDisputeEvidenceUploadParams(buyerKey(userId));

/**
 * Open a dispute about my purchase.
 * @param {string} userId - Buyer
 * @param {{ purchaseId: string, type: string, description: string, quotedPricePaise?: number,
 *   evidence?: Object[], chatMessageIds?: string[] }} input
 * @param {Date} [now]
 * @returns {Promise<Object>} Buyer view
 * @throws {ApiError} 404 not mine, 409 not disputable / already open, 422 evidence
 */
const openDispute = async (userId, input, now = new Date()) => {
  const purchase = await Purchase.findOne({ _id: input.purchaseId, userId }).lean();
  if (!purchase) throw ApiError.notFound('Purchase not found');
  if (!DISPUTABLE.includes(purchase.status)) {
    throw ApiError.conflict('This purchase can no longer be disputed', { code: 'NOT_DISPUTABLE' });
  }
  if (await Dispute.exists({ purchaseId: purchase._id, status: { $in: OPEN } })) {
    throw ApiError.conflict('You already have an open dispute for this purchase', {
      code: 'DISPUTE_ALREADY_OPEN',
    });
  }
  const settings = await getDisputeSettings();
  const evidence = input.evidence || [];
  if (evidence.length > settings.maxEvidenceFiles) {
    throw new ApiError(422, `Add at most ${settings.maxEvidenceFiles} files`, {
      code: 'TOO_MANY_FILES',
    });
  }
  evidence.forEach((file) => uploadService.verifyDisputeEvidence(buyerKey(userId), file));
  const chatMessageIds = input.chatMessageIds?.length
    ? (
        await Message.find({ _id: { $in: input.chatMessageIds }, groupId: purchase.groupId })
          .select('_id')
          .lean()
      ).map((message) => message._id)
    : [];

  const dispute = await Dispute.create({
    groupId: purchase.groupId,
    purchaseId: purchase._id,
    buyerId: userId,
    sellerId: purchase.sellerId,
    type: input.type,
    description: input.description,
    quotedPricePaise: input.quotedPricePaise,
    evidence: evidence.map((file) => ({
      publicId: file.publicId,
      version: file.version,
      format: file.format,
      addedBy: 'buyer',
    })),
    chatMessageIds,
    sellerDueAt: new Date(now.getTime() + settings.sellerResponseHours * HOUR_MS),
    timeline: [
      { at: now, actorType: 'buyer', actorId: userId, action: 'opened', note: input.type },
    ],
  });
  const { notifyDealer } = require('../auction/winner.service');
  await notifyDealer(purchase.sellerId, NOTIFICATION_TYPE.DEALER_DISPUTE_OPENED, {
    productName: await productNameOf(purchase.groupId),
    hours: settings.sellerResponseHours,
    url: '/disputes',
  });
  log.info({ disputeId: String(dispute._id), purchaseId: String(purchase._id) }, 'Dispute opened');
  return toDisputeView(dispute.toObject(), { audience: 'buyer' });
};

/**
 * The dealer objected to a buyer's invoice (Day 10): open a dispute for Support with the
 * dealer's reason as their answer.
 * @param {Object} purchase - Purchase (lean)
 * @param {{ reason: string, userId: string }} objection
 */
const openFromInvoiceObjection = async (purchase, { reason, userId }, now = new Date()) => {
  if (await Dispute.exists({ purchaseId: purchase._id, status: { $in: OPEN } })) return null;
  return Dispute.create({
    groupId: purchase.groupId,
    purchaseId: purchase._id,
    buyerId: purchase.userId,
    sellerId: purchase.sellerId,
    type: DISPUTE_TYPE.INVOICE_OBJECTION,
    description: 'The dealer objected to the invoice the buyer uploaded.',
    evidence: purchase.invoice?.publicId
      ? [
          {
            publicId: purchase.invoice.publicId,
            version: purchase.invoice.version,
            format: purchase.invoice.format,
            addedBy: 'buyer',
          },
        ]
      : [],
    status: S.SELLER_RESPONDED,
    sellerResponse: { text: reason, by: userId, at: now },
    timeline: [
      { at: now, actorType: 'seller', actorId: userId, action: 'invoice_objected', note: reason },
    ],
  });
};

/** @param {string} userId @param {{ page?: string }} query */
const listMyDisputes = async (userId, query = {}) => {
  const pagination = getPagination(query);
  const [rows, total] = await Promise.all([
    Dispute.find({ buyerId: userId })
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    Dispute.countDocuments({ buyerId: userId }),
  ]);
  return {
    disputes: rows.map((row) => toDisputeView({ ...row, evidence: [] }, { audience: 'buyer' })),
    meta: buildPaginationMeta(total, pagination),
  };
};

/** @param {string} userId @param {string} disputeId */
const getMyDispute = async (userId, disputeId) => {
  const dispute = await Dispute.findOne({ _id: disputeId, buyerId: userId }).lean();
  if (!dispute) throw ApiError.notFound('Dispute not found');
  return toDisputeView(dispute, { audience: 'buyer' });
};

/* ---------------------------------- Dealer ---------------------------------- */

/** @param {string} sellerId @returns Signed upload for one evidence file */
const sellerEvidenceUploadParams = (sellerId) =>
  uploadService.createDisputeEvidenceUploadParams(sellerKey(sellerId));

/** @param {string} sellerId @param {{ status?: string, page?: string }} query */
const listSellerDisputes = async (sellerId, { status, ...query } = {}) => {
  const pagination = getPagination(query);
  const filter = {
    sellerId,
    ...(status === 'open' ? { status: { $in: OPEN } } : status ? { status } : {}),
  };
  const [rows, total] = await Promise.all([
    Dispute.find(filter)
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    Dispute.countDocuments(filter),
  ]);
  return {
    disputes: rows.map((row) => toDisputeView({ ...row, evidence: [] }, { audience: 'seller' })),
    meta: buildPaginationMeta(total, pagination),
  };
};

/** @param {string} sellerId @param {string} disputeId */
const getSellerDispute = async (sellerId, disputeId) => {
  const dispute = await Dispute.findOne({ _id: disputeId, sellerId }).lean();
  if (!dispute) throw ApiError.notFound('Dispute not found');
  const buyer = await User.findById(dispute.buyerId).select('name').lean();
  return toDisputeView(dispute, {
    audience: 'seller',
    extra: {
      buyerFirstName: firstNameOnly(buyer?.name) || null,
      productName: await productNameOf(dispute.groupId),
    },
  });
};

/**
 * Dealer answers (within 48 h; a late answer is still recorded, the dispute stays escalated).
 * @param {{ sellerId: string, userId: string }} dealer
 * @param {string} disputeId
 * @param {{ text: string, evidence?: Object[] }} input
 */
const respondToDispute = async (
  { sellerId, userId },
  disputeId,
  { text, evidence = [] },
  now = new Date(),
) => {
  const dispute = await Dispute.findOne({ _id: disputeId, sellerId }).lean();
  if (!dispute) throw ApiError.notFound('Dispute not found');
  if (![S.AWAITING_SELLER, S.SELLER_MISSED].includes(dispute.status)) {
    throw ApiError.conflict('This dispute is not waiting for your answer', {
      code: 'DISPUTE_NOT_AWAITING',
    });
  }
  evidence.forEach((file) => uploadService.verifyDisputeEvidence(sellerKey(sellerId), file));
  const late = dispute.status === S.SELLER_MISSED;
  const updated = await Dispute.findOneAndUpdate(
    { _id: disputeId, status: dispute.status },
    {
      $set: { status: S.SELLER_RESPONDED, sellerResponse: { text, by: userId, at: now } },
      $push: {
        evidence: {
          $each: evidence.map((file) => ({
            publicId: file.publicId,
            version: file.version,
            format: file.format,
            addedBy: 'seller',
          })),
        },
        timeline: {
          at: now,
          actorType: 'seller',
          actorId: userId,
          action: late ? 'responded_late' : 'responded',
        },
      },
    },
    { new: true },
  ).lean();
  if (!updated)
    throw ApiError.conflict('This dispute changed a moment ago', { code: 'DISPUTE_NOT_AWAITING' });
  await notifyUsers([dispute.buyerId], NOTIFICATION_TYPE.DISPUTE_UPDATE, {
    status: 'seller_responded',
    url: `/disputes/${disputeId}`,
  }).catch(() => {});
  return getSellerDispute(sellerId, disputeId);
};

/* ---------------------------------- Support --------------------------------- */

/** @param {{ status?: string, page?: string, limit?: string }} query Oldest first */
const adminListDisputes = async ({ status, ...query } = {}) => {
  const pagination = getPagination(query);
  const filter = status === 'open' || !status ? { status: { $in: OPEN } } : { status };
  const [rows, total] = await Promise.all([
    Dispute.find(filter)
      .sort({ createdAt: 1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .populate('sellerId', 'businessName')
      .lean(),
    Dispute.countDocuments(filter),
  ]);
  return {
    disputes: rows.map((row) =>
      toDisputeView(
        { ...row, sellerId: row.sellerId?._id || row.sellerId, evidence: [] },
        {
          audience: 'staff',
          extra: {
            sellerName: row.sellerId?.businessName || null,
            overdue: row.status === S.SELLER_MISSED,
          },
        },
      ),
    ),
    meta: buildPaginationMeta(total, pagination),
  };
};

/**
 * Full case for Support: evidence links, chat messages, token state, purchase.
 * @param {string} disputeId
 */
const getAdminDispute = async (disputeId) => {
  const dispute = await Dispute.findById(disputeId)
    .populate('sellerId', 'businessName contactEmail')
    .lean();
  if (!dispute) throw ApiError.notFound('Dispute not found');
  const purchase = await Purchase.findById(dispute.purchaseId).lean();
  const [payment, buyer, messages, productName] = await Promise.all([
    purchase?.paymentId ? Payment.findById(purchase.paymentId).lean() : null,
    User.findById(dispute.buyerId).select('name').lean(),
    dispute.chatMessageIds?.length
      ? Message.find({ _id: { $in: dispute.chatMessageIds } })
          .populate('senderId', 'name')
          .sort({ createdAt: 1 })
          .lean()
      : [],
    productNameOf(dispute.groupId),
  ]);
  return toDisputeView(
    { ...dispute, sellerId: dispute.sellerId?._id },
    {
      audience: 'staff',
      extra: {
        sellerName: dispute.sellerId?.businessName || null,
        buyerFirstName: firstNameOnly(buyer?.name) || null,
        productName,
        purchase: purchase
          ? {
              status: purchase.status,
              dealCode: purchase.dealCode,
              pricePaise: purchase.pricePaise,
              tokenPaise: purchase.tokenPaise,
            }
          : null,
        tokenState: tokenState(payment),
        chatMessages: messages.map((message) => ({
          at: message.createdAt,
          from: firstNameOnly(message.senderId?.name) || message.senderType,
          text: message.text || null,
          hidden: Boolean(message.hidden),
        })),
      },
    },
  );
};

/**
 * Refund the buyer's full token (token with SaathMein or on hold) and close their code.
 * @param {Object} dispute
 * @param {Object} purchase
 * @param {Object} payment
 * @returns {Promise<number>} Refund in paise
 */
const refundToken = async (dispute, purchase, payment) => {
  if (tokenState(payment) === 'on_hold') {
    await reverseHeldTransfer(payment._id, `dispute:${dispute._id}`);
  }
  await queueRefund(payment._id, {
    reason: REFUND_REASON.DISPUTE_REFUND,
    amountPaise: payment.amountPaise,
    feePaise: 0,
  });
  if (
    [PURCHASE_STATUS.PENDING, PURCHASE_STATUS.INVOICE_UPLOADED, PURCHASE_STATUS.OBJECTED].includes(
      purchase.status,
    )
  ) {
    await Purchase.updateOne(
      { _id: purchase._id, status: purchase.status },
      { $set: { status: PURCHASE_STATUS.CANCELLED } },
    );
    await GroupMember.updateOne(
      { _id: purchase.memberId, status: MEMBER_STATUS.ACTIVE },
      { $set: { status: MEMBER_STATUS.REFUNDED, leftAt: new Date() } },
    );
    const { advanceGroup } = require('../purchases/purchase.service');
    await advanceGroup(purchase.groupId);
  }
  return payment.amountPaise;
};

/**
 * Support decides a dispute (money action: note required, audited by the controller).
 * @param {string} disputeId
 * @param {{ outcome: string, creditPaise?: number, penalties?: string[], suspensionDays?: number,
 *   note: string }} input
 * @param {string} staffId
 * @param {Date} [now]
 * @returns {Promise<{ before: Object, after: Object }>}
 * @throws {ApiError} 409 already decided / wrong token state, 422 credit too high
 */
const decideDispute = async (disputeId, input, staffId, now = new Date()) => {
  const dispute = await Dispute.findById(disputeId).lean();
  if (!dispute) throw ApiError.notFound('Dispute not found');
  if (!OPEN.includes(dispute.status)) {
    throw ApiError.conflict('This dispute is already decided', { code: 'DISPUTE_DECIDED' });
  }
  // Claim the decision first so two staff members cannot both pay out
  const claimed = await Dispute.findOneAndUpdate(
    { _id: disputeId, status: dispute.status, 'decision.at': { $exists: false } },
    { $set: { 'decision.at': now, 'decision.by': staffId } },
    { new: true },
  ).lean();
  if (!claimed)
    throw ApiError.conflict('Another staff member is deciding this dispute', {
      code: 'DISPUTE_DECIDED',
    });

  try {
    const purchase = await Purchase.findById(dispute.purchaseId).lean();
    const payment = purchase?.paymentId ? await Payment.findById(purchase.paymentId).lean() : null;
    const state = tokenState(payment);
    let refundPaise;
    let creditPaise;

    if (input.outcome === DISPUTE_OUTCOME.REFUND) {
      if (!['with_saathmein', 'on_hold'].includes(state)) {
        throw ApiError.conflict(
          state === 'released'
            ? 'The token was already released to the dealer. Use wallet credits instead.'
            : 'There is no token to refund for this purchase.',
          { code: 'TOKEN_NOT_REFUNDABLE' },
        );
      }
      refundPaise = await refundToken(dispute, purchase, payment);
    }

    if (input.outcome === DISPUTE_OUTCOME.CREDIT) {
      if (state !== 'released') {
        throw ApiError.conflict(
          'Credits are for tokens already released to the dealer. Refund the token instead.',
          {
            code: 'USE_REFUND',
          },
        );
      }
      creditPaise = input.creditPaise;
      if (
        !Number.isSafeInteger(creditPaise) ||
        creditPaise <= 0 ||
        creditPaise > payment.amountPaise
      ) {
        throw new ApiError(
          422,
          `Credits must be between ₹1 and ${formatINR(payment.amountPaise)}`,
          { code: 'INVALID_CREDIT' },
        );
      }
      await creditWallet({
        userId: dispute.buyerId,
        amountPaise: creditPaise,
        type: WALLET_TXN_TYPE.DISPUTE_CREDIT,
        key: `dispute-credit:${disputeId}`,
        groupId: dispute.groupId,
        purchaseId: dispute.purchaseId,
        note: 'Dispute decided in your favour',
      });
      // The dealer owes it back: billed on the next commission invoice
      await SellerDue.updateOne(
        { disputeId },
        {
          $setOnInsert: {
            sellerId: dispute.sellerId,
            amountPaise: creditPaise,
            reason: 'Credits given to a buyer after a dispute',
            disputeId,
            groupId: dispute.groupId,
            createdBy: staffId,
          },
        },
        { upsert: true },
      );
    }

    const settings = await getDisputeSettings();
    const penalties = input.penalties || [];
    await applyPenalties(dispute.sellerId, penalties, {
      reason: `Dispute: ${input.note}`,
      staffId,
      groupId: dispute.groupId,
      disputeId,
      suspensionDays: input.suspensionDays || settings.suspensionDays,
      now,
    });

    const after = await Dispute.findByIdAndUpdate(
      disputeId,
      {
        $set: {
          status: S.RESOLVED,
          decision: {
            outcome: input.outcome,
            refundPaise,
            creditPaise,
            penalties,
            note: input.note,
            by: staffId,
            at: now,
          },
        },
        $push: {
          timeline: {
            at: now,
            actorType: 'staff',
            actorId: staffId,
            action: 'decided',
            note: input.note,
          },
        },
      },
      { new: true },
    ).lean();

    await notifyUsers([dispute.buyerId], NOTIFICATION_TYPE.DISPUTE_UPDATE, {
      status: 'resolved',
      url: `/disputes/${disputeId}`,
    }).catch(() => {});
    log.warn(
      { disputeId, outcome: input.outcome, refundPaise, creditPaise, penalties },
      'Dispute decided',
    );
    return {
      before: toDisputeView(dispute, { audience: 'staff' }),
      after: toDisputeView(after, { audience: 'staff' }),
    };
  } catch (err) {
    // Release the claim so the dispute can be decided again
    await Dispute.updateOne(
      { _id: disputeId, status: { $in: OPEN } },
      { $unset: { 'decision.at': 1, 'decision.by': 1 } },
    );
    throw err;
  }
};

/**
 * Minute sweep: dealers who did not answer in 48 h → escalated (TRU-4 SLA).
 * @param {Date} [now]
 * @returns {Promise<number>} Disputes escalated
 */
const processDisputeDeadlines = async (now = new Date()) => {
  const overdue = await Dispute.find({ status: S.AWAITING_SELLER, sellerDueAt: { $lte: now } })
    .select('_id')
    .limit(100)
    .lean();
  let escalated = 0;
  for (const { _id } of overdue) {
    const result = await Dispute.updateOne(
      { _id, status: S.AWAITING_SELLER },
      {
        $set: { status: S.SELLER_MISSED },
        $push: { timeline: { at: now, actorType: 'system', action: 'seller_missed_deadline' } },
      },
    );
    escalated += result.modifiedCount;
  }
  if (escalated) log.warn({ escalated }, 'Disputes escalated: dealer did not answer in time');
  return escalated;
};

/**
 * Purchases with an open dispute: the purchase sweep pauses expiry and auto-completion.
 * @returns {Promise<import('mongoose').Types.ObjectId[]>}
 */
const purchasesUnderDispute = () => Dispute.distinct('purchaseId', { status: { $in: OPEN } });

module.exports = {
  OPEN_DISPUTE: OPEN,
  tokenState,
  buyerEvidenceUploadParams,
  openDispute,
  openFromInvoiceObjection,
  listMyDisputes,
  getMyDispute,
  sellerEvidenceUploadParams,
  listSellerDisputes,
  getSellerDispute,
  respondToDispute,
  adminListDisputes,
  getAdminDispute,
  decideDispute,
  processDisputeDeadlines,
  purchasesUnderDispute,
};
