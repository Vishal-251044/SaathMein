/**
 * Zod schemas for public city lookups and admin city/area management.
 */
const { z } = require('zod');

const objectId = z.string().regex(/^[a-f0-9]{24}$/, 'Invalid id');
const pincode = z
  .string()
  .trim()
  .regex(/^[1-9]\d{5}$/, 'Pincode must be 6 digits');
const translations = z
  .object({ hi: z.string().trim().max(80).optional(), mr: z.string().trim().max(80).optional() })
  .strict();
/** [longitude, latitude] */
const lngLat = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);

const matchLocationSchema = {
  query: z
    .object({
      latitude: z.coerce.number().min(-90).max(90).optional(),
      longitude: z.coerce.number().min(-180).max(180).optional(),
      pincode: pincode.optional(),
    })
    .refine(
      (q) => q.pincode || (q.latitude !== undefined && q.longitude !== undefined),
      'Send a pincode or latitude and longitude',
    ),
};

const cityIdParams = z.object({ cityId: objectId });

const createCitySchema = {
  body: z
    .object({
      name: z.string().trim().min(2).max(60),
      state: z.string().trim().min(2).max(60),
      nameTranslations: translations.optional(),
      location: lngLat.optional(),
      active: z.boolean().optional(),
    })
    .strict(),
};

const updateCitySchema = {
  params: cityIdParams,
  body: z
    .object({
      name: z.string().trim().min(2).max(60).optional(),
      state: z.string().trim().min(2).max(60).optional(),
      nameTranslations: translations.optional(),
      location: lngLat.optional(),
      active: z.boolean().optional(),
    })
    .strict()
    .refine((body) => Object.keys(body).length > 0, 'Nothing to update'),
};

const areaBody = {
  name: z.string().trim().min(2).max(80),
  pincodes: z.array(pincode).max(30),
  nameTranslations: translations.optional(),
};

const addAreaSchema = {
  params: cityIdParams,
  body: z.object({ ...areaBody, pincodes: areaBody.pincodes.default([]) }).strict(),
};

const updateAreaSchema = {
  params: z.object({ cityId: objectId, areaId: objectId }),
  body: z
    .object({
      name: areaBody.name.optional(),
      pincodes: areaBody.pincodes.optional(),
      nameTranslations: translations.optional(),
      active: z.boolean().optional(),
    })
    .strict()
    .refine((body) => Object.keys(body).length > 0, 'Nothing to update'),
};

module.exports = {
  matchLocationSchema,
  createCitySchema,
  updateCitySchema,
  addAreaSchema,
  updateAreaSchema,
};
