/**
 * Auction close (AUC-8, PRD §10.5) — runs exactly once per auction: job id per end time,
 * a Redis lock, and the state machine's optimistic lock on `auction_live`.
 * At the end time:
 * - fewer than the category's minimum dealers (2) bid and the auction was not extended
 *   yet → extend once by 24 h (minimum-dealers rule);
 * - nobody bid → no_deal (tokens refunded);
 * - still only one dealer → bidding stops and the leader has 24 h to accept that price or
 *   cancel with full refunds (decided 8 Nov 2026; no answer = cancel);
 * - otherwise the lowest price wins, the earliest bid on a tie; the runner-up is the best
 *   bid from another dealer.
 */
const Group = require('../../models/group.model');
const Bid = require('../../models/bid.model');
const { createLogger } = require('../../utils/logger');
const { formatINR } = require('../../utils/money');
const { withLock } = require('../lock.service');
const { transition } = require('../groups/stateMachine');
const { notifyAboutGroup } = require('../groups/groupLive');
const { getAuctionSettings } = require('../settings.service');
const { scheduleAuctionClose } = require('../../jobs/queues');
const { emitToAuction } = require('../../sockets/emitter');
const { declareWinner } = require('./winner.service');
const { raiseAlert } = require('../alerts/alert.service');
const { auctionRulesFor, notifyEligibleDealers } = require('./auction.service');
const {
  BID_STATUS,
  GROUP_STATUS,
  NOTIFICATION_TYPE,
  SOCKET_EVENTS,
} = require('../../constants/enums');

const log = createLogger('AuctionClose');
const LOCK_TTL_MS = 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

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

/** @param {Object[]} bids @returns {number} Distinct dealers who bid */
const countDealers = (bids) => new Set(bids.map((bid) => String(bid.sellerId))).size;

/**
 * Close one auction if its time is up.
 * @param {string} groupId - Group id
 * @param {Date} [now] - Current time (tests)
 * @returns {Promise<{ outcome: 'won'|'no_deal'|'extended'|'awaiting_leader'|'skipped'|'rescheduled'|'locked'|'paused' }>}
 */
const closeAuction = async (groupId, now = new Date()) => {
  const group = await Group.findById(groupId);
  if (!group || group.status !== GROUP_STATUS.AUCTION_LIVE) return { outcome: 'skipped' };
  if (group.auction?.closedAt) return { outcome: 'skipped' }; // waiting for the leader
  if (group.auction?.pausedAt) return { outcome: 'paused' };
  if (group.auction?.endsAt && group.auction.endsAt > now) {
    // Extended after this job was queued: wait for the new end time
    await scheduleAuctionClose(group);
    return { outcome: 'rescheduled' };
  }

  const { acquired, result } = await withLock(`auction-close:${groupId}`, LOCK_TTL_MS, async () => {
    const bids = await Bid.find({
      groupId,
      status: { $in: [BID_STATUS.ACTIVE, BID_STATUS.OUTBID] },
    })
      .sort({ pricePerUnitPaise: 1, createdAt: 1 })
      .limit(500)
      .lean();
    const dealers = countDealers(bids);
    const [rules, settings] = await Promise.all([
      auctionRulesFor(group.categoryId),
      getAuctionSettings(),
    ]);

    // Minimum-dealers rule: extend once
    if (dealers < rules.minDealers && !group.auction?.minDealerExtensionUsed) {
      const endsAt = new Date(now.getTime() + settings.minDealerExtensionHours * HOUR_MS);
      const extended = await Group.findOneAndUpdate(
        {
          _id: groupId,
          status: GROUP_STATUS.AUCTION_LIVE,
          'auction.minDealerExtensionUsed': { $ne: true },
        },
        { $set: { 'auction.endsAt': endsAt, 'auction.minDealerExtensionUsed': true } },
        { new: true },
      );
      if (!extended) return { outcome: 'skipped' };
      await scheduleAuctionClose(extended);
      emitToAuction(groupId, SOCKET_EVENTS.AUCTION_EXTENDED, {
        endsAt,
        extensions: extended.auction.extensions,
        reason: 'min_dealers',
      });
      await notifyEligibleDealers(extended); // second chance for dealers who missed it
      log.info({ groupId, dealers }, 'Auction extended (minimum dealers)');
      return { outcome: 'extended' };
    }

    if (!bids.length) {
      await transition(group, GROUP_STATUS.NO_DEAL, { reason: 'no_valid_bid', ctx: { now } });
      await raiseAlert({
        type: 'auction',
        severity: 'warning',
        title: 'Auction ended with no dealer price',
        message: 'Tokens are being refunded. Check dealer coverage for this city and category.',
        subjectType: 'group',
        subjectId: String(groupId),
        dedupeKey: `auction:no-bids:${groupId}`,
      });
      return { outcome: 'no_deal' };
    }

    if (dealers < rules.minDealers) {
      // One dealer after the extension: the leader decides (accept or cancel with refunds)
      const dueAt = new Date(now.getTime() + settings.singleBidDecisionHours * HOUR_MS);
      await Group.updateOne(
        { _id: groupId, status: GROUP_STATUS.AUCTION_LIVE },
        { $set: { 'auction.closedAt': now, 'auction.singleBidDecisionDueAt': dueAt } },
      );
      await notifyAboutGroup(group.leaderId, group, NOTIFICATION_TYPE.SINGLE_BID_DECISION, {
        price: formatINR(bids[0].pricePerUnitPaise),
      });
      emitToAuction(groupId, SOCKET_EVENTS.AUCTION_EXTENDED, {
        endsAt: group.auction.endsAt,
        closedAt: now,
        reason: 'single_dealer',
      });
      await raiseAlert({
        type: 'auction',
        severity: 'info',
        title: 'Auction ended with only one dealer',
        message: 'The leader has 24 hours to accept that price or cancel.',
        subjectType: 'group',
        subjectId: String(groupId),
        dedupeKey: `auction:one-dealer:${groupId}`,
      });
      return { outcome: 'awaiting_leader' };
    }

    const { winner, runnerUp } = pickWinners(bids);
    await declareWinner(group, winner, runnerUp, { reason: 'lowest_bid_won' });
    return { outcome: 'won' };
  });

  return acquired ? result : { outcome: 'locked' };
};

/**
 * Safety net for the sweep: close live auctions whose end time passed (e.g. a job was
 * lost while Redis was down).
 * @param {Date} [now] - Current time
 * @returns {Promise<number>} Auctions handled
 */
const closeOverdueAuctions = async (now = new Date()) => {
  const overdue = await Group.find({
    status: GROUP_STATUS.AUCTION_LIVE,
    'auction.endsAt': { $lte: new Date(now.getTime() - 60 * 1000) },
    'auction.pausedAt': { $exists: false },
    'auction.closedAt': { $exists: false },
  })
    .select('_id')
    .limit(50)
    .lean();
  let handled = 0;
  for (const { _id } of overdue) {
    const { outcome } = await closeAuction(String(_id), now).catch((err) => {
      log.error({ err: err.message, groupId: String(_id) }, 'Overdue auction close failed');
      return { outcome: 'error' };
    });
    if (['won', 'no_deal', 'extended', 'awaiting_leader'].includes(outcome)) handled += 1;
  }
  return handled;
};

module.exports = { pickWinners, countDealers, closeAuction, closeOverdueAuctions };
