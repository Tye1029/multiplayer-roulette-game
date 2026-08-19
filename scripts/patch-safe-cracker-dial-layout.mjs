import { readFile, writeFile } from 'node:fs/promises';

const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);

const start = '/* SAFE_CRACKER_DIAL_LAYOUT_V2_START */';
const end = '/* SAFE_CRACKER_DIAL_LAYOUT_V2_END */';
const assetPath = '/assets/safe-cracker/textures/dial-reference-face-v7.svg?dial=7&layout=3';
const plateMarkup = `<img class="sc-dial-reference-plate" src="${assetPath}" alt="" aria-hidden="true" draggable="false">`;

const layout = String.raw`${start}
.safe-cracker-game .sc-display {
  margin-bottom: 18px;
}

.safe-cracker-game .sc-dial-wrap {
  margin: 10px auto 0;
  transform: translateY(1px);
  filter:
    drop-shadow(0 3px 2px rgba(255,255,255,.02))
    drop-shadow(0 11px 6px rgba(0,0,0,.66))
    drop-shadow(0 24px 20px rgba(0,0,0,.72));
}

.safe-cracker-game .sc-dial-wrap::before {
  inset: -32px;
  box-shadow:
    inset 0 0 0 8px #010203,
    inset 0 15px 19px rgba(255,255,255,.022),
    inset 0 -34px 39px rgba(0,0,0,.86),
    0 0 0 4px rgba(3,5,6,.94),
    0 9px 0 #010202,
    0 24px 29px rgba(0,0,0,.62);
}

.safe-cracker-game .sc-dial-wrap::after {
  top: -52px;
  width: 64px;
  height: 29px;
  border-width: 2px;
  border-radius: 5px 5px 2px 2px;
  box-shadow:
    inset 0 2px 0 rgba(255,255,255,.22),
    inset 0 -6px 8px rgba(0,0,0,.65),
    0 4px 0 #010203,
    0 8px 10px rgba(0,0,0,.62);
}

.safe-cracker-game .sc-dial-pointer {
  top: -44px;
  width: 24px;
  height: 50px;
  clip-path: polygon(14% 0, 86% 0, 50% 100%);
  background:
    linear-gradient(90deg,
      #5a3408 0%,
      #b87720 21%,
      #f7d77f 47%,
      #d3912f 69%,
      #583106 100%);
  box-shadow:
    inset 1px 1px 0 rgba(255,249,224,.48),
    inset -2px -4px 3px rgba(59,25,2,.54),
    0 3px 0 #120a02,
    0 7px 9px rgba(0,0,0,.58);
  filter: drop-shadow(0 2px 1px rgba(0,0,0,.78));
}

.safe-cracker-game .sc-dial {
  inset: -5px;
  transform: translateY(0) scale(1.018);
  filter:
    drop-shadow(0 2px 1px rgba(255,255,255,.02))
    drop-shadow(0 9px 5px rgba(0,0,0,.67))
    drop-shadow(0 20px 17px rgba(0,0,0,.74));
}

.safe-cracker-game .sc-dial.dragging {
  transform: translateY(2px) scale(1.009);
  filter:
    drop-shadow(0 6px 3px rgba(0,0,0,.63))
    drop-shadow(0 13px 11px rgba(0,0,0,.69));
}

.safe-cracker-game .sc-dial-number {
  --radius: 96px;
  width: 32px;
  height: 32px;
  margin: -16px;
  font-size: 1.28rem;
  letter-spacing: -.03em;
}

.safe-cracker-game .sc-dial-number > span {
  width: 32px;
  height: 32px;
  transform: scaleX(.9);
}

.safe-cracker-game .sc-dial-number.selected > span {
  transform: scaleX(.9) scale(1.04);
}

.safe-cracker-game .sc-dial-hub {
  width: 34%;
}

.safe-cracker-game .sc-current-number {
  width: 74px;
  height: 74px;
  font-size: 2.55rem;
}

.safe-cracker-game .sc-step-controls {
  margin-bottom: 6px;
}

.safe-cracker-game .sc-step-controls button {
  position: relative;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0;
  line-height: 1;
}

.safe-cracker-game .sc-step-controls button::before {
  content: '+';
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font: 700 2.05rem/1 Arial, Helvetica, sans-serif;
  text-align: center;
  transform: none;
}

.safe-cracker-game .sc-step-controls button[data-sc-step='-1']::before {
  content: '−';
}

.safe-cracker-game .sc-confirm-button {
  position: relative;
  z-index: 3;
  width: min(76%, 300px);
  min-height: 56px;
  margin: 14px auto 20px;
  border: 3px solid #6f4b1e;
  border-radius: 10px;
  color: #fff6d9;
  background:
    linear-gradient(180deg, rgba(255,255,255,.3), transparent 31%),
    linear-gradient(180deg, #c69b52 0%, #8c6633 48%, #5c3f1c 100%);
  box-shadow:
    inset 0 0 0 2px #e1bd72,
    inset 0 3px 0 rgba(255,248,218,.27),
    inset 0 -6px 8px rgba(55,31,8,.32),
    0 3px 9px rgba(0,0,0,.34);
  text-shadow:
    0 2px 2px #1a0f04,
    0 -1px 0 rgba(255,249,226,.34);
}

.safe-cracker-game .sc-confirm-button span {
  color: inherit;
  opacity: 1;
}

.safe-cracker-game .sc-confirm-button:not(:disabled) {
  filter: brightness(1.08) saturate(1.06);
}

.safe-cracker-game .sc-confirm-button:not(:disabled):active {
  transform: translateY(1px);
  box-shadow:
    inset 0 0 0 2px #d4aa5c,
    inset 0 2px 0 rgba(255,246,214,.2),
    inset 0 -4px 6px rgba(55,31,8,.28),
    0 1px 5px rgba(0,0,0,.3);
}

.safe-cracker-game .sc-confirm-button:disabled {
  color: #f1dfb2;
  opacity: .84;
  filter: saturate(.82) brightness(.98);
}

@media (max-width: 700px) {
  .safe-cracker-game .sc-display { margin-bottom: 15px; }
  .safe-cracker-game .sc-dial-wrap { margin-top: 7px; transform: translateY(4px); }
  .safe-cracker-game .sc-dial-wrap::before { inset: -21px; }
  .safe-cracker-game .sc-dial-wrap::after { top: -37px; width: 54px; height: 24px; }
  .safe-cracker-game .sc-dial-pointer { top: -31px; width: 21px; height: 38px; }
  .safe-cracker-game .sc-dial { inset: -3px; transform: translateY(1px) scale(1.012); }
  .safe-cracker-game .sc-dial.dragging { transform: translateY(2px) scale(1.006); }
  .safe-cracker-game .sc-dial-number {
    --radius: min(24.5vw, 94px);
    width: 30px;
    height: 30px;
    margin: -15px;
    font-size: min(4.9vw, 1.26rem);
  }
  .safe-cracker-game .sc-dial-number > span { width: 30px; height: 30px; }
  .safe-cracker-game .sc-current-number {
    width: min(19vw, 72px);
    height: min(19vw, 72px);
    font-size: min(10.7vw, 2.55rem);
  }
  .safe-cracker-game .sc-step-controls button::before { font-size: 1.9rem; }
  .safe-cracker-game .sc-confirm-button {
    width: min(78%, 294px);
    min-height: 50px;
    margin: 12px auto 18px;
  }
}

@media (max-height: 720px) and (max-width: 700px) {
  .safe-cracker-game .sc-display { margin-bottom: 11px; }
  .safe-cracker-game .sc-dial-wrap { margin-top: 4px; transform: translateY(3px); }
  .safe-cracker-game .sc-dial-wrap::before { inset: -15px; }
  .safe-cracker-game .sc-dial-wrap::after { top: -30px; width: 48px; height: 21px; }
  .safe-cracker-game .sc-dial-pointer { top: -24px; width: 18px; height: 31px; }
  .safe-cracker-game .sc-dial { inset: -1px; transform: translateY(1px) scale(1.004); }
  .safe-cracker-game .sc-dial.dragging { transform: translateY(2px) scale(1.001); }
  .safe-cracker-game .sc-dial-number {
    --radius: min(20.5vw, 74px);
    width: 27px;
    height: 27px;
    margin: -13.5px;
    font-size: min(4.1vw, .96rem);
  }
  .safe-cracker-game .sc-dial-number > span { width: 27px; height: 27px; }
  .safe-cracker-game .sc-current-number { width: 62px; height: 62px; font-size: 2.05rem; }
  .safe-cracker-game .sc-step-controls button::before { font-size: 1.55rem; }
  .safe-cracker-game .sc-confirm-button {
    min-height: 46px;
    margin: 10px auto 15px;
  }
}
${end}`;

let css = await readFile(cssUrl, 'utf8');
if (!css.includes('/* SAFE_CRACKER_DIAL_DEPTH_V5_START */')) {
  throw new Error('Safe Cracker dial-layout patch requires the validated V5 dial-depth pass.');
}
const oldLayoutPattern = /\/\* SAFE_CRACKER_DIAL_LAYOUT_V\d+_START \*\/[\s\S]*?\/\* SAFE_CRACKER_DIAL_LAYOUT_V\d+_END \*\/\s*/gm;
css = css.replace(oldLayoutPattern, '').trimEnd() + `\n\n${layout}\n`;
await writeFile(cssUrl, css);

let client = await readFile(clientUrl, 'utf8');
const existingPlatePattern = /<img class="sc-dial-reference-plate"[^>]*>/;
if (!existingPlatePattern.test(client)) {
  throw new Error('Safe Cracker dial-layout patch could not find the mounted V7 dial plate.');
}
client = client.replace(existingPlatePattern, plateMarkup);
await writeFile(clientUrl, client);

let html = await readFile(indexUrl, 'utf8');
html = html.replace(/\/assets\/safe-cracker\/safe-cracker\.css\?[^"'\s]*/g, value => {
  const clean = value.replace(/&layout=\d+/g, '');
  return `${clean}&layout=3`;
});
html = html.replace(/\/assets\/safe-cracker\/safe-cracker\.js\?[^"'\s]*/g, value => {
  const clean = value.replace(/&layout=\d+/g, '');
  return `${clean}&layout=3`;
});
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker dial layout v2: numerals sit fully inside the black annulus, the pointer assembly is lower with a larger solid arrow, structural shadows are softened, step symbols remain centered, and the Check Number control is brighter without a heavy bottom ledge.');
