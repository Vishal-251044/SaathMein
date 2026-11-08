/**
 * Notifications (LIV-3, LIV-4): quiet hours 22:00–08:00 IST, texts in the user's language,
 * in-app item + live socket event always, push now or deferred to 08:00, dead Expo tokens
 * removed, push tokens move between accounts, read / unread.
 */
jest.mock('../../../src/models/notification.model', () => ({
  insertMany: jest.fn(async (docs) =>
    docs.map((doc, i) => ({ _id: `n${i}`, createdAt: new Date(), ...doc })),
  ),
  find: jest.fn(),
  updateMany: jest.fn(),
  countDocuments: jest.fn(async () => 2),
}));
jest.mock('../../../src/models/user.model', () => ({
  find: jest.fn(),
  updateOne: jest.fn(),
  updateMany: jest.fn(),
}));
jest.mock('../../../src/sockets/emitter', () => ({ emitToUser: jest.fn() }));

const Notification = require('../../../src/models/notification.model');
const User = require('../../../src/models/user.model');
const { emitToUser } = require('../../../src/sockets/emitter');
const service = require('../../../src/services/notifications/notification.service');

const DAY = new Date('2026-11-08T06:30:00Z'); // 12:00 IST
const NIGHT = new Date('2026-11-08T17:30:00Z'); // 23:00 IST

const users = [
  {
    _id: 'u1',
    language: 'hi',
    status: 'active',
    pushTokens: [{ token: 'ExponentPushToken[aaa]' }],
  },
  { _id: 'u2', language: 'en', status: 'active', pushTokens: [] },
];

beforeEach(() => {
  jest.clearAllMocks();
  User.find.mockReturnValue({ select: () => ({ lean: async () => users }) });
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ data: [{ status: 'ok' }] }),
  }));
});

describe('quiet hours (IST)', () => {
  it.each([
    ['2026-11-08T16:29:00Z', false], // 21:59
    ['2026-11-08T16:30:00Z', true], // 22:00
    ['2026-11-08T20:00:00Z', true], // 01:30
    ['2026-11-09T02:29:00Z', true], // 07:59
    ['2026-11-09T02:30:00Z', false], // 08:00
  ])('%s → %s', (iso, quiet) => {
    expect(service.isQuietHours(new Date(iso))).toBe(quiet);
  });

  it('defers to the next 08:00 IST', () => {
    expect(service.quietHoursEnd(NIGHT).toISOString()).toBe('2026-11-09T02:30:00.000Z');
    expect(service.quietHoursEnd(new Date('2026-11-08T20:00:00Z')).toISOString()).toBe(
      '2026-11-09T02:30:00.000Z',
    );
    expect(service.quietHoursEnd(new Date('2026-11-08T22:00:00Z')).toISOString()).toBe(
      '2026-11-09T02:30:00.000Z',
    ); // 03:30 IST
  });
});

describe('notifyUsers', () => {
  it('saves each notification in the user language, sends it live and pushes by day', async () => {
    expect(
      await service.notifyUsers(
        ['u1', 'u2', 'u1'],
        'refund_done',
        { amount: '₹1,000', groupId: 'g1', url: '/group/g1' },
        { now: DAY },
      ),
    ).toBe(2);
    const docs = Notification.insertMany.mock.calls[0][0];
    expect(docs[0]).toMatchObject({
      userId: 'u1',
      title: 'रिफ़ंड हो गया',
      data: { type: 'refund_done', groupId: 'g1', url: '/group/g1' },
      push: { status: 'sent' },
    });
    expect(docs[1]).toMatchObject({ userId: 'u2', title: 'Refund done', push: { status: 'none' } });
    expect(emitToUser).toHaveBeenCalledTimes(2);
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body).toEqual([
      expect.objectContaining({ to: 'ExponentPushToken[aaa]', title: 'रिफ़ंड हो गया' }),
    ]);
  });

  it('waits until 08:00 during quiet hours (in-app item still appears)', async () => {
    await service.notifyUsers(
      ['u1'],
      'group_full',
      { productName: 'Activa', targetSize: 10 },
      { now: NIGHT },
    );
    expect(Notification.insertMany.mock.calls[0][0][0].push).toEqual({
      status: 'deferred',
      sendAfter: new Date('2026-11-09T02:30:00Z'),
    });
    expect(emitToUser).toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('never throws (notifying must not break the action)', async () => {
    Notification.insertMany.mockRejectedValueOnce(new Error('db down'));
    await expect(service.notifyUsers(['u1'], 'group_full', {}, { now: DAY })).resolves.toBe(0);
  });
});

describe('Expo push', () => {
  it('removes tokens of uninstalled apps', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        data: [{ status: 'error', details: { error: 'DeviceNotRegistered' } }],
      }),
    }));
    expect(
      await service.sendExpoPush([
        { to: 'ExponentPushToken[dead]', title: 't', body: 'b', data: {}, userId: 'u1' },
      ]),
    ).toEqual({ sent: 0, failed: 1 });
    expect(User.updateOne).toHaveBeenCalledWith(
      { _id: 'u1' },
      { $pull: { pushTokens: { token: 'ExponentPushToken[dead]' } } },
    );
  });

  it('sends deferred pushes after 08:00 and marks them sent', async () => {
    Notification.find.mockReturnValue({
      limit: () => ({
        lean: async () => [{ _id: 'n1', userId: 'u1', title: 't', body: 'b', data: {} }],
      }),
    });
    User.find.mockReturnValue({ select: () => ({ lean: async () => users }) });
    expect(await service.sendDeferredPushes(DAY)).toBe(1);
    expect(Notification.updateMany).toHaveBeenCalledWith(
      { _id: { $in: ['n1'] } },
      { $set: { 'push.status': 'sent' } },
    );
    expect(global.fetch).toHaveBeenCalled();
    expect(await service.sendDeferredPushes(NIGHT)).toBe(0);
  });

  it('moves a push token to the account now using the phone', async () => {
    await service.registerPushToken('u2', { token: 'ExponentPushToken[aaa]', platform: 'android' });
    expect(User.updateMany).toHaveBeenCalledWith(
      { _id: { $ne: 'u2' } },
      { $pull: { pushTokens: { token: 'ExponentPushToken[aaa]' } } },
    );
    expect(User.updateOne).toHaveBeenLastCalledWith(
      { _id: 'u2' },
      {
        $push: {
          pushTokens: {
            $each: [expect.objectContaining({ token: 'ExponentPushToken[aaa]' })],
            $slice: -5,
          },
        },
      },
    );
    User.updateOne.mockClear();
    await service.registerPushToken('u2', { token: 'not-a-token', platform: 'android' });
    expect(User.updateOne).not.toHaveBeenCalled();
  });

  it('marks all read and returns what is left unread', async () => {
    expect(await service.markRead('u1', { all: true })).toBe(2);
    expect(Notification.updateMany).toHaveBeenCalledWith(
      { userId: 'u1', read: false },
      { $set: { read: true, readAt: expect.any(Date) } },
    );
  });
});
