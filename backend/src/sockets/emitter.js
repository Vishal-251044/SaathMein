/**
 * Send live events to apps (LIV-1) from anywhere in the backend.
 * - In the API process: straight to the Socket.io server (the Redis adapter reaches every
 *   API instance).
 * - In the worker process (no Socket.io server): published on a Redis channel; every API
 *   instance re-emits to its own connected clients.
 * Emitting never throws: live updates are best effort (the app also polls).
 */
const { getRedis } = require('../config/redis');
const { createLogger } = require('../utils/logger');

const log = createLogger('SocketEmitter');

const EMIT_CHANNEL = 'saathmein:socket-emit';
let io = null;

/** Room names. */
const rooms = {
  group: (groupId) => `group:${groupId}`,
  user: (userId) => `user:${userId}`,
  // Dealers: one room per dealer business (rank updates) and one per auction they watch
  seller: (sellerId) => `seller:${sellerId}`,
  auction: (groupId) => `auction:${groupId}`,
};

/** @param {import('socket.io').Server|null} server - Set by the gateway in the API process */
const setIo = (server) => {
  io = server;
};

/**
 * Emit to one room (or several: a socket in more than one gets it once).
 * @param {string|string[]} room - Room name(s)
 * @param {string} event - SOCKET_EVENTS value
 * @param {Object} payload - JSON payload
 */
const emitToRoom = (room, event, payload) => {
  try {
    if (io) {
      io.to(room).emit(event, payload);
      return;
    }
    const redis = getRedis();
    if (redis) {
      redis.publish(EMIT_CHANNEL, JSON.stringify({ room, event, payload })).catch((err) => {
        log.warn({ err: err.message, event }, 'Could not publish socket event');
      });
    }
  } catch (err) {
    log.warn({ err: err.message, event }, 'Socket emit failed');
  }
};

/** @param {string} groupId @param {string} event @param {Object} payload */
const emitToGroup = (groupId, event, payload) =>
  emitToRoom(rooms.group(groupId), event, { groupId: String(groupId), ...payload });

/**
 * Auction events go to buyers (group room) and dealers watching (auction room). Payloads
 * never contain dealer names (AUC-6).
 * @param {string} groupId @param {string} event @param {Object} payload
 */
const emitToAuction = (groupId, event, payload) =>
  emitToRoom([rooms.group(groupId), rooms.auction(groupId)], event, {
    groupId: String(groupId),
    ...payload,
  });

/** @param {string} sellerId @param {string} event @param {Object} payload */
const emitToSeller = (sellerId, event, payload) =>
  emitToRoom(rooms.seller(sellerId), event, payload);

/** @param {string} userId @param {string} event @param {Object} payload */
const emitToUser = (userId, event, payload) => emitToRoom(rooms.user(userId), event, payload);

/**
 * API process: re-emit events published by the worker to this instance's clients.
 * @param {import('socket.io').Server} server - Socket.io server
 * @returns {Promise<void>}
 */
const subscribeToWorkerEmits = async (server) => {
  const redis = getRedis();
  if (!redis) return;
  const subscriber = redis.duplicate();
  await subscriber.subscribe(EMIT_CHANNEL);
  subscriber.on('message', (_channel, message) => {
    try {
      const { room, event, payload } = JSON.parse(message);
      // local: every API instance gets this message, so each emits only to its own sockets
      server.local.to(room).emit(event, payload);
    } catch (err) {
      log.warn({ err: err.message }, 'Bad socket emit message');
    }
  });
};

module.exports = {
  EMIT_CHANNEL,
  rooms,
  setIo,
  emitToRoom,
  emitToGroup,
  emitToUser,
  emitToAuction,
  emitToSeller,
  subscribeToWorkerEmits,
};
