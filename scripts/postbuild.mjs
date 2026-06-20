import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { createRequire } from 'module';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
const site = process.argv[2] || 'both';

const esbuildPkg = resolve(root, 'node_modules/.pnpm/esbuild@0.25.12/node_modules/esbuild/package.json');
const _require = createRequire(esbuildPkg);
const esbuild = _require('esbuild');

async function minifyDir(dir) {
  if (!existsSync(dir)) return;
  const entries = readdirSync(dir).filter(f => f.endsWith('.js')).map(f => resolve(dir, f));
  if (entries.length === 0) return;
  console.log(`[postbuild] Minifying ${entries.length} scripts in ${dir}...`);
  try {
    await esbuild.build({
      entryPoints: entries,
      outdir: dir,
      minify: true,
      bundle: false,
      write: true,
      allowOverwrite: true,
      logLevel: 'error',
    });
    console.log(`[postbuild] Minification complete for ${dir}`);
  } catch (err) {
    console.error(`[postbuild] Minification failed:`, err.message);
  }
}

function copyDir(src, dest) {
  if (!existsSync(src)) return;
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true, force: true });
}

function copyFile(src, dest) {
  if (!existsSync(src)) return;
  mkdirSync(resolve(dest, '..'), { recursive: true });
  cpSync(src, dest, { force: true });
}

async function main() {
  if (site === 'both' || site === 'main') {
    copyDir(resolve(root, 'lib'), resolve(dist, 'lib'));
    copyDir(resolve(root, 'scripts'), resolve(dist, 'scripts'));
    await minifyDir(resolve(dist, 'scripts'));
  }
  if (site === 'both' || site === 'quickly') {
    copyDir(resolve(root, 'apps/quickly/lib'), resolve(dist, 'apps/quickly/lib'));
    copyDir(resolve(root, 'apps/quickly/scripts'), resolve(dist, 'apps/quickly/scripts'));
    copyDir(resolve(root, 'apps/quickly/styles'), resolve(dist, 'apps/quickly/styles'));
    copyDir(resolve(root, 'apps/quickly/assets'), resolve(dist, 'apps/quickly/assets'));
    await minifyDir(resolve(dist, 'apps/quickly/scripts'));
  }

  // -------- Service Worker generation --------

  const swSrc = resolve(root, 'packages/pwa/src/sw.js');

  function toAbsUrl(src, htmlDir) {
    const resolved = resolve(htmlDir, src);
    const rel = '/' + resolved.replace(/\\/g, '/').replace(dist.replace(/\\/g, '/') + '/', '');
    return rel.replace(/\/index\.html$/, '/index.html');
  }

  function extractAssetUrls(htmlPath) {
    if (!existsSync(htmlPath)) return [];
    const htmlDir = resolve(htmlPath, '..');
    const html = readFileSync(htmlPath, 'utf-8');
    const urls = [];
    const scriptRe = /<script[^>]+src="([^"]+)"[^>]*>/g;
    let m;
    while ((m = scriptRe.exec(html)) !== null) {
      const src = m[1];
      if (src.startsWith('//') || src.startsWith('http')) continue;
      if (src.startsWith('/')) { urls.push(src); continue; }
      urls.push(toAbsUrl(src, htmlDir));
    }
    const linkRe = /<link[^>]+href="([^"]+)"[^>]*>/g;
    while ((m = linkRe.exec(html)) !== null) {
      const href = m[1];
      if (href.startsWith('//') || href.startsWith('http')) continue;
      if (href.startsWith('/')) { urls.push(href); continue; }
      urls.push(toAbsUrl(href, htmlDir));
    }
    return [...new Set(urls)].sort();
  }

  function generateSW(htmlPath, swDestPath, manifestPath) {
    copyFile(swSrc, swDestPath);
    const urls = extractAssetUrls(htmlPath);
    const extra = manifestPath ? [manifestPath] : [];
    const all = [...new Set([...urls, ...extra])];
    const indent = '  ';
    const entries = all.map((u) => `${indent}'${u}'`).join(',\n');
    let sw = readFileSync(swDestPath, 'utf-8');
    sw = sw.replace(/  '__PRECACHE_ENTRIES__'/, entries);
    writeFileSync(swDestPath, sw, 'utf-8');
    console.log(`[postbuild] Injected ${all.length} precache URLs into ${swDestPath}`);
  }

  if (site === 'both' || site === 'main') {
    generateSW(resolve(dist, 'index.html'), resolve(dist, 'sw.js'), '/manifest.json');
  }
  if (site === 'both' || site === 'quickly') {
    generateSW(resolve(dist, 'apps/quickly/index.html'), resolve(dist, 'apps/quickly/sw.js'), '/apps/quickly/manifest.json');
  }
}

main().catch(err => { console.error('[postbuild] Fatal:', err); process.exit(1); });