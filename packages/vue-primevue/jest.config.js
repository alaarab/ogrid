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
      },
    ],
  },
  moduleNameMapper: {
    '^@alaarab/ogrid-core$': '<rootDir>/../core/src/index.ts',
    '^@alaarab/ogrid-vue$': '<rootDir>/../vue/src/index.ts',
    '^@alaarab/ogrid-vue/testing$': '<rootDir>/../vue/src/testing/index.ts',
    '^primevue/(.+)$': '<rootDir>/jest-mocks/primevue-stub.cjs.js',
  },
  testTimeout: 10000,
};
