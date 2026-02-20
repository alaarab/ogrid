const base = require('../../jest.config.base');

module.exports = {
  ...base('vue-primevue'),
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: false,
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        module: 'commonjs',
        target: 'es2019',
        types: ['jest', 'node'],
        baseUrl: '.',
        paths: {
          '@alaarab/ogrid-core': ['../core/src/index.ts'],
          '@alaarab/ogrid-vue': ['../vue/src/index.ts'],
          '@alaarab/ogrid-vue/testing': ['../vue/src/testing/index.ts'],
        },
      },
    }],
  },
  moduleNameMapper: {
    '^@alaarab/ogrid-core$': '<rootDir>/../core/src/index.ts',
    '^@alaarab/ogrid-vue$': '<rootDir>/../vue/src/index.ts',
    '^@alaarab/ogrid-vue/testing$': '<rootDir>/../vue/src/testing/index.ts',
    '^primevue/(.+)$': '<rootDir>/jest-mocks/primevue-stub.cjs.js',
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/**/__tests__/**'],
  coverageDirectory: 'coverage',
};
