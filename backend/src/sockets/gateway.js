/**
 * Socket.io gateway (LIV-1): JWT auth in the handshake, one room per group plus a personal
 * room per user (notifications), Redis adapter so several API instances share rooms.
 * Apps join a group room only if they may see the group (public, member/leader, or with
 * the invite code). Apps fall back to polling when the socket drops.
 */
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const config = require('../config/env');
const { getRedis } = require('../config/redis');
const Group = require('../models/group.model');
const GroupMember = require('../models/groupMember.model');
const SellerStaff = require('../models/sellerStaff.model');
const AuctionDealer = require('../models/auctionDealer.model');
const User = require('../models/user.model');
const { verifyAccessToken } = require('../services/auth/token.service');
const { createLogger } = require('../utils/logger');
const {
  SOCKET_EVENTS,
  TOKEN_AUDIENCE,
  GROUP_VISIBILITY,
  MEMBER_STATUS,
  ACCOUNT_STATUS,
} = require('../constants/enums');
const { rooms, setIo, subscribeToWorkerEmits } = require('./emitter');

const log = createLogger('SocketGateway');
const MAX_GROUP_ROOMS = 20; // per connection

/**
 * May this user follow a group live? (Same rule as the group page.)
 * @param {string} groupId - Group id
 * @param {string} userId - User
 * @param {string} [code] - Invite code
 * @returns {Promise<Object|null>} Lean group when allowed
 */
const canFollowGroup = async (groupId, userId, code, sellerId) => {
  if (!/^[a-f0-9]{24}$/.test(String(groupId))) return null;
  const group = await Group.findById(groupId)
    .select('visibility leaderId inviteCode memberCount targetSize status sellerId')
    .lean();
  if (!group) return null;
  // The dealer who won the group follows it (chat, purchases)
  if (sellerId && String(group.sellerId) === String(sellerId)) return group;
  if (group.visibility === GROUP_VISIBILITY.PUBLIC) return group;
  if (String(group.leaderId) === String(userId)) return group;
  if (code && String(code).toUpperCase() === group.inviteCode) return group;
  const member = await GroupMember.exists({
    groupId,
    userId,
    status: { $ne: MEMBER_STATUS.REJECTED },
  });
  return member ? group : null;
};

/**
 * Handshake auth: `auth: { token }` with the app access token.
 * @param {import('socket.io').Socket} socket
 * @param {Function} next
 */
const authenticate = (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('UNAUTHORIZED'));
  try {
    const payload = verifyAccessToken(token, TOKEN_AUDIENCE.APP);
    socket.data.userId = payload.sub;
    return next();
  } catch (err) {
    if (err.code === 'TOKEN_EXPIRED') return next(new Error('TOKEN_EXPIRED'));
  }
  // Admin console: a staff token joins only the staff room (alerts, monitor refresh)
  try {
    const payload = verifyAccessToken(token, TOKEN_AUDIENCE.STAFF);
    return User.findById(payload.sub)
      .select('staffRole status')
      .lean()
      .then((user) => {
        if (!user?.staffRole || user.status !== ACCOUNT_STATUS.ACTIVE)
          return next(new Error('UNAUTHORIZED'));
        socket.data.staffId = payload.sub;
        socket.data.staffRole = user.staffRole;
        return next();
      })
      .catch(() => next(new Error('UNAUTHORIZED')));
  } catch (err) {
    // The app / console refreshes its token and reconnects
    return next(new Error(err.code === 'TOKEN_EXPIRED' ? 'TOKEN_EXPIRED' : 'UNAUTHORIZED'));
  }
};

/**
 * Attach Socket.io to the HTTP server.
 * @param {import('http').Server} httpServer
 * @returns {Promise<Server>}
 */
const initSockets = async (httpServer) => {
  const io = new Server(httpServer, {
    cors: { origin: config.corsOrigins, credentials: true },
    serveClient: false,
    pingInterval: 25_000,
    pingTimeout: 20_000,
  });

  const redis = getRedis();
  if (redis) {
    io.adapter(createAdapter(redis.duplicate(), redis.duplicate()));
    await subscribeToWorkerEmits(io);
  }

  io.use(authenticate);
  io.on('connection', (socket) => {
    if (socket.data.staffId) {
      socket.join(rooms.staff());
      return; // staff sockets get no buyer or dealer rooms
    }
    const { userId } = socket.data;
    socket.join(rooms.user(userId));
    // Dealer team members also get their business room (rank updates, outbid)
    // (kept as a promise: an auction join sent right after connecting waits for it)
    const sellerReady = SellerStaff.findOne({ userId, status: 'active' })
      .select('sellerId')
      .lean()
      .then((membership) => {
        if (!membership) return;
        socket.data.sellerId = String(membership.sellerId);
        socket.join(rooms.seller(membership.sellerId));
      })
      .catch(() => {});

    // Dealer web: watch an auction the dealer joined (anonymous lowest price, timer)
    socket.on(SOCKET_EVENTS.AUCTION_JOIN, async ({ groupId } = {}, ack = () => {}) => {
      try {
        await sellerReady;
        if (!socket.data.sellerId || !/^[a-f0-9]{24}$/.test(String(groupId))) {
          return ack({ ok: false, error: 'NOT_FOUND' });
        }
        const joined = await AuctionDealer.exists({ groupId, sellerId: socket.data.sellerId });
        if (!joined) return ack({ ok: false, error: 'NOT_JOINED' });
        socket.join(rooms.auction(groupId));
        return ack({ ok: true });
      } catch (err) {
        log.error({ err: err.message, groupId }, '[SocketGateway] auction join failed');
        return ack({ ok: false, error: 'SERVER_ERROR' });
      }
    });

    socket.on(SOCKET_EVENTS.JOIN_GROUP, async ({ groupId, code } = {}, ack = () => {}) => {
      try {
        const joined = [...socket.rooms].filter((room) => room.startsWith('group:')).length;
        if (joined >= MAX_GROUP_ROOMS) return ack({ ok: false, error: 'TOO_MANY_ROOMS' });
        await sellerReady;
        const group = await canFollowGroup(groupId, userId, code, socket.data.sellerId);
        if (!group) return ack({ ok: false, error: 'NOT_FOUND' });
        socket.join(rooms.group(groupId));
        // Current state, so the app is correct right after (re)connecting
        return ack({
          ok: true,
          memberCount: group.memberCount,
          targetSize: group.targetSize,
          status: group.status,
        });
      } catch (err) {
        log.error({ err: err.message, groupId, userId }, '[SocketGateway] join failed');
        return ack({ ok: false, error: 'SERVER_ERROR' });
      }
    });

    socket.on(SOCKET_EVENTS.LEAVE_GROUP, ({ groupId } = {}) => {
      socket.leave(rooms.group(groupId));
    });
  });

  setIo(io);
  log.info({ redisAdapter: Boolean(redis) }, 'Socket.io ready');
  return io;
};

module.exports = { initSockets, canFollowGroup, authenticate };
