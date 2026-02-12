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
          experimentalDecorators: true,
          useDefineForClassFields: false,
        },
      },
    ],
  },
  moduleNameMapper: {
    '^@alaarab/ogrid-core$': '<rootDir>/../core/src/index.ts',
    '^@alaarab/ogrid-angular$': '<rootDir>/../angular/src/index.ts',
    '^@angular/core$': '<rootDir>/../angular/jest-mocks/angular-core.cjs.js',
    '^@angular/common$': '<rootDir>/../angular/jest-mocks/angular-common.cjs.js',
    '^@angular/material/menu$': '<rootDir>/jest-mocks/angular-material-menu.cjs.js',
    '^@angular/material/button$': '<rootDir>/jest-mocks/angular-material-button.cjs.js',
    '^@angular/material/icon$': '<rootDir>/jest-mocks/angular-material-icon.cjs.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@angular/material|@angular/cdk)/)',
  ],
  testTimeout: 10000,
};
