/**
 * Environment config loader.
 * Reads backend/.env, validates every variable with Zod and exports one frozen,
 * typed config object. The rest of the code must import config from here and
 * never read process.env directly.
 */
const path = require('path');
const dotenv = require('dotenv');
const { z } = require('zod');

// Load backend/.env (no-op in production where the host injects variables)
dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Comma-separated list of allowed browser origins (seller/admin web, Expo web)
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  // MongoDB Atlas (replica set — transactions are required for money flows)
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  // Upstash Redis — optional on Day 1, required once queues/sockets land (Day 6+)
  REDIS_URL: z.string().optional().default(''),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Logger is not ready yet (it depends on config), so print directly and stop.
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
  // eslint-disable-next-line no-console
  console.error(`[Config] Invalid environment variables in backend/.env:\n${issues.join('\n')}`);
  process.exit(1);
}

const env = parsed.data;

/**
 * Check that a connection string is a real value, not the .env.example placeholder.
 * @param {string} value - Raw env value
 * @param {string[]} prefixes - Accepted URL schemes
 * @returns {boolean} True when the value starts with one of the prefixes
 */
const isRealUrl = (value, prefixes) => prefixes.some((prefix) => value.startsWith(prefix));

const config = Object.freeze({
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
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
});

module.exports = config;
