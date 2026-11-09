/**
 * Deal codes (AUC-8): when a group is won, every seated member gets a unique code to buy
 * from the winning dealer at the winning price. Codes are 10 characters without look-alike
 * letters; Day 10 adds the signed QR payload and the dealer's scan / confirm flow.
 */
const GroupMember = require('../../models/groupMember.model');
const { generateCode } = require('../../helpers/genericFunctions');
const { createLogger } = require('../../utils/logger');
const { MEMBER_STATUS } = require('../../constants/enums');

const log = createLogger('DealCodes');
const CODE_LENGTH = 10;
const ATTEMPTS = 5;

/**
 * Give one member a deal code (keeps an existing one).
 * @param {Object} member - GroupMember (lean) with _id
 * @returns {Promise<string|null>} The code
 */
const issueDealCode = async (member) => {
  if (member.dealCode) return member.dealCode;
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    const code = generateCode(CODE_LENGTH);
    try {
      const result = await GroupMember.updateOne(
        { _id: member._id, dealCode: { $exists: false } },
        { $set: { dealCode: code } },
      );
      return result.modifiedCount ? code : null;
    } catch (err) {
      if (err?.code !== 11000) throw err; // duplicate code: try another
    }
  }
  log.error({ memberId: String(member._id) }, '[DealCodes] could not generate a unique code');
  return null;
};

/**
 * Deal codes for every seated member of a group that does not have one.
 * @param {string} groupId - Won group
 * @returns {Promise<number>} Codes issued
 */
const issueDealCodes = async (groupId) => {
  const members = await GroupMember.find({
    groupId,
    status: MEMBER_STATUS.ACTIVE,
    dealCode: { $exists: false },
  })
    .select('_id dealCode')
    .lean();
  let issued = 0;
  for (const member of members) {
    if (await issueDealCode(member)) issued += 1;
  }
  return issued;
};

/**
 * Remove the deal codes of a group (winner backed out: the runner-up gets new ones).
 * @param {string} groupId - Group
 */
const clearDealCodes = (groupId) =>
  GroupMember.updateMany({ groupId, dealCode: { $exists: true } }, { $unset: { dealCode: 1 } });

module.exports = { issueDealCode, issueDealCodes, clearDealCodes };
