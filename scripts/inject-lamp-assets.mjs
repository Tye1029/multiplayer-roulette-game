import { readFile, writeFile } from 'node:fs/promises';

const indexUrl = new URL('../index.html', import.meta.url);
const startMarker = '<!-- MODULAR_LAMP_ASSETS_START -->';
const endMarker = '<!-- MODULAR_LAMP_ASSETS_END -->';
const criticalStyle = `  <style id="rrLampCriticalHide">
    [data-roulette-game] > .rr-lamp,
    [data-roulette-game] .rr-lamp-fixture,
    [data-roulette-game] .rr-v106-lamp-art,
    [data-roulette-game] .rr-v114-lamp-art,
    [data-roulette-game] .rr-v120-lamp-rig,
    [data-roulette-game] .rr-v122-lamp-rig,
    [data-roulette-game] .rr-v123-lamp-layer,
    [data-roulette-game] .rr-v124-lamp-fixture,
    [data-roulette-game] .rr126-swing::before,
    [data-roulette-game] .rr126-swing::after,
    [data-roulette-game] .rr126-bulb-glow,
    [data-roulette-game] .rr126-room-glow,
    [data-roulette-game] .rr126-beam,
    [data-roulette-game] .rr126-swing > img:not(#rrLampPng),
    [data-roulette-game] .rr126-swing > [class*="lamp-body"],
    [data-roulette-game] .rr126-swing > [class*="lamp-shade"],
    [data-roulette-game] .rr126-swing > [class*="shade-art"],
    [data-roulette-game] .rr126-swing > [class*="underside"] {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
    }
    [data-roulette-game] .rr126-lamp-rig {
      position: absolute !important;
      inset: 0 0 auto 0 !important;
      width: 100% !important;
      height: 58% !important;
      z-index: 4 !important;
      pointer-events: none !important;
      overflow: visible !important;
    }
    [data-roulette-game] .rr126-chain {
      position: absolute !important;
      top: 0 !important;
      left: 50%;
      width: 14px;
      height: 27%;
      transform: translateX(-50%);
      background: url('/assets/roulette/decor/workshop-lamp-chain.png') center top / 14px auto repeat-y !important;
      z-index: 2 !important;
    }
    [data-roulette-game] .rr126-swing {
      position: absolute !important;
      top: 22%;
      left: 50%;
      width: 44% !important;
      aspect-ratio: 325 / 273 !important;
      transform: translateX(-50%);
      transform-origin: 50% 0 !important;
      overflow: visible !important;
      visibility: visible !important;
      opacity: 1 !important;
      z-index: 3 !important;
    }
    [data-roulette-game] .rr130-table-illumination {
      position: absolute !important;
      inset: 0 !important;
      width: 100% !important;
      height: 100% !important;
      pointer-events: none !important;
    }
    [data-roulette-game] #rrLampPng { visibility: visible !important; opacity: 1 !important; }
    @media (min-width:701px) {
      [data-roulette-game] .rr126-lamp-rig { height:51% !important; }
      [data-roulette-game] .rr126-swing { width:31% !important; max-width:230px !important; }
    }
    @media (max-width:700px), (hover:none) and (pointer:coarse) {
      [data-roulette-game] .rr126-lamp-rig { height:57% !important; }
      [data-roulette-game] .rr126-swing { width:43% !important; max-width:none !important; }
    }
  </style>`;
const block = `${startMarker}\n` +
  `${criticalStyle}\n` +
  '  <script src="/assets/roulette/lamp-config.js?v=17" defer></script>\n' +
  '  <script src="/assets/roulette/lamp.js?v=17" defer></script>\n' +
  '  <script src="/assets/roulette/lamp-bootstrap.js?v=17" defer></script>\n' +
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
console.log('Injected self-contained lamp structure and isolated lamp assets; gun animation remains owned by the game.');