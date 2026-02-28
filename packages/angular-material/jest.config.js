const base = require('../../jest.config.base');

module.exports = {
  ...base('angular-material'),
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
          '@alaarab/ogrid-core/formula': ['../core/src/formula/index.ts'],
          '@alaarab/ogrid-angular': ['../angular/src/index.ts'],
          '@alaarab/ogrid-angular/testing': ['../angular/src/testing/index.ts'],
        },
      },
    }],
  },
  moduleNameMapper: {
    '^@alaarab/ogrid-core$': '<rootDir>/../core/src/index.ts',
    '^@alaarab/ogrid-core/formula$': '<rootDir>/../core/src/formula/index.ts',
    '^@alaarab/ogrid-angular$': '<rootDir>/../angular/src/index.ts',
    '^@alaarab/ogrid-angular/testing$': '<rootDir>/../angular/src/testing/index.ts',
    '^@angular/core$': '<rootDir>/../angular/jest-mocks/angular-core.cjs.js',
    '^@angular/common$': '<rootDir>/../angular/jest-mocks/angular-common.cjs.js',
    '^@angular/material/menu$': '<rootDir>/jest-mocks/angular-material-menu.cjs.js',
    '^@angular/material/button$': '<rootDir>/jest-mocks/angular-material-button.cjs.js',
    '^@angular/material/icon$': '<rootDir>/jest-mocks/angular-material-icon.cjs.js',
    '^@angular/material/divider$': '<rootDir>/jest-mocks/angular-material-divider.cjs.js',
  },
  transformIgnorePatterns: ['node_modules/(?!(@angular/material|@angular/cdk)/)'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/**/__tests__/**'],
  coverageDirectory: 'coverage',
};
