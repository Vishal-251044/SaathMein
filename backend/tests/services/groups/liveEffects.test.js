/**
 * Live effects (LIV-1, LIV-3): every status change is broadcast; "group full" and
 * "dealers are bidding" reach members; when a group ends, members are told (recipients
 * read before refunds change their status); the 24 h reminder is sent once; a seat freed
 * at night is held from 08:00 so nobody loses it while asleep.
 */
jest.mock('../../../src/services/groups/groupLive', () => ({
  publishGroupStatus: jest.fn(),
  notifyGroupMembers: jest.fn(async () => 1),
  notifyAboutGroup: jest.fn(),
  groupRecipients: jest.fn(async () => ['u1', 'u2']),
  publishGroupCount: jest.fn(),
}));
jest.mock('../../../src/services/payments/refund.service', () => ({
  refundGroupMembers: jest.fn(async () => 2),
  queueRefund: jest.fn(),
  REFUND_REASON: {
    GROUP_EXPIRED: 'group_expired',
    NO_DEAL: 'no_deal',
    GROUP_CANCELLED: 'group_cancelled',
  },
}));
jest.mock('../../../src/services/auction/settlement.service', () => ({
  reverseGroupTransfers: jest.fn(async () => ({ reversed: 0, failed: 0 })),
}));
jest.mock('../../../src/jobs/queues', () => ({ scheduleAuctionClose: jest.fn() }));
jest.mock('../../../src/models/group.model', () => ({
  find: jest.fn(),
  findById: jest.fn(),
  updateOne: jest.fn(),
}));
jest.mock('../../../src/models/groupMember.model', () => ({
  countDocuments: jest.fn(async () => 0),
  findOneAndUpdate: jest.fn(),
}));
jest.mock('../../../src/services/settings.service', () => ({
  getPaymentSettings: jest.fn(async () => ({ waitlistOfferHours: 2 })),
  getGroupSettings: jest.fn(async () => ({})),
}));

const Group = require('../../../src/models/group.model');
const GroupMember = require('../../../src/models/groupMember.model');
const live = require('../../../src/services/groups/groupLive');
const { refundGroupMembers } = require('../../../src/services/payments/refund.service');
const { scheduleAuctionClose } = require('../../../src/jobs/queues');
const { runGroupEffects } = require('../../../src/services/groups/groupEffects');
const { sendDeadlineReminders } = require('../../../src/services/groups/deadline.service');
const { offerNextSeat } = require('../../../src/services/groups/membership.service');

beforeEach(() => jest.clearAllMocks());

describe('group effects', () => {
  it('broadcasts the status and tells members when the group is full', async () => {
    await runGroupEffects({ _id: 'g1', status: 'full' }, 'open');
    expect(live.publishGroupStatus).toHaveBeenCalledWith({ _id: 'g1', status: 'full' });
    expect(live.notifyGroupMembers).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'g1' }),
      'group_full',
    );
  });

  it('schedules the close and announces the auction', async () => {
    await runGroupEffects({ _id: 'g1', status: 'auction_live' }, 'full');
    expect(scheduleAuctionClose).toHaveBeenCalled();
    expect(live.notifyGroupMembers).toHaveBeenCalledWith(expect.anything(), 'auction_started');
  });

  it('reads who to tell before refunding, then tells them', async () => {
    const order = [];
    live.groupRecipients.mockImplementationOnce(async () => {
      order.push('recipients');
      return ['u1', 'u2'];
    });
    refundGroupMembers.mockImplementationOnce(async () => {
      order.push('refunds');
      return 2;
    });
    await runGroupEffects({ _id: 'g1', status: 'expired' }, 'open');
    expect(order).toEqual(['recipients', 'refunds']);
    expect(live.notifyGroupMembers).toHaveBeenCalledWith(
      expect.anything(),
      'group_ended',
      {},
      { userIds: ['u1', 'u2'] },
    );
  });
});

describe('reminders and seat offers', () => {
  it('sends the 24 h reminder once per group', async () => {
    Group.find.mockReturnValue({
      limit: () => ({ lean: async () => [{ _id: 'g1' }, { _id: 'g2' }] }),
    });
    Group.updateOne
      .mockResolvedValueOnce({ modifiedCount: 1 })
      .mockResolvedValueOnce({ modifiedCount: 0 });
    expect(await sendDeadlineReminders(new Date('2026-11-08T06:30:00Z'))).toBe(1);
    expect(live.notifyGroupMembers).toHaveBeenCalledTimes(1);
    expect(live.notifyGroupMembers).toHaveBeenCalledWith({ _id: 'g1' }, 'deadline_soon');
  });

  it('a seat freed at 23:00 IST is held until 10:00 IST, and the person is told', async () => {
    Group.findById.mockReturnValue({
      select: () => ({ lean: async () => ({ status: 'full', memberCount: 9, targetSize: 10 }) }),
    });
    GroupMember.findOneAndUpdate.mockResolvedValueOnce({ userId: 'u9' });
    await offerNextSeat('g1', new Date('2026-11-08T17:30:00Z'));
    expect(GroupMember.findOneAndUpdate.mock.calls[0][1].$set.offerExpiresAt).toEqual(
      new Date('2026-11-09T04:30:00Z'),
    );
    expect(live.notifyAboutGroup).toHaveBeenCalledWith('u9', 'g1', 'seat_offer');
  });
});
