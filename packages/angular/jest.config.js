const base = require('../../jest.config.base');

module.exports = {
  ...base('angular'),
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
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
    }],
  },
  moduleNameMapper: {
    '^@alaarab/ogrid-core$': '<rootDir>/../core/src/index.ts',
    '^@angular/core$': '<rootDir>/jest-mocks/angular-core.cjs.js',
    '^@angular/common$': '<rootDir>/jest-mocks/angular-common.cjs.js',
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/**/__tests__/**'],
  coverageDirectory: 'coverage',
};
