import js from '@eslint/js';
import ts from 'typescript-eslint';
export default ts.config(
  { ignores: ['**/dist/**', '**/generated/**', '**/node_modules/**'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        AbortSignal: 'readonly',
        AbortController: 'readonly',
        Buffer: 'readonly',
        document: 'readonly',
        window: 'readonly',
        localStorage: 'readonly',
        HTMLElement: 'readonly',
        HTMLInputElement: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        navigator: 'readonly',
      },
    },
  },
  {
    files: ['apps/mobile/**/*.cjs'],
    languageOptions: {
      globals: { require: 'readonly', module: 'readonly', __dirname: 'readonly' },
    },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
);
