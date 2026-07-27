import { readFile, writeFile } from 'node:fs/promises';

const indexUrl = new URL('../index.html', import.meta.url);
const startMarker = '<!-- MODULAR_LAMP_ASSETS_START -->';
const endMarker = '<!-- MODULAR_LAMP_ASSETS_END -->';
const criticalStyle = `  <style id="rrLampCriticalHide">
    [data-roulette-game] .rr126-swing::before,
    [data-roulette-game] .rr126-swing::after,
    [data-roulette-game] .rr126-bulb-glow,
    [data-roulette-game] .rr126-swing > img:not(#rrLampPng),
    [data-roulette-game] .rr126-swing > [class*="lamp-body"],
    [data-roulette-game] .rr126-swing > [class*="lamp-shade"],
    [data-roulette-game] .rr126-swing > [class*="shade-art"],
    [data-roulette-game] .rr126-swing > [class*="underside"] {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
    }
    [data-roulette-game] .rr126-swing,
    [data-roulette-game] #rrLampPng { visibility: visible !important; opacity: 1 !important; }
  </style>`;
const block = `${startMarker}\n` +
  `${criticalStyle}\n` +
  '  <script src="/assets/roulette/lamp-config.js?v=16" defer></script>\n' +
  '  <script src="/assets/roulette/lamp.js?v=16" defer></script>\n' +
  '  <script src="/assets/roulette/lamp-bootstrap.js?v=16" defer></script>\n' +
  '  <script src="/assets/roulette/turn-orientation.js?v=4" defer></script>\n' +
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
console.log('Injected lamp controls plus artwork-centered real-game turn orientation.');
