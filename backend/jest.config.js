/**
 * Jest config for the backend: Node environment, tests live in tests/.
 */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  setupFiles: ['<rootDir>/tests/setupEnv.js'],
  collectCoverageFrom: ['src/**/*.js'],
  clearMocks: true,
};
