/**
 * Zod schemas for groups (/api/groups) and the admin groups list.
 */
const { z } = require('zod');
const { GROUP_STATUS, GROUP_VISIBILITY, values } = require('../constants/enums');

const objectId = z.string().regex(/^[a-f0-9]{24}$/, 'Invalid id');
const pageParams = {
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
};
const inviteCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{6,12}$/, 'Enter the invite code');

const groupIdParams = z.object({ groupId: objectId });

const createGroupSchema = {
  body: z
    .object({
      productId: objectId,
      variantKey: z.string().trim().min(1).max(60).nullable().optional(), // null = any variant
      targetSize: z.number().int().min(2).max(500),
      deadlineDays: z.number().int().min(1).max(60),
      visibility: z.enum(values(GROUP_VISIBILITY)).default(GROUP_VISIBILITY.PUBLIC),
      requiresApproval: z.boolean().optional(),
      note: z.string().trim().max(500).optional(),
    })
    .strict(),
};

const listGroupsSchema = {
  query: z.object({
    cityId: objectId.optional(),
    categoryId: objectId.optional(),
    productId: objectId.optional(),
    status: z
      .enum(['live', GROUP_STATUS.OPEN, GROUP_STATUS.FULL, GROUP_STATUS.AUCTION_LIVE])
      .optional(),
    sort: z.enum(['ending_soon', 'filling', 'newest']).optional(),
    ...pageParams,
  }),
};

const similarGroupsSchema = {
  query: z.object({ productId: objectId, variantKey: z.string().trim().max(60).optional() }),
};

const myGroupsSchema = {
  query: z.object({ role: z.enum(['joined', 'leading']).optional(), ...pageParams }),
};

const getGroupSchema = {
  params: groupIdParams,
  query: z.object({ code: inviteCode.optional() }),
};

const joinByCodeSchema = { body: z.object({ code: inviteCode }).strict() };

const decideRequestSchema = {
  params: z.object({ groupId: objectId, userId: objectId }),
  body: z.object({ approve: z.boolean() }).strict(),
};

const adminListGroupsSchema = {
  query: z.object({
    cityId: objectId.optional(),
    categoryId: objectId.optional(),
    status: z.enum(values(GROUP_STATUS)).optional(),
    visibility: z.enum(values(GROUP_VISIBILITY)).optional(),
    from: z.iso.date().optional(), // created on or after (YYYY-MM-DD)
    to: z.iso.date().optional(), // created on or before
    q: z.string().trim().max(100).optional(),
    format: z.enum(['json', 'csv']).optional(),
    ...pageParams,
  }),
};

const singleBidDecisionSchema = {
  params: groupIdParams,
  body: z.object({ accept: z.boolean() }).strict(),
};

module.exports = {
  singleBidDecisionSchema,
  groupIdParams,
  createGroupSchema,
  listGroupsSchema,
  similarGroupsSchema,
  myGroupsSchema,
  getGroupSchema,
  joinByCodeSchema,
  decideRequestSchema,
  adminListGroupsSchema,
};
