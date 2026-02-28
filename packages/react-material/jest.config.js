const base = require('../../jest.config.base');

module.exports = {
  ...base('react-material'),
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: false,
      isolatedModules: true,
      diagnostics: false,
      tsconfig: {
        jsx: 'react-jsx',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        module: 'commonjs',
        target: 'es2019',
        types: ['jest', 'node'],
      },
    }],
  },
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^@alaarab/ogrid-core$': '<rootDir>/../core/src/index.ts',
    '^@alaarab/ogrid-core/formula$': '<rootDir>/../core/src/formula/index.ts',
    '^@alaarab/ogrid-react$': '<rootDir>/../react/src/index.ts',
    '^@alaarab/ogrid-react/testing$': '<rootDir>/../react/src/testing/index.ts',
    '^@alaarab/ogrid-react/storybook$': '<rootDir>/../react/src/storybook/index.ts',
    // Individual component mocks (must come before catch-all pattern)
    '^@mui/material/Menu$': '<rootDir>/jest-mocks/mui-material-Menu.cjs.js',
    '^@mui/material/MenuItem$': '<rootDir>/jest-mocks/mui-material-MenuItem.cjs.js',
    '^@mui/material/IconButton$': '<rootDir>/jest-mocks/mui-material-IconButton.cjs.js',
    '^@mui/icons-material/MoreVert$': '<rootDir>/jest-mocks/mui-icons-material-MoreVert.cjs.js',
    // Catch-all patterns for other MUI components
    '^@mui/material(.*)$': '<rootDir>/jest-mocks/mui-material.cjs.js',
    '^@mui/icons-material(.*)$': '<rootDir>/jest-mocks/mui-icons.cjs.js',
    '^@mui/system$': '<rootDir>/jest-mocks/mui-system.cjs.js',
  },
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts', '!src/**/__tests__/**'],
  coverageDirectory: 'coverage',
  setupFilesAfterEnv: ['<rootDir>/../../jest.setup.js', '<rootDir>/jest.setup.ts'],
};
