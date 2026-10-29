/**
 * Zod schemas for public product routes and admin catalog management (categories, products).
 * Money is always integer paise; percentages are basis points.
 */
const { z } = require('zod');
const { COMMISSION_TYPE, values } = require('../constants/enums');

const objectId = z.string().regex(/^[a-f0-9]{24}$/, 'Invalid id');
const paise = z.number().int().min(0).max(1_000_000_000_00); // up to ₹100 crore
const translations = z
  .object({ hi: z.string().trim().max(80).optional(), mr: z.string().trim().max(80).optional() })
  .strict();

/* ------------------------------- Public ------------------------------- */

const listProductsSchema = {
  query: z.object({
    q: z.string().trim().max(100).optional(),
    categoryId: objectId.optional(),
    cityId: objectId.optional(),
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
  }),
};

const productParams = z.object({ productId: objectId });

const getProductSchema = {
  params: productParams,
  query: z.object({ cityId: objectId.optional() }),
};

const priceHistorySchema = {
  params: productParams,
  query: z.object({
    cityId: objectId.optional(),
    variantKey: z.string().trim().max(80).optional(),
  }),
};

/* ----------------------------- Categories ----------------------------- */

const rulesSchema = z
  .object({
    minSize: z.number().int().min(2).max(1000).optional(),
    maxSize: z.number().int().min(2).max(1000).optional(),
    tokenAmountPaise: paise.optional(),
    deadlineDays: z
      .object({ min: z.number().int().min(1).max(90), max: z.number().int().min(1).max(90) })
      .partial()
      .strict()
      .optional(),
    auction: z
      .object({
        durationHours: z.number().int().min(1).max(168),
        minDurationHours: z.number().int().min(1).max(168),
        maxDurationHours: z.number().int().min(1).max(168),
        minStepPaise: paise,
        minStepBps: z.number().int().min(0).max(10000),
        antiSnipeMinutes: z.number().int().min(0).max(60),
        maxExtensions: z.number().int().min(0).max(50),
        minDealers: z.number().int().min(1).max(20),
        priceValidityDays: z.number().int().min(1).max(60),
      })
      .partial()
      .strict()
      .optional(),
    commission: z
      .object({
        type: z.enum(values(COMMISSION_TYPE)),
        value: z.number().int().min(0).max(1_000_000_000),
      })
      .partial()
      .strict()
      .optional(),
    backoutFeePaise: paise.optional(),
  })
  .strict()
  .refine((r) => r.minSize === undefined || r.maxSize === undefined || r.minSize <= r.maxSize, {
    message: 'Minimum group size must not be more than the maximum',
    path: ['minSize'],
  })
  .refine(
    (r) => !r.commission || r.commission.type !== 'percent' || (r.commission.value ?? 0) <= 10000,
    { message: 'Percentage commission must be at most 100%', path: ['commission', 'value'] },
  );

const categoryFields = {
  name: z.string().trim().min(2).max(80),
  nameTranslations: translations.optional(),
  parentId: objectId.nullable().optional(),
  icon: z
    .string()
    .trim()
    .max(40)
    .regex(/^[a-z0-9-]*$/, 'Use a Lucide icon name')
    .optional(),
  featuredBrands: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
  order: z.number().int().min(0).max(1000).optional(),
  active: z.boolean().optional(),
  rules: rulesSchema.optional(),
};

const createCategorySchema = { body: z.object(categoryFields).strict() };

const updateCategorySchema = {
  params: z.object({ categoryId: objectId }),
  body: z
    .object({ ...categoryFields, name: categoryFields.name.optional() })
    .strict()
    .refine((body) => Object.keys(body).length > 0, 'Nothing to update'),
};

/* ------------------------------ Products ------------------------------ */

const adminListProductsSchema = {
  query: z.object({
    q: z.string().trim().max(100).optional(),
    categoryId: objectId.optional(),
    status: z.enum(['all', 'active', 'inactive', 'review']).optional(),
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
  }),
};

const priceEntry = z
  .object({
    cityId: objectId,
    variantKey: z.string().trim().max(80).nullable().optional(),
    mrpPaise: paise.nullable().optional(),
    exShowroomPaise: paise.nullable().optional(),
    onRoadPaise: paise.nullable().optional(),
  })
  .strict()
  .refine((p) => p.mrpPaise != null || p.exShowroomPaise != null || p.onRoadPaise != null, {
    message: 'Each price row needs at least one of MRP, ex-showroom or on-road',
  });

const productFields = {
  categoryId: objectId,
  brand: z.string().trim().min(1).max(60),
  model: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
  specs: z.record(z.string().trim().min(1).max(60), z.string().trim().max(200)).optional(),
  variants: z
    .array(
      z
        .object({
          key: z.string().trim().max(80).optional(),
          name: z.string().trim().min(1).max(80),
          attrs: z.record(z.string().trim().min(1).max(40), z.string().trim().max(80)).optional(),
        })
        .strict(),
    )
    .max(50)
    .optional(),
  prices: z.array(priceEntry).max(500).optional(),
  active: z.boolean().optional(),
};

const createProductSchema = { body: z.object(productFields).strict() };

const updateProductSchema = {
  params: productParams,
  body: z
    .object({
      ...productFields,
      categoryId: productFields.categoryId.optional(),
      brand: productFields.brand.optional(),
      model: productFields.model.optional(),
    })
    .strict()
    .refine((body) => Object.keys(body).length > 0, 'Nothing to update'),
};

const productImageSchema = {
  params: productParams,
  body: z
    .object({
      publicId: z.string().trim().min(1).max(200),
      version: z.coerce.number().int().positive(),
      signature: z
        .string()
        .trim()
        .regex(/^[a-f0-9]{40,64}$/, 'Invalid signature'),
    })
    .strict(),
};

const removeProductImageSchema = {
  params: productParams,
  query: z.object({ url: z.string().trim().url().max(500) }),
};

const importProductsSchema = {
  query: z.object({ dryRun: z.enum(['true', 'false']).optional() }),
};

module.exports = {
  listProductsSchema,
  getProductSchema,
  priceHistorySchema,
  productParams,
  createCategorySchema,
  updateCategorySchema,
  adminListProductsSchema,
  createProductSchema,
  updateProductSchema,
  productImageSchema,
  removeProductImageSchema,
  importProductsSchema,
};
