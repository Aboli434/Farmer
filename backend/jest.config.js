/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  clearMocks: true,
  setupFiles: ['<rootDir>/jest.setup.js'],
  testTimeout: 60000, // 60s global — covers DB-heavy beforeAll/afterAll hooks
};
