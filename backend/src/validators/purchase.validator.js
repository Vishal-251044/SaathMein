/**
 * Zod schemas for purchases, reviews, dealer payouts and admin commissions (Day 10).
 */
const { z } = require('zod');
const { PURCHASE_STATUS, values } = require('../constants/enums');

const objectId = z.string().regex(/^[a-f0-9]{24}$/, 'Invalid id');
const pageParams = {
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
};
const monthKey = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must look like 2026-10');
const isoDate = z.union([z.iso.datetime({ offset: true }), z.iso.date()]);

const purchaseIdParams = z.object({ purchaseId: objectId });

/* ---------------------------------- Buyer ---------------------------------- */

const invoiceUploadParamsSchema = { params: purchaseIdParams };

const submitInvoiceSchema = {
  params: purchaseIdParams,
  body: z
    .object({
      publicId: z.string().min(1).max(300),
      version: z.number().int().positive(),
      signature: z.string().min(10).max(100),
      format: z.enum(['jpg', 'jpeg', 'png', 'pdf']).optional(),
    })
    .strict(),
};

const createReviewSchema = {
  body: z
    .object({
      purchaseId: objectId,
      rating: z.number().int().min(1).max(5),
      text: z.string().trim().max(1000).optional(),
    })
    .strict(),
};

/* ---------------------------------- Dealer --------------------------------- */

// QR payload (SM1.<code>.<signature>) or the bare 10-character code
const dealCodeInputSchema = {
  body: z.object({ code: z.string().trim().min(6, 'Enter the deal code').max(80) }).strict(),
};

const sellerPurchasesSchema = {
  query: z.object({
    status: z.enum(['open', ...values(PURCHASE_STATUS)]).optional(),
    ...pageParams,
  }),
};

const objectInvoiceSchema = {
  params: purchaseIdParams,
  body: z
    .object({ reason: z.string().trim().min(10, 'Tell us why (at least 10 characters)').max(500) })
    .strict(),
};

const payoutsSchema = { query: z.object(pageParams) };

const invoiceIdParams = { params: z.object({ invoiceId: objectId }) };

/* ---------------------------------- Admin ---------------------------------- */

const adminCommissionsSchema = {
  query: z.object({
    cityId: objectId.optional(),
    categoryId: objectId.optional(),
    sellerId: objectId.optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
    format: z.enum(['csv']).optional(),
    ...pageParams,
  }),
};

const adminInvoicesSchema = {
  query: z.object({ month: monthKey.optional(), sellerId: objectId.optional(), ...pageParams }),
};

const generateInvoicesSchema = { body: z.object({ month: monthKey }).strict() };

module.exports = {
  invoiceUploadParamsSchema,
  submitInvoiceSchema,
  createReviewSchema,
  dealCodeInputSchema,
  sellerPurchasesSchema,
  objectInvoiceSchema,
  purchaseIdParams,
  payoutsSchema,
  invoiceIdParams,
  adminCommissionsSchema,
  adminInvoicesSchema,
  generateInvoicesSchema,
};
