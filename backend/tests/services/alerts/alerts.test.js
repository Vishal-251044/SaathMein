/**
 * Alerts (MON-4): a new alert is saved once, shown live in the console and emailed
 * (Owner + the role that handles it) with a push to the Owner's linked phone; repeats of
 * an open alert only count up. Rules: payment success rate, stuck refunds, pending
 * transfers, queue backlog.
 */
jest.mock('../../../src/services/email.service', () => ({ sendEmail: jest.fn() }));
jest.mock('../../../src/sockets/emitter', () => ({ emitToStaff: jest.fn() }));
jest.mock('../../../src/services/notifications/notification.service', () => ({
  notifyUsers: jest.fn(),
}));
jest.mock('../../../src/jobs/queues', () => ({
  getQueue: jest.fn(() => null),
  QUEUE_NAMES: { REFUNDS: 'refunds' },
}));
jest.mock('../../../src/services/settings.service', () => ({
  getSettings: jest.fn(async () => ({
    ownerPushPhone: '+919800000001',
    paymentSuccessMinBps: 9000,
    paymentSuccessMinSample: 10,
    refundStuckHours: 24,
    transferPendingHours: 24,
    queueBacklogMax: 200,
  })),
}));

const { Types } = require('mongoose');
const Alert = require('../../../src/models/alert.model');
const User = require('../../../src/models/user.model');
const Payment = require('../../../src/models/payment.model');
const { sendEmail } = require('../../../src/services/email.service');
const { emitToStaff } = require('../../../src/sockets/emitter');
const { notifyUsers } = require('../../../src/services/notifications/notification.service');
const { raiseAlert } = require('../../../src/services/alerts/alert.service');
const {
  successRateBps,
  runAlertRules,
} = require('../../../src/services/alerts/alertRules.service');

const lean = (value) => ({ lean: async () => value });
const input = {
  type: 'payment',
  severity: 'critical',
  title: 'Webhook failed',
  subjectType: 'payment',
  subjectId: 'p1',
  dedupeKey: 'webhook:evt_1',
};

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('raiseAlert', () => {
  it('saves a new alert, shows it live, emails staff and pushes to the Owner phone', async () => {
    const ownerId = new Types.ObjectId();
    jest.spyOn(Alert, 'findOneAndUpdate').mockReturnValue(lean(null));
    jest
      .spyOn(Alert, 'create')
      .mockResolvedValue({ toObject: () => ({ _id: 'a1', ...input, count: 1, status: 'open' }) });
    jest
      .spyOn(User, 'find')
      .mockReturnValue({ select: () => lean([{ email: 'owner@x.in' }, { email: 'fin@x.in' }]) });
    jest.spyOn(User, 'findOne').mockReturnValue({ select: () => lean({ _id: ownerId }) });

    const view = await raiseAlert(input);

    expect(view).toMatchObject({
      id: 'a1',
      title: 'Webhook failed',
      link: '/admin/monitor/payments',
    });
    expect(emitToStaff).toHaveBeenCalledWith('alert:new', expect.objectContaining({ id: 'a1' }));
    expect(User.find.mock.calls[0][0].staffRole.$in).toEqual(['owner', 'finance']);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: ['owner@x.in', 'fin@x.in'] }),
    );
    expect(User.findOne.mock.calls[0][0].phone).toBe('+919800000001');
    expect(notifyUsers).toHaveBeenCalledWith(
      [ownerId],
      'staff_alert',
      expect.objectContaining({ title: 'Webhook failed' }),
    );
  });

  it('a repeat of an open alert only counts up (no new email or push)', async () => {
    jest
      .spyOn(Alert, 'findOneAndUpdate')
      .mockReturnValue(lean({ _id: 'a1', ...input, count: 2, status: 'open' }));
    const create = jest.spyOn(Alert, 'create');
    const view = await raiseAlert(input);
    expect(view.count).toBe(2);
    expect(create).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(emitToStaff).not.toHaveBeenCalled();
  });

  it('never throws (alerting must not break the caller)', async () => {
    jest.spyOn(Alert, 'findOneAndUpdate').mockReturnValue({
      lean: async () => {
        throw new Error('db down');
      },
    });
    await expect(raiseAlert(input)).resolves.toBeNull();
  });
});

describe('alert rules', () => {
  it('successRateBps', () => {
    expect(successRateBps(9, 1)).toBe(9000);
    expect(successRateBps(0, 0)).toBeNull();
  });

  it('fires the payment success-rate alert below 90% with enough payments', async () => {
    jest
      .spyOn(Payment, 'countDocuments')
      .mockResolvedValueOnce(8) // captured
      .mockResolvedValueOnce(4) // failed → 66.7%
      .mockResolvedValue(0); // nothing stuck / pending
    jest.spyOn(Alert, 'findOneAndUpdate').mockReturnValue(lean(null));
    jest
      .spyOn(Alert, 'create')
      .mockImplementation(async (doc) => ({ toObject: () => ({ _id: 'a', ...doc, count: 1 }) }));
    jest.spyOn(User, 'find').mockReturnValue({ select: () => lean([]) });
    jest.spyOn(User, 'findOne').mockReturnValue({ select: () => lean(null) });

    expect(await runAlertRules(new Date())).toBe(1);
    expect(Alert.create.mock.calls[0][0]).toMatchObject({
      dedupeKey: 'payments:success-rate',
      severity: 'critical',
    });
  });

  it('stays quiet with too few payments to judge', async () => {
    jest
      .spyOn(Payment, 'countDocuments')
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValue(0);
    const create = jest.spyOn(Alert, 'create');
    expect(await runAlertRules(new Date())).toBe(0);
    expect(create).not.toHaveBeenCalled();
  });
});
