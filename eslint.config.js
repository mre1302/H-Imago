'use strict';

const globals = require('globals');

const reglasComunes = {
  'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
  'no-redeclare': 'error',
  'no-dupe-keys': 'error',
  'no-dupe-args': 'error',
  'no-unreachable': 'error',
  'no-constant-condition': 'error',
  'no-empty': ['error', { allowEmptyCatch: true }],
  'no-cond-assign': ['error', 'except-parens'],
  'no-fallthrough': 'error',
  'no-self-assign': 'error',
  'no-useless-escape': 'warn',
  'no-prototype-builtins': 'warn',
  eqeqeq: ['warn', 'smart'],
  'prefer-const': 'off',
  'no-console': 'off',
};

module.exports = [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'src/vendor/**',
      'scripts/__pycache__/**',
    ],
  },
  {
    files: [
      'main.js',
      'preload.js',
      'eslint.config.js',
      'db/**/*.js',
      'lib/**/*.js',
      'scripts/**/*.js',
      'test/**/*.js',
    ],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      ...reglasComunes,
      'no-undef': 'error',
    },
  },
  {
    files: ['src/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'script',
      globals: { ...globals.browser },
    },
    rules: {
      ...reglasComunes,
      /* Los módulos del renderer comparten funciones globales cargadas por
         <script>; no se puede resolver el grafo de dependencias con ESLint. */
      'no-undef': 'off',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
    },
  },
];
