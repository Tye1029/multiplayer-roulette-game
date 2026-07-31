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
/* The reference artwork supplies the static metal, hinges, trim, scratches,
   shadows, and photographed reflections. Live controls remain real DOM. */
.safe-cracker-game.sc-reference-visuals .sc-safe-shell {
  position: relative;
  display: block;
  width: calc(100% - 8px);
  max-width: 620px;
  margin: 0 4px;
  padding: 0;
  overflow: visible;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.safe-cracker-game.sc-reference-visuals .sc-safe-shell::before,
.safe-cracker-game.sc-reference-visuals .sc-safe-shell::after {
  display: none !important;
  content: none !important;
}

.safe-cracker-game.sc-reference-visuals .sc-safe-door {
  position: relative;
  width: 100%;
  height: auto;
  min-height: 0;
  aspect-ratio: 450 / 606;
  margin: 0;
  overflow: hidden;
  border: 0;
  border-radius: 0;
  outline: 0;
  background-color: #050606;
  background-image: url('/assets/safe-cracker/png-ui/safe-body.png');
  background-position: center top;
  background-repeat: no-repeat;
  background-size: 100% 100%;
  box-shadow: 0 20px 34px rgba(0, 0, 0, .62);
  isolation: isolate;
}

.safe-cracker-game.sc-reference-visuals .sc-safe-door::before,
.safe-cracker-game.sc-reference-visuals .sc-safe-door::after,
.safe-cracker-game.sc-reference-visuals .sc-bolts,
.safe-cracker-game.sc-reference-visuals .sc-safe-handle {
  display: none !important;
  content: none !important;
}

/* Dynamic feedback is fitted into the empty photographed display window. */
.safe-cracker-game.sc-reference-visuals .sc-display,
.safe-cracker-game.sc-reference-visuals .sc-display.red,
.safe-cracker-game.sc-reference-visuals .sc-display.orange,
.safe-cracker-game.sc-reference-visuals .sc-display.yellow,
.safe-cracker-game.sc-reference-visuals .sc-display.green {
  position: absolute;
  left: 19.4%;
  top: 7.45%;
  z-index: 20;
  width: 61.2%;
  height: 14.45%;
  min-height: 0;
  margin: 0;
  padding: 7% 6% 4%;
  overflow: hidden;
  border: 0;
  border-radius: 0;
  color: #efc974;
  background: transparent;
  box-shadow: none;
  transform: none;
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
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  align-items: center;
  border: 0;
  background: transparent;
  box-shadow: none;
}

.safe-cracker-game.sc-reference-visuals .sc-display-status {
  align-self: end;
  color: #f1cc79;
  font: 900 clamp(.84rem, 4.3vw, 1.7rem)/.92 Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif;
  letter-spacing: .055em;
  text-align: center;
  text-shadow: 0 2px 2px #000, 0 0 8px rgba(255, 188, 60, .24);
}

.safe-cracker-game.sc-reference-visuals .sc-display-meta {
  align-self: start;
  margin-top: clamp(3px, .8vw, 7px);
  display: flex;
  justify-content: space-between;
  gap: 7px;
  color: rgba(224, 214, 194, .62);
}

.safe-cracker-game.sc-reference-visuals .sc-display-meta small,
.safe-cracker-game.sc-reference-visuals .sc-display-meta b {
  color: inherit;
  font-size: clamp(.42rem, 1.75vw, .66rem);
  line-height: 1;
  letter-spacing: .05em;
  white-space: nowrap;
}

/* Rim/pointer and hub stay fixed while only the number plate rotates. */
.safe-cracker-game.sc-reference-visuals .sc-dial-wrap {
  position: absolute;
  left: 13.33%;
  top: 20.46%;
  z-index: 12;
  width: 72.22%;
  height: auto;
  max-width: none;
  max-height: none;
  aspect-ratio: 325 / 328;
  margin: 0;
  overflow: visible;
  filter: none;
}

.safe-cracker-game.sc-reference-visuals .sc-dial-wrap::before,
.safe-cracker-game.sc-reference-visuals .sc-dial-wrap::after {
  content: '';
  position: absolute;
  pointer-events: none;
  transform: none;
  clip-path: none;
}

.safe-cracker-game.sc-reference-visuals .sc-dial-wrap::before {
  inset: 0;
  z-index: 8;
  background: url('/assets/safe-cracker/png-ui/dial-rim-pointer.png') center / 100% 100% no-repeat;
  filter: drop-shadow(0 12px 14px rgba(0, 0, 0, .5));
}

.safe-cracker-game.sc-reference-visuals .sc-dial-wrap::after {
  left: 29.23%;
  top: 29.27%;
  z-index: 10;
  width: 41.54%;
  aspect-ratio: 1;
  border-radius: 50%;
  background: url('/assets/safe-cracker/png-ui/dial-hub.png') center / 100% 100% no-repeat;
}

.safe-cracker-game.sc-reference-visuals .sc-dial {
  position: absolute;
  left: 11.69%;
  top: 12.2%;
  z-index: 5;
  width: 76.92%;
  height: 76.22%;
  inset: auto;
  border: 0;
  border-radius: 50%;
  filter: none;
  box-shadow: none;
  touch-action: none;
  user-select: none;
}

.safe-cracker-game.sc-reference-visuals .sc-dial::before,
.safe-cracker-game.sc-reference-visuals .sc-dial::after,
.safe-cracker-game.sc-reference-visuals .sc-dial-pointer {
  display: none !important;
  content: none !important;
}

.safe-cracker-game.sc-reference-visuals .sc-dial-face {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
  border-radius: 50%;
  background: url('/assets/safe-cracker/png-ui/dial-face.png') center / 100% 100% no-repeat;
  box-shadow: none;
  transform-origin: 50% 50%;
  will-change: transform;
}

.safe-cracker-game.sc-reference-visuals .sc-dial-number,
.safe-cracker-game.sc-reference-visuals .sc-dial-hub {
  display: none !important;
}

.safe-cracker-game.sc-reference-visuals .sc-current-number {
  left: 50%;
  top: 50%;
  z-index: 14;
  width: 30%;
  height: 30%;
  border: 0;
  border-radius: 50%;
  color: #ffe6a0;
  background: transparent;
  box-shadow: none;
  font-size: clamp(2rem, 12vw, 4.15rem);
  text-shadow: 0 3px 3px #000, 0 0 12px rgba(255, 187, 53, .62);
}

/* The real buttons sit exactly over the blank photographed button wells. */
.safe-cracker-game.sc-reference-visuals .sc-step-controls {
  position: absolute;
  left: 26%;
  top: 71.12%;
  z-index: 30;
  width: 49.33%;
  height: 12.38%;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.82%;
  align-items: stretch;
}

.safe-cracker-game.sc-reference-visuals .sc-step-controls button {
  position: relative;
  z-index: 31;
  width: 100%;
  height: 100%;
  min-width: 0;
  padding: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  border: 0;
  border-radius: 0;
  color: transparent;
  background-color: transparent;
  background-position: center;
  background-repeat: no-repeat;
  background-size: 100% 100%;
  box-shadow: none;
  font-size: 0;
  line-height: 0;
  text-shadow: none;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

.safe-cracker-game.sc-reference-visuals .sc-step-controls button:first-child {
  background-image: url('/assets/safe-cracker/png-ui/button-minus.png');
}
.safe-cracker-game.sc-reference-visuals .sc-step-controls button:last-child {
  background-image: url('/assets/safe-cracker/png-ui/button-plus.png');
}
.safe-cracker-game.sc-reference-visuals .sc-step-controls button:not(:disabled):active {
  transform: translateY(2px) scale(.985);
  filter: brightness(.9);
  box-shadow: none;
}

.safe-cracker-game.sc-reference-visuals .sc-confirm-button {
  position: absolute;
  left: 12.67%;
  top: 82.84%;
  z-index: 30;
  width: 76%;
  height: 15.35%;
  min-height: 0;
  margin: 0;
  padding: 5% 9% 7%;
  display: grid;
  place-items: center;
  overflow: visible;
  border: 0;
  border-radius: 0;
  color: #f5d38c;
  background: transparent url('/assets/safe-cracker/png-ui/button-check-frame.png') center / 100% 100% no-repeat;
  box-shadow: none;
  font: 900 clamp(.85rem, 4.3vw, 1.45rem)/1 Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif;
  letter-spacing: .075em;
  text-shadow: 0 2px 2px #000, 0 0 7px rgba(255, 187, 53, .2);
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

.safe-cracker-game.sc-reference-visuals .sc-confirm-button::before,
.safe-cracker-game.sc-reference-visuals .sc-confirm-button::after {
  display: none !important;
  content: none !important;
}

.safe-cracker-game.sc-reference-visuals .sc-confirm-button span {
  position: relative;
  z-index: 1;
  transform: translateY(-2%);
}

.safe-cracker-game.sc-reference-visuals .sc-confirm-button:not(:disabled):active {
  transform: translateY(2px) scale(.992);
  filter: brightness(.91);
  box-shadow: none;
}
.safe-cracker-game.sc-reference-visuals .sc-confirm-button:disabled {
  opacity: .78;
  filter: saturate(.55) brightness(.72);
}

@media (max-width: 700px) {
  .safe-cracker-game.sc-reference-visuals .sc-safe-shell {
    width: calc(100% - 4px);
    margin-inline: 2px;
  }
  .safe-cracker-game.sc-reference-visuals .sc-display {
    padding-top: 6%;
  }
  .safe-cracker-game.sc-reference-visuals .sc-display-status {
    font-size: clamp(.78rem, 5.6vw, 1.35rem);
  }
  .safe-cracker-game.sc-reference-visuals .sc-current-number {
    font-size: clamp(1.9rem, 13vw, 3.45rem);
  }
  .safe-cracker-game.sc-reference-visuals .sc-confirm-button {
    font-size: clamp(.78rem, 5vw, 1.18rem);
  }
}

@media (max-width: 380px) {
  .safe-cracker-game.sc-reference-visuals .sc-display-meta {
    gap: 3px;
  }
  .safe-cracker-game.sc-reference-visuals .sc-display-meta small,
  .safe-cracker-game.sc-reference-visuals .sc-display-meta b {
    font-size: clamp(.35rem, 1.65vw, .5rem);
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
  throw new Error('Safe Cracker PNG hybrid could not version the reference assets.');
}
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker PNG hybrid v15: photographed static safe, independently rotating dial plate, fixed rim and hub, and live aligned controls.');
