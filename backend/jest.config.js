/**
 * Jest config for the backend: Node environment, tests live in tests/.
 */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  setupFiles: ['<rootDir>/tests/setupEnv.js'],
  collectCoverageFrom: ['src/**/*.js'],
  clearMocks: true,
  // Real bcrypt (cost 12) in auth tests can pass 5 s when all suites run in parallel
  testTimeout: 20000,
};
