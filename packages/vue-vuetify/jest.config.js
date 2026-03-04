const base = require('../../jest.config.base');

module.exports = {
  ...base('vue-vuetify'),
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: false,
      isolatedModules: true,
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        module: 'commonjs',
        target: 'es2019',
        types: ['jest', 'node'],
        baseUrl: '.',
        paths: {
          '@alaarab/ogrid-core': ['../core/src/index.ts'],
          '@alaarab/ogrid-core/formula': ['../core/src/formula/index.ts'],
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
    '^@alaarab/ogrid-vue$': '<rootDir>/../vue/src/index.ts',
    '^@alaarab/ogrid-vue/testing$': '<rootDir>/../vue/src/testing/index.ts',
    '^vuetify/components$': '<rootDir>/jest-mocks/vuetify-components.cjs.js',
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/**/__tests__/**'],
  coverageDirectory: 'coverage',
};
