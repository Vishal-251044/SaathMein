/**
 * Zod schemas for the dealer dashboard (/api/seller) and admin seller review.
 */
const { z } = require('zod');
const Seller = require('../models/seller.model');

const objectId = z.string().regex(/^[a-f0-9]{24}$/, 'Invalid id');
const email = z.string().trim().toLowerCase().max(254).pipe(z.email('Enter a valid email'));
const password = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(200)
  .regex(/[A-Za-z]/, 'Password needs a letter')
  .regex(/\d/, 'Password needs a number');
const indianPhone = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s-]/g, ''))
  .transform((value) => (/^[6-9]\d{9}$/.test(value) ? `+91${value}` : value))
  .pipe(z.string().regex(/^\+91[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'));
const personName = z.string().trim().min(2, 'Name must be at least 2 characters').max(80);
const businessName = z
  .string()
  .trim()
  .min(4, 'Business name must be at least 4 characters')
  .max(120);
/** [longitude, latitude] */
const lngLat = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);

/* ---------------------------------- Auth ---------------------------------- */

const registerSchema = {
  body: z.object({ name: personName, email, password, businessName, phone: indianPhone }).strict(),
};

const loginSchema = {
  body: z.object({ email, password: z.string().min(1, 'Password is required').max(200) }).strict(),
};

const verifyEmailSchema = {
  body: z
    .object({
      code: z
        .string()
        .trim()
        .regex(/^\d{6}$/, 'Enter the 6-digit code'),
    })
    .strict(),
};

const inviteTokenParams = {
  params: z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{30,80}$/, 'Invalid link') }),
};

const acceptInviteSchema = {
  body: z
    .object({
      token: z.string().regex(/^[A-Za-z0-9_-]{30,80}$/, 'Invalid link'),
      name: personName.optional(),
      password,
    })
    .strict(),
};

/* --------------------------------- Profile -------------------------------- */

const updateProfileSchema = {
  body: z
    .object({
      businessName: businessName.optional(),
      contactName: personName.optional(),
      contactPhone: indianPhone.optional(),
      cities: z.array(objectId).min(1, 'Choose at least one city').max(20).optional(),
      categories: z.array(objectId).min(1, 'Choose at least one category').max(30).optional(),
      location: lngLat.optional(),
    })
    .strict()
    .refine((body) => Object.keys(body).length > 0, 'Nothing to update'),
};

/* ----------------------------------- KYC ---------------------------------- */

const docType = z.enum(Seller.KYC_DOC_TYPES);

const kycUploadParamsSchema = { body: z.object({ docType }).strict() };

const kycSchema = {
  body: z
    .object({
      businessName,
      businessType: z.enum(Seller.BUSINESS_TYPES),
      contactName: personName,
      contactPhone: indianPhone,
      gstin: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, 'Enter a valid 15-character GSTIN'),
      pan: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z]{5}\d{4}[A-Z]$/, 'Enter a valid 10-character PAN'),
      address: z
        .object({
          line1: z.string().trim().min(3).max(100),
          line2: z.string().trim().max(100).optional(),
          area: z.string().trim().max(80).optional(),
          cityId: objectId,
          state: z.string().trim().min(2).max(32).optional(),
          pincode: z
            .string()
            .trim()
            .regex(/^[1-9]\d{5}$/, 'Pincode must be 6 digits'),
        })
        .strict(),
      documents: z
        .array(
          z
            .object({
              type: docType,
              publicId: z.string().trim().min(1).max(200),
              version: z.coerce.number().int().positive(),
              signature: z
                .string()
                .trim()
                .regex(/^[a-f0-9]{40,64}$/, 'Invalid upload'),
              format: z.enum(['jpg', 'jpeg', 'png', 'pdf']).optional(),
            })
            .strict(),
        )
        .min(1)
        .max(15),
      bank: z
        .object({
          accountNumber: z
            .string()
            .trim()
            .regex(/^\d{9,18}$/, 'Account number must be 9–18 digits'),
          ifsc: z
            .string()
            .trim()
            .toUpperCase()
            .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Enter a valid 11-character IFSC'),
          beneficiaryName: z.string().trim().min(3).max(120),
        })
        .strict(),
    })
    .strict(),
};

/* ---------------------------------- Team ---------------------------------- */

const inviteSchema = { body: z.object({ email, name: personName.optional() }).strict() };
const inviteIdParams = { params: z.object({ inviteId: objectId }) };
const memberIdParams = { params: z.object({ userId: objectId }) };

/* ---------------------------- Product requests ---------------------------- */

const productRequestSchema = {
  body: z
    .object({
      brand: z.string().trim().min(1).max(60),
      model: z.string().trim().min(1).max(120),
      categoryId: objectId.optional(),
      note: z.string().trim().max(500).optional(),
    })
    .strict(),
};

/* --------------------------------- Public --------------------------------- */

const publicSellersSchema = {
  query: z.object({
    cityId: objectId,
    categoryId: objectId.optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
  }),
};

/* --------------------------------- Admin ---------------------------------- */

const adminListSellersSchema = {
  query: z.object({
    kycStatus: z.enum(['not_submitted', 'pending', 'approved', 'rejected']).optional(),
    q: z.string().trim().max(100).optional(),
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
  }),
};

const sellerIdParams = z.object({ sellerId: objectId });

const rejectKycSchema = {
  params: sellerIdParams,
  body: z
    .object({
      reason: z
        .string()
        .trim()
        .min(10, 'Explain what the dealer must fix (10+ characters)')
        .max(1000),
    })
    .strict(),
};

const approveKycSchema = {
  params: sellerIdParams,
  body: z.object({ note: z.string().trim().max(1000).optional() }).strict(),
};

const adminProductRequestsSchema = {
  query: z.object({
    status: z.enum(['open', 'added', 'rejected', 'all']).optional(),
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
  }),
};

const updateProductRequestSchema = {
  params: z.object({ requestId: objectId }),
  body: z
    .object({ status: z.enum(['open', 'added', 'rejected']), productId: objectId.optional() })
    .strict(),
};

const auditLogsSchema = {
  query: z.object({
    targetType: z.string().trim().max(40).optional(),
    targetId: z.string().trim().max(40).optional(),
    actorId: objectId.optional(),
    // Prefix of an action name, e.g. "auction." (letters, digits, dot, underscore only)
    action: z
      .string()
      .trim()
      .regex(/^[a-z0-9._]{1,80}$/i, 'Invalid action')
      .optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    format: z.enum(['json', 'csv']).optional(),
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
  }),
};

module.exports = {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  inviteTokenParams,
  acceptInviteSchema,
  updateProfileSchema,
  kycUploadParamsSchema,
  kycSchema,
  inviteSchema,
  inviteIdParams,
  memberIdParams,
  productRequestSchema,
  publicSellersSchema,
  adminListSellersSchema,
  sellerIdParams,
  rejectKycSchema,
  approveKycSchema,
  adminProductRequestsSchema,
  updateProductRequestSchema,
  auditLogsSchema,
};
