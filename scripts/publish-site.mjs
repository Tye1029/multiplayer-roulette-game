import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.resolve(root, 'dist');
if (path.dirname(output) !== path.resolve(root)) throw new Error('Invalid publish directory');
await rm(output, { recursive: true, force: true });
await mkdir(output);
for (const directory of ['assets', 'admin', 'shared/games']) {
  await cp(path.join(root, directory), path.join(output, directory), { recursive: true });
}
// Include established public previews, but never ship patch scripts, source
// templates, workflow files, dependency trees, or repository documentation.
for (const entry of await readdir(root, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith('.html')) {
    await cp(path.join(root, entry.name), path.join(output, entry.name));
  }
}
for (const game of await readdir(path.join(root, 'games/multiplayer'), { withFileTypes: true })) {
  if (!game.isDirectory()) continue;
  const directory = path.join(root, 'games/multiplayer', game.name);
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.html')) continue;
    const destination = path.join(output, 'games/multiplayer', game.name);
    await mkdir(destination, { recursive: true });
    await cp(path.join(directory, entry.name), path.join(destination, entry.name));
  }
}
console.log('Prepared dist/: public pages and runtime assets only.');
