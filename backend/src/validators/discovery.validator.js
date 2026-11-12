/**
 * Zod schemas for the home feed, wallet / referral and Admin → Curation (Day 11).
 * Admin → Settings validates each section in services/admin/adminSettings.service.js.
 */
const { z } = require('zod');
const { CURATION_TYPE, values } = require('../constants/enums');

const objectId = z.string().regex(/^[a-f0-9]{24}$/, 'Invalid id');
const pageParams = {
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
};
const isoDate = z.union([z.iso.datetime({ offset: true }), z.iso.date()]);
const translations = z
  .object({ hi: z.string().trim().max(160).optional(), mr: z.string().trim().max(160).optional() })
  .strict();
// In-app paths only — a banner can never send buyers to an outside site
const inAppPath = z
  .string()
  .trim()
  .regex(
    /^\/(category|group|product|groups\/browse)(\/[A-Za-z0-9_-]+)?(\?[A-Za-z0-9=&_-]*)?$/,
    'Use an in-app path like /category/<id>',
  );

const homeFeedSchema = { query: z.object({ cityId: objectId.optional() }) };

const walletSchema = { query: z.object(pageParams) };

const applyReferralSchema = {
  body: z
    .object({
      code: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z0-9]{6,12}$/, 'Enter the referral code'),
    })
    .strict(),
};

const curationItemBody = z
  .object({
    type: z.enum(values(CURATION_TYPE)),
    cityId: objectId.nullable().optional(),
    title: z.string().trim().max(80).optional(),
    titleTranslations: translations.optional(),
    subtitle: z.string().trim().max(160).optional(),
    subtitleTranslations: translations.optional(),
    image: z
      .object({
        publicId: z.string().min(1).max(300),
        version: z.number().int().positive(),
        signature: z.string().min(10).max(100),
      })
      .strict()
      .nullable()
      .optional(),
    linkPath: inAppPath.nullable().optional(),
    groupId: objectId.nullable().optional(),
    order: z.number().int().min(0).max(1000).optional(),
    active: z.boolean().optional(),
    startsAt: isoDate.nullable().optional(),
    endsAt: isoDate.nullable().optional(),
  })
  .strict();

const listCurationSchema = { query: z.object({ type: z.enum(values(CURATION_TYPE)).optional() }) };
const createCurationSchema = { body: curationItemBody };
const updateCurationSchema = {
  params: z.object({ itemId: objectId }),
  body: curationItemBody.omit({ type: true }).partial(),
};
const curationIdParams = { params: z.object({ itemId: objectId }) };

const categoryOrderSchema = {
  body: z
    .object({
      order: z
        .array(z.object({ id: objectId, order: z.number().int().min(0).max(1000) }).strict())
        .min(1)
        .max(200),
    })
    .strict(),
};

const settingsKeyParams = {
  params: z.object({
    key: z.enum(['groups', 'auctions', 'payments', 'purchases', 'billing', 'referrals', 'flags']),
  }),
};

module.exports = {
  homeFeedSchema,
  walletSchema,
  applyReferralSchema,
  listCurationSchema,
  createCurationSchema,
  updateCurationSchema,
  curationIdParams,
  categoryOrderSchema,
  settingsKeyParams,
};
