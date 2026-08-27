/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  clearMocks: true,
  setupFiles: ['<rootDir>/jest.setup.js'],
  testTimeout: 120000, // 120s global — remote DB is slow
};
