import base from '@app/eslint-config';

export default [
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/out/**', '**/release/**'],
  },
  ...base,
];
