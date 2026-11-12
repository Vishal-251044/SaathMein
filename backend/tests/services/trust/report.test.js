/**
 * Reports (TRU-3) and phone privacy: one report per person and target, only things the
 * reporter can see, no self-reports; Support actions per target type; a decision closes
 * every open report on the target; hiding a review recomputes the rating. Dealers see
 * phones masked until the exit window ends (decided 12 Nov 2026).
 */
jest.mock('../../../src/services/trust/rating.service', () => ({
  recomputeSellerRating: jest.fn(),
}));
jest.mock('../../../src/services/trust/penalty.service', () => ({ applyPenalties: jest.fn() }));
jest.mock('../../../src/services/chat/chat.service', () => ({
  reportMessage: jest.fn(async () => ({})),
}));

const { Types } = require('mongoose');
const Group = require('../../../src/models/group.model');
const GroupMember = require('../../../src/models/groupMember.model');
const Message = require('../../../src/models/message.model');
const Report = require('../../../src/models/report.model');
const Review = require('../../../src/models/review.model');
const Seller = require('../../../src/models/seller.model');
const { recomputeSellerRating } = require('../../../src/services/trust/rating.service');
const { applyPenalties } = require('../../../src/services/trust/penalty.service');
const { reportMessage } = require('../../../src/services/chat/chat.service');
const reports = require('../../../src/services/trust/report.service');
const { phoneForDealer } = require('../../../src/services/trust/privacy');

const userId = String(new Types.ObjectId());
const groupId = String(new Types.ObjectId());
const lean = (value) => ({
  select: () => lean(value),
  populate: () => lean(value),
  lean: async () => value,
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('createReport', () => {
  it('reports a public group', async () => {
    jest.spyOn(Group, 'findById').mockReturnValue(lean({ visibility: 'public' }));
    const create = jest.spyOn(Report, 'create').mockResolvedValue({ _id: 'r1', status: 'open' });
    await reports.createReport(userId, { targetType: 'group', targetId: groupId, reason: 'fraud' });
    expect(create.mock.calls[0][0]).toMatchObject({
      reporterId: userId,
      targetType: 'group',
      reason: 'fraud',
    });
  });

  it('cannot see a community group it is not in', async () => {
    jest.spyOn(Group, 'findById').mockReturnValue(lean({ visibility: 'community' }));
    jest.spyOn(GroupMember, 'exists').mockResolvedValue(null);
    jest.spyOn(Group, 'exists').mockResolvedValue(null);
    await expect(
      reports.createReport(userId, { targetType: 'group', targetId: groupId, reason: 'spam' }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('chat messages also count toward the automatic hide', async () => {
    const messageId = String(new Types.ObjectId());
    jest.spyOn(Message, 'findById').mockReturnValue(lean({ groupId, senderId: 'other' }));
    jest.spyOn(GroupMember, 'exists').mockResolvedValue({ _id: 'm' });
    jest.spyOn(Report, 'create').mockResolvedValue({ _id: 'r1', status: 'open' });
    await reports.createReport(userId, {
      targetType: 'message',
      targetId: messageId,
      reason: 'abuse',
    });
    expect(reportMessage).toHaveBeenCalledWith(groupId, userId, messageId, 'abuse');
  });

  it('refuses my own message and a second report of the same thing', async () => {
    jest.spyOn(Message, 'findById').mockReturnValue(lean({ groupId, senderId: userId }));
    jest.spyOn(GroupMember, 'exists').mockResolvedValue({ _id: 'm' });
    await expect(
      reports.createReport(userId, { targetType: 'message', targetId: groupId, reason: 'abuse' }),
    ).rejects.toMatchObject({ code: 'OWN_TARGET' });

    jest.spyOn(Seller, 'exists').mockResolvedValue({ _id: 's' });
    jest
      .spyOn(Report, 'create')
      .mockRejectedValue(Object.assign(new Error('dup'), { code: 11000 }));
    await expect(
      reports.createReport(userId, {
        targetType: 'seller',
        targetId: groupId,
        reason: 'price_not_honoured',
      }),
    ).rejects.toMatchObject({ code: 'ALREADY_REPORTED' });
  });
});

describe('decideReport', () => {
  const open = (targetType) => ({
    _id: 'r1',
    targetType,
    targetId: new Types.ObjectId(),
    status: 'open',
  });
  const given = (report) => {
    jest
      .spyOn(Report, 'findById')
      .mockReturnValueOnce(lean(report))
      .mockReturnValueOnce(lean({ ...report, status: 'resolved' }));
    return jest.spyOn(Report, 'updateMany').mockResolvedValue({ modifiedCount: 3 });
  };

  it('hiding a review recomputes the dealer rating and closes every report on it', async () => {
    const report = open('review');
    const close = given(report);
    jest.spyOn(Review, 'findByIdAndUpdate').mockReturnValue(lean({ sellerId: 's1' }));
    const result = await reports.decideReport(
      'r1',
      { action: 'hide_content', note: 'Fake review from a rival' },
      'staff',
    );
    expect(recomputeSellerRating).toHaveBeenCalledWith('s1');
    expect(close.mock.calls[0][0]).toEqual({
      targetType: 'review',
      targetId: report.targetId,
      status: 'open',
    });
    expect(result.closed).toBe(3);
  });

  it('warns the dealer of a reported seller', async () => {
    given(open('seller'));
    await reports.decideReport(
      'r1',
      { action: 'warn_seller', note: 'Several price complaints' },
      'staff',
    );
    expect(applyPenalties).toHaveBeenCalledWith(
      expect.anything(),
      ['warning'],
      expect.objectContaining({ staffId: 'staff' }),
    );
  });

  it('refuses actions that do not fit the target', async () => {
    jest.spyOn(Report, 'findById').mockReturnValue(lean(open('group')));
    await expect(
      reports.decideReport(
        'r1',
        { action: 'hide_content', note: 'Not possible for groups' },
        'staff',
      ),
    ).rejects.toMatchObject({ code: 'INVALID_ACTION' });
  });
});

describe('phone privacy for dealers', () => {
  const now = new Date('2026-11-12T10:00:00Z');
  it('masked during the exit window, full after it', () => {
    expect(phoneForDealer('+919876543210', new Date(now.getTime() + 1000), now)).toEqual({
      phone: '+91******3210',
      phoneMasked: true,
    });
    expect(phoneForDealer('+919876543210', new Date(now.getTime() - 1000), now)).toEqual({
      phone: '+919876543210',
      phoneMasked: false,
    });
    expect(phoneForDealer('+919876543210', null, now).phoneMasked).toBe(true);
    expect(phoneForDealer(null, null, now)).toEqual({ phone: null, phoneMasked: false });
  });
});
