const base = require('../../jest.config.base');

module.exports = {
  ...base('react-radix'),
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
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
    }],
  },
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^@alaarab/ogrid-core$': '<rootDir>/../core/src/index.ts',
    '^@alaarab/ogrid-react$': '<rootDir>/../react/src/index.ts',
    '^@alaarab/ogrid-react/testing$': '<rootDir>/../react/src/testing/index.ts',
    '^@alaarab/ogrid-react/storybook$': '<rootDir>/../react/src/storybook/index.ts',
  },
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts', '!src/**/__tests__/**'],
  coverageDirectory: 'coverage',
  setupFilesAfterEnv: ['<rootDir>/../../jest.setup.js', '<rootDir>/jest.setup.ts'],
};
