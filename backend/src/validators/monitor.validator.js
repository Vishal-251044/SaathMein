/**
 * Zod schemas for the Owner / Admin Console monitors, staff actions, alerts and Team
 * (PRD §10.11, MON-1..4, ADL-1). Every action carries a reason note for the audit log.
 */
const { z } = require('zod');
const { QUEUE_NAMES } = require('../jobs/queues');
const { INVITABLE_ROLES } = require('../models/staffInvite.model');

const objectId = z.string().regex(/^[a-f0-9]{24}$/, 'Invalid id');
const page = z.string().regex(/^\d+$/).optional();
const scope = {
  cityId: objectId.optional(),
  categoryId: objectId.optional(),
};
const reason = z.string().trim().min(10, 'Write a reason (at least 10 characters)').max(1000);
const email = z.string().trim().toLowerCase().max(254).pipe(z.email('Enter a valid email'));
const password = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(200)
  .regex(/[A-Za-z]/, 'Password needs a letter')
  .regex(/\d/, 'Password needs a number');

const groupParams = z.object({ groupId: objectId });
const paymentParams = z.object({ paymentId: objectId });
const sellerParams = z.object({ sellerId: objectId });
const userParams = z.object({ userId: objectId });

const overviewSchema = { query: z.object(scope) };
const auctionsSchema = {
  query: z.object({ status: z.enum(['live', 'recent']).optional(), ...scope, page, limit: page }),
};
const groupIdSchema = { params: groupParams };
const dealersSchema = { query: z.object({ ...scope, page, limit: page }) };
const buyersSchema = {
  query: z.object({ q: z.string().trim().max(40).optional(), page, limit: page }),
};
const paymentMonitorSchema = {
  query: z.object({ from: z.iso.date().optional(), to: z.iso.date().optional() }),
};
const paymentsSchema = {
  query: z.object({
    view: z
      .enum(['all', 'refunds_failed', 'refunds_pending', 'held', 'transfer_failed'])
      .optional(),
    q: z.string().trim().max(60).optional(),
    page,
    limit: page,
  }),
};
const retryJobsSchema = {
  params: z.object({ queue: z.enum(Object.values(QUEUE_NAMES)) }),
  body: z.object({ reason }).strict(),
};

/* ---- actions ---- */
const reasonOnly = (params) => ({ params, body: z.object({ reason }).strict() });
const auctionReasonSchema = reasonOnly(groupParams);
const extendAuctionSchema = {
  params: groupParams,
  body: z.object({ hours: z.number().int().min(1).max(72), reason }).strict(),
};
const forceRunnerUpSchema = {
  params: groupParams,
  body: z.object({ reason, penalise: z.boolean() }).strict(),
};
const extendGroupSchema = {
  params: groupParams,
  body: z.object({ days: z.number().int().min(1).max(30), reason }).strict(),
};
const paymentReasonSchema = reasonOnly(paymentParams);
const manualRefundSchema = {
  params: paymentParams,
  body: z.object({ amountPaise: z.number().int().min(1).max(100_000_000), reason }).strict(),
};
const penaliseDealerSchema = {
  params: sellerParams,
  body: z
    .object({
      type: z.enum(['warning', 'auction_suspension']),
      days: z.number().int().min(1).max(365).optional(),
      reason,
    })
    .strict()
    .refine((body) => body.type !== 'auction_suspension' || body.days, {
      message: 'Choose how many days to suspend',
      path: ['days'],
    }),
};
const liftPenaltySchema = {
  params: z.object({ sellerId: objectId, penaltyId: objectId }),
  body: z.object({ reason }).strict(),
};
const buyerStatusSchema = {
  params: userParams,
  body: z.object({ active: z.boolean(), reason }).strict(),
};

/* ---- alerts ---- */
const alertsSchema = {
  query: z.object({
    status: z.enum(['open', 'ack', 'closed', 'active']).optional(),
    type: z
      .enum(['payment', 'auction', 'suspicious_bidding', 'reconciliation', 'system'])
      .optional(),
    page,
    limit: page,
  }),
};
const alertActionSchema = {
  params: z.object({ alertId: objectId }),
  body: z.object({ action: z.enum(['ack', 'close']) }).strict(),
};

/* ---- team ---- */
const inviteStaffSchema = {
  body: z.object({ email, role: z.enum(INVITABLE_ROLES) }).strict(),
};
const inviteIdSchema = { params: z.object({ inviteId: objectId }) };
const changeRoleSchema = {
  params: userParams,
  body: z.object({ role: z.enum(INVITABLE_ROLES), reason }).strict(),
};
const staffStatusSchema = {
  params: userParams,
  body: z.object({ active: z.boolean(), reason }).strict(),
};
const inviteTokenSchema = {
  params: z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{20,100}$/) }),
};
const acceptInviteSchema = {
  params: inviteTokenSchema.params,
  body: z.object({ name: z.string().trim().min(2).max(80), password }).strict(),
};

module.exports = {
  overviewSchema,
  auctionsSchema,
  groupIdSchema,
  dealersSchema,
  buyersSchema,
  paymentMonitorSchema,
  paymentsSchema,
  retryJobsSchema,
  auctionReasonSchema,
  extendAuctionSchema,
  forceRunnerUpSchema,
  extendGroupSchema,
  paymentReasonSchema,
  manualRefundSchema,
  penaliseDealerSchema,
  liftPenaltySchema,
  buyerStatusSchema,
  alertsSchema,
  alertActionSchema,
  inviteStaffSchema,
  inviteIdSchema,
  changeRoleSchema,
  staffStatusSchema,
  inviteTokenSchema,
  acceptInviteSchema,
};
