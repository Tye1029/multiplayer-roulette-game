import { readFile, writeFile } from 'node:fs/promises';

const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const start = '/* SAFE_CRACKER_PNG_COMPLETENESS_V16_START */';
const end = '/* SAFE_CRACKER_PNG_COMPLETENESS_V16_END */';

let css = await readFile(cssUrl, 'utf8');
if (!css.includes('/* SAFE_CRACKER_PNG_HYBRID_V15_START */')) {
  throw new Error('Safe Cracker PNG completeness requires PNG hybrid v15 first.');
}

const patch = String.raw`${start}
/* The complete supplied body now owns every static surface: outer frame,
   hinges, gold trim, pointer, lower apron, button bezels and reflections. */
.safe-cracker-game.sc-reference-visuals .sc-safe-shell {
  position: relative !important;
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
  z-index: 2 !important;
  width: 100% !important;
  height: auto !important;
  min-height: 0 !important;
  aspect-ratio: 432 / 561 !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
  border: 0 !important;
  border-radius: 0 !important;
  outline: 0 !important;
  background-color: transparent !important;
  background-image: url('/assets/safe-cracker/png-ui/safe-body.png?v=4') !important;
  background-position: center !important;
  background-repeat: no-repeat !important;
  background-size: 100% 100% !important;
  box-shadow: 0 22px 40px rgba(0, 0, 0, .64) !important;
  isolation: isolate !important;
}

/* No generated steel is allowed to cover the photographed lower frame. */
.safe-cracker-game.sc-reference-visuals .sc-safe-door::before,
.safe-cracker-game.sc-reference-visuals .sc-safe-door::after,
.safe-cracker-game.sc-reference-visuals .sc-bolts,
.safe-cracker-game.sc-reference-visuals .sc-safe-handle {
  display: none !important;
  content: none !important;
  background: none !important;
  border: 0 !important;
  box-shadow: none !important;
}

/* Fully reset the inherited trapezoid and fit the live display into the
   transparent 226x61 opening in the supplied body. */
.safe-cracker-game.sc-reference-visuals .sc-display,
.safe-cracker-game.sc-reference-visuals .sc-display.red,
.safe-cracker-game.sc-reference-visuals .sc-display.orange,
.safe-cracker-game.sc-reference-visuals .sc-display.yellow,
.safe-cracker-game.sc-reference-visuals .sc-display.green,
.safe-cracker-game.sc-reference-visuals .sc-display-glass,
.safe-cracker-game.sc-reference-visuals .sc-display-bezel {
  clip-path: none !important;
  -webkit-clip-path: none !important;
  mask: none !important;
  -webkit-mask: none !important;
  transform: none !important;
  filter: none !important;
}

.safe-cracker-game.sc-reference-visuals .sc-display,
.safe-cracker-game.sc-reference-visuals .sc-display.red,
.safe-cracker-game.sc-reference-visuals .sc-display.orange,
.safe-cracker-game.sc-reference-visuals .sc-display.yellow,
.safe-cracker-game.sc-reference-visuals .sc-display.green {
  left: 23.843% !important;
  top: 9.269% !important;
  width: 52.315% !important;
  height: 10.873% !important;
  padding: 2% 3.2% !important;
  overflow: hidden !important;
  border: 0 !important;
  border-radius: 2.8% !important;
  outline: 0 !important;
  background:
    radial-gradient(ellipse at 50% -12%, rgba(255, 218, 143, .06), transparent 50%),
    linear-gradient(180deg, rgba(18, 20, 20, .99), rgba(2, 3, 3, .995)) !important;
  box-shadow: inset 0 1px 0 rgba(255, 240, 207, .045), inset 0 -14px 22px rgba(0, 0, 0, .58) !important;
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

/* The complete 226px numbered dial rotates inside the exact circular cutout. */
.safe-cracker-game.sc-reference-visuals .sc-dial-wrap {
  left: 24.306% !important;
  top: 28.520% !important;
  width: 51.620% !important;
  height: 39.750% !important;
}

.safe-cracker-game.sc-reference-visuals .sc-dial-face {
  background-color: transparent !important;
  background-image: url('/assets/safe-cracker/png-ui/dial-face.png?v=4') !important;
  background-position: center !important;
  background-repeat: no-repeat !important;
  background-size: 100% 100% !important;
}

/* Fit the real controls inside the two transparent 65x32 button openings. */
.safe-cracker-game.sc-reference-visuals .sc-step-controls {
  left: 31.713% !important;
  top: 73.797% !important;
  width: 36.574% !important;
  height: 5.704% !important;
  gap: 18.354% !important;
}

.safe-cracker-game.sc-reference-visuals .sc-step-controls button {
  border: 0 !important;
  border-radius: 8% !important;
  color: #f4c76b !important;
  background:
    radial-gradient(ellipse at 42% 0%, rgba(255, 238, 192, .09), transparent 48%),
    linear-gradient(180deg, rgba(45, 43, 37, .98), rgba(5, 6, 6, .99)) !important;
  box-shadow: inset 0 1px 0 rgba(255, 239, 199, .1), inset 0 -9px 14px rgba(0, 0, 0, .6) !important;
  font-size: clamp(1.05rem, 5.2vw, 2rem) !important;
}

/* Fit Check Number inside the photographed 251x37 lower opening. */
.safe-cracker-game.sc-reference-visuals .sc-confirm-button {
  left: 21.065% !important;
  top: 87.344% !important;
  width: 58.102% !important;
  height: 6.595% !important;
  z-index: 31 !important;
  padding: 0 3% !important;
  border: 0 !important;
  border-radius: 4% !important;
  color: #f4ce7d !important;
  background:
    radial-gradient(ellipse at 48% 0%, rgba(255, 232, 179, .1), transparent 50%),
    linear-gradient(180deg, rgba(47, 43, 34, .99), rgba(6, 7, 7, .995)) !important;
  box-shadow: inset 0 1px 0 rgba(255, 240, 204, .11), inset 0 -12px 18px rgba(0, 0, 0, .64) !important;
  font-size: clamp(.78rem, 3.9vw, 1.35rem) !important;
  letter-spacing: .075em !important;
}

.safe-cracker-game.sc-reference-visuals .sc-confirm-button::before,
.safe-cracker-game.sc-reference-visuals .sc-confirm-button::after {
  display: none !important;
  content: none !important;
}

/* Restore the warm result hierarchy that was flattened by the prior override. */
body > .sc-result-overlay[data-sc-result-portal] .sc-result-title {
  color: #f2c86e !important;
  text-shadow: 0 2px 3px #000, 0 0 14px rgba(244, 181, 57, .34) !important;
}
body > .sc-result-overlay[data-sc-result-portal] .sc-result-code-card {
  border-color: rgba(202, 145, 52, .42) !important;
  background: linear-gradient(180deg, rgba(35, 33, 28, .96), rgba(5, 6, 6, .98)) !important;
  box-shadow: inset 0 1px 0 rgba(255, 238, 197, .08), 0 8px 20px rgba(0, 0, 0, .42) !important;
}
body > .sc-result-overlay[data-sc-result-portal] .sc-result-code-card small,
body > .sc-result-overlay[data-sc-result-portal] .sc-result-summary {
  color: rgba(232, 220, 194, .72) !important;
}
body > .sc-result-overlay[data-sc-result-portal] .sc-result-code-card b {
  color: #f5d27e !important;
  text-shadow: 0 0 10px rgba(244, 181, 57, .24) !important;
}

@media (max-width: 560px) {
  .safe-cracker-game.sc-reference-visuals .sc-safe-shell {
    width: 100% !important;
  }
}
${end}`;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
const blockPattern = new RegExp(`${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}\\n?`, 'g');
css = css.replace(blockPattern, '').trimEnd() + '\n\n' + patch + '\n';
await writeFile(cssUrl, css);

let index = await readFile(indexUrl, 'utf8');
index = index.replace(/&png=1(?:&complete=\d+)?/g, '&png=1&complete=2');
await writeFile(indexUrl, index);

console.log('Applied Safe Cracker PNG completeness v16: mounted the full supplied body and 226px dial, exposed every static frame and reflection, removed trapezoid clipping, aligned all controls, and restored warm result colors.');
