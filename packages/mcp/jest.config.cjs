const base = require('../../jest.config.base');

module.exports = {
  ...base('mcp'),
  testEnvironment: 'node',
  setupFilesAfterEnv: [],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: false,
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        isolatedModules: true,
        module: 'commonjs',
        target: 'es2019',
        types: ['jest', 'node'],
        moduleResolution: 'node',
      },
    }],
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/**/__tests__/**'],
  coverageDirectory: 'coverage',
};
