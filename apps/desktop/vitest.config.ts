import { fileURLToPath } from 'node:url';
import Icons from 'unplugin-icons/vite';
import { defineConfig } from 'vitest/config';

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
    // `@time-stop/db` resolves migrations from `import.meta.url` at module load, which jsdom
    // resolves against the document instead of the file system; Node must load it, not Vite.
    server: { deps: { external: ['@time-stop/db', /packages\/db/] } },
  },
});
