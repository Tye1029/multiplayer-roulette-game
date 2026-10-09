import { readFile, writeFile } from 'node:fs/promises';

// Keep the published entry point compatible with the existing release validators.
// Author changes in the template and game fragments, never in generated index.html.
const root = new URL('../', import.meta.url);
const template = (await readFile(new URL('shared/site/index.template.html', root), 'utf8')).replace(/\r\n/g, '\n');
const token = /\/\* SITE_INCLUDE: ([a-zA-Z0-9/_.-]+)#([a-zA-Z0-9_-]+) \*\//g;
let output = '';
let cursor = 0;
for (const match of template.matchAll(token)) {
  const path = match[1];
  if (!path.startsWith('games/multiplayer/') || path.includes('..')) {
    throw new Error(`Invalid site fragment: ${path}`);
  }
  output += template.slice(cursor, match.index);
  const source = (await readFile(new URL(path, root), 'utf8')).replace(/\r\n/g, '\n');
  const start = `// SITE_FRAGMENT_START: ${match[2]}\n`;
  const end = `\n// SITE_FRAGMENT_END: ${match[2]}`;
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  if (from < 0 || to < 0) throw new Error(`Missing fragment ${path}#${match[2]}`);
  output += source.slice(from + start.length, to);
  cursor = match.index + match[0].length;
}
output += template.slice(cursor);
await writeFile(new URL('index.html', root), output);
console.log('Assembled multiplayer site from shared shell and game-owned source.');
