import { readFile, writeFile } from 'node:fs/promises';

const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);

const start = '/* SAFE_CRACKER_DIAL_LAYOUT_V1_START */';
const end = '/* SAFE_CRACKER_DIAL_LAYOUT_V1_END */';
const assetPath = '/assets/safe-cracker/textures/dial-reference-face-v7.svg?dial=7&layout=2';
const plateMarkup = `<img class="sc-dial-reference-plate" src="${assetPath}" alt="" aria-hidden="true" draggable="false">`;

const layout = String.raw`${start}
.safe-cracker-game .sc-display {
  margin-bottom: 20px;
}

.safe-cracker-game .sc-dial-wrap {
  margin: 8px auto 0;
  transform: translateY(0);
  filter:
    drop-shadow(0 4px 2px rgba(255,255,255,.022))
    drop-shadow(0 14px 7px rgba(0,0,0,.78))
    drop-shadow(0 31px 26px rgba(0,0,0,.84));
}

.safe-cracker-game .sc-dial-wrap::before {
  inset: -34px;
}

.safe-cracker-game .sc-dial-wrap::after {
  top: -58px;
  width: 64px;
  height: 29px;
  border-width: 2px;
  border-radius: 5px 5px 2px 2px;
  box-shadow:
    inset 0 2px 0 rgba(255,255,255,.24),
    inset 0 -7px 9px rgba(0,0,0,.78),
    0 5px 0 #010203,
    0 11px 14px rgba(0,0,0,.78);
}

.safe-cracker-game .sc-dial-pointer {
  top: -49px;
  width: 20px;
  height: 44px;
  clip-path: polygon(16% 0, 84% 0, 50% 100%);
  background:
    linear-gradient(90deg,
      #4a2b08 0%,
      #a66a1e 24%,
      #f3ce78 48%,
      #c68628 68%,
      #4a2907 100%);
  box-shadow:
    inset 1px 1px 0 rgba(255,247,219,.4),
    inset -2px -4px 4px rgba(48,20,2,.68),
    0 4px 0 #120a02,
    0 10px 12px rgba(0,0,0,.78);
  filter: drop-shadow(0 3px 2px rgba(0,0,0,.9));
}

.safe-cracker-game .sc-dial {
  inset: -6px;
  transform: translateY(-2px) scale(1.022);
  filter:
    drop-shadow(0 3px 1px rgba(255,255,255,.022))
    drop-shadow(0 12px 6px rgba(0,0,0,.78))
    drop-shadow(0 27px 23px rgba(0,0,0,.84));
}

.safe-cracker-game .sc-dial.dragging {
  transform: translateY(1px) scale(1.011);
  filter:
    drop-shadow(0 7px 4px rgba(0,0,0,.73))
    drop-shadow(0 17px 14px rgba(0,0,0,.79));
}

.safe-cracker-game .sc-dial-number {
  --radius: 103px;
  width: 34px;
  height: 34px;
  margin: -17px;
  font-size: 1.34rem;
  letter-spacing: -.035em;
}

.safe-cracker-game .sc-dial-number > span {
  width: 34px;
  height: 34px;
  transform: scaleX(.88);
}

.safe-cracker-game .sc-dial-number.selected > span {
  transform: scaleX(.88) scale(1.045);
}

.safe-cracker-game .sc-dial-hub {
  width: 34%;
}

.safe-cracker-game .sc-current-number {
  width: 74px;
  height: 74px;
  font-size: 2.55rem;
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
  width: min(70%, 280px);
  min-height: 54px;
  margin: 10px auto 25px;
  border: 4px solid #24170a;
  color: #fff1c2;
  background:
    linear-gradient(180deg, rgba(255,255,255,.27), transparent 30%),
    linear-gradient(180deg, #a98243 0%, #74552b 48%, #443016 100%);
  box-shadow:
    inset 0 0 0 2px #d9b467,
    inset 0 3px 0 rgba(255,244,207,.24),
    inset 0 -9px 11px rgba(38,21,5,.55),
    0 6px 0 #1a1007,
    0 13px 20px rgba(0,0,0,.6);
  text-shadow:
    0 2px 3px #130c04,
    0 -1px 0 rgba(255,248,220,.3);
}

.safe-cracker-game .sc-confirm-button span {
  color: inherit;
  opacity: 1;
}

.safe-cracker-game .sc-confirm-button:not(:disabled) {
  filter: brightness(1.08) saturate(1.08);
}

.safe-cracker-game .sc-confirm-button:disabled {
  color: #e7d4a3;
  opacity: .74;
  filter: saturate(.72) brightness(.9);
}

@media (max-width: 700px) {
  .safe-cracker-game .sc-display { margin-bottom: 17px; }
  .safe-cracker-game .sc-dial-wrap { margin-top: 6px; transform: translateY(2px); }
  .safe-cracker-game .sc-dial-wrap::before { inset: -23px; }
  .safe-cracker-game .sc-dial-wrap::after { top: -43px; width: 54px; height: 24px; }
  .safe-cracker-game .sc-dial-pointer { top: -36px; width: 17px; height: 33px; }
  .safe-cracker-game .sc-dial { inset: -4px; transform: translateY(-1px) scale(1.014); }
  .safe-cracker-game .sc-dial.dragging { transform: translateY(1px) scale(1.007); }
  .safe-cracker-game .sc-dial-number {
    --radius: min(26.5vw, 102px);
    width: 32px;
    height: 32px;
    margin: -16px;
    font-size: min(5.25vw, 1.34rem);
  }
  .safe-cracker-game .sc-dial-number > span { width: 32px; height: 32px; }
  .safe-cracker-game .sc-current-number {
    width: min(19vw, 72px);
    height: min(19vw, 72px);
    font-size: min(10.7vw, 2.55rem);
  }
  .safe-cracker-game .sc-step-controls button::before { font-size: 1.9rem; }
  .safe-cracker-game .sc-confirm-button { min-height: 49px; margin-bottom: 23px; }
}

@media (max-height: 720px) and (max-width: 700px) {
  .safe-cracker-game .sc-display { margin-bottom: 13px; }
  .safe-cracker-game .sc-dial-wrap { margin-top: 3px; transform: translateY(1px); }
  .safe-cracker-game .sc-dial-wrap::before { inset: -17px; }
  .safe-cracker-game .sc-dial-wrap::after { top: -35px; width: 48px; height: 21px; }
  .safe-cracker-game .sc-dial-pointer { top: -29px; width: 15px; height: 27px; }
  .safe-cracker-game .sc-dial { inset: -2px; transform: translateY(0) scale(1.006); }
  .safe-cracker-game .sc-dial.dragging { transform: translateY(1px) scale(1.002); }
  .safe-cracker-game .sc-dial-number {
    --radius: min(22vw, 80px);
    width: 28px;
    height: 28px;
    margin: -14px;
    font-size: min(4.45vw, 1rem);
  }
  .safe-cracker-game .sc-dial-number > span { width: 28px; height: 28px; }
  .safe-cracker-game .sc-current-number { width: 62px; height: 62px; font-size: 2.05rem; }
  .safe-cracker-game .sc-step-controls button::before { font-size: 1.55rem; }
  .safe-cracker-game .sc-confirm-button { min-height: 44px; margin: 7px auto 19px; }
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
  return `${clean}&layout=2`;
});
html = html.replace(/\/assets\/safe-cracker\/safe-cracker\.js\?[^"'\s]*/g, value => {
  const clean = value.replace(/&layout=\d+/g, '');
  return `${clean}&layout=2`;
});
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker dial layout v1: numerals moved inward and reduced, dial scaled down, pointer and housing made smaller and sharper, step symbols optically centered, and the Check Number control brightened.');
