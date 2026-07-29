import { readFile, writeFile } from 'node:fs/promises';

const indexUrl = new URL('../index.html', import.meta.url);
let html = await readFile(indexUrl, 'utf8');

html = html.replace(
  '/^duel-[a-z0-9_-]+-\\\\d{10,16}-[a-f0-9]{10,32}$/.test',
  '/^duel-[a-z0-9_-]+-[0-9]{10,16}-[a-f0-9]{10,32}$/.test'
);

if (!html.includes('/^duel-[a-z0-9_-]+-[0-9]{10,16}-[a-f0-9]{10,32}$/.test')) {
  throw new Error('The client pending-create ID validator was not normalized.');
}

await writeFile(indexUrl, html);
console.log('Normalized the client create-ID validator.');
