/**
 * Integration tests for GET /api/health, the 404 handler and the CORS whitelist.
 * The app is loaded once; the database status is switched through a mock (reloading the
 * whole app per test is slow when all suites run in parallel).
 */
jest.mock('../src/config/db', () => ({
  ...jest.requireActual('../src/config/db'),
  getDBStatus: jest.fn(() => 'not_configured'),
}));

const request = require('supertest');
const { getDBStatus } = require('../src/config/db');
const app = require('../src/app');

beforeEach(() => {
  getDBStatus.mockReturnValue('not_configured');
});

describe('GET /api/health', () => {
  it('returns 503 "degraded" when the database is not configured', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.error.details.status).toBe('degraded');
    expect(res.body.error.details.services).toEqual({
      database: 'not_configured',
      redis: 'not_configured',
    });
  });

  it('returns 200 with database "connected" when MongoDB is up', async () => {
    getDBStatus.mockReturnValue('connected');
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      message: 'Service healthy',
      data: { status: 'ok', services: { database: 'connected' } },
    });
    expect(res.headers['x-request-id']).toBeDefined();
  });
});

describe('Error handling and security middleware', () => {
  it('returns the standard 404 format for unknown routes', async () => {
    const res = await request(app).get('/api/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      message: 'Route not found: GET /api/does-not-exist',
      error: { code: 'NOT_FOUND' },
    });
  });

  it('rejects browser requests from origins outside the whitelist', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'https://evil.example.com');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('allows whitelisted origins', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'http://localhost:3000');

    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"bad json');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('returns 503 DATABASE_UNAVAILABLE for API routes while MongoDB is down', async () => {
    const res = await request(app).post('/api/auth/otp/request').send({ phone: '+919876543210' });

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('DATABASE_UNAVAILABLE');
  });

  it('sets security headers and hides x-powered-by', async () => {
    const res = await request(app).get('/api/health');

    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
