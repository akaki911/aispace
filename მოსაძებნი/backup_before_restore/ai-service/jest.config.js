module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/tests/**/*.test.js',
    '**/?(*.)+(spec|test).js'
  ],
  collectCoverageFrom: [
    'policy/**/*.js',
    'utils/**/*.js',
    'controllers/**/*.js',
    'services/**/*.js',
    'core/**/*.js',
    '!**/node_modules/**',
    '!**/tests/**'
  ],
  verbose: true
};