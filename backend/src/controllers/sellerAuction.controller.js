/**
 * Dealer auctions and seller-led deals controller — /api/seller/auctions, /api/seller/deals
 * (PRD §10.5, AUC-1 to AUC-9). `req.seller` comes from requireSeller.
 */
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const auctionService = require('../services/auction/auction.service');
const bidService = require('../services/auction/bid.service');
const winnerService = require('../services/auction/winner.service');
const dealService = require('../services/deals/deal.service');

/** @param {import('express').Request} req @returns {{ sellerId: string, userId: string }} */
const dealer = (req) => ({ sellerId: req.seller.sellerId, userId: req.auth.userId });

/** GET /api/seller/auctions?tab=live|upcoming|won */
const listAuctions = asyncHandler(async (req, res) => {
  const { groups, meta } = await auctionService.listSellerAuctions(
    req.seller.sellerId,
    req.validatedQuery,
  );
  return sendSuccess(res, { message: 'Auctions fetched', data: { groups }, meta });
});

/** GET /api/seller/auctions/:groupId */
const getAuction = asyncHandler(async (req, res) => {
  const auction = await auctionService.getSellerAuction(req.params.groupId, req.seller.sellerId);
  return sendSuccess(res, { message: 'Auction fetched', data: { auction } });
});

/** POST /api/seller/auctions/:groupId/join */
const joinAuction = asyncHandler(async (req, res) => {
  const auction = await auctionService.joinAuction(req.params.groupId, dealer(req), req.body);
  return sendSuccess(res, { message: 'You joined the auction', data: { auction } });
});

/** POST /api/seller/auctions/:groupId/bids */
const placeBid = asyncHandler(async (req, res) => {
  const result = await bidService.placeBid(req.params.groupId, dealer(req), req.body, {
    ip: req.ip,
  });
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Bid placed. You have the lowest price.',
    data: result,
  });
});

/** POST /api/seller/auctions/:groupId/back-out (owner only) */
const backOut = asyncHandler(async (req, res) => {
  await winnerService.backOut(req.params.groupId, dealer(req), req.body.reason);
  return sendSuccess(res, { message: 'You backed out of this group' });
});

/** POST /api/seller/auctions/:groupId/runner-up { accept } */
const respondRunnerUp = asyncHandler(async (req, res) => {
  await winnerService.respondToRunnerUpOffer(req.params.groupId, dealer(req), req.body.accept);
  const auction = await auctionService.getSellerAuction(req.params.groupId, req.seller.sellerId);
  return sendSuccess(res, {
    message: req.body.accept ? 'You took the group' : 'Offer declined',
    data: { auction },
  });
});

/** GET /api/seller/deals */
const listDeals = asyncHandler(async (req, res) => {
  const { deals, meta } = await dealService.listSellerDeals(
    req.seller.sellerId,
    req.validatedQuery,
  );
  return sendSuccess(res, { message: 'Deals fetched', data: { deals }, meta });
});

/** POST /api/seller/deals */
const createDeal = asyncHandler(async (req, res) => {
  const deal = await dealService.createDeal(dealer(req), req.body);
  return sendSuccess(res, { statusCode: 201, message: 'Deal published', data: { deal } });
});

module.exports = {
  listAuctions,
  getAuction,
  joinAuction,
  placeBid,
  backOut,
  respondRunnerUp,
  listDeals,
  createDeal,
};
