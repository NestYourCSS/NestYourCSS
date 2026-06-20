import { defineConfig, createLogger } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// 1. Create a custom logger
const logger = createLogger();
const originalWarn = logger.warn;

// 2. Intercept warnings and filter out the annoying one
logger.warn = (msg, options) => {
  if (msg.includes('can\'t be bundled without type="module" attribute')) {
    return; // Drop the warning silently
  }
  originalWarn(msg, options);
};

export default defineConfig({
  // 3. Apply the custom logger
  customLogger: logger, 
  
  resolve: {
    alias: {
      '@nycss/state': resolve(__dirname, 'packages/state/src/store.js'),
      '@nycss/engine': resolve(__dirname, 'packages/engine/src/engine.js'),
      '@nycss/ui': resolve(__dirname, 'packages/ui/src/index.js'),
      '@nycss/pwa': resolve(__dirname, 'packages/pwa/src/index.js'),
    },
  },
  build: {
    target: 'esnext',
    cssTarget: 'chrome120',
    outDir: 'dist',
    sourcemap: 'hidden',
    chunkSizeWarningLimit: 2000, 
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
      output: {
        manualChunks(id) {
          if (id.includes('lib')) {
            return 'vendor';
          }
        }
      }
    },
  },
  server: { port: 3000 },
});