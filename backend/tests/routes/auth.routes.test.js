/**
 * Route tests for /api/auth and /api/admin/auth: validation, Firebase not configured,
 * and the CSRF header on cookie routes. No database is needed for these paths.
 */
// Pretend MongoDB is connected so requests reach the auth routes
jest.mock('../../src/config/db', () => ({
  ...jest.requireActual('../../src/config/db'),
  getDBStatus: () => 'connected',
}));

const request = require('supertest');
const app = require('../../src/app');

describe('/api/auth routes', () => {
  it('validates the phone number format (422)', async () => {
    const res = await request(app).post('/api/auth/otp/request').send({ phone: '98765' });
    expect(res.status).toBe(422);
    expect(res.body.error.details[0]).toMatchObject({ in: 'body', field: 'phone' });
  });

  it('returns 503 when Firebase is not configured yet', async () => {
    const res = await request(app)
      .post('/api/auth/otp/verify')
      .send({ idToken: 'x'.repeat(200), deviceId: 'device-12345' });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('FIREBASE_NOT_CONFIGURED');
  });

  it('rejects malformed refresh tokens (401) and missing ones (422)', async () => {
    const malformed = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'definitely-not-a-valid-token' });
    expect(malformed.status).toBe(401);
    expect(malformed.body.error.code).toBe('INVALID_REFRESH_TOKEN');

    const missing = await request(app).post('/api/auth/refresh').send({});
    expect(missing.status).toBe(422);
  });

  it('requires a token for /api/auth/me', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
  });
});

describe('/api/admin/auth routes', () => {
  it('validates the login body (422)', async () => {
    const res = await request(app)
      .post('/api/admin/auth/login')
      .send({ email: 'not-an-email', password: '' });
    expect(res.status).toBe(422);
  });

  it('validates the 2FA code format (422)', async () => {
    const res = await request(app)
      .post('/api/admin/auth/2fa/verify')
      .send({ challengeToken: 'x'.repeat(40), code: '12' });
    expect(res.status).toBe(422);
  });

  it('rejects an expired or forged 2FA challenge (401)', async () => {
    const res = await request(app)
      .post('/api/admin/auth/2fa/verify')
      .send({ challengeToken: 'x'.repeat(40), code: '123456' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('CHALLENGE_EXPIRED');
  });

  it('requires the X-Requested-With header on cookie routes (CSRF guard)', async () => {
    const res = await request(app).post('/api/admin/auth/refresh');
    expect(res.status).toBe(403);
  });

  it('protects every other admin route', async () => {
    expect((await request(app).get('/api/admin/anything')).status).toBe(401);
  });
});
