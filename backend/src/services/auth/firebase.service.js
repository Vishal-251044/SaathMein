/**
 * Firebase service — verifies the Firebase ID token the app receives after the user
 * enters the SMS OTP. Our own JWTs are issued only after this check passes.
 */
const { getFirebaseAuth } = require('../../config/firebase');
const ApiError = require('../../utils/ApiError');
const { createLogger } = require('../../utils/logger');

const log = createLogger('FirebaseService');

/**
 * Verify a Firebase ID token from phone sign-in.
 * @param {string} idToken - ID token from the Firebase client SDK
 * @returns {Promise<{ uid: string, phone: string }>} Firebase user id and verified phone
 * @throws {ApiError} 503 when Firebase is not configured, 401 for invalid/expired/revoked tokens,
 *   400 when the token has no phone number
 */
const verifyPhoneIdToken = async (idToken) => {
  const auth = getFirebaseAuth();
  if (!auth) {
    log.error('Firebase is not configured. Set FIREBASE_* in backend/.env');
    throw new ApiError(503, 'Phone login is not available right now. Please try again later.', {
      code: 'FIREBASE_NOT_CONFIGURED',
    });
  }

  let decoded;
  try {
    // checkRevoked = true: tokens of disabled or signed-out Firebase users are rejected
    decoded = await auth.verifyIdToken(idToken, true);
  } catch (err) {
    log.warn({ code: err.code }, 'Firebase ID token rejected');
    throw new ApiError(401, 'Phone verification failed. Please request a new OTP.', {
      code: 'INVALID_FIREBASE_TOKEN',
    });
  }

  if (!decoded.phone_number || decoded.firebase?.sign_in_provider !== 'phone') {
    throw ApiError.badRequest('This login is not a phone number login', {
      code: 'PHONE_LOGIN_REQUIRED',
    });
  }

  return { uid: decoded.uid, phone: decoded.phone_number };
};

module.exports = { verifyPhoneIdToken };
