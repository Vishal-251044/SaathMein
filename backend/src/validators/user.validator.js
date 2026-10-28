/**
 * Zod schemas for /api/users/me (profile, interests, avatar).
 */
const { z } = require('zod');
const { BUYING_TIMELINE, LANGUAGE, values } = require('../constants/enums');

const objectId = z.string().regex(/^[a-f0-9]{24}$/, 'Invalid id');
// Budgets up to ₹10 crore, in integer paise
const paise = z.number().int().min(0).max(10_000_000_000);

const updateProfileSchema = {
  body: z
    .object({
      name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80).optional(),
      language: z.enum(values(LANGUAGE)).optional(),
      cityId: objectId.optional(),
      area: z.string().trim().max(80).nullable().optional(),
      pincode: z
        .string()
        .trim()
        .regex(/^[1-9]\d{5}$/, 'Pincode must be 6 digits')
        .nullable()
        .optional(),
    })
    .strict()
    .refine((body) => Object.keys(body).length > 0, 'Nothing to update'),
};

const saveInterestsSchema = {
  body: z
    .object({
      categories: z.array(objectId).max(20).default([]),
      brands: z.array(z.string().trim().min(1).max(60)).max(40).default([]),
      budgetMinPaise: paise.optional(),
      budgetMaxPaise: paise.optional(),
      timeline: z.enum(values(BUYING_TIMELINE)).optional(),
    })
    .strict()
    .refine(
      (body) =>
        body.budgetMinPaise === undefined ||
        body.budgetMaxPaise === undefined ||
        body.budgetMinPaise <= body.budgetMaxPaise,
      { message: 'Minimum budget must not be more than the maximum', path: ['budgetMinPaise'] },
    ),
};

const setAvatarSchema = {
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

module.exports = { updateProfileSchema, saveInterestsSchema, setAvatarSchema };
