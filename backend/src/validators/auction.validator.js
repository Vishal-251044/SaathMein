/**
 * Zod schemas for dealer auctions and seller-led deals (/api/seller/auctions, /api/seller/deals).
 * Money is integer paise; the server re-checks every rule (ceiling, step, breakdown total).
 */
const { z } = require('zod');

const objectId = z.string().regex(/^[a-f0-9]{24}$/, 'Invalid id');
// Up to ₹1,000 crore per unit — far above any real product, blocks overflow tricks
const paise = z.number().int().min(0).max(100_000_000_000);
const pageParams = {
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
};
const groupIdParams = z.object({ groupId: objectId });

const listAuctionsSchema = {
  query: z.object({ tab: z.enum(['live', 'upcoming', 'won']).default('live'), ...pageParams }),
};

const auctionParamsSchema = { params: groupIdParams };

// Joining = accepting the commitment (AUC-2): delivery date + price validity 7–15 days
const joinAuctionSchema = {
  params: groupIdParams,
  body: z
    .object({
      acceptCommitment: z.literal(true, { error: 'Accept the commitment to join' }),
      deliveryBy: z.union([z.iso.datetime({ offset: true }), z.iso.date()]),
      priceValidityDays: z.number().int().min(7).max(15),
    })
    .strict(),
};

// All-inclusive breakdown (AUC-3): must add up to pricePerUnitPaise (checked in the service)
const breakdown = z
  .object({
    basePaise: paise,
    discountPaise: paise.optional(),
    taxPaise: paise.optional(),
    rtoPaise: paise.optional(),
    insurancePaise: paise.optional(),
    accessoriesPaise: paise.optional(),
    handlingPaise: paise.optional(),
    warrantyPaise: paise.optional(),
    deliveryPaise: paise.optional(),
  })
  .strict();

const placeBidSchema = {
  params: groupIdParams,
  body: z
    .object({
      pricePerUnitPaise: paise.min(100),
      breakdown,
      inclusions: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
      terms: z.string().trim().max(2000).optional(),
    })
    .strict(),
};

const backOutSchema = {
  params: groupIdParams,
  body: z
    .object({ reason: z.string().trim().min(10, 'Tell us why (at least 10 characters)').max(500) })
    .strict(),
};

const runnerUpSchema = {
  params: groupIdParams,
  body: z.object({ accept: z.boolean() }).strict(),
};

// Seller-led deal (AUC-9): 2–4 tiers, discount in basis points (500 = 5%)
const tier = z
  .object({
    size: z.number().int().min(2).max(500),
    discountBps: z.number().int().min(1).max(5000),
  })
  .strict();

const createDealSchema = {
  body: z
    .object({
      productId: objectId,
      variantKey: z.string().trim().min(1).max(60).nullable().optional(),
      cityId: objectId,
      basePricePaise: paise.min(100),
      tiers: z.array(tier).min(2).max(4),
      deadlineDays: z.number().int().min(1).max(60),
      note: z.string().trim().max(500).optional(),
    })
    .strict(),
};

const listDealsSchema = { query: z.object(pageParams) };

module.exports = {
  listAuctionsSchema,
  auctionParamsSchema,
  joinAuctionSchema,
  placeBidSchema,
  backOutSchema,
  runnerUpSchema,
  createDealSchema,
  listDealsSchema,
};
