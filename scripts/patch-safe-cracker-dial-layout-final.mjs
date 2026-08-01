import { readFile, writeFile } from 'node:fs/promises';

const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);

const start = '/* SAFE_CRACKER_DIAL_LAYOUT_V3_START */';
const end = '/* SAFE_CRACKER_DIAL_LAYOUT_V3_END */';
const assetPath = '/assets/safe-cracker/textures/dial-reference-face-v7.svg?dial=7&layout=4';
const plateMarkup = `<img class="sc-dial-reference-plate" src="${assetPath}" alt="" aria-hidden="true" draggable="false">`;

const refinement = String.raw`${start}
.safe-cracker-game .sc-dial-number {
  --radius: 88px;
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

.safe-cracker-game .sc-confirm-button {
  border: 0 !important;
  outline: 0;
  border-radius: 8px;
  box-shadow:
    inset 0 2px 0 rgba(255,248,218,.22),
    inset 0 -5px 7px rgba(55,31,8,.27),
    0 2px 6px rgba(0,0,0,.28);
}

.safe-cracker-game .sc-confirm-button::before,
.safe-cracker-game .sc-confirm-button::after {
  content: none !important;
  display: none !important;
}

.safe-cracker-game .sc-confirm-button:not(:disabled):active {
  border: 0 !important;
  transform: translateY(1px);
  box-shadow:
    inset 0 1px 0 rgba(255,246,214,.18),
    inset 0 -3px 5px rgba(55,31,8,.23),
    0 1px 4px rgba(0,0,0,.24);
}

@media (max-width: 700px) {
  .safe-cracker-game .sc-dial-number {
    --radius: min(22.2vw, 85px);
    width: 28px;
    height: 28px;
    margin: -14px;
    font-size: min(4.55vw, 1.18rem);
  }

  .safe-cracker-game .sc-dial-number > span {
    width: 28px;
    height: 28px;
  }
}

@media (max-height: 720px) and (max-width: 700px) {
  .safe-cracker-game .sc-dial-number {
    --radius: min(18.3vw, 66px);
    width: 25px;
    height: 25px;
    margin: -12.5px;
    font-size: min(3.8vw, .9rem);
  }

  .safe-cracker-game .sc-dial-number > span {
    width: 25px;
    height: 25px;
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
await writeFile(clientUrl, client);

let html = await readFile(indexUrl, 'utf8');
html = html.replace(/\/assets\/safe-cracker\/safe-cracker\.css\?[^"'\s]*/g, value => {
  const clean = value.replace(/&layout=\d+/g, '');
  return `${clean}&layout=4`;
});
html = html.replace(/\/assets\/safe-cracker\/safe-cracker\.js\?[^"'\s]*/g, value => {
  const clean = value.replace(/&layout=\d+/g, '');
  return `${clean}&layout=4`;
});
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker dial layout v3: numerals moved fully inward within the black annulus and the Check Number button decorative border and ornaments were removed.');
