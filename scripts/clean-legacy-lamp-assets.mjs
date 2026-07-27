import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rouletteDir = fileURLToPath(new URL('../assets/roulette/', import.meta.url));
const keep = new Set([
  'lamp-config.js',
  'lamp.js',
  'lamp-bootstrap.js',
  'lamp-calibration.js',
  'lamp.css',
  'lamp-calibration.css',
  path.join('decor', 'lamp-1.png')
]);
const removableExtensions = new Set(['.png', '.webp', '.gif', '.jpg', '.jpeg', '.svg', '.css', '.js', '.txt']);
const removed = [];

async function walk(directory, relative = '') {
  let entries = [];
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }

  for (const entry of entries) {
    const relativePath = path.join(relative, entry.name);
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(absolutePath, relativePath);
      continue;
    }

    const normalized = relativePath.split(path.sep).join('/');
    const basename = entry.name.toLowerCase();
    const extension = path.extname(basename);
    const isLampNamed = basename.includes('lamp');
    const isKnownTemporary = /(?:legacy|old|temp|patch|development|active)/i.test(basename);
    if (removableExtensions.has(extension) && (isLampNamed || isKnownTemporary) && !keep.has(normalized)) {
      await rm(absolutePath, { force: true });
      removed.push(normalized);
    }
  }
}

await walk(rouletteDir);
console.log(removed.length
  ? `Removed stale lamp deploy files: ${removed.join(', ')}`
  : 'No stale lamp deploy files found.');
