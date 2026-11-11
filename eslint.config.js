// ESLint (flat config): navegador con módulos ES en el frontend, Node CommonJS en el backend.
import js from '@eslint/js';
import globals from 'globals';

export default [
  // Salidas generadas y el proyecto Android (Kotlin) quedan fuera del lint de JS.
  { ignores: ['**/node_modules/**', '**/build/**', 'android/**'] },
  js.configs.recommended,
  {
    files: ['frontend/public/**/*.js'],
    languageOptions: { sourceType: 'module', globals: globals.browser },
  },
  {
    files: ['frontend/tests/**/*.js', 'eslint.config.js'],
    languageOptions: { sourceType: 'module', globals: globals.node },
  },
  {
    files: ['backend/**/*.js'],
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
