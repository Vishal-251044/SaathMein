/**
 * Side effects after a group status change (run once the change is saved):
 * - auction_live → schedule the auction close job.
 * - expired / no_deal / cancelled → every token is refunded (Day 7, PAY-3).
 * Live updates to the group room and push notifications come on Day 8.
 * Effects never throw: the status change has already happened.
 */
const { scheduleAuctionClose } = require('../../jobs/queues');
const { createLogger } = require('../../utils/logger');
const { GROUP_STATUS } = require('../../constants/enums');

const log = createLogger('GroupEffects');

const REFUND_STATUSES = new Set([
  GROUP_STATUS.EXPIRED,
  GROUP_STATUS.NO_DEAL,
  GROUP_STATUS.CANCELLED,
]);

/**
 * @param {Object} group - Updated group
 * @param {string} from - Previous status
 * @returns {Promise<void>}
 */
const runGroupEffects = async (group, from) => {
  try {
    if (group.status === GROUP_STATUS.AUCTION_LIVE) await scheduleAuctionClose(group);
    if (REFUND_STATUSES.has(group.status)) {
      // TODO(Day 7): queue refunds for every paid member (PAY-3)
      log.info(
        { groupId: String(group._id), from, to: group.status, members: group.memberCount },
        'Group ended; member refunds run from Day 7',
      );
    }
  } catch (err) {
    log.error({ err: err.message, groupId: String(group._id) }, 'Group side effect failed');
  }
};

module.exports = { runGroupEffects };
