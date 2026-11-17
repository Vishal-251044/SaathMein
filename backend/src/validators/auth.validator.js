/**
 * Zod schemas for app (buyer/seller) and staff auth requests.
 */
const { z } = require('zod');

/** App install id generated on the phone (random UUID-like string). */
const deviceId = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9-]{8,64}$/, 'deviceId must be 8–64 letters, digits or dashes')
  .optional();

/** Phone in E.164, e.g. +919876543210 (country rules are checked in the service). */
const phone = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, 'Phone must be in international format, e.g. +919876543210');

const refreshToken = z.string().trim().min(20).max(200);

const otpRequestSchema = { body: z.object({ phone, deviceId }) };

const otpVerifySchema = {
  body: z.object({ idToken: z.string().trim().min(100).max(4096), deviceId }),
};

/** Google sign-in (F4): Firebase ID token from the Google credential. */
const googleLoginSchema = {
  body: z.object({ idToken: z.string().trim().min(100).max(4096), deviceId }),
};

/** Add a verified phone to the signed-in account: Firebase phone ID token. */
const linkPhoneSchema = { body: z.object({ idToken: z.string().trim().min(100).max(4096) }) };

const refreshSchema = { body: z.object({ refreshToken }) };

const staffLoginSchema = {
  body: z.object({
    email: z.string().trim().toLowerCase().max(254).pipe(z.email('Enter a valid email')),
    password: z.string().min(1, 'Password is required').max(200),
  }),
};

const staffTwoFactorSchema = {
  body: z.object({
    challengeToken: z.string().trim().min(20).max(2048),
    // 6-digit authenticator code or 8-character backup code (with optional dash/space)
    code: z
      .string()
      .trim()
      .regex(/^(\d{6}|[A-Za-z0-9]{4}[-\s]?[A-Za-z0-9]{4})$/, 'Enter the 6-digit code'),
  }),
};

module.exports = {
  otpRequestSchema,
  otpVerifySchema,
  googleLoginSchema,
  linkPhoneSchema,
  refreshSchema,
  staffLoginSchema,
  staffTwoFactorSchema,
};
