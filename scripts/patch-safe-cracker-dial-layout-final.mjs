import { readFile, writeFile } from 'node:fs/promises';

const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);

const start = '/* SAFE_CRACKER_DIAL_LAYOUT_V3_START */';
const end = '/* SAFE_CRACKER_DIAL_LAYOUT_V3_END */';
const assetPath = '/assets/safe-cracker/textures/dial-reference-face-v7.svg?dial=7&layout=7';
const plateMarkup = `<img class="sc-dial-reference-plate" src="${assetPath}" alt="" aria-hidden="true" draggable="false">`;

const refinement = String.raw`${start}
.safe-cracker-game .sc-dial-number {
  --radius: 91px;
  width: 30px;
  height: 30px;
  margin: -15px;
  font-size: 1.22rem;
}

.safe-cracker-game .sc-dial-number > span {
  width: 30px;
  height: 30px;
  transform: scaleX(.9);
}

.safe-cracker-game .sc-dial-number.selected > span {
  transform: scaleX(.9) scale(1.035);
}

.safe-cracker-game .sc-dial-wrap::after {
  top: -46px;
}

.safe-cracker-game .sc-dial-pointer {
  top: -38px;
}

.safe-cracker-game .sc-confirm-button {
  overflow: hidden;
  isolation: isolate;
  -webkit-appearance: none;
  appearance: none;
  border: 3px solid #050708 !important;
  border-bottom-color: #050708 !important;
  outline: 0;
  border-radius: 8px;
  color: #ddb362;
  background: linear-gradient(180deg,
    #e2e8ea 0%,
    #c4cdd1 31%,
    #929fa5 67%,
    #68757b 100%) !important;
  box-shadow:
    inset 0 2px 0 rgba(255,255,255,.72),
    inset 0 -4px 6px rgba(10,14,16,.28),
    0 7px 0 #050708,
    0 13px 15px rgba(0,0,0,.42) !important;
  text-shadow:
    -1px -1px 0 #050708,
    0 -1px 0 #050708,
    1px -1px 0 #050708,
    -1px 0 0 #050708,
    1px 0 0 #050708,
    -1px 1px 0 #050708,
    0 1px 0 #050708,
    1px 1px 0 #050708,
    0 2px 2px #000;
  transform: translateY(0);
  transition: transform .06s ease, box-shadow .06s ease;
}

.safe-cracker-game .sc-confirm-button::before,
.safe-cracker-game .sc-confirm-button::after {
  content: none !important;
  display: none !important;
}

.safe-cracker-game .sc-confirm-button:not(:disabled) {
  color: #ddb362;
  filter: brightness(1.04) saturate(.82);
}

.safe-cracker-game .sc-confirm-button:disabled {
  color: #ddb362;
  opacity: .74;
  filter: saturate(.68) brightness(.92);
}

.safe-cracker-game .sc-confirm-button:active {
  border: 3px solid #050708 !important;
  border-bottom-color: #050708 !important;
  transform: translateY(4px) !important;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.5),
    inset 0 -2px 4px rgba(10,14,16,.25),
    0 3px 0 #050708,
    0 7px 9px rgba(0,0,0,.34) !important;
}

@media (max-width: 700px) {
  .safe-cracker-game .sc-dial-number {
    --radius: min(23vw, 88px);
    width: 28px;
    height: 28px;
    margin: -14px;
    font-size: min(4.55vw, 1.18rem);
  }

  .safe-cracker-game .sc-dial-number > span {
    width: 28px;
    height: 28px;
  }

  .safe-cracker-game .sc-dial-wrap::after {
    top: -31px;
  }

  .safe-cracker-game .sc-dial-pointer {
    top: -25px;
  }
}

@media (max-height: 720px) and (max-width: 700px) {
  .safe-cracker-game .sc-dial-number {
    --radius: min(19.1vw, 69px);
    width: 25px;
    height: 25px;
    margin: -12.5px;
    font-size: min(3.8vw, .9rem);
  }

  .safe-cracker-game .sc-dial-number > span {
    width: 25px;
    height: 25px;
  }

  .safe-cracker-game .sc-dial-wrap::after {
    top: -24px;
  }

  .safe-cracker-game .sc-dial-pointer {
    top: -18px;
  }
}
${end}`;

let css = await readFile(cssUrl, 'utf8');
if (!css.includes('/* SAFE_CRACKER_DIAL_LAYOUT_V2_START */')) {
  throw new Error('Safe Cracker final dial-layout patch requires the validated V2 layout pass.');
}
const oldFinalPattern = /\/\* SAFE_CRACKER_DIAL_LAYOUT_V3_START \*\/[\s\S]*?\/\* SAFE_CRACKER_DIAL_LAYOUT_V3_END \*\/\s*/gm;
css = css.replace(oldFinalPattern, '').trimEnd() + `\n\n${refinement}\n`;
await writeFile(cssUrl, css);

let client = await readFile(clientUrl, 'utf8');
const existingPlatePattern = /<img class="sc-dial-reference-plate"[^>]*>/;
if (!existingPlatePattern.test(client)) {
  throw new Error('Safe Cracker final dial-layout patch could not find the mounted V7 dial plate.');
}
client = client.replace(existingPlatePattern, plateMarkup);

if (!/RESETTING(?:…|\.\.\.)/i.test(client)) {
  throw new Error('Safe Cracker final dial-layout patch could not find the cooldown RESETTING label.');
}
client = client.replace(/RESETTING(?:…|\.\.\.)/gi, 'CHECK NUMBER');
await writeFile(clientUrl, client);

let html = await readFile(indexUrl, 'utf8');
html = html.replace(/\/assets\/safe-cracker\/safe-cracker\.css\?[^"'\s]*/g, value => {
  const clean = value.replace(/&layout=\d+/g, '');
  return `${clean}&layout=7`;
});
html = html.replace(/\/assets\/safe-cracker\/safe-cracker\.js\?[^"'\s]*/g, value => {
  const clean = value.replace(/&layout=\d+/g, '');
  return `${clean}&layout=7`;
});
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker confirmation refinement: inherited yellow/orange underlayers are removed, the button has a black mechanical press step, the gold label has a black outline, and the cooldown RESETTING label now remains CHECK NUMBER.');
