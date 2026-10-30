/**
 * Auction close (AUC-5, PRD §10.5) — runs exactly once per auction: job id per end time,
 * a Redis lock, and the state machine's optimistic lock on `auction_live`.
 * Lowest all-inclusive price wins; on a tie the earliest bid wins. The runner-up is the
 * best bid from a different dealer. No valid bid → no_deal (tokens refunded, Day 7).
 *
 * TODO(Day 9): minimum-dealers rule (extend once by 24 h when fewer than 2 dealers bid),
 * pause handling from admin, and deal codes for members (Day 10).
 */
const Group = require('../../models/group.model');
const Bid = require('../../models/bid.model');
const { createLogger } = require('../../utils/logger');
const { withLock } = require('../lock.service');
const { transition } = require('../groups/stateMachine');
const { scheduleAuctionClose } = require('../../jobs/queues');
const { BID_STATUS, GROUP_STATUS } = require('../../constants/enums');

const log = createLogger('AuctionClose');
const LOCK_TTL_MS = 60 * 1000;

/**
 * Winner and runner-up from a group's bids (pure, for tests).
 * @param {Object[]} bids - Bids sorted by price, then time
 * @returns {{ winner: Object|null, runnerUp: Object|null }}
 */
const pickWinners = (bids) => {
  const winner = bids[0] || null;
  const runnerUp = winner
    ? bids.find((bid) => String(bid.sellerId) !== String(winner.sellerId)) || null
    : null;
  return { winner, runnerUp };
};

/**
 * Close one auction if its time is up.
 * @param {string} groupId - Group id
 * @param {Date} [now] - Current time (tests)
 * @returns {Promise<{ outcome: 'won'|'no_deal'|'skipped'|'rescheduled'|'locked'|'paused' }>}
 */
const closeAuction = async (groupId, now = new Date()) => {
  const group = await Group.findById(groupId);
  if (!group || group.status !== GROUP_STATUS.AUCTION_LIVE) return { outcome: 'skipped' };
  if (group.auction?.pausedAt) return { outcome: 'paused' };
  if (group.auction?.endsAt && group.auction.endsAt > now) {
    // Extended by anti-sniping after this job was queued: wait for the new end time
    await scheduleAuctionClose(group);
    return { outcome: 'rescheduled' };
  }

  const { acquired, result } = await withLock(`auction-close:${groupId}`, LOCK_TTL_MS, async () => {
    const bids = await Bid.find({
      groupId,
      status: { $in: [BID_STATUS.ACTIVE, BID_STATUS.OUTBID] },
    })
      .sort({ pricePerUnitPaise: 1, createdAt: 1 })
      .limit(100)
      .lean();
    const { winner, runnerUp } = pickWinners(bids);

    if (!winner) {
      await transition(group, GROUP_STATUS.NO_DEAL, { reason: 'no_valid_bid' });
      return { outcome: 'no_deal' };
    }

    await transition(group, GROUP_STATUS.WON, {
      reason: 'lowest_bid_won',
      ctx: { winnerBidId: winner._id },
      set: {
        sellerId: winner.sellerId,
        'auction.winnerBidId': winner._id,
        'auction.runnerUpBidId': runnerUp?._id,
        'auction.lowestBidId': winner._id,
        'auction.lowestPricePaise': winner.pricePerUnitPaise,
      },
    });
    await Bid.updateOne({ _id: winner._id }, { $set: { status: BID_STATUS.WON } });
    if (runnerUp)
      await Bid.updateOne({ _id: runnerUp._id }, { $set: { status: BID_STATUS.RUNNER_UP } });
    await Bid.updateMany(
      {
        groupId,
        _id: { $nin: [winner._id, runnerUp?._id].filter(Boolean) },
        status: { $in: [BID_STATUS.ACTIVE, BID_STATUS.OUTBID] },
      },
      { $set: { status: BID_STATUS.LOST } },
    );
    log.info({ groupId, winnerBidId: String(winner._id) }, 'Auction won');
    return { outcome: 'won' };
  });

  return acquired ? result : { outcome: 'locked' };
};

/**
 * Safety net for the sweep: close live auctions whose end time passed (e.g. a job was
 * lost while Redis was down).
 * @param {Date} [now] - Current time
 * @returns {Promise<number>} Auctions closed
 */
const closeOverdueAuctions = async (now = new Date()) => {
  const overdue = await Group.find({
    status: GROUP_STATUS.AUCTION_LIVE,
    'auction.endsAt': { $lte: new Date(now.getTime() - 60 * 1000) },
    'auction.pausedAt': { $exists: false },
  })
    .select('_id')
    .limit(50)
    .lean();
  let closed = 0;
  for (const { _id } of overdue) {
    const { outcome } = await closeAuction(String(_id), now).catch((err) => {
      log.error({ err: err.message, groupId: String(_id) }, 'Overdue auction close failed');
      return { outcome: 'error' };
    });
    if (outcome === 'won' || outcome === 'no_deal') closed += 1;
  }
  return closed;
};

module.exports = { pickWinners, closeAuction, closeOverdueAuctions };
