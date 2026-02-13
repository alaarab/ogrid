/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
    '**/__tests__/**/*.spec.ts',
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
          experimentalDecorators: true,
          useDefineForClassFields: false,
          baseUrl: '.',
          paths: {
            '@alaarab/ogrid-core': ['../core/src/index.ts'],
            '@alaarab/ogrid-core/testing': ['../core/src/testing/index.ts'],
            '@alaarab/ogrid-angular': ['../angular/src/index.ts'],
            '@alaarab/ogrid-angular/testing': ['../angular/src/testing/index.ts'],
          },
        },
      },
    ],
  },
  moduleNameMapper: {
    '^@alaarab/ogrid-core$': '<rootDir>/../core/src/index.ts',
    '^@alaarab/ogrid-core/testing$': '<rootDir>/../core/src/testing/index.ts',
    '^@alaarab/ogrid-angular$': '<rootDir>/../angular/src/index.ts',
    '^@alaarab/ogrid-angular/testing$': '<rootDir>/../angular/src/testing/index.ts',
    '^@angular/core/testing$': '<rootDir>/../angular/jest-mocks/angular-core-testing.cjs.js',
    '^@angular/core$': '<rootDir>/../angular/jest-mocks/angular-core.cjs.js',
    '^@angular/common$': '<rootDir>/../angular/jest-mocks/angular-common.cjs.js',
    '^@angular/platform-browser$': '<rootDir>/../angular/jest-mocks/angular-platform-browser.cjs.js',
    '^@angular/cdk/overlay$': '<rootDir>/jest-mocks/angular-cdk-overlay.cjs.js',
    '\\.scss$': '<rootDir>/jest-mocks/style-mock.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@angular|primeng)/)',
  ],
  setupFilesAfterEnv: ['<rootDir>/../../jest.setup.js'],
  testTimeout: 10000,
};
