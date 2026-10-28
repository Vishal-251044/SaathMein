/**
 * Test environment: runs before every test file, before config is loaded.
 * Uses placeholder connection strings so no real database or Redis is touched.
 */
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'not-configured-in-tests';
process.env.REDIS_URL = '';
process.env.CORS_ORIGINS = 'http://localhost:3000';
