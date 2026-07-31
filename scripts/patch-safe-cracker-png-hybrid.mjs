import { readFile, writeFile } from 'node:fs/promises';

const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const cssStart = '/* SAFE_CRACKER_PNG_HYBRID_V15_START */';
const cssEnd = '/* SAFE_CRACKER_PNG_HYBRID_V15_END */';

let css = await readFile(cssUrl, 'utf8');
if (!css.includes('/* SAFE_CRACKER_REFLECTION_DEPTH_V14_START */')) {
  throw new Error('Safe Cracker PNG hybrid requires reflection-depth v14 first.');
}

const hybridCss = String.raw`${cssStart}
/* The user's supplied reference provides the static photographed safe body:
   steel, hinges, gold trim, pointer, shadows, reflections and button frames. */
.safe-cracker-game.sc-reference-visuals .sc-safe-shell {
  position: relative;
  display: block !important;
  width: min(100%, 620px) !important;
  max-width: 620px !important;
  margin-inline: auto !important;
  padding: 0 !important;
  overflow: visible !important;
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}

.safe-cracker-game.sc-reference-visuals .sc-safe-shell::before,
.safe-cracker-game.sc-reference-visuals .sc-safe-shell::after {
  display: none !important;
  content: none !important;
}

.safe-cracker-game.sc-reference-visuals .sc-safe-door {
  position: relative !important;
  width: 100% !important;
  height: auto !important;
  min-height: 0 !important;
  aspect-ratio: 432 / 561;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
  border: 0 !important;
  border-radius: 0 !important;
  outline: 0 !important;
  background-color: transparent !important;
  background-image: url('/assets/safe-cracker/png-ui/safe-body.png?v=2') !important;
  background-position: center !important;
  background-repeat: no-repeat !important;
  background-size: 100% 100% !important;
  box-shadow: 0 22px 38px rgba(0, 0, 0, .6) !important;
  isolation: isolate;
}

.safe-cracker-game.sc-reference-visuals .sc-safe-door::before,
.safe-cracker-game.sc-reference-visuals .sc-safe-door::after,
.safe-cracker-game.sc-reference-visuals .sc-bolts,
.safe-cracker-game.sc-reference-visuals .sc-safe-handle {
  display: none !important;
  content: none !important;
}

/* Live feedback is fitted into the transparent display opening. */
.safe-cracker-game.sc-reference-visuals .sc-display,
.safe-cracker-game.sc-reference-visuals .sc-display.red,
.safe-cracker-game.sc-reference-visuals .sc-display.orange,
.safe-cracker-game.sc-reference-visuals .sc-display.yellow,
.safe-cracker-game.sc-reference-visuals .sc-display.green {
  position: absolute !important;
  left: 23.495% !important;
  top: 9.002% !important;
  z-index: 20 !important;
  width: 53.01% !important;
  height: 11.41% !important;
  min-height: 0 !important;
  margin: 0 !important;
  padding: 2.1% 3.4% !important;
  overflow: hidden !important;
  border: 0 !important;
  border-radius: 3.5% !important;
  color: #efc979 !important;
  background:
    linear-gradient(118deg, rgba(255,255,255,.075), transparent 24% 72%, rgba(255,184,48,.035)),
    linear-gradient(180deg, rgba(19,21,21,.98), rgba(4,5,5,.99)) !important;
  box-shadow:
    inset 0 2px 0 rgba(255,245,214,.07),
    inset 0 -16px 24px rgba(0,0,0,.56),
    0 0 8px rgba(255,177,40,.035) !important;
  transform: none !important;
}

.safe-cracker-game.sc-reference-visuals .sc-display::before,
.safe-cracker-game.sc-reference-visuals .sc-display::after,
.safe-cracker-game.sc-reference-visuals .sc-display-bezel,
.safe-cracker-game.sc-reference-visuals .sc-display-glass::before,
.safe-cracker-game.sc-reference-visuals .sc-display-glass::after,
.safe-cracker-game.sc-reference-visuals .sc-feedback-meter {
  display: none !important;
  content: none !important;
}

.safe-cracker-game.sc-reference-visuals .sc-display-glass {
  width: 100% !important;
  height: 100% !important;
  padding: 0 !important;
  display: grid !important;
  grid-template-rows: minmax(0, 1fr) auto !important;
  align-items: center !important;
  border: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}

.safe-cracker-game.sc-reference-visuals .sc-display-status {
  align-self: end !important;
  color: #f1cc79 !important;
  font: 900 clamp(.92rem, 4.5vw, 1.72rem)/.96 Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif !important;
  letter-spacing: .065em !important;
  text-align: center !important;
  text-shadow: 0 2px 2px #000, 0 0 8px rgba(255, 188, 60, .24) !important;
}

.safe-cracker-game.sc-reference-visuals .sc-display-meta {
  align-self: start !important;
  margin-top: clamp(3px, .7vw, 6px) !important;
  display: flex !important;
  justify-content: space-between !important;
  gap: 6px !important;
  color: rgba(224, 214, 194, .62) !important;
}

.safe-cracker-game.sc-reference-visuals .sc-display-meta small,
.safe-cracker-game.sc-reference-visuals .sc-display-meta b {
  color: inherit !important;
  font-size: clamp(.4rem, 1.7vw, .62rem) !important;
  line-height: 1 !important;
  letter-spacing: .05em !important;
  white-space: nowrap !important;
}

.safe-cracker-game.sc-reference-visuals .sc-display.red .sc-display-status { color: #ff7468 !important; }
.safe-cracker-game.sc-reference-visuals .sc-display.orange .sc-display-status { color: #ffad5c !important; }
.safe-cracker-game.sc-reference-visuals .sc-display.yellow .sc-display-status { color: #f3d472 !important; }
.safe-cracker-game.sc-reference-visuals .sc-display.green .sc-display-status { color: #91e8aa !important; }

/* Only the numbered plate rotates. The photographed outer rim and pointer remain
   fixed in the safe-body PNG, so its reflections stay anchored to the room. */
.safe-cracker-game.sc-reference-visuals .sc-dial-wrap {
  position: absolute !important;
  left: 23.73% !important;
  top: 28.16% !important;
  z-index: 22 !important;
  width: 52.55% !important;
  height: 40.46% !important;
  max-width: none !important;
  max-height: none !important;
  margin: 0 !important;
  overflow: visible !important;
  filter: none !important;
}

.safe-cracker-game.sc-reference-visuals .sc-dial-wrap::before,
.safe-cracker-game.sc-reference-visuals .sc-dial-wrap::after {
  display: none !important;
  content: none !important;
}

.safe-cracker-game.sc-reference-visuals .sc-dial {
  position: absolute !important;
  inset: 0 !important;
  z-index: 5 !important;
  width: 100% !important;
  height: 100% !important;
  overflow: visible !important;
  border: 0 !important;
  border-radius: 50% !important;
  filter: none !important;
  box-shadow: none !important;
  touch-action: none !important;
  user-select: none !important;
}

/* A restrained screen-fixed crescent adds life without covering the artwork. */
.safe-cracker-game.sc-reference-visuals .sc-dial::before {
  content: '' !important;
  position: absolute !important;
  inset: 1.5% !important;
  z-index: 9 !important;
  display: block !important;
  border-radius: 50% !important;
  background:
    radial-gradient(ellipse 38% 13% at 35% 8%, rgba(255,255,255,.22), rgba(255,235,186,.055) 43%, transparent 76%),
    radial-gradient(ellipse 12% 31% at 8% 39%, rgba(255,255,255,.07), transparent 72%) !important;
  mix-blend-mode: screen !important;
  opacity: .68 !important;
  pointer-events: none !important;
  transform: none !important;
  clip-path: none !important;
}

.safe-cracker-game.sc-reference-visuals .sc-dial::after,
.safe-cracker-game.sc-reference-visuals .sc-dial-pointer {
  display: none !important;
  content: none !important;
}

.safe-cracker-game.sc-reference-visuals .sc-dial-face {
  position: absolute !important;
  inset: 0 !important;
  width: 100% !important;
  height: 100% !important;
  border: 0 !important;
  border-radius: 50% !important;
  background-color: transparent !important;
  background-image: url('/assets/safe-cracker/png-ui/dial-face.png?v=2') !important;
  background-position: center !important;
  background-repeat: no-repeat !important;
  background-size: 100% 100% !important;
  box-shadow: none !important;
  transform-origin: 50% 50% !important;
  will-change: transform;
}

.safe-cracker-game.sc-reference-visuals .sc-dial-number,
.safe-cracker-game.sc-reference-visuals .sc-dial-hub {
  display: none !important;
}

.safe-cracker-game.sc-reference-visuals .sc-current-number {
  left: 50% !important;
  top: 50% !important;
  z-index: 14 !important;
  width: 36.3% !important;
  height: 36.3% !important;
  border: 0 !important;
  border-radius: 50% !important;
  color: #ffe6a0 !important;
  background:
    radial-gradient(ellipse at 38% 23%, rgba(255,239,197,.12), transparent 30%),
    radial-gradient(circle, #120d04 0%, #040404 69%, #000 100%) !important;
  box-shadow:
    inset 0 0 22px rgba(255,170,25,.09),
    inset 5px 4px 8px rgba(255,255,255,.022),
    0 0 16px rgba(255,174,31,.08) !important;
  font: 900 clamp(2rem, 9vw, 4.6rem)/1 ui-monospace, SFMono-Regular, Menlo, monospace !important;
  text-shadow: 0 3px 3px #000, 0 0 12px rgba(255, 187, 53, .62) !important;
  pointer-events: none !important;
}

/* Real controls occupy the transparent interiors of the photographed frames. */
.safe-cracker-game.sc-reference-visuals .sc-step-controls {
  position: absolute !important;
  left: 31.25% !important;
  top: 73.44% !important;
  z-index: 30 !important;
  width: 37.5% !important;
  height: 6.35% !important;
  margin: 0 !important;
  padding: 0 !important;
  display: grid !important;
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  gap: 12% !important;
  align-items: stretch !important;
}

.safe-cracker-game.sc-reference-visuals .sc-step-controls button {
  position: relative !important;
  z-index: 31 !important;
  width: 100% !important;
  height: 100% !important;
  min-width: 0 !important;
  padding: 0 0 4% !important;
  display: grid !important;
  place-items: center !important;
  overflow: hidden !important;
  border: 0 !important;
  border-radius: 9% !important;
  color: #f3c86e !important;
  background:
    radial-gradient(ellipse at 38% 0, rgba(255,245,211,.11), transparent 44%),
    linear-gradient(180deg, rgba(49,48,43,.98), rgba(8,9,9,.99)) !important;
  box-shadow:
    inset 0 2px 0 rgba(255,239,196,.12),
    inset 0 -10px 17px rgba(0,0,0,.54) !important;
  font: 900 clamp(1.2rem, 6vw, 2.3rem)/1 Arial, sans-serif !important;
  text-shadow: 0 2px 2px #000, 0 0 6px rgba(255,187,53,.14) !important;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation !important;
}

.safe-cracker-game.sc-reference-visuals .sc-step-controls button:not(:disabled):active {
  transform: translateY(2px) scale(.985) !important;
  filter: brightness(.9) !important;
  box-shadow: inset 0 1px 0 rgba(255,239,196,.08), inset 0 -7px 12px rgba(0,0,0,.58) !important;
}

.safe-cracker-game.sc-reference-visuals .sc-confirm-button {
  position: absolute !important;
  left: 20.6% !important;
  top: 86.81% !important;
  z-index: 30 !important;
  width: 58.8% !important;
  height: 7.4% !important;
  min-height: 0 !important;
  margin: 0 !important;
  padding: 0 4% !important;
  display: grid !important;
  place-items: center !important;
  overflow: hidden !important;
  border: 0 !important;
  border-radius: 7% !important;
  color: #f5d38c !important;
  background:
    radial-gradient(ellipse at 43% 0, rgba(255,239,196,.13), transparent 42%),
    linear-gradient(180deg, rgba(55,50,41,.99), rgba(8,9,9,.99)) !important;
  box-shadow:
    inset 0 2px 0 rgba(255,245,216,.13),
    inset 0 -14px 21px rgba(0,0,0,.61) !important;
  font: 900 clamp(.8rem, 4.2vw, 1.4rem)/1 Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif !important;
  letter-spacing: .07em !important;
  text-shadow: 0 2px 2px #000, 0 0 7px rgba(255,187,53,.16) !important;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation !important;
}

.safe-cracker-game.sc-reference-visuals .sc-confirm-button::before,
.safe-cracker-game.sc-reference-visuals .sc-confirm-button::after {
  display: none !important;
  content: none !important;
}

.safe-cracker-game.sc-reference-visuals .sc-confirm-button span {
  position: relative !important;
  z-index: 1 !important;
}

.safe-cracker-game.sc-reference-visuals .sc-confirm-button:not(:disabled):active {
  transform: translateY(2px) scale(.992) !important;
  filter: brightness(.91) !important;
  box-shadow: inset 0 1px 0 rgba(255,245,216,.08), inset 0 -10px 16px rgba(0,0,0,.65) !important;
}

.safe-cracker-game.sc-reference-visuals .sc-confirm-button:disabled {
  opacity: 1 !important;
  color: rgba(229,207,158,.48) !important;
  filter: saturate(.55) brightness(.74) !important;
}

@media (max-width: 430px) {
  .safe-cracker-game.sc-reference-visuals .sc-display-status {
    font-size: clamp(.82rem, 5.1vw, 1.25rem) !important;
  }
  .safe-cracker-game.sc-reference-visuals .sc-display-meta {
    margin-top: 3px !important;
  }
  .safe-cracker-game.sc-reference-visuals .sc-display-meta small,
  .safe-cracker-game.sc-reference-visuals .sc-display-meta b {
    font-size: clamp(.36rem, 1.85vw, .51rem) !important;
  }
  .safe-cracker-game.sc-reference-visuals .sc-current-number {
    font-size: clamp(1.75rem, 10vw, 3.2rem) !important;
  }
  .safe-cracker-game.sc-reference-visuals .sc-confirm-button {
    font-size: clamp(.68rem, 4.35vw, .98rem) !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  .safe-cracker-game.sc-reference-visuals .sc-dial-face,
  .safe-cracker-game.sc-reference-visuals .sc-step-controls button,
  .safe-cracker-game.sc-reference-visuals .sc-confirm-button {
    transition-duration: .001ms !important;
  }
}
${cssEnd}`;

const markerPattern = /\/\* SAFE_CRACKER_PNG_HYBRID_V15_START \*\/[\s\S]*?\/\* SAFE_CRACKER_PNG_HYBRID_V15_END \*\/\s*/m;
css = css.replace(markerPattern, '').trimEnd() + `\n\n${hybridCss}\n`;
await writeFile(cssUrl, css);

let html = await readFile(indexUrl, 'utf8');
html = html.replaceAll('&depth=1&png=1', '&depth=1');
html = html.replaceAll('&depth=1', '&depth=1&png=1');
if (!html.includes('&reference=1&depth=1&png=1')) {
  throw new Error('Safe Cracker PNG hybrid could not version the supplied reference assets.');
}
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker PNG hybrid v15: supplied static safe body, independently rotating numbered plate, fixed photographed pointer and reflections, and live aligned controls.');
