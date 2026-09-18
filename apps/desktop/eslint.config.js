import base from '@time-stop/eslint-config';
import react from '@time-stop/eslint-config/react';

const PAGES = ['tracker', 'dashboard', 'settings'];

/** The renderer's import bans, plus the page folders the linted files must not reach. */
const restrictImports = (pages) => ({
  'no-restricted-imports': [
    'error',
    {
      paths: [{ name: 'electron', message: 'Use window.timeStop, exposed by the preload script.' }],
      patterns: [
        { group: ['electron/*'], message: 'Use window.timeStop, exposed by the preload script.' },
        ...(pages.length > 0
          ? [
              {
                group: pages.flatMap((page) => [`@/components/${page}/*`, `**/${page}/*`]),
                message: 'Compose page folders in routes/; move what they share to components/.',
              },
            ]
          : []),
      ],
    },
  ],
});

export default [
  { ignores: ['out/**', 'dist/**', 'release/**', 'test-results/**'] },
  ...base.map((config) => ({
    ...config,
    files: [
      'electron.vite.config.ts',
      'playwright.config.ts',
      'e2e/**/*.ts',
      'src/main/**/*.ts',
      'src/preload/**/*.ts',
      'src/shared/**/*.ts',
    ],
  })),
  ...react.map((config) => ({ ...config, files: ['src/renderer/**/*.{ts,tsx}'] })),
  {
    // shadcn primitives export their variant helpers next to the component; the test harness
    // renders providers nothing refreshes.
    files: ['src/renderer/src/components/ui/**/*.tsx', 'src/renderer/src/test/**/*.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  // The renderer reaches the main process only through window.timeStop.
  { files: ['src/renderer/**/*.{ts,tsx}'], rules: restrictImports([]) },
  // Page folders are composed in routes/: nothing else imports them, and they never import each other.
  {
    files: ['src/renderer/src/**/*.{ts,tsx}'],
    ignores: ['src/renderer/src/routes/**', 'src/renderer/src/*.{ts,tsx}'],
    rules: restrictImports(PAGES),
  },
  ...PAGES.map((page) => ({
    files: [`src/renderer/src/components/${page}/**/*.{ts,tsx}`],
    rules: restrictImports(PAGES.filter((other) => other !== page)),
  })),
];
