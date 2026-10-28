/**
 * Unit tests for staff 2FA: TOTP verification, replay protection, encryption at rest
 * and one-time backup codes. Also covers the login lockout policy.
 */
const { generate } = require('otplib');
const twoFactor = require('../../../src/services/auth/twoFactor.service');
const {
  nextFailedAttemptState,
  MAX_FAILED_ATTEMPTS,
} = require('../../../src/services/auth/staffAuth.service');

describe('twoFactor.service', () => {
  it('accepts a current TOTP code once and rejects its replay', async () => {
    const secret = twoFactor.createTotpSecret();
    const code = await generate({ secret });

    const first = await twoFactor.verifyTotpCode(secret, code);
    expect(first.valid).toBe(true);

    const replay = await twoFactor.verifyTotpCode(secret, code, first.timeStep);
    expect(replay.valid).toBe(false);
  });

  it('rejects wrong and malformed codes', async () => {
    const secret = twoFactor.createTotpSecret();
    const code = await generate({ secret });
    const wrong = String((Number(code) + 1) % 1000000).padStart(6, '0');

    expect((await twoFactor.verifyTotpCode(secret, wrong)).valid).toBe(false);
    expect((await twoFactor.verifyTotpCode(secret, 'abc123')).valid).toBe(false);
    expect((await twoFactor.verifyTotpCode(secret, '12345')).valid).toBe(false);
  });

  it('encrypts secrets so the database never holds them in plain text', () => {
    const secret = twoFactor.createTotpSecret();
    const encrypted = twoFactor.encryptSecret(secret);

    expect(encrypted).not.toContain(secret);
    expect(twoFactor.decryptSecret(encrypted)).toBe(secret);
    // Tampering is detected (AES-GCM authentication tag)
    const tampered = `${encrypted.slice(0, -2)}AA`;
    expect(() => twoFactor.decryptSecret(tampered)).toThrow();
  });

  it('builds an otpauth URL for authenticator apps', () => {
    const url = twoFactor.buildOtpAuthUrl('JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP', 'owner@saathmein.in');
    expect(url).toMatch(/^otpauth:\/\/totp\/SaathMein:owner%40saathmein\.in\?/);
    expect(url).toContain('issuer=SaathMein');
  });

  it('generates 10 one-time backup codes, stored only as hashes', () => {
    const { codes, stored } = twoFactor.generateBackupCodes();

    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    codes.forEach((code) => expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/));
    expect(JSON.stringify(stored)).not.toContain(codes[0].replace('-', ''));

    // Matching ignores case and separators; used codes never match again
    expect(twoFactor.isBackupCodeFormat(codes[3].toLowerCase())).toBe(true);
    expect(twoFactor.findUnusedBackupCode(stored, codes[3].toLowerCase().replace('-', ' '))).toBe(
      3,
    );
    stored[3].usedAt = new Date();
    expect(twoFactor.findUnusedBackupCode(stored, codes[3])).toBe(-1);
    expect(twoFactor.isBackupCodeFormat('123456')).toBe(false);
  });
});

describe('staff login lockout policy', () => {
  it(`locks the account for 15 minutes after ${MAX_FAILED_ATTEMPTS} failures`, () => {
    const now = Date.now();
    let state = { failedLoginCount: 0 };
    for (let attempt = 1; attempt < MAX_FAILED_ATTEMPTS; attempt += 1) {
      state = nextFailedAttemptState(state, now);
      expect(state).toEqual({ failedLoginCount: attempt, lockUntil: null });
    }
    state = nextFailedAttemptState(state, now);
    expect(state.failedLoginCount).toBe(0);
    expect(state.lockUntil.getTime()).toBe(now + 15 * 60 * 1000);
  });
});
