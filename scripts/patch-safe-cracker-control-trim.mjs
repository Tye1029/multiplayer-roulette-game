import { readFile, writeFile } from 'node:fs/promises';

const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const start = '/* SAFE_CRACKER_CONTROL_TRIM_V1_START */';
const end = '/* SAFE_CRACKER_CONTROL_TRIM_V1_END */';

let css = await readFile(cssUrl, 'utf8');
if (!css.includes('/* SAFE_CRACKER_DIAL_LAYOUT_V3_START */') || !css.includes('/* SAFE_CRACKER_SCREW_REFINEMENT_V1_START */')) {
  throw new Error('Safe Cracker control trim requires the final dial layout and screw refinement passes.');
}

const trimCss = String.raw`${start}
/* One consistent thin polished-silver trim around the pointer housing, step
   controls, digital display, and Check Number control. The trim is drawn as an
   inset edge so the existing mechanical borders, dimensions, and press motion
   remain unchanged. */
.safe-cracker-game .sc-dial-wrap::after,
.safe-cracker-game .sc-step-controls button,
.safe-cracker-game .sc-display,
.safe-cracker-game .sc-confirm-button {
  outline: 1px solid rgba(224, 232, 235, .96) !important;
  outline-offset: -2px !important;
}

/* Subtle two-tone edge catches make the one-pixel trim read as polished metal
   rather than a flat white line. */
.safe-cracker-game .sc-dial-wrap::after {
  border-color: #667278 !important;
  background:
    linear-gradient(180deg, rgba(255,255,255,.18), transparent 31%),
    linear-gradient(90deg, #20282c 0%, #87949a 22%, #d8e0e2 48%, #7a878d 72%, #1b2226 100%) !important;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.74),
    inset 0 -1px 0 rgba(43,52,56,.9),
    inset 0 -6px 8px rgba(0,0,0,.56),
    0 4px 0 #010203,
    0 8px 10px rgba(0,0,0,.62) !important;
}

.safe-cracker-game .sc-step-controls button {
  border-color: #667278 !important;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.68),
    inset 0 -1px 0 rgba(40,49,53,.88),
    0 4px 0 #11161a,
    0 6px 9px rgba(0,0,0,.34) !important;
}

.safe-cracker-game .sc-step-controls button:active {
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.5),
    inset 0 -1px 0 rgba(40,49,53,.82),
    0 1px 0 #11161a,
    0 3px 5px rgba(0,0,0,.3) !important;
}

.safe-cracker-game .sc-display {
  border-color: #4f5b60 !important;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.62),
    inset 0 0 0 2px #465156,
    inset 0 -1px 0 rgba(28,35,38,.9),
    0 8px 16px rgba(0,0,0,.55) !important;
}

.safe-cracker-game .sc-confirm-button {
  border-color: #4f5b60 !important;
  font-family: Impact, Haettenschweiler, 'Arial Black', 'Segoe UI Black', sans-serif !important;
  font-size: 1.12rem !important;
  font-weight: 900 !important;
  letter-spacing: .105em !important;
  line-height: 1 !important;
  box-shadow:
    inset 0 2px 0 rgba(255,255,255,.72),
    inset 0 0 0 1px rgba(214,224,227,.58),
    inset 0 -4px 6px rgba(10,14,16,.28),
    0 7px 0 #050708,
    0 13px 15px rgba(0,0,0,.42) !important;
}

.safe-cracker-game .sc-confirm-button:active {
  border-color: #4f5b60 !important;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.52),
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
    outline-offset: -1px !important;
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
html = html.replace(/(\/assets\/safe-cracker\/safe-cracker\.(?:css|js)\?[^"'\s>]+)/g, '$1&trim=1');
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker control trim v1: the pointer housing, step buttons, display, and Check Number control share a thin polished-silver border, with larger blockier Check Number lettering.');
