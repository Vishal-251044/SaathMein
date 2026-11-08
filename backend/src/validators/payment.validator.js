/**
 * Zod schemas for /api/payments. The token amount is never accepted from the app.
 */
const { z } = require('zod');

const objectId = z.string().regex(/^[a-f0-9]{24}$/, 'Invalid id');

const createOrderSchema = {
  body: z
    .object({
      groupId: objectId,
      code: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z0-9]{6,12}$/)
        .optional(),
    })
    .strict(),
};

const verifySchema = {
  body: z
    .object({
      orderId: z
        .string()
        .trim()
        .regex(/^order_[A-Za-z0-9]+$/, 'Invalid order'),
      razorpayPaymentId: z
        .string()
        .trim()
        .regex(/^pay_[A-Za-z0-9]+$/, 'Invalid payment'),
      signature: z
        .string()
        .trim()
        .regex(/^[a-f0-9]{64}$/, 'Invalid signature'),
    })
    .strict(),
};

const paymentIdParams = { params: z.object({ paymentId: objectId }) };

const myPaymentsSchema = {
  query: z.object({
    groupId: objectId.optional(),
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
  }),
};

const waitlistSchema = {
  params: z.object({ groupId: objectId }),
  body: z
    .object({
      code: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z0-9]{6,12}$/)
        .optional(),
    })
    .strict()
    .optional(),
};

module.exports = {
  createOrderSchema,
  verifySchema,
  paymentIdParams,
  myPaymentsSchema,
  waitlistSchema,
};
