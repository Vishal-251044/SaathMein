/**
 * Side effects after a group status change (run once the change is saved):
 * - every change → live `group:status` to everyone watching the group (LIV-1);
 * - full → "Your group is full" to members, then the auction starts (buyer-led) or the
 *   deal is won at its top tier (seller-led);
 * - auction_live → schedule the auction close job, tell members, invite eligible dealers;
 * - expired / no_deal / cancelled → every paid member's token is refunded in full (PAY-3)
 *   and members are told.
 * Effects never throw: the status change has already happened (refunds are retried by
 * the refund job and the minute sweep).
 */
const { scheduleAuctionClose } = require('../../jobs/queues');
const { createLogger } = require('../../utils/logger');
const { refundGroupMembers, REFUND_REASON } = require('../payments/refund.service');
const { reverseGroupTransfers } = require('../auction/settlement.service');
const { publishGroupStatus, notifyGroupMembers, groupRecipients } = require('./groupLive');
const { GROUP_STATUS, GROUP_TYPE, NOTIFICATION_TYPE } = require('../../constants/enums');

const log = createLogger('GroupEffects');

/** Group endings that refund every token, and the refund reason used. */
const REFUND_REASONS = Object.freeze({
  [GROUP_STATUS.EXPIRED]: REFUND_REASON.GROUP_EXPIRED,
  [GROUP_STATUS.NO_DEAL]: REFUND_REASON.NO_DEAL,
  [GROUP_STATUS.CANCELLED]: REFUND_REASON.GROUP_CANCELLED,
});

/**
 * @param {Object} group - Updated group
 * @param {string} from - Previous status
 * @returns {Promise<void>}
 */
const runGroupEffects = async (group, from) => {
  try {
    publishGroupStatus(group);
    if (group.status === GROUP_STATUS.FULL) {
      await notifyGroupMembers(group, NOTIFICATION_TYPE.GROUP_FULL);
      // Loaded here: these services import the state machine, which imports this file
      if (group.type === GROUP_TYPE.SELLER_LED) {
        const { closeSellerDeal } = require('../deals/deal.service');
        await closeSellerDeal(group, 'deal_full');
      } else {
        const { startAuction } = require('../auction/auction.service');
        await startAuction(group); // its own transition runs these effects for auction_live
      }
    }
    if (group.status === GROUP_STATUS.AUCTION_LIVE) {
      await scheduleAuctionClose(group);
      await notifyGroupMembers(group, NOTIFICATION_TYPE.AUCTION_STARTED);
      const { notifyEligibleDealers } = require('../auction/auction.service');
      await notifyEligibleDealers(group);
    }
    const reason = REFUND_REASONS[group.status];
    if (reason) {
      // Who to tell, read before refunds mark members refunded
      const recipients = await groupRecipients(group._id);
      // Tokens held at a dealer come back first (only refundable once reversed)
      await reverseGroupTransfers(group._id, `group_${group.status}`);
      const count = await refundGroupMembers(group._id, reason);
      if (recipients.length) {
        await notifyGroupMembers(group, NOTIFICATION_TYPE.GROUP_ENDED, {}, { userIds: recipients });
      }
      log.info(
        { groupId: String(group._id), from, to: group.status, refunds: count },
        'Group ended; refunds queued',
      );
    }
  } catch (err) {
    log.error(
      { err: err.message, groupId: String(group._id) },
      '[GroupEffects] side effect failed',
    );
  }
};

module.exports = { runGroupEffects };
