/**
 * Admin → Settings (F35): partial updates are validated per section, merged over what is
 * stored, saved and the cache cleared; before / after are returned for the audit log.
 */
jest.mock('../../../src/services/settings.service', () => {
  const actual = jest.requireActual('../../../src/services/settings.service');
  return {
    ...actual,
    getSettings: jest.fn(async (key) => ({ ...actual.DEFAULTS[key] })),
    clearSettingsCache: jest.fn(),
  };
});

const Setting = require('../../../src/models/setting.model');
const { clearSettingsCache } = require('../../../src/services/settings.service');
const {
  updateSection,
  getAllSettings,
} = require('../../../src/services/admin/adminSettings.service');

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

it('merges a partial update over the stored values', async () => {
  jest
    .spyOn(Setting, 'findOne')
    .mockReturnValue({ lean: async () => ({ value: { friendCreditPaise: 5_000 } }) });
  const save = jest.spyOn(Setting, 'updateOne').mockResolvedValue({});
  await updateSection('referrals', { leaderBonusPaise: 25_000 }, 'staff1');
  expect(save.mock.calls[0][1].$set.value).toEqual({
    friendCreditPaise: 5_000,
    leaderBonusPaise: 25_000,
  });
  expect(clearSettingsCache).toHaveBeenCalled();
});

it.each([
  ['referrals', { friendCreditPaise: -1 }],
  ['flags', { maintenanceMode: 'yes' }],
  ['billing', { gstin: 'NOT-A-GSTIN' }],
  ['billing', { invoicePrefix: 'sm' }],
  ['groups', { earlyStartThresholdBps: 1000 }],
  ['flags', { unknownFlag: true }],
])('rejects %s %j', async (key, changes) => {
  await expect(updateSection(key, changes, 'staff1')).rejects.toMatchObject({ statusCode: 422 });
});

it('lists every editable section with defaults', async () => {
  const all = await getAllSettings();
  expect(Object.keys(all)).toEqual([
    'groups',
    'auctions',
    'payments',
    'purchases',
    'billing',
    'referrals',
    'alerts',
    'flags',
  ]);
  expect(all.flags.defaults.maintenanceMode).toBe(false);
});
