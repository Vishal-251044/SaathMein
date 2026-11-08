/**
 * Side effects after a group status change (run once the change is saved):
 * - auction_live → schedule the auction close job.
 * - expired / no_deal / cancelled → every paid member's token is refunded in full (PAY-3).
 * - full → the waitlist opens (nothing to do until a seat frees up).
 * Live updates to the group room and push notifications come on Day 8.
 * Effects never throw: the status change has already happened (refunds are retried by
 * the refund job and the minute sweep).
 */
const { scheduleAuctionClose } = require('../../jobs/queues');
const { createLogger } = require('../../utils/logger');
const { refundGroupMembers, REFUND_REASON } = require('../payments/refund.service');
const { GROUP_STATUS } = require('../../constants/enums');

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
    if (group.status === GROUP_STATUS.AUCTION_LIVE) await scheduleAuctionClose(group);
    const reason = REFUND_REASONS[group.status];
    if (reason) {
      const count = await refundGroupMembers(group._id, reason);
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
