/**
 * Short distributed lock in Redis (SET NX PX) so a job runs once across workers.
 * The real exactly-once guarantee for group changes is the state machine's optimistic
 * lock; this lock just stops two workers doing the same work at the same time.
 * Without Redis the function runs unlocked (single process in development).
 */
const { getRedis } = require('../config/redis');
const { randomToken } = require('../utils/crypto');
const { createLogger } = require('../utils/logger');

const log = createLogger('Lock');

// Delete the key only if we still own it
const RELEASE_SCRIPT =
  'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end';

/**
 * Run `fn` while holding `lock:<key>`.
 * @param {string} key - Lock name, e.g. "auction-close:<groupId>"
 * @param {number} ttlMs - Lock expiry (longer than the work takes)
 * @param {() => Promise<*>} fn - Work to do
 * @returns {Promise<{ acquired: boolean, result?: * }>}
 */
const withLock = async (key, ttlMs, fn) => {
  const redis = getRedis();
  if (!redis) return { acquired: true, result: await fn() };

  const owner = randomToken(12);
  const lockKey = `lock:${key}`;
  let acquired;
  try {
    acquired = (await redis.set(lockKey, owner, 'PX', ttlMs, 'NX')) === 'OK';
  } catch (err) {
    // Redis down: the state machine lock still protects the data
    log.warn({ err: err.message, key }, 'Lock unavailable, running without it');
    return { acquired: true, result: await fn() };
  }
  if (!acquired) return { acquired: false };

  try {
    return { acquired: true, result: await fn() };
  } finally {
    await redis.eval(RELEASE_SCRIPT, 1, lockKey, owner).catch(() => {});
  }
};

module.exports = { withLock };
