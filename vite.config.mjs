import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@nycss/state': resolve(__dirname, 'packages/state/src/store.js'),
      '@nycss/engine': resolve(__dirname, 'packages/engine/src/engine.js'),
      '@nycss/ui': resolve(__dirname, 'packages/ui/src/index.js'),
      '@nycss/pwa': resolve(__dirname, 'packages/pwa/src/index.js'),
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        quickly: resolve(__dirname, 'apps/quickly/index.html'),
      },
    },
  },
  server: {
    port: 3000,
  },
});
