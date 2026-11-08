/**
 * Settings service — admin-editable business values with safe defaults (cached 60 s).
 * Defaults are used until an admin saves a value (the Settings page arrives on Day 11).
 *
 * groups (Day 6, decided by Vishal 30 Oct 2026):
 * - earlyStartThresholdBps: at the deadline, groups at ≥ 70% of target may extend once or
 *   start the auction early (GRP-5); below that they expire.
 * - leaderDecisionHours: how long the leader has to choose (48 h), then the group expires.
 * - extensionDays: one extension adds 7 days (never past the category's maximum deadline).
 * - maxOpenGroupsPerLeader: anti-spam limit on open groups one person leads.
 *
 * payments (Day 7):
 * - seatReservationMinutes: a seat is held while the buyer is in checkout.
 * - waitlistOfferHours: a freed seat is offered to the next waitlisted person this long.
 */
const Setting = require('../models/setting.model');
const { createLogger } = require('../utils/logger');

const log = createLogger('Settings');
const CACHE_MS = 60 * 1000;

const DEFAULTS = Object.freeze({
  groups: Object.freeze({
    earlyStartThresholdBps: 7000,
    leaderDecisionHours: 48,
    extensionDays: 7,
    maxOpenGroupsPerLeader: 5,
  }),
  payments: Object.freeze({
    seatReservationMinutes: 15,
    waitlistOfferHours: 2,
  }),
});

const cache = new Map();

/**
 * One settings section merged over its defaults.
 * @param {'groups'} key - Section key
 * @returns {Promise<Object>} Section values
 */
const getSettings = async (key) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.loadedAt < CACHE_MS) return cached.value;

  let stored = null;
  try {
    stored = await Setting.findOne({ key }).lean();
  } catch (err) {
    // Fall back to defaults so a settings read never breaks a request
    log.error({ err: err.message, key }, 'Could not read settings, using defaults');
  }
  const value = { ...DEFAULTS[key], ...(stored?.value || {}) };
  cache.set(key, { value, loadedAt: Date.now() });
  return value;
};

/** @returns {Promise<typeof DEFAULTS.groups>} Group lifecycle settings */
const getGroupSettings = () => getSettings('groups');

/** @returns {Promise<typeof DEFAULTS.payments>} Checkout and waitlist settings */
const getPaymentSettings = () => getSettings('payments');

/** Forget cached values (after an admin edit, and in tests). */
const clearSettingsCache = () => cache.clear();

module.exports = {
  DEFAULTS,
  getSettings,
  getGroupSettings,
  getPaymentSettings,
  clearSettingsCache,
};
