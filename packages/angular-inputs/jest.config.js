const base = require('../../jest.config.base');
module.exports = {
  ...base('angular-inputs'),
  moduleNameMapper: {
    '^@alaarab/ogrid-core$': '<rootDir>/../core/src',
    '^@alaarab/ogrid-core/(.*)$': '<rootDir>/../core/src/$1',
    '^@alaarab/ogrid-inputs$': '<rootDir>/../inputs/src',
    '^@alaarab/ogrid-inputs/(.*)$': '<rootDir>/../inputs/src/$1',
  },
};
