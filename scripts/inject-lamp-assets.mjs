import { readFile, writeFile } from 'node:fs/promises';

const indexUrl = new URL('../index.html', import.meta.url);
const startMarker = '<!-- MODULAR_LAMP_ASSETS_START -->';
const endMarker = '<!-- MODULAR_LAMP_ASSETS_END -->';
const block = `${startMarker}\n` +
  '  <script src="/assets/roulette/lamp-config.js?v=11" defer></script>\n' +
  '  <script src="/assets/roulette/lamp.js?v=11" defer></script>\n' +
  '  <script src="/assets/roulette/lamp-bootstrap.js?v=11" defer></script>\n' +
  `${endMarker}`;

let html = await readFile(indexUrl, 'utf8');
const markerPattern = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`, 'm');

if (markerPattern.test(html)) {
  html = html.replace(markerPattern, block);
} else if (html.includes('</head>')) {
  html = html.replace('</head>', `${block}\n</head>`);
} else {
  throw new Error('Cannot inject modular lamp assets: index.html has no </head> tag');
}

await writeFile(indexUrl, html);
console.log('Injected modular lamp assets into index.html for this Netlify deploy.');
