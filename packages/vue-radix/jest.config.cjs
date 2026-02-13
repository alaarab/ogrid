module.exports = {
  testEnvironment: 'jsdom',
  displayName: 'vue-radix',
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@alaarab/ogrid-core$': '<rootDir>/../core/src/index.ts',
    '^@alaarab/ogrid-core/testing$': '<rootDir>/../core/src/testing/index.ts',
    '^@alaarab/ogrid-vue$': '<rootDir>/../vue/src/index.ts',
    '^@alaarab/ogrid-vue/testing$': '<rootDir>/../vue/src/testing/index.ts',
    '\\.vue$': '<rootDir>/jest-mocks/vue-component.cjs.js',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'preserve',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          types: ['jest', 'node'],
          baseUrl: '.',
          paths: {
            '@alaarab/ogrid-core': ['../core/src/index.ts'],
            '@alaarab/ogrid-core/testing': ['../core/src/testing/index.ts'],
            '@alaarab/ogrid-vue': ['../vue/src/index.ts'],
            '@alaarab/ogrid-vue/testing': ['../vue/src/testing/index.ts'],
          },
        },
      },
    ],
  },
  testTimeout: 10000,
  setupFilesAfterEnv: ['<rootDir>/../../jest.setup.js'],
};
