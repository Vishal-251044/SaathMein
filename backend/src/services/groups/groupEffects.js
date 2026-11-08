/**
 * Side effects after a group status change (run once the change is saved):
 * - every change → live `group:status` to everyone watching the group (LIV-1);
 * - full → "Your group is full" to members;
 * - auction_live → schedule the auction close job + "Dealers are bidding";
 * - expired / no_deal / cancelled → every paid member's token is refunded in full (PAY-3)
 *   and members are told.
 * Effects never throw: the status change has already happened (refunds are retried by
 * the refund job and the minute sweep).
 */
const { scheduleAuctionClose } = require('../../jobs/queues');
const { createLogger } = require('../../utils/logger');
const { refundGroupMembers, REFUND_REASON } = require('../payments/refund.service');
const { publishGroupStatus, notifyGroupMembers, groupRecipients } = require('./groupLive');
const { GROUP_STATUS, NOTIFICATION_TYPE } = require('../../constants/enums');

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
    }
    if (group.status === GROUP_STATUS.AUCTION_LIVE) {
      await scheduleAuctionClose(group);
      await notifyGroupMembers(group, NOTIFICATION_TYPE.AUCTION_STARTED);
    }
    const reason = REFUND_REASONS[group.status];
    if (reason) {
      // Who to tell, read before refunds mark members refunded
      const recipients = await groupRecipients(group._id);
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
