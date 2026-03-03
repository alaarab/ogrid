const base = require('../../jest.config.base');
const baseConfig = base('react-inputs');
module.exports = {
  ...baseConfig,
  setupFilesAfterEnv: [
    ...(baseConfig.setupFilesAfterEnv || []),
    '<rootDir>/jest.setup.ts',
  ],
  moduleNameMapper: {
    '^@alaarab/ogrid-core$': '<rootDir>/../core/src',
    '^@alaarab/ogrid-core/(.*)$': '<rootDir>/../core/src/$1',
    '^@alaarab/ogrid-inputs$': '<rootDir>/../inputs/src',
    '^@alaarab/ogrid-inputs/(.*)$': '<rootDir>/../inputs/src/$1',
  },
};
