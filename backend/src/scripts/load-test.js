/**
 * Socket load test (Day 14): opens N app sockets (default 500) to a running API, joins one
 * public group room each, then publishes live counter updates at the "joins per minute"
 * rate (default 50) through the same Redis channel the worker uses. Every client measures
 * how long each update took to arrive. Pass = ≥ 99% connected, every update delivered to
 * every client, p95 latency under 1 s (PRD: live counter updates under 1 s).
 *
 * Usage (against local or staging, never production by accident):
 *   npm run load-test -- --url https://api-staging.example.com --group <publicGroupId>
 *     [--clients 500] [--rate 50] [--seconds 120]
 * Needs the same JWT_ACCESS_SECRET and REDIS_URL as the API under test (backend/.env).
 * Tokens are minted for random user ids; no data is written to MongoDB.
 */
const crypto = require('crypto');
const { io } = require('socket.io-client');
const config = require('../config/env');
const { getRedis, disconnectRedis } = require('../config/redis');
const { signAccessToken } = require('../services/auth/token.service');
const { SOCKET_EVENTS, TOKEN_AUDIENCE } = require('../constants/enums');

const EMIT_CHANNEL = 'saathmein:socket-emit';

/** Read `--name value` arguments. */
const args = Object.fromEntries(
  process.argv
    .slice(2)
    .reduce(
      (pairs, arg, index, all) =>
        arg.startsWith('--') ? [...pairs, [arg.slice(2), all[index + 1]]] : pairs,
      [],
    )
    .map(([key, value]) => [key, value === undefined || value.startsWith('--') ? 'true' : value]),
);

const url = args.url || `http://localhost:${config.port}`;
const groupId = args.group;
const clients = Number.parseInt(args.clients || '500', 10);
const ratePerMinute = Number.parseInt(args.rate || '50', 10);
const seconds = Number.parseInt(args.seconds || '120', 10);

/** p-th percentile of numbers (0–100). */
const percentile = (values, p) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
};

const print = (line) => process.stdout.write(`${line}\n`);

const main = async () => {
  if (!groupId || !/^[a-f0-9]{24}$/.test(groupId)) {
    print('Pass --group <id of a PUBLIC open group> (24 hex characters).');
    return 1;
  }
  if (config.isProduction && args['i-know-this-is-production'] !== 'true') {
    print('Refusing to load-test production. Use staging, or add --i-know-this-is-production.');
    return 1;
  }
  const redis = getRedis();
  if (!redis) {
    print('REDIS_URL is not set: updates are published through Redis like the worker does.');
    return 1;
  }

  print(`Connecting ${clients} sockets to ${url} …`);
  const latencies = [];
  const connectTimes = [];
  let joinFailures = 0;
  let received = 0;
  const sockets = await Promise.all(
    Array.from({ length: clients }, async () => {
      const userId = crypto.randomBytes(12).toString('hex');
      const { token } = signAccessToken({
        userId,
        sessionId: userId,
        audience: TOKEN_AUDIENCE.APP,
      });
      const startedAt = Date.now();
      const socket = io(url, {
        transports: ['websocket'],
        auth: { token },
        reconnection: false,
        timeout: 20_000,
      });
      socket.on(SOCKET_EVENTS.GROUP_COUNT, (payload) => {
        if (!payload?.loadTestSentAt) return;
        received += 1;
        latencies.push(Date.now() - payload.loadTestSentAt);
      });
      const ok = await new Promise((resolve) => {
        socket.once('connect', () => resolve(true));
        socket.once('connect_error', () => resolve(false));
      });
      if (!ok) return null;
      connectTimes.push(Date.now() - startedAt);
      const ack = await new Promise((resolve) => {
        socket
          .timeout(10_000)
          .emit(SOCKET_EVENTS.JOIN_GROUP, { groupId }, (err, response) =>
            resolve(err ? null : response),
          );
      });
      if (!ack?.ok) joinFailures += 1;
      return socket;
    }),
  );
  const connected = sockets.filter(Boolean);
  print(`Connected ${connected.length}/${clients}; group joins failed: ${joinFailures}`);

  const total = Math.max(1, Math.round((ratePerMinute * seconds) / 60));
  const everyMs = 60_000 / ratePerMinute;
  print(`Publishing ${total} counter updates (${ratePerMinute}/min) for ${seconds} s …`);
  for (let index = 0; index < total; index += 1) {
    await redis.publish(
      EMIT_CHANNEL,
      JSON.stringify({
        room: `group:${groupId}`,
        event: SOCKET_EVENTS.GROUP_COUNT,
        payload: {
          groupId,
          memberCount: index,
          targetSize: 20,
          status: 'open',
          loadTestSentAt: Date.now(),
        },
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, everyMs));
  }
  await new Promise((resolve) => setTimeout(resolve, 3000)); // let the last updates land

  const expected = total * (connected.length - joinFailures);
  const deliveredPct = expected ? (received / expected) * 100 : 0;
  const p95 = percentile(latencies, 95);
  print('');
  print(
    `Connect time  p50 ${percentile(connectTimes, 50)} ms · p95 ${percentile(connectTimes, 95)} ms`,
  );
  print(`Delivered     ${received}/${expected} (${deliveredPct.toFixed(2)}%)`);
  print(
    `Latency       p50 ${percentile(latencies, 50)} ms · p95 ${p95} ms · max ${percentile(latencies, 100)} ms`,
  );
  const pass =
    connected.length >= clients * 0.99 && deliveredPct >= 99.9 && p95 !== null && p95 < 1000;
  print(pass ? 'RESULT: PASS' : 'RESULT: FAIL');

  connected.forEach((socket) => socket.close());
  await disconnectRedis();
  return pass ? 0 : 2;
};

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    print(`Load test crashed: ${err.message}`);
    process.exit(1);
  });
