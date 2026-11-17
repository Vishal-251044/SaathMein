/**
 * Firebase service — verifies the Firebase ID tokens the app sends after phone OTP or
 * Google sign-in (F4). Our own JWTs are issued only after this check passes.
 */
const { getFirebaseAuth } = require('../../config/firebase');
const ApiError = require('../../utils/ApiError');
const { createLogger } = require('../../utils/logger');

const log = createLogger('FirebaseService');

/**
 * Verify any Firebase ID token (not revoked, not expired).
 * @param {string} idToken
 * @param {string} failMessage - Message for an invalid token
 * @returns {Promise<Object>} Decoded token
 */
const verifyFirebaseToken = async (idToken, failMessage) => {
  const auth = getFirebaseAuth();
  if (!auth) {
    log.error('Firebase is not configured. Set FIREBASE_* in backend/.env');
    throw new ApiError(503, 'Login is not available right now. Please try again later.', {
      code: 'FIREBASE_NOT_CONFIGURED',
    });
  }
  try {
    // checkRevoked = true: tokens of disabled or signed-out Firebase users are rejected
    return await auth.verifyIdToken(idToken, true);
  } catch (err) {
    log.warn({ code: err.code }, 'Firebase ID token rejected');
    throw new ApiError(401, failMessage, { code: 'INVALID_FIREBASE_TOKEN' });
  }
};

/**
 * Verify a Firebase ID token from phone sign-in.
 * @param {string} idToken - ID token from the Firebase client SDK
 * @returns {Promise<{ uid: string, phone: string }>} Firebase user id and verified phone
 * @throws {ApiError} 503 when Firebase is not configured, 401 for invalid/expired/revoked tokens,
 *   400 when the token has no phone number
 */
const verifyPhoneIdToken = async (idToken) => {
  const decoded = await verifyFirebaseToken(
    idToken,
    'Phone verification failed. Please request a new OTP.',
  );

  if (!decoded.phone_number || decoded.firebase?.sign_in_provider !== 'phone') {
    throw ApiError.badRequest('This login is not a phone number login', {
      code: 'PHONE_LOGIN_REQUIRED',
    });
  }

  return { uid: decoded.uid, phone: decoded.phone_number };
};

/**
 * Verify a Firebase ID token from Google sign-in (F4).
 * @param {string} idToken - ID token from the Firebase client SDK
 * @returns {Promise<{ uid: string, email: string, name: string|null }>}
 * @throws {ApiError} 401 invalid token, 400 not a Google sign-in or email not verified
 */
const verifyGoogleIdToken = async (idToken) => {
  const decoded = await verifyFirebaseToken(idToken, 'Google sign-in failed. Please try again.');
  if (decoded.firebase?.sign_in_provider !== 'google.com' || !decoded.email) {
    throw ApiError.badRequest('This login is not a Google sign-in', {
      code: 'GOOGLE_LOGIN_REQUIRED',
    });
  }
  if (decoded.email_verified !== true) {
    throw ApiError.badRequest('Your Google email is not verified', {
      code: 'GOOGLE_EMAIL_UNVERIFIED',
    });
  }
  return {
    uid: decoded.uid,
    email: String(decoded.email).toLowerCase(),
    name: typeof decoded.name === 'string' ? decoded.name.slice(0, 80) : null,
  };
};

module.exports = { verifyPhoneIdToken, verifyGoogleIdToken };
