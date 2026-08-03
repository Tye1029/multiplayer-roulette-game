import { readFile, writeFile } from 'node:fs/promises';

const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const start = '/* SAFE_CRACKER_CONTROL_TRIM_V2_START */';
const end = '/* SAFE_CRACKER_CONTROL_TRIM_V2_END */';

let css = await readFile(cssUrl, 'utf8');
if (!css.includes('/* SAFE_CRACKER_DIAL_LAYOUT_V3_START */') || !css.includes('/* SAFE_CRACKER_SCREW_REFINEMENT_V1_START */')) {
  throw new Error('Safe Cracker control trim requires the final dial layout and screw refinement passes.');
}

const trimCss = String.raw`${start}
/* A thicker shared steel frame now surrounds the pointer housing, step
   controls, digital display, and Check Number control. The controls keep their
   original dimensions because the game already uses border-box sizing. */
.safe-cracker-game .sc-dial-wrap::after,
.safe-cracker-game .sc-step-controls button,
.safe-cracker-game .sc-display,
.safe-cracker-game .sc-confirm-button {
  border-width: 5px !important;
  border-style: solid !important;
  border-color: #78858a !important;
  outline: 1px solid rgba(247, 252, 253, .96) !important;
  outline-offset: -1px !important;
}

/* Keep the three real controls available as positioning contexts for a
   border-only metal overlay. The mask cuts the center away, so their original
   fills, status colors, text, and button interaction remain untouched. */
.safe-cracker-game .sc-step-controls button,
.safe-cracker-game .sc-display,
.safe-cracker-game .sc-confirm-button {
  position: relative !important;
  isolation: isolate;
}

.safe-cracker-game .sc-step-controls button::after,
.safe-cracker-game .sc-display::after,
.safe-cracker-game .sc-confirm-button::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 2;
  padding: 4px;
  border-radius: inherit;
  pointer-events: none;
  background:
    linear-gradient(122deg,
      transparent 0 12%,
      rgba(255,255,255,.14) 17%,
      rgba(255,255,255,.96) 23%,
      rgba(216,230,234,.5) 27%,
      transparent 36% 66%,
      rgba(255,255,255,.52) 72%,
      transparent 79%),
    repeating-linear-gradient(92deg,
      #4b565b 0 2px,
      #8e9a9f 2px 3px,
      #dce5e7 3px 4px,
      #667278 4px 6px,
      #f5fafb 6px 7px,
      #aab5b9 7px 9px,
      #566167 9px 12px);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.96),
    inset 1px 0 0 rgba(236,245,247,.62),
    inset 0 -1px 0 rgba(30,38,42,.96),
    inset -1px 0 0 rgba(48,58,63,.78),
    0 0 5px rgba(227,239,242,.34);
  -webkit-mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  mask-composite: exclude;
}

/* The pointer housing is itself a metal box, so its full face receives the
   same brushed grain and a fixed diagonal reflective glare. */
.safe-cracker-game .sc-dial-wrap::after {
  background:
    linear-gradient(122deg,
      transparent 0 12%,
      rgba(255,255,255,.12) 17%,
      rgba(255,255,255,.94) 23%,
      rgba(216,230,234,.46) 27%,
      transparent 36% 66%,
      rgba(255,255,255,.42) 72%,
      transparent 79%),
    repeating-linear-gradient(92deg,
      rgba(255,255,255,.02) 0 2px,
      rgba(255,255,255,.3) 2px 3px,
      rgba(0,0,0,.13) 3px 5px,
      rgba(255,255,255,.2) 5px 6px,
      rgba(0,0,0,.1) 6px 9px),
    linear-gradient(180deg, rgba(255,255,255,.18), transparent 31%),
    linear-gradient(90deg, #20282c 0%, #87949a 22%, #d8e0e2 48%, #7a878d 72%, #1b2226 100%) !important;
  box-shadow:
    inset 0 2px 0 rgba(255,255,255,.94),
    inset 2px 0 0 rgba(232,242,244,.5),
    inset 0 -2px 0 rgba(32,40,44,.94),
    inset 0 -7px 9px rgba(0,0,0,.54),
    0 0 5px rgba(231,242,245,.32),
    0 4px 0 #010203,
    0 8px 10px rgba(0,0,0,.62) !important;
}

.safe-cracker-game .sc-step-controls button {
  box-shadow:
    inset 0 2px 0 rgba(255,255,255,.76),
    inset 0 -2px 0 rgba(39,48,52,.9),
    0 4px 0 #11161a,
    0 6px 9px rgba(0,0,0,.34) !important;
}

.safe-cracker-game .sc-step-controls button::before {
  z-index: 3;
}

.safe-cracker-game .sc-step-controls button:active {
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.58),
    inset 0 -1px 0 rgba(40,49,53,.82),
    0 1px 0 #11161a,
    0 3px 5px rgba(0,0,0,.3) !important;
}

.safe-cracker-game .sc-display {
  box-shadow:
    inset 0 2px 0 rgba(255,255,255,.7),
    inset 0 0 0 2px #465156,
    inset 0 -2px 0 rgba(28,35,38,.94),
    0 8px 16px rgba(0,0,0,.55) !important;
}

.safe-cracker-game .sc-confirm-button {
  font-family: Impact, Haettenschweiler, 'Arial Black', 'Segoe UI Black', sans-serif !important;
  font-size: 1.12rem !important;
  font-weight: 900 !important;
  letter-spacing: .105em !important;
  line-height: 1 !important;
  box-shadow:
    inset 0 2px 0 rgba(255,255,255,.76),
    inset 0 0 0 1px rgba(214,224,227,.58),
    inset 0 -4px 6px rgba(10,14,16,.28),
    0 7px 0 #050708,
    0 13px 15px rgba(0,0,0,.42) !important;
}

.safe-cracker-game .sc-confirm-button:active {
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.58),
    inset 0 0 0 1px rgba(214,224,227,.48),
    inset 0 -2px 4px rgba(10,14,16,.25),
    0 3px 0 #050708,
    0 7px 9px rgba(0,0,0,.34) !important;
}

@media (max-width: 700px) {
  .safe-cracker-game .sc-dial-wrap::after,
  .safe-cracker-game .sc-step-controls button,
  .safe-cracker-game .sc-display,
  .safe-cracker-game .sc-confirm-button {
    border-width: 4px !important;
  }

  .safe-cracker-game .sc-step-controls button::after,
  .safe-cracker-game .sc-display::after,
  .safe-cracker-game .sc-confirm-button::after {
    padding: 3px;
  }

  .safe-cracker-game .sc-confirm-button {
    font-size: 1rem !important;
    letter-spacing: .09em !important;
  }
}
${end}`;

const oldBlock = /\/\* SAFE_CRACKER_CONTROL_TRIM_V\d+_START \*\/[\s\S]*?\/\* SAFE_CRACKER_CONTROL_TRIM_V\d+_END \*\/\n?/g;
css = css.replace(oldBlock, '').trimEnd() + `\n\n${trimCss}\n`;
await writeFile(cssUrl, css);

let html = await readFile(indexUrl, 'utf8');
html = html.replace(/(\/assets\/safe-cracker\/safe-cracker\.(?:css|js)\?[^"'\s>]*)&trim=\d+/g, '$1');
html = html.replace(/(\/assets\/safe-cracker\/safe-cracker\.(?:css|js)\?[^"'\s>]+)/g, '$1&trim=2');
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker control trim v2: all four control groups have thicker brushed-steel borders with reflective glare while the blockier Check Number lettering, mobile layout, and interaction behavior remain unchanged.');
