/**
 * Production start-up guards (Day 14 security review): the API refuses to start in
 * production with weak secrets, missing Razorpay / Redis / Firebase values, a placeholder
 * MongoDB URI or localhost CORS origins. Runs the config loader in a child process because
 * it exits on failure.
 */
const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const strong = 'x'.repeat(40);

/** A complete, valid production environment. */
const goodEnv = {
  NODE_ENV: 'production',
  MONGODB_URI: 'mongodb+srv://user:pass@cluster.example.net/saathmein',
  REDIS_URL: 'rediss://default:pass@redis.example.io:6379',
  JWT_ACCESS_SECRET: strong,
  JWT_REFRESH_SECRET: `${strong}a`,
  STAFF_JWT_ACCESS_SECRET: `${strong}b`,
  STAFF_JWT_REFRESH_SECRET: `${strong}c`,
  DEAL_CODE_SECRET: `${strong}d`,
  TWO_FACTOR_ENCRYPTION_KEY: 'a'.repeat(64),
  RAZORPAY_KEY_ID: 'rzp_test_abc',
  RAZORPAY_KEY_SECRET: 'secret',
  RAZORPAY_WEBHOOK_SECRET: 'webhook-secret',
  FIREBASE_PROJECT_ID: 'saathmein',
  FIREBASE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----',
  CORS_ORIGINS: 'https://saathmein.in',
};

/** Load the config with only these variables (no .env file influence for these keys). */
const load = (env) =>
  spawnSync(process.execPath, ['-e', "require('./src/config/env'); console.log('STARTED')"], {
    cwd: ROOT,
    env: { PATH: process.env.PATH, SYSTEMROOT: process.env.SYSTEMROOT, ...env },
    encoding: 'utf8',
  });

it('starts with a complete production environment', () => {
  const result = load(goodEnv);
  expect(result.stdout).toContain('STARTED');
});

it.each([
  [
    'missing webhook secret',
    { RAZORPAY_WEBHOOK_SECRET: 'your_razorpay_webhook_secret_here' },
    'RAZORPAY_WEBHOOK_SECRET',
  ],
  ['missing Redis', { REDIS_URL: '' }, 'REDIS_URL'],
  [
    'localhost CORS',
    { CORS_ORIGINS: 'https://saathmein.in,http://localhost:3000' },
    'CORS_ORIGINS',
  ],
  [
    'placeholder MongoDB',
    { MONGODB_URI: 'your_mongodb_atlas_connection_string_here' },
    'MONGODB_URI',
  ],
  ['weak JWT secret', { JWT_ACCESS_SECRET: 'short' }, 'JWT_ACCESS_SECRET'],
])('refuses to start with %s', (_label, override, expected) => {
  const result = load({ ...goodEnv, ...override });
  expect(result.status).toBe(1);
  expect(result.stdout).not.toContain('STARTED');
  expect(result.stderr).toContain(expected);
});
