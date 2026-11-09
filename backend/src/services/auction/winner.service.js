/**
 * Auction results (PRD §10.5, AUC-8):
 * - declareWinner: lowest bid wins (earliest on a tie) → group won, 24 h exit window, deal
 *   codes for every member, bids and dealers marked, everyone told.
 * - backOut: the winner backs out → penalty (rating penalty + 30-day auction suspension);
 *   the runner-up is offered the group at its own last price, else the group is cancelled
 *   with full refunds.
 * - respondToRunnerUpOffer: runner-up accepts (group → purchasing with them) or declines
 *   (no_deal, refunds).
 * - processAuctionTimeouts: leader did not answer a single-dealer result (cancel + refund),
 *   runner-up did not answer (no_deal + refund).
 * Route transfers on hold for the winner are created on Day 10.
 */
const Group = require('../../models/group.model');
const Bid = require('../../models/bid.model');
const Seller = require('../../models/seller.model');
const SellerStaff = require('../../models/sellerStaff.model');
const AuctionDealer = require('../../models/auctionDealer.model');
const Product = require('../../models/product.model');
const config = require('../../config/env');
const ApiError = require('../../utils/ApiError');
const { createLogger } = require('../../utils/logger');
const { formatINR } = require('../../utils/money');
const { transition } = require('../groups/stateMachine');
const { notifyGroupMembers, groupUrl } = require('../groups/groupLive');
const { notifyUsers } = require('../notifications/notification.service');
const { getAuctionSettings } = require('../settings.service');
const emailService = require('../email.service');
const { emitToAuction } = require('../../sockets/emitter');
const { toPublicSeller } = require('../seller/sellerPresenter');
const { issueDealCodes, clearDealCodes } = require('./dealCode.service');
const { holdGroupTransfersSafe, reverseGroupTransfers } = require('./settlement.service');
const {
  BID_STATUS,
  GROUP_STATUS,
  NOTIFICATION_TYPE,
  SOCKET_EVENTS,
} = require('../../constants/enums');

const log = createLogger('AuctionWinner');
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Product name for texts. */
const productNameOf = async (group) => {
  const product = await Product.findById(group.productId).select('brand model').lean();
  return product ? `${product.brand} ${product.model}` : 'SaathMein group';
};

/** Dealer web link to an auction. */
const dealerAuctionUrl = (groupId) => `${config.sellerWebUrl}/auctions/${groupId}`;

/**
 * Tell a dealer team (in-app for every member of the team + email to the business).
 * @param {string} sellerId - Dealer
 * @param {string} type - NOTIFICATION_TYPE
 * @param {Object} data - Template values
 * @param {(seller: Object) => Promise<*>} [email] - Email to send to the business
 */
const notifyDealer = async (sellerId, type, data, email) => {
  try {
    const [seller, staff] = await Promise.all([
      Seller.findById(sellerId).select('contactEmail businessName').lean(),
      SellerStaff.find({ sellerId, status: 'active' }).distinct('userId'),
    ]);
    await notifyUsers(staff, type, data);
    if (email && seller?.contactEmail) await email(seller);
  } catch (err) {
    log.warn({ err: err.message, sellerId: String(sellerId) }, 'Dealer notification failed');
  }
};

/**
 * Declare the winner of a live auction.
 * @param {Object} group - Group in auction_live
 * @param {Object} winnerBid - Lowest bid (lean)
 * @param {Object|null} runnerUpBid - Best bid from another dealer
 * @param {{ reason: string, actor?: Object }} options
 * @returns {Promise<Object>} Updated group
 */
const declareWinner = async (group, winnerBid, runnerUpBid, { reason, actor } = {}) => {
  const settings = await getAuctionSettings();
  const now = new Date();
  const updated = await transition(group, GROUP_STATUS.WON, {
    reason,
    actor,
    ctx: { winnerBidId: winnerBid._id },
    set: {
      sellerId: winnerBid.sellerId,
      winningPricePaise: winnerBid.pricePerUnitPaise,
      exitWindowEndsAt: new Date(now.getTime() + settings.exitWindowHours * HOUR_MS),
      'auction.winnerBidId': winnerBid._id,
      'auction.runnerUpBidId': runnerUpBid?._id,
      'auction.lowestBidId': winnerBid._id,
      'auction.lowestPricePaise': winnerBid.pricePerUnitPaise,
      'auction.closedAt': now,
    },
    unset: { 'auction.singleBidDecisionDueAt': 1 },
  });

  // Bids and dealers (bids are append-only; only status changes)
  await Bid.updateOne({ _id: winnerBid._id }, { $set: { status: BID_STATUS.WON } });
  if (runnerUpBid)
    await Bid.updateOne({ _id: runnerUpBid._id }, { $set: { status: BID_STATUS.RUNNER_UP } });
  await Bid.updateMany(
    {
      groupId: group._id,
      _id: { $nin: [winnerBid._id, runnerUpBid?._id].filter(Boolean) },
      status: { $in: [BID_STATUS.ACTIVE, BID_STATUS.OUTBID] },
    },
    { $set: { status: BID_STATUS.LOST } },
  );
  await AuctionDealer.updateMany({ groupId: group._id }, { $set: { status: 'lost' } });
  await AuctionDealer.updateOne(
    { groupId: group._id, sellerId: winnerBid.sellerId },
    { $set: { status: 'won' } },
  );
  if (runnerUpBid) {
    await AuctionDealer.updateOne(
      { groupId: group._id, sellerId: runnerUpBid.sellerId },
      { $set: { status: 'runner_up' } },
    );
  }

  await issueDealCodes(group._id);
  // Tokens minus commission to the dealer, on hold until each purchase is confirmed (PAY-4)
  await holdGroupTransfersSafe(group._id);
  await announceWinner(updated, winnerBid);
  log.info(
    { groupId: String(group._id), price: winnerBid.pricePerUnitPaise, reason },
    'Auction won',
  );
  return updated;
};

/**
 * Live + notifications for a new winner (also used when the runner-up takes over).
 * @param {Object} group - Updated group
 * @param {Object} winnerBid - Winning bid
 */
const announceWinner = async (group, winnerBid) => {
  const [seller, productName, dealers] = await Promise.all([
    Seller.findById(winnerBid.sellerId)
      .select('businessName address rating ratingCount kyc.status geo')
      .lean(),
    productNameOf(group),
    AuctionDealer.find({ groupId: group._id }).select('sellerId').lean(),
  ]);
  const price = formatINR(winnerBid.pricePerUnitPaise);
  emitToAuction(group._id, SOCKET_EVENTS.AUCTION_WON, {
    pricePaise: winnerBid.pricePerUnitPaise,
    seller: seller ? toPublicSeller(seller) : null,
    exitWindowEndsAt: group.exitWindowEndsAt,
  });
  await notifyGroupMembers(group, NOTIFICATION_TYPE.AUCTION_WON, {
    price,
    dealerName: seller?.businessName || 'The dealer',
  });
  for (const dealer of dealers) {
    const won = String(dealer.sellerId) === String(winnerBid.sellerId);
    await notifyDealer(
      dealer.sellerId,
      NOTIFICATION_TYPE.DEALER_RESULT,
      { won, price, productName, memberCount: group.memberCount, url: dealerAuctionUrl(group._id) },
      (business) =>
        emailService.sendAuctionResult({
          to: business.contactEmail,
          productName,
          won,
          price,
          members: group.memberCount,
          url: dealerAuctionUrl(group._id),
        }),
    );
  }
};

/**
 * The winning dealer backs out (PRD §10.5 "Winner backs out").
 * @param {string} groupId - Won group
 * @param {{ sellerId: string, userId: string }} dealer - Who is backing out
 * @param {string} reason - Why (stored with the penalty)
 * @returns {Promise<Object>} Updated group
 * @throws {ApiError} 403 not the winner, 409 wrong status
 */
const backOut = async (groupId, { sellerId, userId }, reason) => {
  const group = await Group.findById(groupId);
  if (!group) throw ApiError.notFound('Group not found');
  if (String(group.sellerId) !== String(sellerId))
    throw ApiError.forbidden('Only the winning dealer can do this');
  if (group.status !== GROUP_STATUS.WON) {
    throw ApiError.conflict('This group can no longer be handed back', { code: 'CANNOT_BACK_OUT' });
  }
  const settings = await getAuctionSettings();
  const now = new Date();

  // Penalty: rating penalty + suspension from auctions
  await Seller.updateOne(
    { _id: sellerId },
    {
      $push: {
        penalties: {
          $each: [
            { type: 'rating_penalty', reason, groupId, createdBy: userId },
            {
              type: 'auction_suspension',
              reason,
              groupId,
              until: new Date(now.getTime() + settings.backOutSuspensionDays * DAY_MS),
              createdBy: userId,
            },
          ],
        },
      },
    },
  );
  await AuctionDealer.updateOne({ groupId, sellerId }, { $set: { status: 'backed_out' } });
  await clearDealCodes(groupId);
  // Take the held tokens back before they go to the runner-up or are refunded (PAY-4)
  await reverseGroupTransfers(groupId, 'dealer_backed_out');
  log.warn({ groupId, sellerId, reason }, 'Winning dealer backed out');

  const runnerUpBid = group.auction?.runnerUpBidId
    ? await Bid.findById(group.auction.runnerUpBidId).lean()
    : null;
  if (!runnerUpBid) {
    return transition(group, GROUP_STATUS.CANCELLED, {
      reason: 'winner_backed_out',
      actor: { type: 'user', id: userId },
    });
  }

  const updated = await transition(group, GROUP_STATUS.RUNNER_UP, {
    reason: 'winner_backed_out',
    actor: { type: 'user', id: userId },
    ctx: { runnerUpBidId: runnerUpBid._id },
    set: {
      'auction.runnerUpOfferDueAt': new Date(now.getTime() + settings.runnerUpOfferHours * HOUR_MS),
    },
  });
  const productName = await productNameOf(group);
  const price = formatINR(runnerUpBid.pricePerUnitPaise);
  await notifyDealer(
    runnerUpBid.sellerId,
    NOTIFICATION_TYPE.RUNNER_UP_OFFER,
    { productName, price, url: dealerAuctionUrl(groupId) },
    (business) =>
      emailService.sendRunnerUpOffer({
        to: business.contactEmail,
        productName,
        price,
        hours: settings.runnerUpOfferHours,
        url: dealerAuctionUrl(groupId),
      }),
  );
  return updated;
};

/**
 * Runner-up accepts or declines the group.
 * @param {string} groupId - Group in runner_up
 * @param {{ sellerId: string, userId: string }} dealer - Runner-up dealer
 * @param {boolean} accept - Take the group
 * @returns {Promise<Object>} Updated group
 */
const respondToRunnerUpOffer = async (groupId, { sellerId, userId }, accept) => {
  const group = await Group.findById(groupId);
  if (!group) throw ApiError.notFound('Group not found');
  if (group.status !== GROUP_STATUS.RUNNER_UP) {
    throw ApiError.conflict('There is no open offer for this group', {
      code: 'NO_RUNNER_UP_OFFER',
    });
  }
  const bid = await Bid.findById(group.auction?.runnerUpBidId).lean();
  if (!bid || String(bid.sellerId) !== String(sellerId))
    throw ApiError.forbidden('This offer is not for you');

  const actor = { type: 'user', id: userId };
  if (!accept) {
    await AuctionDealer.updateOne({ groupId, sellerId }, { $set: { status: 'lost' } });
    return transition(group, GROUP_STATUS.NO_DEAL, { reason: 'runner_up_declined', actor });
  }

  const settings = await getAuctionSettings();
  const updated = await transition(group, GROUP_STATUS.PURCHASING, {
    reason: 'runner_up_accepted',
    actor,
    set: {
      sellerId,
      winningPricePaise: bid.pricePerUnitPaise,
      exitWindowEndsAt: new Date(Date.now() + settings.exitWindowHours * HOUR_MS),
      'auction.winnerBidId': bid._id,
      'auction.lowestBidId': bid._id,
      'auction.lowestPricePaise': bid.pricePerUnitPaise,
    },
    unset: { 'auction.runnerUpOfferDueAt': 1, 'auction.runnerUpBidId': 1 },
  });
  await Bid.updateOne({ _id: bid._id }, { $set: { status: BID_STATUS.WON } });
  await AuctionDealer.updateOne({ groupId, sellerId }, { $set: { status: 'won' } });
  await issueDealCodes(groupId);
  await holdGroupTransfersSafe(groupId);
  await announceWinner(updated, bid);
  return updated;
};

/**
 * Minute sweep: unanswered single-dealer results and runner-up offers.
 * @param {Date} [now]
 * @returns {Promise<{ cancelled: number, noDeal: number }>}
 */
const processAuctionTimeouts = async (now = new Date()) => {
  let cancelled = 0;
  let noDeal = 0;
  const single = await Group.find({
    status: GROUP_STATUS.AUCTION_LIVE,
    'auction.singleBidDecisionDueAt': { $lte: now },
  }).limit(100);
  for (const group of single) {
    try {
      await transition(group, GROUP_STATUS.CANCELLED, {
        reason: 'single_bid_no_answer',
        ctx: { now },
      });
      cancelled += 1;
    } catch (err) {
      if (err.code !== 'GROUP_CHANGED') throw err;
    }
  }
  const runnerUps = await Group.find({
    status: GROUP_STATUS.RUNNER_UP,
    'auction.runnerUpOfferDueAt': { $lte: now },
  }).limit(100);
  for (const group of runnerUps) {
    try {
      await transition(group, GROUP_STATUS.NO_DEAL, {
        reason: 'runner_up_no_answer',
        ctx: { now },
      });
      noDeal += 1;
    } catch (err) {
      if (err.code !== 'GROUP_CHANGED') throw err;
    }
  }
  return { cancelled, noDeal };
};

module.exports = {
  declareWinner,
  announceWinner,
  backOut,
  respondToRunnerUpOffer,
  processAuctionTimeouts,
  notifyDealer,
  dealerAuctionUrl,
  productNameOf,
  groupUrl,
};
