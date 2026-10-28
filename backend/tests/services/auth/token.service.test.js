/**
 * Unit tests for the token service: access tokens per audience, challenge tokens and
 * refresh token format/hashing.
 */
const jwt = require('jsonwebtoken');
const { Types } = require('mongoose');
const tokenService = require('../../../src/services/auth/token.service');
const { TOKEN_AUDIENCE } = require('../../../src/constants/enums');

const userId = new Types.ObjectId().toString();
const sessionId = new Types.ObjectId().toString();

describe('token.service', () => {
  it('signs an app access token that verifies with the app audience', () => {
    const { token, expiresAt } = tokenService.signAccessToken({
      userId,
      sessionId,
      audience: TOKEN_AUDIENCE.APP,
      claims: { roles: ['buyer'] },
    });
    const payload = tokenService.verifyAccessToken(token, TOKEN_AUDIENCE.APP);

    expect(payload).toMatchObject({ sub: userId, sid: sessionId, roles: ['buyer'] });
    // 15 minute lifetime from config
    expect(expiresAt.getTime() - Date.now()).toBeGreaterThan(14 * 60 * 1000);
    expect(expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(15 * 60 * 1000);
  });

  it('never accepts an app token as a staff token (and vice versa)', () => {
    const app = tokenService.signAccessToken({ userId, sessionId, audience: TOKEN_AUDIENCE.APP });
    const staff = tokenService.signAccessToken({
      userId,
      sessionId,
      audience: TOKEN_AUDIENCE.STAFF,
      claims: { staffRole: 'owner' },
    });

    expect(() => tokenService.verifyAccessToken(app.token, TOKEN_AUDIENCE.STAFF)).toThrow(
      expect.objectContaining({ statusCode: 401, code: 'INVALID_TOKEN' }),
    );
    expect(() => tokenService.verifyAccessToken(staff.token, TOKEN_AUDIENCE.APP)).toThrow(
      expect.objectContaining({ statusCode: 401 }),
    );
    expect(tokenService.isValidAppToken(app.token)).toBe(true);
    expect(tokenService.isValidAppToken(staff.token)).toBe(false);
  });

  it('reports expired tokens with TOKEN_EXPIRED', () => {
    const expired = jwt.sign({ sid: sessionId }, process.env.JWT_ACCESS_SECRET, {
      subject: userId,
      audience: TOKEN_AUDIENCE.APP,
      issuer: tokenService.ISSUER,
      expiresIn: -10,
    });
    expect(() => tokenService.verifyAccessToken(expired, TOKEN_AUDIENCE.APP)).toThrow(
      expect.objectContaining({ code: 'TOKEN_EXPIRED' }),
    );
  });

  it('rejects tokens signed with another secret or algorithm "none"', () => {
    const forged = jwt.sign({ sid: sessionId }, 'attacker-secret', {
      subject: userId,
      audience: TOKEN_AUDIENCE.APP,
      issuer: tokenService.ISSUER,
    });
    const unsigned = jwt.sign({ sid: sessionId }, null, {
      algorithm: 'none',
      subject: userId,
      audience: TOKEN_AUDIENCE.APP,
      issuer: tokenService.ISSUER,
    });
    expect(() => tokenService.verifyAccessToken(forged, TOKEN_AUDIENCE.APP)).toThrow();
    expect(() => tokenService.verifyAccessToken(unsigned, TOKEN_AUDIENCE.APP)).toThrow();
  });

  it('round-trips 2FA challenge tokens and rejects access tokens as challenges', () => {
    const challenge = tokenService.signChallengeToken(userId, 'setup');
    expect(tokenService.verifyChallengeToken(challenge)).toEqual({ userId, purpose: 'setup' });

    const staff = tokenService.signAccessToken({
      userId,
      sessionId,
      audience: TOKEN_AUDIENCE.STAFF,
    });
    expect(() => tokenService.verifyChallengeToken(staff.token)).toThrow(
      expect.objectContaining({ code: 'CHALLENGE_EXPIRED' }),
    );
  });

  it('creates opaque refresh tokens tied to a session, hashed per audience', () => {
    const { token, hash } = tokenService.createRefreshToken(sessionId, TOKEN_AUDIENCE.APP);

    expect(tokenService.parseRefreshToken(token)).toBe(sessionId);
    expect(hash).toBe(tokenService.hashRefreshToken(token, TOKEN_AUDIENCE.APP));
    expect(hash).not.toBe(tokenService.hashRefreshToken(token, TOKEN_AUDIENCE.STAFF));
    expect(hash).not.toContain(token);
    expect(tokenService.parseRefreshToken('garbage')).toBeNull();
    expect(tokenService.parseRefreshToken(`${sessionId}.short`)).toBeNull();
  });
});
