/**
 * Environment config loader.
 * Reads backend/.env, validates every variable with Zod and exports one frozen,
 * typed config object. The rest of the code must import config from here and
 * never read process.env directly.
 *
 * Secrets may be placeholders in development (the server still starts, with a warning),
 * but production refuses to start unless every secret is a real, long value.
 */
const crypto = require('crypto');
const path = require('path');
const dotenv = require('dotenv');
const { z } = require('zod');
const { parseDurationToMs } = require('../helpers/genericFunctions');

// Load backend/.env (no-op in production where the host injects variables)
dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

/** Duration strings like "15m", "8h", "30d" (validated by parsing). */
const duration = (fallback) =>
  z
    .string()
    .default(fallback)
    .refine((value) => parseDurationToMs(value) > 0, 'must be a duration like 15m, 8h or 30d');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Comma-separated list of allowed browser origins (seller/admin web, Expo web)
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  // MongoDB Atlas (replica set — transactions are required for money flows)
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  // Upstash Redis — optional until queues/sockets land (Day 6+)
  REDIS_URL: z.string().optional().default(''),

  // Buyer / seller app tokens (ACC-1)
  JWT_ACCESS_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  JWT_ACCESS_EXPIRES_IN: duration('15m'),
  JWT_REFRESH_EXPIRES_IN: duration('30d'),
  // Password hashing cost. Production must keep 12+; tests use 4 so suites stay fast.
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),

  // Staff (admin console) tokens — separate secrets (ADL-4)
  // Signs deal-code QR payloads (PUR-1)
  DEAL_CODE_SECRET: z.string().min(1).default('your_deal_code_signing_secret_here'),
  STAFF_JWT_ACCESS_SECRET: z.string().min(1),
  STAFF_JWT_REFRESH_SECRET: z.string().min(1),
  STAFF_JWT_ACCESS_EXPIRES_IN: duration('15m'),
  STAFF_JWT_REFRESH_EXPIRES_IN: duration('8h'),
  STAFF_IDLE_TIMEOUT: duration('30m'),

  // 32-byte key (64 hex chars) that encrypts staff TOTP secrets at rest (ADL-2)
  TWO_FACTOR_ENCRYPTION_KEY: z.string().default(''),

  // Firebase Admin — verifies phone OTP ID tokens (ACC-1)
  FIREBASE_PROJECT_ID: z.string().default(''),
  FIREBASE_CLIENT_EMAIL: z.string().default(''),
  FIREBASE_PRIVATE_KEY: z.string().default(''),

  // Cloudinary — avatars (Day 3), product images, KYC docs, invoices
  CLOUDINARY_CLOUD_NAME: z.string().default(''),
  CLOUDINARY_API_KEY: z.string().default(''),
  CLOUDINARY_API_SECRET: z.string().default(''),

  // Razorpay — Route linked accounts for dealers (Day 5), payments from Day 7
  RAZORPAY_KEY_ID: z.string().default(''),
  RAZORPAY_KEY_SECRET: z.string().default(''),
  RAZORPAY_WEBHOOK_SECRET: z.string().default(''),
  // Business category sent when creating a dealer's linked account (Razorpay business categories)
  RAZORPAY_ROUTE_CATEGORY: z.string().default('ecommerce'),
  RAZORPAY_ROUTE_SUBCATEGORY: z.string().default('ecommerce_marketplace'),

  // Email (Resend) — dealer verification codes, KYC updates, staff invites
  RESEND_API_KEY: z.string().default(''),
  EMAIL_FROM: z.string().default('SaathMein <no-reply@saathmein.in>'),

  // Public URL of the dealer dashboard (links in emails, e.g. team invites)
  SELLER_WEB_URL: z.string().default('http://localhost:3000/seller'),

  // Public base for share links (<base>/g/<code>) and Android App Links (Day 8)
  APP_LINK_BASE_URL: z.string().default('http://localhost:5000'),
  ANDROID_PACKAGE_NAME: z.string().default('com.saathmein.app'),
  // SHA-256 fingerprints of the app signing keys (Play Console → App integrity), comma separated
  ANDROID_SHA256_CERT_FINGERPRINTS: z.string().default(''),
  PLAY_STORE_URL: z
    .string()
    .default('https://play.google.com/store/apps/details?id=com.saathmein.app'),
  // Optional: Expo push "enhanced security" access token (expo.dev → Access tokens)
  EXPO_ACCESS_TOKEN: z.string().default(''),

  // Owner account — read only by `npm run create-owner` (ADL-3)
  OWNER_EMAIL: z.string().default(''),
  OWNER_PASSWORD: z.string().default(''),
  OWNER_NAME: z.string().default('Owner'),
});

/**
 * Print a config problem and exit. The logger is not ready yet (it depends on config).
 * @param {string} message - What is wrong
 */
const fail = (message) => {
  // eslint-disable-next-line no-console
  console.error(`[Config] ${message}`);
  process.exit(1);
};

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
  fail(`Invalid environment variables in backend/.env:\n${issues.join('\n')}`);
}

const env = parsed.data;
const isProduction = env.NODE_ENV === 'production';

/**
 * Check that a connection string is a real value, not the .env.example placeholder.
 * @param {string} value - Raw env value
 * @param {string[]} prefixes - Accepted URL schemes
 * @returns {boolean} True when the value starts with one of the prefixes
 */
const isRealUrl = (value, prefixes) => prefixes.some((prefix) => value.startsWith(prefix));

/**
 * A secret is "real" when it is long and not the `your_..._here` placeholder.
 * @param {string} value - Secret value
 * @returns {boolean} True for production-grade secrets
 */
const isStrongSecret = (value) => value.length >= 32 && !/^your_.*_here$/.test(value);

const SECRET_KEYS = [
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'STAFF_JWT_ACCESS_SECRET',
  'STAFF_JWT_REFRESH_SECRET',
  'DEAL_CODE_SECRET',
];
const weakSecrets = SECRET_KEYS.filter((key) => !isStrongSecret(env[key]));
const isTwoFactorKeyValid = /^[0-9a-fA-F]{64}$/.test(env.TWO_FACTOR_ENCRYPTION_KEY);

if (isProduction && weakSecrets.length) {
  fail(`These secrets must be at least 32 random characters: ${weakSecrets.join(', ')}`);
}
if (isProduction && env.BCRYPT_ROUNDS < 12) {
  fail('BCRYPT_ROUNDS must be 12 or more in production');
}
if (isProduction && !isTwoFactorKeyValid) {
  fail('TWO_FACTOR_ENCRYPTION_KEY must be 64 hex characters (32 bytes) in production');
}

/**
 * Key that encrypts TOTP secrets. Outside production a placeholder falls back to a
 * fixed development key, so 2FA can be tested before real secrets exist.
 */
const twoFactorKey = isTwoFactorKeyValid
  ? Buffer.from(env.TWO_FACTOR_ENCRYPTION_KEY, 'hex')
  : crypto.createHash('sha256').update('saathmein-development-only-2fa-key').digest();

// Private keys pasted into .env usually contain literal "\n" sequences
const firebasePrivateKey = env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

const config = Object.freeze({
  env: env.NODE_ENV,
  isProduction,
  isTest: env.NODE_ENV === 'test',
  port: env.PORT,
  logLevel: env.LOG_LEVEL,
  corsOrigins: env.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  mongo: {
    uri: env.MONGODB_URI,
    isConfigured: isRealUrl(env.MONGODB_URI, ['mongodb://', 'mongodb+srv://']),
  },
  redis: {
    url: env.REDIS_URL,
    isConfigured: isRealUrl(env.REDIS_URL, ['redis://', 'rediss://']),
  },
  auth: {
    app: {
      accessSecret: env.JWT_ACCESS_SECRET,
      refreshSecret: env.JWT_REFRESH_SECRET,
      accessTtlMs: parseDurationToMs(env.JWT_ACCESS_EXPIRES_IN),
      refreshTtlMs: parseDurationToMs(env.JWT_REFRESH_EXPIRES_IN),
    },
    staff: {
      accessSecret: env.STAFF_JWT_ACCESS_SECRET,
      refreshSecret: env.STAFF_JWT_REFRESH_SECRET,
      accessTtlMs: parseDurationToMs(env.STAFF_JWT_ACCESS_EXPIRES_IN),
      refreshTtlMs: parseDurationToMs(env.STAFF_JWT_REFRESH_EXPIRES_IN),
      idleTimeoutMs: parseDurationToMs(env.STAFF_IDLE_TIMEOUT),
    },
    twoFactorKey,
    isTwoFactorKeyConfigured: isTwoFactorKeyValid,
    weakSecrets,
    bcryptRounds: env.BCRYPT_ROUNDS,
  },
  firebase: {
    projectId: env.FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey: firebasePrivateKey,
    isConfigured:
      Boolean(env.FIREBASE_PROJECT_ID) &&
      !env.FIREBASE_PROJECT_ID.startsWith('your_') &&
      firebasePrivateKey.includes('BEGIN PRIVATE KEY'),
  },
  cloudinary: {
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    apiSecret: env.CLOUDINARY_API_SECRET,
    isConfigured: [
      env.CLOUDINARY_CLOUD_NAME,
      env.CLOUDINARY_API_KEY,
      env.CLOUDINARY_API_SECRET,
    ].every((value) => value && !/^your_.*_here$/.test(value)),
  },
  razorpay: {
    keyId: env.RAZORPAY_KEY_ID,
    keySecret: env.RAZORPAY_KEY_SECRET,
    webhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
    routeCategory: env.RAZORPAY_ROUTE_CATEGORY,
    routeSubcategory: env.RAZORPAY_ROUTE_SUBCATEGORY,
    isConfigured:
      /^rzp_(test|live)_/.test(env.RAZORPAY_KEY_ID) &&
      Boolean(env.RAZORPAY_KEY_SECRET) &&
      !/^your_.*_here$/.test(env.RAZORPAY_KEY_SECRET),
    isLiveMode: env.RAZORPAY_KEY_ID.startsWith('rzp_live_'),
  },
  email: {
    resendApiKey: env.RESEND_API_KEY,
    from: env.EMAIL_FROM,
    isConfigured: env.RESEND_API_KEY.startsWith('re_'),
  },
  dealCodeSecret: env.DEAL_CODE_SECRET,
  sellerWebUrl: env.SELLER_WEB_URL.replace(/\/+$/, ''),
  appLinks: {
    baseUrl: env.APP_LINK_BASE_URL.replace(/\/+$/, ''),
    androidPackage: env.ANDROID_PACKAGE_NAME,
    sha256Fingerprints: env.ANDROID_SHA256_CERT_FINGERPRINTS.split(',')
      .map((value) => value.trim())
      .filter(Boolean),
    playStoreUrl: env.PLAY_STORE_URL,
  },
  expo: {
    accessToken: env.EXPO_ACCESS_TOKEN.startsWith('your_') ? '' : env.EXPO_ACCESS_TOKEN,
  },
  owner: {
    email: env.OWNER_EMAIL,
    password: env.OWNER_PASSWORD,
    name: env.OWNER_NAME,
  },
});

module.exports = config;
