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
/* Restore the complete physical safe composition around the supplied PNG while
   preserving only the dial plate and controls as independently moving layers. */
.safe-cracker-game.sc-reference-visuals .sc-safe-shell {
  width: min(100%, 650px) !important;
  padding: clamp(8px, 1.8vw, 14px) !important;
  border: 1px solid rgba(196, 141, 49, .28) !important;
  border-radius: clamp(18px, 3vw, 28px) !important;
  background:
    linear-gradient(110deg, rgba(255, 225, 157, .055), transparent 24% 76%, rgba(153, 87, 18, .045)),
    linear-gradient(180deg, #111617 0%, #050708 48%, #020304 100%) !important;
  box-shadow:
    inset 0 1px 0 rgba(255, 239, 196, .08),
    inset 0 0 0 5px rgba(0, 0, 0, .62),
    0 22px 48px rgba(0, 0, 0, .62) !important;
}

.safe-cracker-game.sc-reference-visuals .sc-safe-shell::before,
.safe-cracker-game.sc-reference-visuals .sc-safe-shell::after {
  content: '' !important;
  display: block !important;
  position: absolute !important;
  z-index: 1 !important;
  pointer-events: none !important;
}

.safe-cracker-game.sc-reference-visuals .sc-safe-shell::before {
  inset: 5px !important;
  border-radius: inherit !important;
  border: 1px solid rgba(225, 171, 72, .34) !important;
  box-shadow: inset 0 0 20px rgba(255, 190, 72, .035) !important;
}

.safe-cracker-game.sc-reference-visuals .sc-safe-shell::after {
  left: 9% !important;
  right: 9% !important;
  top: 1.1% !important;
  height: 9% !important;
  border-radius: 50% !important;
  background: radial-gradient(ellipse at center, rgba(255, 218, 139, .11), transparent 68%) !important;
  filter: blur(12px) !important;
  opacity: .7 !important;
}

.safe-cracker-game.sc-reference-visuals .sc-safe-door {
  z-index: 2 !important;
  overflow: visible !important;
  border-radius: clamp(9px, 1.8vw, 16px) !important;
  background-color: #060707 !important;
  box-shadow:
    inset 0 0 0 1px rgba(233, 181, 80, .16),
    inset 0 -28px 40px rgba(0, 0, 0, .5),
    0 15px 28px rgba(0, 0, 0, .52) !important;
}

/* Remove every inherited trapezoid/legacy clipping rule from the live display. */
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
}

.safe-cracker-game.sc-reference-visuals .sc-display {
  border-radius: 4.5% !important;
  outline: 1px solid rgba(224, 170, 69, .2) !important;
  outline-offset: -1px !important;
  background:
    radial-gradient(ellipse at 50% -10%, rgba(255, 215, 130, .07), transparent 48%),
    linear-gradient(180deg, rgba(21, 23, 22, .99), rgba(3, 4, 4, .995)) !important;
}

/* Complete the missing lower apron and physical confirmation frame. */
.safe-cracker-game.sc-reference-visuals .sc-safe-door::after {
  content: '' !important;
  display: block !important;
  position: absolute !important;
  left: 7.2% !important;
  right: 7.2% !important;
  top: 81.8% !important;
  bottom: 2.2% !important;
  z-index: 18 !important;
  border: 2px solid rgba(190, 132, 42, .54) !important;
  border-radius: 5.5% !important;
  background:
    linear-gradient(108deg, rgba(255, 238, 196, .08), transparent 23% 76%, rgba(106, 57, 8, .08)),
    linear-gradient(180deg, #262521 0%, #0b0c0c 34%, #030404 100%) !important;
  box-shadow:
    inset 0 1px 0 rgba(255, 238, 195, .17),
    inset 0 0 0 5px rgba(0, 0, 0, .48),
    inset 0 -18px 24px rgba(0, 0, 0, .7),
    0 8px 12px rgba(0, 0, 0, .38) !important;
  pointer-events: none !important;
}

.safe-cracker-game.sc-reference-visuals .sc-confirm-button {
  left: 15.5% !important;
  top: 85.25% !important;
  width: 69% !important;
  height: 9.25% !important;
  z-index: 31 !important;
  border: 1px solid rgba(220, 166, 66, .55) !important;
  border-radius: 8% !important;
  background:
    radial-gradient(ellipse at 50% 0%, rgba(255, 230, 171, .15), transparent 52%),
    linear-gradient(180deg, #3a352a 0%, #15130f 35%, #050606 100%) !important;
  box-shadow:
    inset 0 2px 0 rgba(255, 241, 207, .18),
    inset 0 0 0 4px rgba(0, 0, 0, .5),
    inset 0 -15px 20px rgba(0, 0, 0, .65),
    0 5px 8px rgba(0, 0, 0, .4) !important;
  color: #f5d58c !important;
  font-size: clamp(.88rem, 4.4vw, 1.5rem) !important;
}

.safe-cracker-game.sc-reference-visuals .sc-confirm-button::before,
.safe-cracker-game.sc-reference-visuals .sc-confirm-button::after {
  content: '' !important;
  display: block !important;
  position: absolute !important;
  pointer-events: none !important;
}

.safe-cracker-game.sc-reference-visuals .sc-confirm-button::before {
  inset: 7% 3.5% !important;
  border: 1px solid rgba(235, 190, 94, .22) !important;
  border-radius: inherit !important;
}

.safe-cracker-game.sc-reference-visuals .sc-confirm-button::after {
  left: 10% !important;
  right: 10% !important;
  bottom: -13% !important;
  height: 10% !important;
  border-radius: 50% !important;
  background: radial-gradient(ellipse, rgba(255, 181, 53, .45), transparent 70%) !important;
  filter: blur(3px) !important;
}

/* Rebuild the missing depth around the two small controls without changing hit areas. */
.safe-cracker-game.sc-reference-visuals .sc-step-controls {
  left: 29.2% !important;
  top: 72.15% !important;
  width: 41.6% !important;
  height: 8.25% !important;
  gap: 13% !important;
}

.safe-cracker-game.sc-reference-visuals .sc-step-controls button {
  border: 1px solid rgba(211, 151, 55, .5) !important;
  border-radius: 14% !important;
  box-shadow:
    inset 0 2px 0 rgba(255, 241, 209, .16),
    inset 0 0 0 4px rgba(0, 0, 0, .44),
    inset 0 -12px 17px rgba(0, 0, 0, .62),
    0 5px 9px rgba(0, 0, 0, .42) !important;
}

/* Replace the empty black gap below the source PNG with continuous safe steel. */
.safe-cracker-game.sc-reference-visuals .sc-safe-door {
  background-image:
    url('/assets/safe-cracker/png-ui/safe-body.png?v=3'),
    linear-gradient(180deg, transparent 0 77%, #090a0a 77% 100%) !important;
}

@media (max-width: 560px) {
  .safe-cracker-game.sc-reference-visuals .sc-safe-shell {
    width: calc(100% - 2px) !important;
    padding: 7px !important;
    border-radius: 17px !important;
  }
  .safe-cracker-game.sc-reference-visuals .sc-safe-door {
    border-radius: 9px !important;
  }
}
${end}`;

const escapedStart = start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const escapedEnd = end.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const blockPattern = new RegExp(`${escapedStart}[\\s\\S]*?${escapedEnd}\\n?`, 'g');
css = css.replace(blockPattern, '').trimEnd() + '\n\n' + patch + '\n';
await writeFile(cssUrl, css);

let index = await readFile(indexUrl, 'utf8');
index = index.replaceAll('&png=1', '&png=1&complete=1');
index = index.replaceAll('&png=1&complete=1&complete=1', '&png=1&complete=1');
await writeFile(indexUrl, index);

console.log('Applied Safe Cracker PNG completeness v16: restored lower frame, confirmation plate, control depth, full safe shell, and removed inherited trapezoid clipping.');
