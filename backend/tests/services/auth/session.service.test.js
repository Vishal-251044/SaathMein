/**
 * Unit tests for refresh token rotation, reuse detection and staff idle timeout.
 * The Session model is mocked, so no database is needed.
 */
jest.mock('../../../src/models/session.model', () => ({
  create: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  updateOne: jest.fn(),
  MAX_USED_HASHES: 20,
}));

const { Types } = require('mongoose');
const Session = require('../../../src/models/session.model');
const sessionService = require('../../../src/services/auth/session.service');
const tokenService = require('../../../src/services/auth/token.service');
const { TOKEN_AUDIENCE } = require('../../../src/constants/enums');

const sessionId = new Types.ObjectId().toString();
const userId = new Types.ObjectId();

/** Mimic `Model.findOne(...).select(...)` returning a document. */
const findOneReturning = (doc) =>
  Session.findOne.mockReturnValue({ select: () => Promise.resolve(doc) });

describe('session.service', () => {
  it('creates a session storing only the refresh token hash', async () => {
    Session.create.mockImplementation(async (doc) => doc);
    const { session, refreshToken } = await sessionService.createSession({
      userId,
      audience: TOKEN_AUDIENCE.APP,
      context: { deviceId: 'device-12345', ip: '1.2.3.4' },
    });

    expect(tokenService.parseRefreshToken(refreshToken)).toBe(String(session._id));
    expect(session.refreshTokenHash).toBe(
      tokenService.hashRefreshToken(refreshToken, TOKEN_AUDIENCE.APP),
    );
    expect(JSON.stringify(session)).not.toContain(refreshToken);
  });

  it('rotates a valid refresh token atomically and returns a new one', async () => {
    const { token } = tokenService.createRefreshToken(sessionId, TOKEN_AUDIENCE.APP);
    Session.findOneAndUpdate.mockResolvedValue({ _id: sessionId, userId, expiresAt: new Date() });

    const result = await sessionService.rotateRefreshToken(token, TOKEN_AUDIENCE.APP);

    expect(result.refreshToken).not.toBe(token);
    expect(tokenService.parseRefreshToken(result.refreshToken)).toBe(sessionId);
    const [filter, update] = Session.findOneAndUpdate.mock.calls[0];
    expect(filter).toMatchObject({
      _id: sessionId,
      refreshTokenHash: tokenService.hashRefreshToken(token, TOKEN_AUDIENCE.APP),
      revokedAt: null,
    });
    expect(update.$push.usedTokenHashes.$each).toEqual([filter.refreshTokenHash]);
  });

  it('revokes the whole session when an already-used token is replayed', async () => {
    const { token } = tokenService.createRefreshToken(sessionId, TOKEN_AUDIENCE.APP);
    const usedHash = tokenService.hashRefreshToken(token, TOKEN_AUDIENCE.APP);
    Session.findOneAndUpdate.mockResolvedValue(null);
    findOneReturning({
      userId,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60000),
      usedTokenHashes: [usedHash],
    });

    await expect(
      sessionService.rotateRefreshToken(token, TOKEN_AUDIENCE.APP),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'REFRESH_TOKEN_REUSED',
    });
    expect(Session.updateOne).toHaveBeenCalledWith(
      { _id: sessionId, revokedAt: null },
      { $set: expect.objectContaining({ revokedReason: 'reuse_detected' }) },
    );
  });

  it('rejects malformed and revoked refresh tokens', async () => {
    await expect(
      sessionService.rotateRefreshToken('not-a-token', TOKEN_AUDIENCE.APP),
    ).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });

    const { token } = tokenService.createRefreshToken(sessionId, TOKEN_AUDIENCE.APP);
    Session.findOneAndUpdate.mockResolvedValue(null);
    findOneReturning({ revokedAt: new Date(), expiresAt: new Date(Date.now() + 60000) });
    await expect(
      sessionService.rotateRefreshToken(token, TOKEN_AUDIENCE.APP),
    ).rejects.toMatchObject({
      code: 'SESSION_ENDED',
    });
  });

  it('ends an idle staff session (30 min without activity)', async () => {
    Session.findOne.mockResolvedValue({
      userId,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      lastActivityAt: new Date(Date.now() - 31 * 60 * 1000),
    });

    await expect(
      sessionService.assertStaffSessionActive(sessionId, String(userId)),
    ).rejects.toMatchObject({ code: 'SESSION_IDLE' });
    expect(Session.updateOne).toHaveBeenCalledWith(
      { _id: sessionId, revokedAt: null },
      { $set: expect.objectContaining({ revokedReason: 'idle_timeout' }) },
    );
  });

  it('accepts an active staff session and rejects one belonging to another user', async () => {
    const active = {
      userId,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      lastActivityAt: new Date(),
    };
    Session.findOne.mockResolvedValue(active);
    await expect(sessionService.assertStaffSessionActive(sessionId, String(userId))).resolves.toBe(
      active,
    );
    await expect(
      sessionService.assertStaffSessionActive(sessionId, new Types.ObjectId().toString()),
    ).rejects.toMatchObject({ code: 'SESSION_ENDED' });
  });
});
