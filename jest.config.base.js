// Shared Jest configuration for all OGrid packages.
// Each package extends this base with its own overrides.
//
// Usage:
//   const base = require('../../jest.config.base');
//   module.exports = { ...base('core'), moduleNameMapper: { ... } };
function createBaseConfig(displayName) {
  return {
    displayName,
    cacheDirectory: `<rootDir>/../../node_modules/.jest-cache/${displayName}`,
    testEnvironment: 'jsdom',
    roots: ['<rootDir>/src'],
    testMatch: [
      '**/__tests__/**/*.test.ts',
      '**/__tests__/**/*.test.tsx',
    ],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
    transform: {
      '^.+\\.tsx?$': [
        'ts-jest',
        {
          useESM: false,
          isolatedModules: true, // Skip type-checking — build handles that. Saves ~40% memory per worker.
          tsconfig: {
            esModuleInterop: true,
            allowSyntheticDefaultImports: true,
            module: 'commonjs',
            target: 'es2019',
            types: ['jest', 'node'],
          },
        },
      ],
    },
    setupFilesAfterEnv: ['<rootDir>/../../jest.setup.js'],
    testTimeout: 10000,
    maxWorkers: 4, // Cap workers to limit memory — 4 workers × ~300MB ≈ 1.2GB per package
    coverageThreshold: {
      global: {
        branches: 70,
        functions: 75,
        lines: 75,
        statements: 75,
      },
    },
  };
}

module.exports = createBaseConfig;
