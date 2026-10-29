/**
 * Audit log (ADL-5, Day 5): secrets are redacted, diffs keep only changed fields, and the
 * middleware records successful admin writes only.
 */
jest.mock('../../src/models/auditLog.model', () => ({ create: jest.fn(async () => ({})) }));

const express = require('express');
const request = require('supertest');
const AuditLog = require('../../src/models/auditLog.model');
const { sanitize, diffSnapshots, setAudit } = require('../../src/services/audit.service');
const { auditAdminWrites } = require('../../src/middlewares/audit.middleware');

/** Wait for the res 'finish' handler to run. */
const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('audit.service', () => {
  it('redacts secrets but keeps normal fields such as pincodes', () => {
    expect(
      sanitize({
        password: 'x',
        nested: { refreshToken: 'y', accountNumber: '123' },
        code: '1',
        pincodes: ['411001'],
      }),
    ).toEqual({
      password: '[redacted]',
      nested: { refreshToken: '[redacted]', accountNumber: '[redacted]' },
      code: '[redacted]',
      pincodes: ['411001'],
    });
  });

  it('keeps only changed top-level fields', () => {
    expect(
      diffSnapshots(
        { name: 'Pune', active: true, updatedAt: 1 },
        { name: 'Pune', active: false, updatedAt: 2 },
      ),
    ).toEqual({
      before: { active: true },
      after: { active: false },
    });
  });
});

describe('auditAdminWrites', () => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.staff = { userId: '64b000000000000000000001', role: 'admin' };
    next();
  });
  app.use(auditAdminWrites);
  app.get('/things', (req, res) => res.json({}));
  app.post('/things/:id', (req, res) => {
    setAudit(req, {
      action: 'thing.update',
      targetType: 'thing',
      targetId: req.params.id,
      after: { secret: 's' },
    });
    res.json({});
  });
  app.post('/plain', (req, res) => res.status(201).json({}));
  app.post('/fails', (req, res) => res.status(409).json({}));

  beforeEach(() => jest.clearAllMocks());

  it('records a successful write with the controller detail', async () => {
    await request(app).post('/things/42').send({});
    await flush();
    expect(AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: '64b000000000000000000001',
        actorRole: 'admin',
        action: 'thing.update',
        targetId: '42',
        after: { secret: '[redacted]' },
        method: 'POST',
        path: '/things/42',
        statusCode: 200,
      }),
    );
  });

  it('records writes without detail using the route', async () => {
    await request(app).post('/plain').send({});
    await flush();
    expect(AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'POST /plain' }),
    );
  });

  it('skips reads and failed writes', async () => {
    await request(app).get('/things');
    await request(app).post('/fails').send({});
    await flush();
    expect(AuditLog.create).not.toHaveBeenCalled();
  });
});
