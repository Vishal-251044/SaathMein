/**
 * Group lifecycle state machine (PRD §10.3, GRP-8). The ONLY place that changes
 * `group.status` (CLAUDE.md §8). Every change is checked against the allowed transitions
 * and that edge's guard, then written with the current status as an optimistic lock, so
 * two processes (a job and a user) can never both move the same group.
 *
 * open → full → auction_live → won → purchasing → completed
 *               (seller-led: full → won)          purchasing → runner_up → purchasing
 * Failure endings: expired, no_deal, cancelled (tokens refunded — Day 7).
 */
const Group = require('../../models/group.model');
const ApiError = require('../../utils/ApiError');
const { createLogger } = require('../../utils/logger');
const { runGroupEffects } = require('./groupEffects');
const { GROUP_STATUS: S, GROUP_TYPE } = require('../../constants/enums');

const log = createLogger('GroupStateMachine');

/** Allowed next statuses for each status. Terminal statuses allow nothing. */
const TRANSITIONS = Object.freeze({
  [S.OPEN]: [S.FULL, S.AUCTION_LIVE, S.EXPIRED, S.CANCELLED],
  [S.FULL]: [S.AUCTION_LIVE, S.WON, S.CANCELLED],
  [S.AUCTION_LIVE]: [S.WON, S.NO_DEAL, S.CANCELLED],
  [S.WON]: [S.PURCHASING, S.CANCELLED],
  [S.PURCHASING]: [S.COMPLETED, S.RUNNER_UP, S.CANCELLED],
  [S.RUNNER_UP]: [S.PURCHASING, S.NO_DEAL, S.CANCELLED],
  [S.COMPLETED]: [],
  [S.EXPIRED]: [],
  [S.NO_DEAL]: [],
  [S.CANCELLED]: [],
});

const TERMINAL = new Set([S.COMPLETED, S.EXPIRED, S.NO_DEAL, S.CANCELLED]);

/**
 * Members needed to start the auction early at the deadline (GRP-5): ceil(target × threshold).
 * @param {number} targetSize - Group target
 * @param {number} thresholdBps - e.g. 7000 = 70%
 * @returns {number}
 */
const earlyStartMinimum = (targetSize, thresholdBps) =>
  Math.max(1, Math.ceil((targetSize * thresholdBps) / 10000));

/**
 * Guards per edge `from>to`. Each returns an error message when the move is not allowed.
 * `ctx.now` is the current time; other ctx fields are listed per guard.
 */
const GUARDS = {
  [`${S.OPEN}>${S.FULL}`]: (group) =>
    group.memberCount >= group.targetSize ? null : 'The group has not reached its target yet',

  // Early start after the deadline at ≥ threshold (ctx.thresholdBps). Buyer-led only.
  [`${S.OPEN}>${S.AUCTION_LIVE}`]: (group, ctx) => {
    if (group.type !== GROUP_TYPE.BUYER_LED) return 'Only buyer-led groups have an auction';
    if (group.deadline > ctx.now) return 'The auction can start early only after the deadline';
    if (!ctx.thresholdBps) return 'Early start threshold is missing';
    const minimum = earlyStartMinimum(group.targetSize, ctx.thresholdBps);
    return group.memberCount >= minimum
      ? null
      : `At least ${minimum} of ${group.targetSize} members are needed to start early`;
  },

  [`${S.OPEN}>${S.EXPIRED}`]: (group, ctx) =>
    group.deadline <= ctx.now ? null : 'The deadline has not passed yet',

  [`${S.FULL}>${S.AUCTION_LIVE}`]: (group) =>
    group.type === GROUP_TYPE.BUYER_LED ? null : 'Only buyer-led groups have an auction',

  [`${S.FULL}>${S.WON}`]: (group) =>
    group.type === GROUP_TYPE.SELLER_LED ? null : 'Buyer-led groups are won through the auction',

  // Lowest bid wins (ctx.winnerBidId from auction close)
  [`${S.AUCTION_LIVE}>${S.WON}`]: (group, ctx) =>
    ctx.winnerBidId ? null : 'A winning bid is required',

  [`${S.PURCHASING}>${S.RUNNER_UP}`]: (group, ctx) =>
    ctx.runnerUpBidId || group.auction?.runnerUpBidId ? null : 'There is no runner-up offer',
};

/**
 * Is `from → to` an allowed edge?
 * @param {string} from - Current status
 * @param {string} to - Next status
 * @returns {boolean}
 */
const canTransition = (from, to) => Boolean(TRANSITIONS[from]?.includes(to));

/**
 * Throw if the group may not move to `to` right now.
 * @param {Object} group - Group (document or lean)
 * @param {string} to - Next status
 * @param {Object} [ctx] - Guard context (`now`, `thresholdBps`, `winnerBidId`, `reason`)
 * @throws {ApiError} 409 INVALID_TRANSITION, 422 TRANSITION_BLOCKED / REASON_REQUIRED
 */
const assertTransition = (group, to, ctx = {}) => {
  const from = group.status;
  if (!canTransition(from, to)) {
    throw ApiError.conflict(`A group cannot go from ${from} to ${to}`, {
      code: 'INVALID_TRANSITION',
      details: { from, to },
    });
  }
  if (to === S.CANCELLED && !ctx.reason) {
    throw new ApiError(422, 'Cancelling a group needs a reason', { code: 'REASON_REQUIRED' });
  }
  const guard = GUARDS[`${from}>${to}`];
  const blocked = guard ? guard(group, { now: new Date(), ...ctx }) : null;
  if (blocked) {
    throw new ApiError(422, blocked, { code: 'TRANSITION_BLOCKED', details: { from, to } });
  }
};

/**
 * Move a group to a new status.
 * @param {string|Object} groupOrId - Group id, or an already loaded group
 * @param {string} to - Next status
 * @param {Object} options
 * @param {string} options.reason - Why (stored in statusHistory; required for cancel)
 * @param {{ type: 'system'|'user'|'staff', id?: string }} [options.actor] - Who caused it
 * @param {Object} [options.set] - Extra fields to set in the same write (e.g. auction times)
 * @param {Object} [options.unset] - Fields to remove in the same write
 * @param {Object} [options.ctx] - Guard context
 * @param {import('mongoose').ClientSession} [options.session] - Transaction session. Inside a
 *   transaction, side effects are NOT run: call runGroupEffects(group, from) after commit.
 * @returns {Promise<Object>} The updated group document
 * @throws {ApiError} 404, 409 GROUP_CHANGED (status changed meanwhile), guard errors
 */
const transition = async (
  groupOrId,
  to,
  { reason, actor = { type: 'system' }, set = {}, unset, ctx = {}, session } = {},
) => {
  const group =
    typeof groupOrId === 'object' && groupOrId.status
      ? groupOrId
      : await Group.findById(groupOrId).session(session || null);
  if (!group) throw ApiError.notFound('Group not found');

  const from = group.status;
  const now = ctx.now || new Date(); // jobs pass the time they run for
  assertTransition(group, to, { ...ctx, now, reason });

  const update = {
    $set: { ...set, status: to },
    $push: {
      statusHistory: { from, to, reason, byType: actor.type, by: actor.id, at: now },
    },
    ...(unset ? { $unset: unset } : {}),
  };
  // Optimistic lock: only applies if nobody changed the status since we read it
  const updated = await Group.findOneAndUpdate({ _id: group._id, status: from }, update, {
    new: true,
    session,
    stateMachine: true,
  });
  if (!updated) {
    throw ApiError.conflict('This group changed a moment ago. Please refresh.', {
      code: 'GROUP_CHANGED',
    });
  }

  log.info(
    { groupId: String(group._id), from, to, reason, actor: actor.type },
    'Group status changed',
  );
  if (!session) await runGroupEffects(updated, from);
  return updated;
};

module.exports = {
  TRANSITIONS,
  TERMINAL,
  canTransition,
  assertTransition,
  transition,
  earlyStartMinimum,
};
