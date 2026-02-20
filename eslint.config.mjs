import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import storybook from 'eslint-plugin-storybook';
// TODO: Install and enable import sorting:
//   npm install -D eslint-plugin-simple-import-sort
// Then uncomment the import and rule configuration below.
// import simpleImportSort from 'eslint-plugin-simple-import-sort';

export default [
  {
    ignores: [
      '**/node_modules/**', '**/dist/**', '**/coverage/**', '**/storybook-static/**', '**/.turbo/**',
      '**/*.config.js', '**/*.config.cjs', 'jest.config.base.js', '**/jest-mocks/**', '**/scripts/**', '**/*.stories.tsx', '**/__tests__/**',
      '**/.docusaurus/**', '**/build/**', 'packages/docs/**', '**/*.mjs', '**/*.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      react,
      'react-hooks': reactHooks,
      // Uncomment after installing eslint-plugin-simple-import-sort:
      // 'simple-import-sort': simpleImportSort,
    },
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { React: 'readonly', JSX: 'readonly' },
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/display-name': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      // Strict-preset rules downgraded to warn (too many existing usages to error today)
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-dynamic-delete': 'warn',
      '@typescript-eslint/no-invalid-void-type': 'warn',
      // Uncomment after installing eslint-plugin-simple-import-sort:
      // 'simple-import-sort/imports': 'error',
      // 'simple-import-sort/exports': 'error',
    },
  },
  {
    files: ['packages/vue/**/*.ts', 'packages/vue-vuetify/**/*.ts', 'packages/vue-primevue/**/*.ts', 'packages/angular/**/*.ts', 'packages/angular-material/**/*.ts', 'packages/angular-primeng/**/*.ts', 'packages/angular-radix/**/*.ts'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'react/no-unknown-property': 'off',
    },
  },
  {
    files: ['packages/vue-vuetify/**/*.ts', 'packages/vue-primevue/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  ...storybook.configs['flat/recommended'],
];
