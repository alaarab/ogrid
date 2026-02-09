/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
    '**/__tests__/**/*.spec.ts',
    '**/__tests__/**/*.spec.tsx',
    '**/?(*.)+(spec|test).ts',
    '**/?(*.)+(spec|test).tsx',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: false,
        diagnostics: false,
        tsconfig: {
          jsx: 'react-jsx',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          module: 'commonjs',
          target: 'es2019',
          types: ['jest', 'node'],
        },
      },
    ],
  },
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^rtl-css-js/core$': '<rootDir>/jest-mocks/rtl-css-js-core.cjs.js',
    '^@fluentui/react-components$': '<rootDir>/jest-mocks/fluent-react-components.cjs.js',
    '^@fluentui/react-accordion(.*)$': '<rootDir>/jest-mocks/fluent-accordion.cjs.js',
    '^@fluentui/react-avatar(.*)$': '<rootDir>/jest-mocks/fluent-avatar.cjs.js',
    '^@fluentui/react-badge(.*)$': '<rootDir>/jest-mocks/fluent-badge.cjs.js',
    '^@alaarab/ogrid-core$': '<rootDir>/../core/src/index.ts',
    '^@alaarab/ogrid-core/testing$': '<rootDir>/../core/src/testing/index.ts',
    '^@alaarab/ogrid-core/storybook$': '<rootDir>/../core/src/storybook/index.ts',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
  ],
  coverageDirectory: 'coverage',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testTimeout: 10000,
};
