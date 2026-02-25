const base = require('../../jest.config.base');

module.exports = {
  ...base('angular-primeng'),
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
        experimentalDecorators: true,
        useDefineForClassFields: false,
        baseUrl: '.',
        paths: {
          '@alaarab/ogrid-core': ['../core/src/index.ts'],
          '@alaarab/ogrid-angular': ['../angular/src/index.ts'],
          '@alaarab/ogrid-angular/testing': ['../angular/src/testing/index.ts'],
        },
      },
    }],
  },
  moduleNameMapper: {
    '^@alaarab/ogrid-core$': '<rootDir>/../core/src/index.ts',
    '^@alaarab/ogrid-angular$': '<rootDir>/../angular/src/index.ts',
    '^@alaarab/ogrid-angular/testing$': '<rootDir>/../angular/src/testing/index.ts',
    '^@angular/core$': '<rootDir>/../angular/jest-mocks/angular-core.cjs.js',
    '^@angular/common$': '<rootDir>/../angular/jest-mocks/angular-common.cjs.js',
    '^primeng/button$': '<rootDir>/jest-mocks/primeng-button.cjs.js',
    '^primeng/menu$': '<rootDir>/jest-mocks/primeng-menu.cjs.js',
    '^primeng/api$': '<rootDir>/jest-mocks/primeng-api.cjs.js',
  },
  transformIgnorePatterns: ['node_modules/(?!(@angular|primeng)/)'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/**/__tests__/**'],
  coverageDirectory: 'coverage',
};
