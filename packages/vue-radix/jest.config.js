const base = require('../../jest.config.base');

module.exports = {
  ...base('vue-radix'),
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        jsx: 'preserve',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        types: ['jest', 'node'],
        baseUrl: '.',
        paths: {
          '@alaarab/ogrid-core': ['../core/src/index.ts'],
          '@alaarab/ogrid-core/formula': ['../core/src/formula/index.ts'],
          '@alaarab/ogrid-core/testing': ['../core/src/testing/index.ts'],
          '@alaarab/ogrid-vue': ['../vue/src/index.ts'],
          '@alaarab/ogrid-vue/testing': ['../vue/src/testing/index.ts'],
        },
      },
    }],
  },
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^@alaarab/ogrid-core$': '<rootDir>/../core/src/index.ts',
    '^@alaarab/ogrid-core/formula$': '<rootDir>/../core/src/formula/index.ts',
    '^@alaarab/ogrid-core/testing$': '<rootDir>/../core/src/testing/index.ts',
    '^@alaarab/ogrid-vue$': '<rootDir>/../vue/src/index.ts',
    '^@alaarab/ogrid-vue/testing$': '<rootDir>/../vue/src/testing/index.ts',
    '\\.vue$': '<rootDir>/jest-mocks/vue-component.cjs.js',
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/**/__tests__/**'],
  coverageDirectory: 'coverage',
};
