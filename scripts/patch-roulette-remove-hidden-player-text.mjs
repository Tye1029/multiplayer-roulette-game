import { readFile, writeFile } from 'node:fs/promises';

const indexUrl = new URL('../index.html', import.meta.url);
let html = await readFile(indexUrl, 'utf8');

const hiddenPlayerPattern = /player\s+hidden\s+until\s+(?:the\s+)?revolver\s+chooses[.!…]?/gi;
const before = html;
html = html.replace(hiddenPlayerPattern, '');

if (hiddenPlayerPattern.test(html)) {
  throw new Error('The hidden-player opening message still remains after patching.');
}

if (html === before) {
  console.warn('Hidden-player opening message was already absent from the generated page.');
} else {
  await writeFile(indexUrl, html);
}

console.log('Removed the top “Player hidden until revolver chooses” message.');
