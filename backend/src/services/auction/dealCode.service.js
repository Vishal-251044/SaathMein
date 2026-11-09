/**
 * Deal codes (PUR-1): when a group is won, every seated member gets a unique 10-character
 * code (no look-alike letters) and a purchase record for the winning dealer, price and
 * validity. The QR carries the code plus an HMAC signature (DEAL_CODE_SECRET), so a
 * scanned code cannot be forged; dealers may also type the bare code.
 */
const crypto = require('crypto');
const Group = require('../../models/group.model');
const GroupMember = require('../../models/groupMember.model');
const Payment = require('../../models/payment.model');
const Purchase = require('../../models/purchase.model');
const config = require('../../config/env');
const { generateCode } = require('../../helpers/genericFunctions');
const { safeEqual } = require('../../utils/crypto');
const { createLogger } = require('../../utils/logger');
const { MEMBER_STATUS, PURCHASE_STATUS } = require('../../constants/enums');

const log = createLogger('DealCodes');
const CODE_LENGTH = 10;
const ATTEMPTS = 5;
const QR_PREFIX = 'SM1';
const SIGNATURE_LENGTH = 16;
/** Purchases that are still open (not completed / expired / cancelled). */
const OPEN_PURCHASE = [
  PURCHASE_STATUS.PENDING,
  PURCHASE_STATUS.INVOICE_UPLOADED,
  PURCHASE_STATUS.OBJECTED,
];

/** @param {string} code @returns {string} Short HMAC signature (base64url) */
const signatureFor = (code) =>
  crypto
    .createHmac('sha256', config.dealCodeSecret)
    .update(`deal-code:${code}`)
    .digest('base64url')
    .slice(0, SIGNATURE_LENGTH);

/**
 * QR payload for a deal code: "SM1.<code>.<signature>".
 * @param {string} code - Deal code
 * @returns {string}
 */
const qrPayloadFor = (code) => `${QR_PREFIX}.${code}.${signatureFor(code)}`;

/**
 * Read what the dealer scanned or typed.
 * @param {string} input - QR payload or bare code (spaces / dashes allowed)
 * @returns {{ code: string|null, scanned: boolean }} code null when a QR signature is wrong
 */
const parseDealCodeInput = (input) => {
  const text = String(input || '').trim();
  if (text.startsWith(`${QR_PREFIX}.`)) {
    const [, code, signature] = text.split('.');
    const valid = Boolean(code && signature) && safeEqual(signature, signatureFor(code));
    return { code: valid ? code.toUpperCase() : null, scanned: true };
  }
  const code = text.toUpperCase().replace(/[\s-]/g, '');
  return { code: /^[A-Z0-9]{6,16}$/.test(code) ? code : null, scanned: false };
};

/**
 * Create (or re-point, after a runner-up takes over) the member's purchase record.
 * @param {Object} member - GroupMember (lean) with _id, userId, paymentId
 * @param {Object} group - Won group (lean) with sellerId, winningPricePaise, priceValidUntil
 * @param {string} code - The member's deal code
 */
const upsertPurchase = async (member, group, code) => {
  const payment = member.paymentId
    ? await Payment.findById(member.paymentId).select('amountPaise').lean()
    : null;
  await Purchase.updateOne(
    { memberId: member._id },
    {
      $set: {
        groupId: group._id,
        userId: member.userId,
        sellerId: group.sellerId,
        paymentId: member.paymentId,
        bidId: group.auction?.winnerBidId,
        dealCode: code,
        pricePaise: group.winningPricePaise,
        tokenPaise: payment?.amountPaise ?? 0,
        status: PURCHASE_STATUS.PENDING,
        validUntil: group.priceValidUntil,
      },
      $unset: { reminderSentAt: 1, invoice: 1, autoCompleteAt: 1, objection: 1 },
    },
    { upsert: true },
  );
};

/**
 * Give one member a deal code (keeps an existing one) and an open purchase.
 * @param {Object} member - GroupMember (lean) with _id
 * @param {Object} [group] - Won group (loaded when missing)
 * @returns {Promise<string|null>} The code
 */
const issueDealCode = async (member, group) => {
  const won = group || (await Group.findById(member.groupId).lean());
  const full = member.userId
    ? member
    : await GroupMember.findById(member._id).select('_id groupId userId paymentId dealCode').lean();
  if (!won || !full) return null;
  let code = full.dealCode || null;
  for (let attempt = 0; attempt < ATTEMPTS && !code; attempt += 1) {
    const candidate = generateCode(CODE_LENGTH);
    try {
      const result = await GroupMember.updateOne(
        { _id: full._id, dealCode: { $exists: false } },
        { $set: { dealCode: candidate } },
      );
      code = result.modifiedCount
        ? candidate
        : (await GroupMember.findById(full._id).select('dealCode').lean())?.dealCode;
    } catch (err) {
      if (err?.code !== 11000) throw err; // duplicate code: try another
    }
  }
  if (!code) {
    log.error({ memberId: String(full._id) }, '[DealCodes] could not generate a unique code');
    return null;
  }
  const open = await Purchase.exists({
    memberId: full._id,
    status: { $in: OPEN_PURCHASE },
    sellerId: won.sellerId,
    dealCode: code,
  });
  if (!open) await upsertPurchase(full, won, code);
  return code;
};

/**
 * Deal codes and purchases for every seated member of a won group.
 * @param {string} groupId - Won group
 * @returns {Promise<number>} Codes issued
 */
const issueDealCodes = async (groupId) => {
  const group = await Group.findById(groupId).lean();
  if (!group?.sellerId) return 0;
  const members = await GroupMember.find({ groupId, status: MEMBER_STATUS.ACTIVE })
    .select('_id groupId userId paymentId dealCode')
    .lean();
  let issued = 0;
  for (const member of members) {
    if (await issueDealCode(member, group)) issued += 1;
  }
  return issued;
};

/**
 * Remove the deal codes of a group and cancel its open purchases (the winner backed out:
 * the runner-up gets new codes).
 * @param {string} groupId - Group
 */
const clearDealCodes = async (groupId) => {
  await Purchase.updateMany(
    { groupId, status: { $in: OPEN_PURCHASE } },
    { $set: { status: PURCHASE_STATUS.CANCELLED } },
  );
  return GroupMember.updateMany(
    { groupId, dealCode: { $exists: true } },
    { $unset: { dealCode: 1 } },
  );
};

module.exports = {
  OPEN_PURCHASE,
  qrPayloadFor,
  parseDealCodeInput,
  issueDealCode,
  issueDealCodes,
  clearDealCodes,
};
