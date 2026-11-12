/**
 * Zod schemas for reports, disputes and public dealer profiles (Day 12, TRU-2 to TRU-5).
 */
const { z } = require('zod');
const {
  DISPUTE_OUTCOME,
  DISPUTE_STATUS,
  DISPUTE_TYPE,
  REPORT_REASON,
  REPORT_STATUS,
  REPORT_TARGET,
  values,
} = require('../constants/enums');

const objectId = z.string().regex(/^[a-f0-9]{24}$/, 'Invalid id');
const pageParams = {
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
};
const evidenceFile = z
  .object({
    publicId: z.string().min(1).max(300),
    version: z.number().int().positive(),
    signature: z.string().min(10).max(100),
    format: z.enum(['jpg', 'jpeg', 'png', 'pdf']).optional(),
  })
  .strict();
const note = z.string().trim().min(10, 'Write a reason (at least 10 characters)').max(2000);

const createReportSchema = {
  body: z
    .object({
      targetType: z.enum(values(REPORT_TARGET)),
      targetId: objectId,
      groupId: objectId.optional(),
      reason: z.enum(values(REPORT_REASON)),
      details: z.string().trim().max(1000).optional(),
    })
    .strict(),
};

const openDisputeSchema = {
  body: z
    .object({
      purchaseId: objectId,
      // invoice_objection is opened by the system when a dealer objects
      type: z.enum(values(DISPUTE_TYPE).filter((type) => type !== DISPUTE_TYPE.INVOICE_OBJECTION)),
      description: z
        .string()
        .trim()
        .min(20, 'Tell us what happened (at least 20 characters)')
        .max(2000),
      quotedPricePaise: z.number().int().min(0).max(100_000_000_000).optional(),
      evidence: z.array(evidenceFile).max(6).optional(),
      chatMessageIds: z.array(objectId).max(20).optional(),
    })
    .strict(),
};

const disputeIdParams = { params: z.object({ disputeId: objectId }) };
const myDisputesSchema = { query: z.object(pageParams) };

const sellerDisputesSchema = {
  query: z.object({
    status: z.enum(['open', ...values(DISPUTE_STATUS)]).optional(),
    ...pageParams,
  }),
};

const respondDisputeSchema = {
  params: z.object({ disputeId: objectId }),
  body: z
    .object({
      text: z.string().trim().min(10, 'Write your answer (at least 10 characters)').max(2000),
      evidence: z.array(evidenceFile).max(6).optional(),
    })
    .strict(),
};

const adminDisputesSchema = {
  query: z.object({
    status: z.enum(['open', ...values(DISPUTE_STATUS)]).optional(),
    ...pageParams,
  }),
};

const decideDisputeSchema = {
  params: z.object({ disputeId: objectId }),
  body: z
    .object({
      outcome: z.enum(values(DISPUTE_OUTCOME)),
      creditPaise: z.number().int().positive().optional(),
      penalties: z
        .array(z.enum(['warning', 'rating_penalty', 'auction_suspension']))
        .max(3)
        .optional(),
      suspensionDays: z.number().int().min(1).max(365).optional(),
      note,
    })
    .strict(),
};

const adminReportsSchema = {
  query: z.object({
    status: z.enum(values(REPORT_STATUS)).optional(),
    targetType: z.enum(values(REPORT_TARGET)).optional(),
    ...pageParams,
  }),
};

const decideReportSchema = {
  params: z.object({ reportId: objectId }),
  body: z
    .object({
      action: z.enum([
        'dismiss',
        'hide_content',
        'restore_content',
        'warn_seller',
        'suspend_account',
      ]),
      note,
    })
    .strict(),
};

const sellerIdParams = { params: z.object({ sellerId: objectId }) };
const sellerReviewsSchema = {
  params: z.object({ sellerId: objectId }),
  query: z.object(pageParams),
};

module.exports = {
  createReportSchema,
  openDisputeSchema,
  disputeIdParams,
  myDisputesSchema,
  sellerDisputesSchema,
  respondDisputeSchema,
  adminDisputesSchema,
  decideDisputeSchema,
  adminReportsSchema,
  decideReportSchema,
  sellerIdParams,
  sellerReviewsSchema,
};
