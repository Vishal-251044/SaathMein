/**
 * create-owner — creates the ONE Owner account for the admin console (ADL-3).
 * Usage: npm run create-owner   (reads OWNER_EMAIL, OWNER_PASSWORD, OWNER_NAME from backend/.env)
 *
 * - Refuses to run if an Owner already exists (there is exactly one Owner).
 * - The password is never printed. 2FA is set up on the first login at /admin/login.
 * - After it succeeds, remove OWNER_PASSWORD from .env (it is no longer needed).
 */
const mongoose = require('mongoose');
const { z } = require('zod');
const config = require('../config/env');
const { createLogger } = require('../utils/logger');
const User = require('../models/user.model');
const { STAFF_ROLE, ACCOUNT_STATUS } = require('../constants/enums');
const { hashPassword } = require('../services/auth/staffAuth.service');

const log = createLogger('CreateOwner');

const ownerSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('OWNER_EMAIL must be a valid email')),
  name: z.string().trim().min(2, 'OWNER_NAME must be at least 2 characters').max(80),
  password: z
    .string()
    .min(12, 'OWNER_PASSWORD must be at least 12 characters')
    .regex(/[a-z]/, 'OWNER_PASSWORD needs a lowercase letter')
    .regex(/[A-Z]/, 'OWNER_PASSWORD needs an uppercase letter')
    .regex(/\d/, 'OWNER_PASSWORD needs a digit')
    .regex(/[^A-Za-z0-9]/, 'OWNER_PASSWORD needs a symbol')
    .refine((value) => !/^your_.*_here$/.test(value), 'OWNER_PASSWORD is still the placeholder'),
});

/**
 * Validate input, then create the Owner.
 * @returns {Promise<number>} Process exit code
 */
const run = async () => {
  const parsed = ownerSchema.safeParse(config.owner);
  if (!parsed.success) {
    parsed.error.issues.forEach((issue) => log.error(issue.message));
    log.error('Fix the OWNER_* values in backend/.env and run again');
    return 1;
  }
  if (!config.mongo.isConfigured) {
    log.error('MONGODB_URI is not set in backend/.env');
    return 1;
  }

  // Connect once (no background retries): a one-off script should fail fast and clearly
  await mongoose.connect(config.mongo.uri, { serverSelectionTimeoutMS: 15000 });
  await User.init(); // make sure unique indexes (one Owner, unique email) exist

  const existingOwner = await User.findOne({ staffRole: STAFF_ROLE.OWNER }).select('email');
  if (existingOwner) {
    log.error(`An Owner already exists (${existingOwner.email}). Nothing was changed.`);
    return 1;
  }

  const { email, name, password } = parsed.data;
  const emailTaken = await User.exists({ email });
  if (emailTaken) {
    log.error(`A user with ${email} already exists. Use a different OWNER_EMAIL.`);
    return 1;
  }

  await User.create({
    name,
    email,
    passwordHash: await hashPassword(password),
    passwordChangedAt: new Date(),
    staffRole: STAFF_ROLE.OWNER,
    status: ACCOUNT_STATUS.ACTIVE,
    twoFactorEnabled: false,
  });

  log.info(`Owner created: ${email}`);
  log.info('Next: sign in at /admin/login and scan the 2FA setup key with your authenticator app.');
  log.info('Then remove OWNER_PASSWORD from backend/.env.');
  return 0;
};

run()
  .then(async (code) => {
    await mongoose.disconnect().catch(() => {});
    process.exit(code);
  })
  .catch(async (err) => {
    log.error({ err }, 'create-owner failed');
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
