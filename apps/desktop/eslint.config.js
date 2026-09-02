import base from '@time-stop/eslint-config';
import react from '@time-stop/eslint-config/react';

export default [
  { ignores: ['out/**', 'dist/**', 'release/**'] },
  ...base.map((config) => ({
    ...config,
    files: ['electron.vite.config.ts', 'src/main/**/*.ts', 'src/preload/**/*.ts'],
  })),
  ...react.map((config) => ({ ...config, files: ['src/renderer/**/*.{ts,tsx}'] })),
  {
    // shadcn primitives export their variant helpers next to the component.
    files: ['src/renderer/src/components/ui/**/*.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    // The renderer reaches the main process only through window.timeStop.
    files: ['src/renderer/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'electron', message: 'Use window.timeStop, exposed by the preload script.' },
          ],
          patterns: ['electron/*'],
        },
      ],
    },
  },
];
