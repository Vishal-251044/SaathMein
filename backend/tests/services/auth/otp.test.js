/**
 * Unit tests for OTP abuse limits (ACC-4): 3 requests per 10 minutes per phone,
 * Indian numbers only, suspended accounts blocked.
 */
jest.mock('../../../src/models/user.model', () => ({ findOne: jest.fn() }));

const User = require('../../../src/models/user.model');
const { requestOtp } = require('../../../src/services/auth/auth.service');
const { resetMemoryCounters } = require('../../../src/services/rateLimit.service');

/** Mimic `User.findOne(...).select(...)`. */
const userLookupReturns = (doc) =>
  User.findOne.mockReturnValue({ select: () => Promise.resolve(doc) });

describe('requestOtp abuse limits', () => {
  beforeEach(() => {
    resetMemoryCounters();
    userLookupReturns(null);
  });

  it('allows 3 OTP requests per number in 10 minutes, then returns 429', async () => {
    const phone = '+919876543210';
    for (let i = 0; i < 3; i += 1) {
      // Different devices, so only the per-phone limit applies
      await expect(requestOtp({ phone, deviceId: `device-000${i}` })).resolves.toEqual({ phone });
    }
    await expect(requestOtp({ phone, deviceId: 'device-0009' })).rejects.toMatchObject({
      statusCode: 429,
      code: 'OTP_LIMIT',
      details: { retryAfterSeconds: expect.any(Number) },
    });
  });

  it('limits one device cycling through many numbers', async () => {
    const deviceId = 'device-cycling';
    for (let i = 0; i < 5; i += 1) {
      await requestOtp({ phone: `+91987654320${i}`, deviceId });
    }
    await expect(requestOtp({ phone: '+919876543299', deviceId })).rejects.toMatchObject({
      statusCode: 429,
    });
  });

  it('accepts only valid Indian mobile numbers', async () => {
    await expect(requestOtp({ phone: '+15551234567' })).rejects.toMatchObject({
      statusCode: 422,
      code: 'INVALID_PHONE',
    });
    await expect(requestOtp({ phone: '+911234567890' })).rejects.toMatchObject({ statusCode: 422 });
  });

  it('blocks suspended accounts', async () => {
    userLookupReturns({ status: 'suspended' });
    await expect(requestOtp({ phone: '+919812345678' })).rejects.toMatchObject({
      statusCode: 403,
      code: 'ACCOUNT_SUSPENDED',
    });
  });
});
