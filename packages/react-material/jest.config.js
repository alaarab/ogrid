/** @type {import('jest').Config} */
module.exports = {
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
    '^@alaarab/ogrid-core$': '<rootDir>/../core/src/index.ts',
    '^@alaarab/ogrid-react$': '<rootDir>/../react/src/index.ts',
    '^@alaarab/ogrid-react/testing$': '<rootDir>/../react/src/testing/index.ts',
    '^@alaarab/ogrid-react/storybook$': '<rootDir>/../react/src/storybook/index.ts',
    '^@mui/material(.*)$': '<rootDir>/jest-mocks/mui-material.cjs.js',
    '^@mui/icons-material(.*)$': '<rootDir>/jest-mocks/mui-icons.cjs.js',
    '^@mui/system$': '<rootDir>/jest-mocks/mui-system.cjs.js',
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
