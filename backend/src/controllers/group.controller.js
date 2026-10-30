/**
 * Groups controller — /api/groups (PRD §10.3, §12.3).
 */
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const groupService = require('../services/groups/group.service');
const communityService = require('../services/groups/community.service');

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

module.exports = {
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
