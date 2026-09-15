import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import Icons from 'unplugin-icons/vite';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import type { Plugin } from 'vite';

/**
 * Injects the renderer's Content Security Policy. Production is self-only; development
 * additionally allows the inline React Refresh preamble, injected styles and the HMR socket.
 */
function csp(): Plugin {
  let policy = "default-src 'self'";
  return {
    name: 'time-stop:csp',
    configResolved(config) {
      if (config.command === 'serve') {
        policy =
          "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: http://localhost:*; worker-src 'self' blob:";
      }
    },
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: policy },
          injectTo: 'head-prepend',
        },
      ];
    },
  };
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    // A sandboxed preload cannot require packages, so the method tables it reads are bundled in.
    plugins: [externalizeDepsPlugin({ exclude: ['@time-stop/domain', 'zod', 'luxon'] })],
    build: {
      rollupOptions: {
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
      },
    },
  },
  renderer: {
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src/renderer/src', import.meta.url)),
      },
    },
    plugins: [react(), tailwindcss(), csp(), Icons({ compiler: 'jsx', jsx: 'react' })],
  },
});
