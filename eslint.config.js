// ESLint (flat config): navegador con módulos ES en el frontend, Node CommonJS en el backend.
import js from '@eslint/js';
import globals from 'globals';

export default [
  // Salidas generadas y el proyecto Android (Kotlin) quedan fuera del lint de JS.
  { ignores: ['**/node_modules/**', '**/build/**', 'apps/android/**', 'apps/web/public/assets/vendor/**'] },
  js.configs.recommended,
  {
    files: ['apps/web/public/**/*.js'],
    languageOptions: { sourceType: 'module', globals: globals.browser },
  },
  {
    files: ['apps/web/tests/**/*.js', 'eslint.config.js'],
    languageOptions: { sourceType: 'module', globals: globals.node },
  },
  {
    files: ['apps/api/**/*.js'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
  },
  {
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'no-console': 'off',
    },
  },
];
