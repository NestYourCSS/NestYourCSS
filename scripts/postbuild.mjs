import { cpSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
const site = process.argv[2] || 'both';

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

if (site === 'both' || site === 'main') {
  copyDir(resolve(root, 'lib'), resolve(dist, 'lib'));
  copyDir(resolve(root, 'scripts'), resolve(dist, 'scripts'));
}
if (site === 'both' || site === 'quickly') {
  copyDir(resolve(root, 'apps/quickly/lib'), resolve(dist, 'apps/quickly/lib'));
  copyDir(resolve(root, 'apps/quickly/scripts'), resolve(dist, 'apps/quickly/scripts'));
  copyDir(resolve(root, 'apps/quickly/styles'), resolve(dist, 'apps/quickly/styles'));
  copyDir(resolve(root, 'apps/quickly/assets'), resolve(dist, 'apps/quickly/assets'));
  copyFile(resolve(root, 'apps/quickly/manifest.json'), resolve(dist, 'apps/quickly/manifest.json'));
}
