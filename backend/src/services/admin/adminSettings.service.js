/**
 * Admin → Settings (F35, PRD §10.11): platform-wide business values and feature flags.
 * Each section is validated with Zod, stored as one `settings` document (merged over the
 * code defaults) and the settings cache is cleared. Per-category values (token, back-out
 * fee, auction duration, bid step, anti-sniping, minimum dealers, commission) stay on the
 * category (Admin → Categories). Every change is audited with before / after.
 */
const { z } = require('zod');
const Setting = require('../../models/setting.model');
const ApiError = require('../../utils/ApiError');
const { DEFAULTS, getSettings, clearSettingsCache } = require('../settings.service');

const paise = z.number().int().min(0).max(100_000_000);
const hours = z
  .number()
  .int()
  .min(1)
  .max(24 * 30);
const days = z.number().int().min(1).max(365);
const bps = z.number().int().min(0).max(10_000);

/** Editable sections and their rules (partial updates). */
const SECTION_SCHEMAS = Object.freeze({
  groups: z
    .object({
      earlyStartThresholdBps: bps.min(5000),
      leaderDecisionHours: hours,
      extensionDays: days.max(30),
      maxOpenGroupsPerLeader: z.number().int().min(1).max(50),
    })
    .partial()
    .strict(),
  auctions: z
    .object({
      minRating: z.number().min(0).max(5),
      minReviewsForRating: z.number().int().min(1).max(100),
      minDealerExtensionHours: hours,
      singleBidDecisionHours: hours,
      exitWindowHours: hours,
      runnerUpOfferHours: hours,
      priceAlertMinutes: z
        .number()
        .int()
        .min(5)
        .max(24 * 60),
      bidCooldownSeconds: z.number().int().min(1).max(600),
      backOutSuspensionDays: days,
    })
    .partial()
    .strict(),
  payments: z
    .object({
      seatReservationMinutes: z.number().int().min(5).max(120),
      waitlistOfferHours: hours.max(72),
    })
    .partial()
    .strict(),
  purchases: z
    .object({
      invoiceObjectionHours: hours,
      expiryReminderHours: hours,
      sellerDealValidityDays: days.max(60),
    })
    .partial()
    .strict(),
  billing: z
    .object({
      legalName: z.string().trim().min(2).max(120),
      gstin: z.union([
        z.literal(''),
        z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^[0-9A-Z]{15}$/, 'GSTIN has 15 letters and digits'),
      ]),
      address: z.string().trim().max(300),
      stateCode: z.string().regex(/^\d{2}$/),
      sacCode: z.string().trim().max(10),
      gstRateBps: bps.max(2800),
      invoicePrefix: z
        .string()
        .trim()
        .regex(/^[A-Z]{1,6}$/, 'Use 1 to 6 capital letters'),
    })
    .partial()
    .strict(),
  referrals: z
    .object({
      referrerCreditPaise: paise.max(1_000_000),
      friendCreditPaise: paise.max(1_000_000),
      leaderBonusPaise: paise.max(1_000_000),
      leaderBonusMinOtherPurchases: z.number().int().min(0).max(100),
      claimWithinDays: days.max(90),
    })
    .partial()
    .strict(),
  // Alert rules (MON-4). Push alerts go to the buyer-app account with ownerPushPhone
  // (decided 13 Nov 2026); console bell and email work for all staff.
  alerts: z
    .object({
      ownerPushPhone: z.union([
        z.literal(''),
        z
          .string()
          .trim()
          .transform((value) => value.replace(/[\s-]/g, ''))
          .transform((value) => (/^[6-9]\d{9}$/.test(value) ? `+91${value}` : value))
          .pipe(
            z.string().regex(/^\+91[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
          ),
      ]),
      paymentSuccessMinBps: bps.min(5000),
      paymentSuccessMinSample: z.number().int().min(1).max(10_000),
      refundStuckHours: hours,
      transferPendingHours: hours,
      queueBacklogMax: z.number().int().min(10).max(100_000),
      apiErrorsPerMinute: z.number().int().min(1).max(10_000),
    })
    .partial()
    .strict(),
  flags: z
    .object({
      referrals: z.boolean(),
      sellerDeals: z.boolean(),
      communityGroups: z.boolean(),
      maintenanceMode: z.boolean(),
    })
    .partial()
    .strict(),
});

const SECTION_KEYS = Object.keys(SECTION_SCHEMAS);

/**
 * Every editable section with current values and defaults.
 * @returns {Promise<Record<string, { values: Object, defaults: Object }>>}
 */
const getAllSettings = async () => {
  const entries = await Promise.all(
    SECTION_KEYS.map(async (key) => [
      key,
      { values: await getSettings(key), defaults: DEFAULTS[key] },
    ]),
  );
  return Object.fromEntries(entries);
};

/**
 * Change part of one section.
 * @param {string} key - Section
 * @param {Object} changes - Raw body
 * @param {string} staffId
 * @returns {Promise<{ before: Object, after: Object }>}
 * @throws {ApiError} 404 unknown section, 422 invalid values
 */
const updateSection = async (key, changes, staffId) => {
  const schema = SECTION_SCHEMAS[key];
  if (!schema) throw ApiError.notFound('Unknown settings section');
  const parsed = schema.safeParse(changes);
  if (!parsed.success) {
    throw new ApiError(422, 'Some values are invalid', {
      code: 'VALIDATION_ERROR',
      details: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }
  const before = await getSettings(key);
  const stored = await Setting.findOne({ key }).lean();
  const value = { ...(stored?.value || {}), ...parsed.data };
  await Setting.updateOne({ key }, { $set: { value, updatedBy: staffId } }, { upsert: true });
  clearSettingsCache();
  return { before, after: await getSettings(key) };
};

module.exports = { SECTION_SCHEMAS, SECTION_KEYS, getAllSettings, updateSection };
