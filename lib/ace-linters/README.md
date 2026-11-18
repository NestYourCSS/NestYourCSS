# Ace Linters (self-hosted)

Shared, self-hosted build used by both the main site and the `quickly` app.

- Upstream package: [`ace-linters`](https://www.npmjs.com/package/ace-linters) **2.2.2**
- `ace-linters.min.js` – browser client (`LanguageProvider`)
- `service-manager.js` – worker service manager (name required by the client)
- `css-service.js` – bundled CSS language service
- `provider.js` – creates the shared provider, registering only the CSS service

Both apps load these files from `/lib/ace-linters/`:

- the main app serves/copies its root `lib/` directory;
- the quickly app serves this directory through a small Vite middleware in dev and
  `scripts/postbuild.mjs` copies it into `dist/apps/quickly/lib/` for production.

To upgrade, replace the three upstream build files with the same files from the
new `ace-linters` release, minify them with esbuild (`minify: true, bundle: false`),
and update the version above.
