/**
 * Group deadlines (GRP-5, GRP-8) — run every minute by the deadline sweep job.
 * When an open buyer-led group passes its deadline:
 * - at ≥ 70% of target (settings.groups.earlyStartThresholdBps) with at least one member:
 *   the leader gets 48 h (leaderDecisionHours) to extend once or start the auction early;
 * - otherwise it expires (tokens refunded — Day 7).
 * If the leader does not choose in time, the group expires.
 * Seller-led deals at expiry depend on open question 4 and arrive on Day 9.
 */
const Group = require('../../models/group.model');
const { createLogger } = require('../../utils/logger');
const { getGroupSettings } = require('../settings.service');
const { transition, earlyStartMinimum } = require('./stateMachine');
const { GROUP_STATUS, GROUP_TYPE } = require('../../constants/enums');

const log = createLogger('GroupDeadlines');
const BATCH = 200;
const HOUR_MS = 60 * 60 * 1000;

/**
 * Expire one group, ignoring a race where someone else changed it first.
 * @param {Object} group - Group document
 * @param {string} reason - statusHistory reason
 * @param {Date} now - Sweep time
 * @returns {Promise<boolean>} true when expired by this call
 */
const expireGroup = async (group, reason, now) => {
  try {
    await transition(group, GROUP_STATUS.EXPIRED, { reason, ctx: { now } });
    return true;
  } catch (err) {
    if (err.code === 'GROUP_CHANGED') return false;
    throw err;
  }
};

/**
 * One sweep.
 * @param {Date} [now] - Current time (tests)
 * @returns {Promise<{ expired: number, awaitingLeader: number }>}
 */
const processDeadlines = async (now = new Date()) => {
  const settings = await getGroupSettings();
  let expired = 0;
  let awaitingLeader = 0;

  // 1. Deadline just passed and not yet handled
  const due = await Group.find({
    status: GROUP_STATUS.OPEN,
    type: GROUP_TYPE.BUYER_LED,
    deadline: { $lte: now },
    leaderDecisionDueAt: { $exists: false },
  }).limit(BATCH);

  for (const group of due) {
    const minimum = earlyStartMinimum(group.targetSize, settings.earlyStartThresholdBps);
    if (group.memberCount > 0 && group.memberCount >= minimum) {
      // Not a status change: the group stays open while the leader decides
      const result = await Group.updateOne(
        { _id: group._id, status: GROUP_STATUS.OPEN, leaderDecisionDueAt: { $exists: false } },
        {
          $set: {
            leaderDecisionDueAt: new Date(now.getTime() + settings.leaderDecisionHours * HOUR_MS),
          },
        },
      );
      if (result.modifiedCount) {
        awaitingLeader += 1;
        // TODO(Day 8): push + in-app notification to the leader
        log.info(
          { groupId: String(group._id), members: group.memberCount },
          'Leader decision window opened',
        );
      }
    } else if (await expireGroup(group, 'deadline_passed', now)) {
      expired += 1;
    }
  }

  // 2. Leader did not choose in time
  const undecided = await Group.find({
    status: GROUP_STATUS.OPEN,
    leaderDecisionDueAt: { $lte: now },
  }).limit(BATCH);
  for (const group of undecided) {
    if (await expireGroup(group, 'leader_decision_timeout', now)) expired += 1;
  }

  if (expired || awaitingLeader) log.info({ expired, awaitingLeader }, 'Deadline sweep finished');
  return { expired, awaitingLeader };
};

module.exports = { processDeadlines };
