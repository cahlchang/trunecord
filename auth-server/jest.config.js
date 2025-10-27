module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    '**/*.js',
    '!**/node_modules/**',
    '!**/coverage/**',
    '!jest.config.js'
  ],
  modulePathIgnorePatterns: ['<rootDir>/dist-lambda'],
  testMatch: [
    '**/test/**/*.test.js'
  ],
  verbose: true
};
