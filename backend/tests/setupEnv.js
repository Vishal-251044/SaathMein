/**
 * Test environment: runs before every test file, before config is loaded.
 * Uses placeholder connection strings so no real database or Redis is touched,
 * and fixed test-only secrets (never used anywhere else).
 */
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'not-configured-in-tests';
process.env.REDIS_URL = '';
process.env.CORS_ORIGINS = 'http://localhost:3000';

process.env.JWT_ACCESS_SECRET = 'test-app-access-secret-0123456789abcdef';
process.env.JWT_REFRESH_SECRET = 'test-app-refresh-secret-0123456789abcdef';
process.env.STAFF_JWT_ACCESS_SECRET = 'test-staff-access-secret-0123456789abcdef';
process.env.DEAL_CODE_SECRET = 'test-deal-code-secret-0123456789abcdef';
process.env.STAFF_JWT_REFRESH_SECRET = 'test-staff-refresh-secret-0123456789abcdef';
process.env.TWO_FACTOR_ENCRYPTION_KEY = 'a'.repeat(64);
process.env.FIREBASE_PROJECT_ID = '';
process.env.FIREBASE_PRIVATE_KEY = '';
// Test-only Cloudinary credentials (signing is local; no network calls are made)
process.env.CLOUDINARY_CLOUD_NAME = 'saathmein-test';
process.env.CLOUDINARY_API_KEY = '123456789012345';
process.env.CLOUDINARY_API_SECRET = 'test-cloudinary-secret';
// Test-only Razorpay keys (no network calls are made; the SDK is mocked)
process.env.RAZORPAY_KEY_ID = 'rzp_test_saathmein';
process.env.RAZORPAY_KEY_SECRET = 'test-razorpay-key-secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'test-razorpay-webhook-secret';
// Cheap password hashing in tests (production enforces 12+)
process.env.BCRYPT_ROUNDS = '4';
