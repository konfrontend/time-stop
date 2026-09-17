import { fileURLToPath } from 'node:url';
import Icons from 'unplugin-icons/vite';
import { defineConfig } from 'vitest/config';

/**
 * `@time-stop/db` resolves its migrations folder from `import.meta.url` at module load, which jsdom
 * resolves against the document rather than the file system, so Node has to load the package
 * instead of Vite. That means the tests run against `packages/db/dist`: `turbo test` builds it
 * first, a bare `vitest run` in this workspace uses whatever was built last.
 */
export default defineConfig({
  plugins: [Icons({ compiler: 'jsx', jsx: 'react' })],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src/renderer/src', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./vitest.setup.ts'],
    server: { deps: { external: ['@time-stop/db', /packages\/db/] } },
  },
});
