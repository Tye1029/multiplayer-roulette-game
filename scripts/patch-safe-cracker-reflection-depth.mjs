import { readFile, writeFile } from 'node:fs/promises';

const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const cssStart = '/* SAFE_CRACKER_REFLECTION_DEPTH_V14_START */';
const cssEnd = '/* SAFE_CRACKER_REFLECTION_DEPTH_V14_END */';

let css = await readFile(cssUrl, 'utf8');
if (!css.includes('/* SAFE_CRACKER_REFERENCE_VISUALS_V13_START */')) {
  throw new Error('Safe Cracker reflection-depth pass requires reference visuals v13 first.');
}

const reflectionDepth = String.raw`${cssStart}
.safe-cracker-game.sc-reference-visuals {
  --sc-ref-light-x: 48%;
  --sc-ref-light-y: -3%;
  background:
    radial-gradient(ellipse 46% 22% at var(--sc-ref-light-x) var(--sc-ref-light-y), rgba(255,218,139,.18), transparent 66%),
    radial-gradient(ellipse 76% 50% at 50% 18%, rgba(207,132,35,.055), transparent 67%),
    linear-gradient(90deg, rgba(255,255,255,.022), transparent 12%, transparent 88%, rgba(255,255,255,.016)),
    repeating-linear-gradient(0deg, rgba(255,255,255,.011) 0 1px, transparent 1px 4px),
    linear-gradient(180deg, #101315 0%, #07090a 43%, #020303 100%);
}

.safe-cracker-game.sc-reference-visuals .sc-safe-shell {
  background:
    radial-gradient(ellipse 54% 17% at 48% -2%, rgba(255,221,151,.16), transparent 73%),
    linear-gradient(116deg, rgba(255,255,255,.08), transparent 9% 43%, rgba(255,211,127,.026) 48%, transparent 57%),
    repeating-linear-gradient(90deg, rgba(255,255,255,.014) 0 1px, transparent 1px 6px),
    linear-gradient(145deg, #424540 0%, #1b1d1b 27%, #070909 68%, #252824 100%);
  box-shadow:
    inset 0 0 0 3px #070808,
    inset 0 0 0 6px rgba(196, 139, 48, .2),
    inset 0 2px 0 rgba(255,245,216,.2),
    inset 18px 0 34px rgba(0,0,0,.42),
    inset -16px 0 32px rgba(0,0,0,.5),
    inset 0 -42px 82px rgba(0,0,0,.7),
    0 -8px 24px rgba(225,155,58,.08),
    0 20px 36px rgba(0,0,0,.58);
}

.safe-cracker-game.sc-reference-visuals .sc-safe-door {
  background:
    radial-gradient(ellipse 44% 24% at 50% -3%, rgba(255,231,178,.2), transparent 72%),
    radial-gradient(ellipse 22% 42% at 4% 44%, rgba(255,255,255,.075), transparent 68%),
    radial-gradient(ellipse 19% 36% at 97% 39%, rgba(255,193,85,.045), transparent 70%),
    radial-gradient(circle at 7% 7%, #d0c8b5 0 2px, #2a2a27 3px 6px, transparent 7px),
    radial-gradient(circle at 93% 7%, #bcb5a4 0 2px, #252622 3px 6px, transparent 7px),
    radial-gradient(circle at 7% 93%, #918d83 0 2px, #20211f 3px 6px, transparent 7px),
    radial-gradient(circle at 93% 93%, #918d83 0 2px, #20211f 3px 6px, transparent 7px),
    repeating-linear-gradient(92deg, rgba(255,255,255,.019) 0 1px, rgba(0,0,0,.013) 1px 5px),
    linear-gradient(145deg, #5a5b55 0%, #30322e 17%, #111311 56%, #070909 79%, #292b27 100%);
  box-shadow:
    inset 0 0 0 3px #0c0e0d,
    inset 0 0 0 8px rgba(142, 143, 133, .38),
    inset 0 2px 0 rgba(255,255,255,.17),
    inset 22px 0 36px rgba(0,0,0,.44),
    inset -18px 0 32px rgba(0,0,0,.52),
    inset 0 -44px 82px rgba(0,0,0,.66),
    0 15px 24px rgba(0,0,0,.6);
}

/* Remove the oversized polygonal reflection inherited from earlier visual layers. */
.safe-cracker-game.sc-reference-visuals .sc-display::before,
.safe-cracker-game.sc-reference-visuals .sc-display::after,
.safe-cracker-game.sc-reference-visuals .sc-display-glass::before,
.safe-cracker-game.sc-reference-visuals .sc-display-glass::after {
  clip-path: none !important;
  transform: none !important;
}
.safe-cracker-game.sc-reference-visuals .sc-display::after {
  display: none !important;
  content: none !important;
}

/* A localized top light replaces the full-door trapezoid overlay. */
.safe-cracker-game.sc-reference-visuals .sc-safe-door::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 8;
  clip-path: none !important;
  transform: none !important;
  background:
    radial-gradient(ellipse 40% 16% at 49% 0%, rgba(255,236,192,.19), transparent 72%),
    radial-gradient(ellipse 12% 36% at 7% 37%, rgba(255,255,255,.075), transparent 72%),
    radial-gradient(ellipse 9% 29% at 93% 35%, rgba(255,199,92,.055), transparent 74%);
  mix-blend-mode: screen;
  opacity: .78;
  pointer-events: none;
}

.safe-cracker-game.sc-reference-visuals .sc-display {
  background:
    linear-gradient(122deg, rgba(255,255,255,.09) 0%, rgba(255,255,255,.018) 20%, transparent 38% 79%, rgba(255,190,58,.035)),
    linear-gradient(180deg, #1b1e1e 0%, #080a0a 59%, #020303 100%);
  box-shadow:
    inset 0 0 0 3px #040505,
    inset 0 0 0 5px rgba(156, 105, 30, .34),
    inset 0 2px 0 rgba(255,241,205,.12),
    inset 0 -18px 28px rgba(0,0,0,.62),
    0 9px 16px rgba(0,0,0,.56),
    0 -4px 14px rgba(255,190,70,.055);
}

.safe-cracker-game.sc-reference-visuals .sc-dial-wrap {
  width: min(79vw, 346px);
  height: min(79vw, 346px);
  max-width: 346px;
  max-height: 346px;
  margin: 0 auto 4px;
  filter: drop-shadow(0 18px 18px rgba(0,0,0,.58));
}

.safe-cracker-game.sc-reference-visuals .sc-dial {
  inset: 2px;
  filter: none;
}

.safe-cracker-game.sc-reference-visuals .sc-dial::before,
.safe-cracker-game.sc-reference-visuals .sc-dial::after {
  inset: -7px;
  clip-path: none !important;
  transform: none !important;
}

/* Screen-fixed crescent and glints: the dial rotates underneath this light. */
.safe-cracker-game.sc-reference-visuals .sc-dial::before {
  background:
    radial-gradient(ellipse 48% 20% at 38% 5%, rgba(255,255,255,.24), rgba(255,242,205,.08) 34%, transparent 72%),
    radial-gradient(ellipse 16% 42% at 8% 39%, rgba(255,255,255,.11), transparent 70%),
    radial-gradient(ellipse 20% 18% at 82% 85%, rgba(255,187,53,.08), transparent 75%);
  mix-blend-mode: screen;
  opacity: .92;
}

.safe-cracker-game.sc-reference-visuals .sc-dial::after {
  border: 4px solid rgba(222, 174, 86, .5);
  box-shadow:
    inset 0 0 0 4px #050606,
    inset 0 0 0 9px rgba(104, 73, 27, .8),
    inset 0 0 0 13px #111310,
    inset 0 0 0 16px rgba(218, 166, 74, .22),
    inset 0 0 28px rgba(255,202,102,.08),
    0 0 0 2px #050606,
    0 0 0 6px rgba(107, 75, 27, .72),
    0 12px 23px rgba(0,0,0,.66);
}

.safe-cracker-game.sc-reference-visuals .sc-dial-face {
  border: 10px solid #070808;
  background:
    radial-gradient(circle at 37% 23%, rgba(255,255,255,.15), transparent 14%),
    radial-gradient(circle at 50% 50%, #040505 0 20%, transparent 21%),
    radial-gradient(circle, transparent 0 42%, rgba(202,145,47,.16) 42.5% 44%, transparent 44.5% 60%, rgba(216,164,71,.22) 60.5% 62%, transparent 62.5%),
    repeating-conic-gradient(from -1.2deg, #c79843 0deg .9deg, #3c2a0d .9deg 2deg, #101212 2deg 35.1deg, #815c22 35.1deg 36deg),
    radial-gradient(circle, #121412 0 62%, #070808 63% 69%, #c28e37 70% 73%, #282923 74% 79%, #050606 80%);
  box-shadow:
    inset 0 0 0 2px #8f6a2d,
    inset 0 0 0 6px #171916,
    inset 0 0 0 9px rgba(194,142,48,.2),
    inset 0 0 40px rgba(0,0,0,.94),
    inset 10px 9px 17px rgba(255,255,255,.035);
}

.safe-cracker-game.sc-reference-visuals .sc-dial-number {
  --radius: 122px;
  color: #f2cb79;
  font-size: 1.18rem;
  text-shadow: 0 2px 2px #000, 0 0 6px rgba(255,190,69,.24);
}

.safe-cracker-game.sc-reference-visuals .sc-dial-hub {
  width: 35%;
  border: 5px solid #050606;
  background:
    radial-gradient(ellipse at 34% 20%, rgba(255,255,255,.17), transparent 25%),
    radial-gradient(circle at 50% 52%, #070707 0 49%, #17140e 50% 59%, #d39b3e 60% 65%, #3a2309 66% 74%, #060707 75%);
  box-shadow:
    inset 0 0 20px rgba(0,0,0,.94),
    inset 4px 3px 7px rgba(255,255,255,.035),
    0 0 0 2px #f0c66f,
    0 0 0 6px #69420f,
    0 0 0 9px #090a09,
    0 12px 20px rgba(0,0,0,.7);
}

.safe-cracker-game.sc-reference-visuals .sc-current-number {
  width: 86px;
  height: 86px;
  background:
    radial-gradient(ellipse at 38% 23%, rgba(255,239,197,.12), transparent 29%),
    radial-gradient(circle, #130e04 0%, #040404 68%, #000 100%);
  box-shadow:
    inset 0 0 24px rgba(255,170,25,.1),
    inset 5px 4px 8px rgba(255,255,255,.025),
    0 0 20px rgba(255,174,31,.11);
}

.safe-cracker-game.sc-reference-visuals .sc-step-controls {
  gap: 18px;
  margin: -4px 0 11px;
  align-items: center;
}
.safe-cracker-game.sc-reference-visuals .sc-step-controls button {
  width: 104px;
  height: 58px;
  padding: 0 0 4px;
  display: grid;
  place-items: center;
  line-height: 1;
  background:
    radial-gradient(ellipse at 38% 0, rgba(255,245,211,.12), transparent 43%),
    linear-gradient(124deg, rgba(255,255,255,.13), transparent 25% 72%, rgba(255,182,45,.04)),
    linear-gradient(180deg, #36352f, #141615 58%, #070808);
  box-shadow:
    inset 0 0 0 2px #060707,
    inset 0 2px 0 rgba(255,239,196,.17),
    inset 0 -11px 18px rgba(0,0,0,.62),
    0 5px 0 #040505,
    0 10px 15px rgba(0,0,0,.5);
}

.safe-cracker-game.sc-reference-visuals .sc-confirm-button {
  margin-top: 2px;
  background:
    radial-gradient(ellipse at 43% 0, rgba(255,239,196,.14), transparent 40%),
    linear-gradient(118deg, rgba(255,255,255,.14), transparent 23% 69%, rgba(255,190,56,.05)),
    linear-gradient(180deg, #3d382e 0%, #1a1a17 52%, #080909 100%);
  box-shadow:
    inset 0 0 0 3px #060707,
    inset 0 0 0 5px rgba(218, 157, 58, .38),
    inset 0 2px 0 rgba(255,245,216,.17),
    inset 0 -15px 22px rgba(0,0,0,.68),
    0 5px 0 #050505,
    0 12px 18px rgba(0,0,0,.54),
    0 0 17px rgba(255,174,34,.075);
}

@media (max-width: 700px) {
  .safe-cracker-game.sc-reference-visuals .sc-safe-shell { padding: 10px; }
  .safe-cracker-game.sc-reference-visuals .sc-safe-door { min-height: 500px; }
  .safe-cracker-game.sc-reference-visuals .sc-dial-wrap {
    width: min(78vw, 326px);
    height: min(78vw, 326px);
    margin-bottom: 3px;
  }
  .safe-cracker-game.sc-reference-visuals .sc-dial-number { --radius: min(28.1vw, 116px); }
  .safe-cracker-game.sc-reference-visuals .sc-step-controls {
    gap: 18px;
    margin: -5px 0 9px;
  }
  .safe-cracker-game.sc-reference-visuals .sc-step-controls button {
    width: min(27vw, 96px);
    height: 52px;
    font-size: 1.75rem;
  }
}

@media (max-width: 700px) and (max-height: 780px) {
  .safe-cracker-game.sc-reference-visuals .sc-safe-door { min-height: 448px; }
  .safe-cracker-game.sc-reference-visuals .sc-display { margin-top: 10px; margin-bottom: 3px; }
  .safe-cracker-game.sc-reference-visuals .sc-dial-wrap {
    width: min(65vw, 258px);
    height: min(65vw, 258px);
    margin-bottom: 0;
  }
  .safe-cracker-game.sc-reference-visuals .sc-dial-number { --radius: min(23.1vw, 91px); font-size: .94rem; }
  .safe-cracker-game.sc-reference-visuals .sc-current-number { width: 68px; height: 68px; font-size: 2.2rem; }
  .safe-cracker-game.sc-reference-visuals .sc-step-controls {
    gap: 17px;
    margin: -7px 0 7px;
  }
  .safe-cracker-game.sc-reference-visuals .sc-step-controls button {
    width: 82px;
    height: 47px;
    font-size: 1.6rem;
  }
  .safe-cracker-game.sc-reference-visuals .sc-confirm-button {
    min-height: 49px;
    margin-block: 1px 7px;
  }
}
${cssEnd}`;

const markerPattern = /\/\* SAFE_CRACKER_REFLECTION_DEPTH_V14_START \*\/[\s\S]*?\/\* SAFE_CRACKER_REFLECTION_DEPTH_V14_END \*\/\s*/m;
css = css.replace(markerPattern, '').trimEnd() + `\n\n${reflectionDepth}\n`;
await writeFile(cssUrl, css);

let html = await readFile(indexUrl, 'utf8');
if (!html.includes('&reference=1&depth=1')) {
  html = html.replaceAll('&reference=1', '&reference=1&depth=1');
}
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker reflection depth v14: removed trapezoid overlay, added localized warm light, thickened dial rings, deepened steel reflections, and aligned minus/plus controls.');