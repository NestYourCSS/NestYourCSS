import { defineConfig, createLogger } from 'vite';
import { createReadStream, statSync } from 'fs';
import { extname, join, normalize, resolve, sep } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// The quickly app has its own root, so serve the shared Ace Linters bundle
// from the repository's /lib directory on the same-origin /lib/... path that
// the main app uses (and that postbuild copies into the deployed app).
const aceLintersDir = resolve(__dirname, 'lib/ace-linters');
const contentTypes = {
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

function serveSharedAceLinters() {
  return {
    name: 'serve-shared-ace-linters',
    configureServer(server) {
      server.middlewares.use('/lib/ace-linters', (req, res, next) => {
        const pathname = decodeURIComponent((req.url || '/').split('?')[0]);
        const filePath = normalize(join(aceLintersDir, pathname));

        if (filePath !== aceLintersDir && !filePath.startsWith(aceLintersDir + sep)) {
          return next();
        }

        try {
          if (!statSync(filePath).isFile()) return next();
        } catch {
          return next();
        }

        res.setHeader('Content-Type', contentTypes[extname(filePath)] || 'application/octet-stream');
        res.setHeader('Cache-Control', 'no-cache');
        createReadStream(filePath).pipe(res);
      });
    },
  };
}

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

  plugins: [serveSharedAceLinters()],

  root: resolve(__dirname, 'apps/quickly'),
  publicDir: resolve(__dirname, 'public/apps/quickly'),
  resolve: {
    alias: {
      '@nycss/state': resolve(__dirname, 'packages/state/src/store.js'),
      '@nycss/engine/config': resolve(__dirname, 'packages/engine/src/config.js'),
      '@nycss/engine': resolve(__dirname, 'packages/engine/src/engine.js'),
      '@nycss/ui': resolve(__dirname, 'packages/ui/src/index.js'),
      '@nycss/pwa': resolve(__dirname, 'packages/pwa/src/index.js'),
    },
  },
  build: {
    outDir: resolve(__dirname, 'dist/apps/quickly'),
    emptyOutDir: true,
    sourcemap: 'hidden',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      input: resolve(__dirname, 'apps/quickly/index.html'),
    },
  },
  server: {
    port: 3001,
    fs: {
      allow: [resolve(__dirname)],
    },
  },
});
