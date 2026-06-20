import { defineConfig, createLogger } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const logger = createLogger();
const originalWarn = logger.warn;

logger.warn = (msg, options) => {
  if (msg.includes('can\'t be bundled without type="module" attribute')) {
    return;
  }
  originalWarn(msg, options);
};

export default defineConfig({
  customLogger: logger,

  optimizeDeps: {
    include: [
      '@nycss/ui',
      '@nycss/engine',
      '@nycss/state',
      '@nycss/pwa',
    ],
  },

  resolve: {
    alias: {
      '@nycss/state': resolve(__dirname, 'packages/state/src/store.js'),
      '@nycss/engine': resolve(__dirname, 'packages/engine/src/engine.js'),
      '@nycss/ui': resolve(__dirname, 'packages/ui/src/index.js'),
      '@nycss/pwa': resolve(__dirname, 'packages/pwa/src/index.js'),
    },
  },
  build: {
    sourcemap: 'hidden',
    outDir: 'dist',
    chunkSizeWarningLimit: 2000,
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
