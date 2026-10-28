/**
 * Firebase Admin SDK — used to verify the ID token the app gets after phone OTP (ACC-1).
 * Loaded lazily and only when FIREBASE_* variables are real values, so the API starts
 * fast and works (with phone login disabled) before Firebase is set up.
 */
const config = require('./env');

const APP_NAME = 'saathmein';
let authClient = null;

/**
 * Get the Firebase Auth client.
 * @returns {import('firebase-admin/auth').Auth|null} Auth client, or null when Firebase is
 *   not configured in backend/.env
 */
const getFirebaseAuth = () => {
  if (!config.firebase.isConfigured) return null;
  if (authClient) return authClient;

  // Required here (not at the top) so the SDK only loads when it is actually used
  const { initializeApp, cert, getApps } = require('firebase-admin/app');
  const { getAuth } = require('firebase-admin/auth');

  const app =
    getApps().find((existing) => existing.name === APP_NAME) ||
    initializeApp(
      {
        credential: cert({
          projectId: config.firebase.projectId,
          clientEmail: config.firebase.clientEmail,
          privateKey: config.firebase.privateKey,
        }),
      },
      APP_NAME,
    );

  authClient = getAuth(app);
  return authClient;
};

module.exports = { getFirebaseAuth };
