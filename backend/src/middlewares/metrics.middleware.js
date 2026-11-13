/**
 * Request metrics for System health (PRD §10.11 monitors): requests, 5xx errors and
 * response times per minute for the last 15 minutes, kept in memory per API process.
 * A spike of server errors raises a "system" alert (once while it stays open).
 */
const { getSettings } = require('../services/settings.service');

const WINDOW_MINUTES = 15;
const MAX_SAMPLES = 2000; // response times kept per minute (for p95)
const buckets = new Map(); // minute → { requests, errors, durations[] }

const minuteOf = (ms) => Math.floor(ms / 60_000);

/** Drop minutes older than the window. */
const prune = (current) => {
  for (const minute of buckets.keys()) {
    if (minute <= current - WINDOW_MINUTES) buckets.delete(minute);
  }
};

/**
 * Express middleware: records every response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {Function} next
 */
const recordMetrics = (req, res, next) => {
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const minute = minuteOf(Date.now());
    if (!buckets.has(minute)) {
      buckets.set(minute, { requests: 0, errors: 0, durations: [] });
      prune(minute);
    }
    const bucket = buckets.get(minute);
    bucket.requests += 1;
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    if (bucket.durations.length < MAX_SAMPLES) bucket.durations.push(ms);
    if (res.statusCode >= 500) {
      bucket.errors += 1;
      checkErrorSpike(bucket.errors).catch(() => {});
    }
  });
  next();
};

/** Raise a system alert when this minute's 5xx count crosses the setting. */
const checkErrorSpike = async (errorsThisMinute) => {
  const { apiErrorsPerMinute } = await getSettings('alerts');
  if (errorsThisMinute !== apiErrorsPerMinute) return; // once per minute, at the threshold
  const { raiseAlert } = require('../services/alerts/alert.service');
  await raiseAlert({
    type: 'system',
    severity: 'critical',
    title: 'API server errors are spiking',
    message: `${errorsThisMinute} server errors in one minute. Check Sentry and the System health monitor.`,
    subjectType: 'system',
    dedupeKey: 'system:api-errors',
  });
};

/**
 * Snapshot for the System health monitor.
 * @returns {{ minutes: number, requests: number, errors: number, errorRateBps: number, p95Ms: number|null,
 *   perMinute: { minute: string, requests: number, errors: number }[] }}
 */
const getMetricsSnapshot = () => {
  const current = minuteOf(Date.now());
  prune(current);
  let requests = 0;
  let errors = 0;
  const durations = [];
  const perMinute = [];
  for (let minute = current - WINDOW_MINUTES + 1; minute <= current; minute += 1) {
    const bucket = buckets.get(minute) || { requests: 0, errors: 0, durations: [] };
    requests += bucket.requests;
    errors += bucket.errors;
    durations.push(...bucket.durations);
    perMinute.push({
      minute: new Date(minute * 60_000).toISOString(),
      requests: bucket.requests,
      errors: bucket.errors,
    });
  }
  durations.sort((a, b) => a - b);
  return {
    minutes: WINDOW_MINUTES,
    requests,
    errors,
    errorRateBps: requests ? Math.round((errors / requests) * 10_000) : 0,
    p95Ms: durations.length
      ? Math.round(durations[Math.floor(durations.length * 0.95)] ?? durations.at(-1))
      : null,
    perMinute,
  };
};

module.exports = { recordMetrics, getMetricsSnapshot };
