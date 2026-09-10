import base from '@time-stop/eslint-config';

export default [
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/out/**', '**/release/**'],
  },
  ...base,
];
