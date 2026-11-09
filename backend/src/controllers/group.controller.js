/**
 * Groups controller — /api/groups (PRD §10.3, §12.3).
 */
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const groupService = require('../services/groups/group.service');
const communityService = require('../services/groups/community.service');
const membershipService = require('../services/groups/membership.service');

/** POST /api/groups */
const createGroup = asyncHandler(async (req, res) => {
  const group = await groupService.createGroup(req.auth.userId, req.body);
  return sendSuccess(res, { statusCode: 201, message: 'Group created', data: { group } });
});

/** GET /api/groups?cityId=&categoryId=&productId=&status=&sort=&page= */
const listGroups = asyncHandler(async (req, res) => {
  const { groups, meta } = await groupService.listGroups(req.validatedQuery, {
    userId: req.auth?.userId,
  });
  return sendSuccess(res, { message: 'Groups fetched', data: { groups }, meta });
});

/** GET /api/groups/similar?productId=&variantKey= */
const similarGroups = asyncHandler(async (req, res) => {
  const groups = await groupService.findSimilarGroups(req.validatedQuery, req.auth.userId);
  return sendSuccess(res, { message: 'Similar groups fetched', data: { groups } });
});

/** GET /api/groups/mine?role=joined|leading */
const myGroups = asyncHandler(async (req, res) => {
  const { groups, meta } = await groupService.listMyGroups(req.auth.userId, req.validatedQuery);
  return sendSuccess(res, { message: 'Your groups fetched', data: { groups }, meta });
});

/** GET /api/groups/:groupId?code= */
const getGroup = asyncHandler(async (req, res) => {
  const group = await groupService.getGroup(req.params.groupId, {
    userId: req.auth?.userId,
    code: req.validatedQuery.code,
  });
  return sendSuccess(res, { message: 'Group fetched', data: { group } });
});

/** POST /api/groups/join-by-code */
const joinByCode = asyncHandler(async (req, res) => {
  const result = await communityService.joinByCode(req.body.code, req.auth.userId);
  return sendSuccess(res, { message: 'Group found', data: result });
});

/** POST /api/groups/:groupId/extend (leader) */
const extendDeadline = asyncHandler(async (req, res) => {
  const group = await groupService.extendDeadline(req.params.groupId, req.auth.userId);
  return sendSuccess(res, { message: 'Deadline extended', data: { group } });
});

/** POST /api/groups/:groupId/start-auction (leader, early start) */
const startAuctionEarly = asyncHandler(async (req, res) => {
  const group = await groupService.startAuctionEarly(req.params.groupId, req.auth.userId);
  return sendSuccess(res, { message: 'Auction started', data: { group } });
});

/** POST /api/groups/:groupId/cancel (leader, nobody paid yet) */
const cancelGroup = asyncHandler(async (req, res) => {
  const group = await groupService.cancelGroup(req.params.groupId, req.auth.userId);
  return sendSuccess(res, { message: 'Group cancelled', data: { group } });
});

/** GET /api/groups/:groupId/requests (leader) */
const listRequests = asyncHandler(async (req, res) => {
  const requests = await communityService.listJoinRequests(req.params.groupId, req.auth.userId);
  return sendSuccess(res, { message: 'Requests fetched', data: { requests } });
});

/** POST /api/groups/:groupId/requests/:userId (leader) — body { approve } */
const decideRequest = asyncHandler(async (req, res) => {
  const requests = await communityService.decideJoinRequest(
    req.params.groupId,
    req.auth.userId,
    req.params.userId,
    req.body.approve,
  );
  return sendSuccess(res, {
    message: req.body.approve ? 'Request approved' : 'Request declined',
    data: { requests },
  });
});

/** GET /api/groups/:groupId/leave-preview — what leaving would refund */
const leavePreview = asyncHandler(async (req, res) => {
  const terms = await membershipService.leavePreview(req.params.groupId, req.auth.userId);
  return sendSuccess(res, { message: 'Refund preview', data: { terms } });
});

/** POST /api/groups/:groupId/leave — leave and get the token back (PAY-3) */
const leaveGroup = asyncHandler(async (req, res) => {
  const terms = await membershipService.leaveGroup(req.params.groupId, req.auth.userId);
  const group = await groupService.getGroup(req.params.groupId, { userId: req.auth.userId });
  return sendSuccess(res, {
    message: 'You left the group. Your refund is on its way.',
    data: { terms, group },
  });
});

/** POST /api/groups/:groupId/waitlist — join the waitlist of a full group */
const joinWaitlist = asyncHandler(async (req, res) => {
  const { position } = await membershipService.joinWaitlist(
    req.params.groupId,
    req.auth.userId,
    req.body || {},
  );
  const group = await groupService.getGroup(req.params.groupId, {
    userId: req.auth.userId,
    code: req.body?.code,
  });
  return sendSuccess(res, {
    statusCode: 201,
    message: 'You are on the waitlist',
    data: { position, group },
  });
});

/** DELETE /api/groups/:groupId/waitlist */
const leaveWaitlist = asyncHandler(async (req, res) => {
  await membershipService.leaveWaitlist(req.params.groupId, req.auth.userId);
  return sendSuccess(res, { message: 'You left the waitlist' });
});

/** GET /api/groups/:groupId/auction?code= */
const getGroupAuction = asyncHandler(async (req, res) => {
  const auction = await groupService.getGroupAuction(req.params.groupId, {
    userId: req.auth?.userId,
    code: req.validatedQuery?.code,
  });
  return sendSuccess(res, { message: 'Auction fetched', data: { auction } });
});

/** POST /api/groups/:groupId/auction/decision { accept } */
const decideSingleBid = asyncHandler(async (req, res) => {
  const group = await groupService.decideSingleBid(
    req.params.groupId,
    req.auth.userId,
    req.body.accept,
  );
  return sendSuccess(res, {
    message: req.body.accept ? 'Offer accepted' : 'Group cancelled; tokens will be refunded',
    data: { group },
  });
});

module.exports = {
  getGroupAuction,
  decideSingleBid,
  leavePreview,
  leaveGroup,
  joinWaitlist,
  leaveWaitlist,
  createGroup,
  listGroups,
  similarGroups,
  myGroups,
  getGroup,
  joinByCode,
  extendDeadline,
  startAuctionEarly,
  cancelGroup,
  listRequests,
  decideRequest,
};
