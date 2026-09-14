import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import importPlugin from 'eslint-plugin-import';
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default [
  {
    ignores: [
      'out/**',
      'out-tsc/**',
      'dist/**',
      'dist-server/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'resources/**',
      'build/**',
      '**/*.d.ts',
      'eslint.config.js',
      'scripts/*.mjs',
    ],
  },
  js.configs.recommended,
  ...compat.extends('airbnb', 'airbnb/hooks', 'airbnb-typescript'),
  prettierConfig,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: [
          './tsconfig.node.json',
          './tsconfig.web.json',
          './tsconfig.server.json',
          './tsconfig.test-server.json',
        ],
        tsconfigRootDir: __dirname,
        ecmaFeatures: { jsx: true },
      },
      globals: { ...globals.node, ...globals.browser },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      import: importPlugin,
      'jsx-a11y': jsxA11yPlugin,
    },
    settings: {
      react: { version: 'detect' },
      'import/resolver': {
        typescript: {
          project: [
            './tsconfig.node.json',
            './tsconfig.web.json',
            './tsconfig.server.json',
            './tsconfig.test-server.json',
          ],
        },
      },
    },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
      'react/jsx-filename-extension': ['error', { extensions: ['.tsx'] }],
      'react/require-default-props': 'off',
      'react/prop-types': 'off',
      'react/function-component-definition': [
        'error',
        {
          namedComponents: ['function-declaration', 'arrow-function'],
          unnamedComponents: 'arrow-function',
        },
      ],
      'import/prefer-default-export': 'off',
      'import/extensions': 'off',
      'import/no-extraneous-dependencies': [
        'error',
        {
          devDependencies: [
            '**/*.test.ts',
            '**/*.test.tsx',
            'tests/**',
            'scripts/**',
            'vitest.config.ts',
            'playwright.config.ts',
            'electron.vite.config.ts',
            'eslint.config.js',
            'drizzle.config.ts',
          ],
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { ignoreRestSiblings: true, argsIgnorePattern: '^_' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-restricted-syntax': 'off',
      'max-classes-per-file': ['error', 2],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ['src/main/**/*.ts', 'src/preload/**/*.ts'],
    rules: {
      // `electron` is intentionally a devDependency (electron-builder convention) but is
      // a legitimate runtime import in the main/preload processes.
      'import/no-extraneous-dependencies': 'off',
    },
  },
  {
    files: ['scripts/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['tests/**/*.{ts,tsx}', '**/*.test.{ts,tsx}'],
    rules: {
      'import/no-extraneous-dependencies': 'off',
      // __filename/__dirname are the standard ESM replacement pattern used in the e2e spec.
      'no-underscore-dangle': 'off',
      '@typescript-eslint/naming-convention': 'off',
    },
  },
];
