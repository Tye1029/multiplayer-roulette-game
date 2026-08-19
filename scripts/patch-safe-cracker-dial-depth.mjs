import { readFile, writeFile } from 'node:fs/promises';
import { buildSafeCrackerReferenceDialSvg } from './build-safe-cracker-reference-dial.mjs';

const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const faceUrl = new URL('../assets/safe-cracker/textures/dial-reference-face-v7.svg', import.meta.url);

const cssStart = '/* SAFE_CRACKER_DIAL_DEPTH_V5_START */';
const cssEnd = '/* SAFE_CRACKER_DIAL_DEPTH_V5_END */';
const assetPath = '/assets/safe-cracker/textures/dial-reference-face-v7.svg?dial=7';
const plateMarkup = `<img class="sc-dial-reference-plate" src="${assetPath}" alt="" aria-hidden="true" draggable="false">`;

const dialDepth = String.raw`${cssStart}
.safe-cracker-game .sc-dial-wrap {
  isolation: isolate;
  transform: translateY(-8px);
  filter:
    drop-shadow(0 5px 2px rgba(255,255,255,.025))
    drop-shadow(0 17px 8px rgba(0,0,0,.8))
    drop-shadow(0 38px 31px rgba(0,0,0,.86));
}

.safe-cracker-game .sc-dial-wrap::before {
  inset: -38px;
  border: 2px solid rgba(143,153,158,.18);
  pointer-events: none;
  background:
    radial-gradient(circle,
      transparent 0 63%,
      #010203 64% 70%,
      #343e42 71% 72.5%,
      #0c1012 73.5% 86%,
      #030405 87% 100%);
  box-shadow:
    inset 0 0 0 10px #010203,
    inset 0 18px 23px rgba(255,255,255,.026),
    inset 0 -44px 50px rgba(0,0,0,.98),
    0 0 0 5px rgba(3,5,6,.97),
    0 13px 0 #010202,
    0 34px 39px rgba(0,0,0,.82);
}

.safe-cracker-game .sc-dial-wrap::after {
  top: -84px;
  z-index: 10;
  width: 94px;
  height: 43px;
  border: 3px solid #040607;
  border-radius: 8px 8px 3px 3px;
  pointer-events: none;
  background:
    linear-gradient(180deg, rgba(255,255,255,.19), transparent 27%),
    linear-gradient(90deg,
      #070a0c 0%,
      #323a3e 18%,
      #929ca0 47%,
      #3a4347 73%,
      #080b0d 100%);
  box-shadow:
    inset 0 2px 0 rgba(255,255,255,.26),
    inset 0 -10px 12px rgba(0,0,0,.8),
    0 8px 0 #010203,
    0 19px 21px rgba(0,0,0,.84);
}

.safe-cracker-game .sc-dial-pointer {
  top: -71px;
  z-index: 14;
  width: 34px;
  height: 55px;
  border: 0;
  border-radius: 0;
  pointer-events: none;
  clip-path: polygon(9% 0, 91% 0, 100% 11%, 69% 68%, 50% 100%, 31% 68%, 0 11%);
  background:
    linear-gradient(90deg,
      #332005 0%,
      #96601a 16%,
      #f4d080 43%,
      #d09330 57%,
      #74440e 79%,
      #231304 100%);
  box-shadow:
    inset 2px 1px 0 rgba(255,247,219,.44),
    inset -3px -7px 7px rgba(48,20,2,.72),
    0 7px 0 #120a02,
    0 18px 19px rgba(0,0,0,.86);
  filter:
    drop-shadow(0 2px 1px rgba(0,0,0,.97))
    drop-shadow(0 6px 4px rgba(0,0,0,.78));
}

.safe-cracker-game .sc-dial {
  inset: -10px;
  transform: translateY(-9px) scale(1.048);
  filter:
    drop-shadow(0 3px 1px rgba(255,255,255,.025))
    drop-shadow(0 15px 7px rgba(0,0,0,.81))
    drop-shadow(0 34px 29px rgba(0,0,0,.88));
}

.safe-cracker-game .sc-dial.dragging {
  transform: translateY(-2px) scale(1.024);
  filter:
    drop-shadow(0 9px 4px rgba(0,0,0,.77))
    drop-shadow(0 23px 19px rgba(0,0,0,.84));
}

.safe-cracker-game .sc-dial-face {
  overflow: visible;
  border: 0;
  background: #050708 !important;
  background-image: none !important;
  box-shadow:
    inset 0 0 0 2px rgba(235,240,242,.1),
    inset 0 -35px 42px rgba(0,0,0,.32),
    0 0 0 4px #010203,
    0 12px 0 #010202,
    0 30px 32px rgba(0,0,0,.86);
}

.safe-cracker-game .sc-dial-reference-plate {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: block;
  width: 100%;
  height: 100%;
  max-width: none;
  border: 0;
  border-radius: 50%;
  object-fit: contain;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
}

.safe-cracker-game .sc-dial-face::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 2;
  border-radius: 50%;
  pointer-events: none;
  background:
    repeating-radial-gradient(circle at 50% 50%,
      transparent 0 2.2px,
      rgba(255,255,255,.008) 2.2px 2.75px,
      transparent 2.75px 5px),
    radial-gradient(circle,
      transparent 0 72%,
      rgba(0,0,0,.06) 84%,
      rgba(0,0,0,.27) 100%);
  opacity: .46;
}

.safe-cracker-game .sc-dial-face::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 3;
  border-radius: 50%;
  pointer-events: none;
  box-shadow:
    inset 0 4px 3px rgba(255,255,255,.024),
    inset 0 -18px 22px rgba(0,0,0,.31);
}

.safe-cracker-game .sc-dial-number {
  --radius: 109px;
  z-index: 5;
  width: 39px;
  height: 44px;
  margin: -22px -19.5px;
  color: #ddb362;
  font-family: "DIN Condensed", "Roboto Condensed", "Arial Narrow", "Helvetica Neue Condensed", sans-serif;
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: -.045em;
  text-shadow:
    0 3px 3px #000,
    0 -1px 0 rgba(255,242,208,.28);
}

.safe-cracker-game .sc-dial-number::before,
.safe-cracker-game .sc-dial-number::after {
  content: none !important;
  display: none !important;
}

.safe-cracker-game .sc-dial-number > span {
  width: 37px;
  height: 44px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 0;
  color: inherit;
  background: transparent;
  box-shadow: none;
  transform: scaleX(.84);
  transform-origin: center;
  transition: color .13s ease, transform .13s ease, text-shadow .13s ease;
}

.safe-cracker-game .sc-dial-number.selected {
  color: #f0ca77;
  text-shadow:
    0 3px 3px #000,
    0 -1px 0 rgba(255,245,218,.38);
}

.safe-cracker-game .sc-dial-number.selected > span {
  color: inherit;
  transform: scaleX(.84) scale(1.055) translateY(-1px);
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.safe-cracker-game .sc-dial-hub {
  z-index: 7;
  width: 35%;
  overflow: visible;
  border: 7px solid #040607;
  background:
    radial-gradient(circle at 38% 27%, rgba(255,255,255,.08), transparent 19%),
    radial-gradient(circle at 40% 33%,
      #242a2d 0 10%,
      #0d1113 38%,
      #020304 78%,
      #101517 100%);
  box-shadow:
    inset 0 3px 2px rgba(255,255,255,.1),
    inset 0 -20px 27px rgba(0,0,0,.82),
    inset 0 0 26px rgba(0,0,0,.93),
    0 0 0 2px #a66f28,
    0 0 0 5px #2c1c08,
    0 0 0 8px #dce2e4,
    0 0 0 12px #697478,
    0 0 0 16px #121719,
    0 9px 0 #010203,
    0 25px 27px rgba(0,0,0,.86);
}

.safe-cracker-game .sc-dial-hub::before {
  content: '';
  position: absolute;
  inset: -21%;
  z-index: -1;
  border-radius: 50%;
  border: 2px solid rgba(199,207,210,.62);
  pointer-events: none;
  background:
    radial-gradient(circle,
      transparent 0 65%,
      rgba(227,233,235,.67) 66% 68%,
      #596469 69% 73%,
      #111719 74% 100%);
  box-shadow:
    inset 0 3px 3px rgba(255,255,255,.08),
    inset 0 -11px 14px rgba(0,0,0,.73),
    0 8px 7px rgba(0,0,0,.83);
}

.safe-cracker-game .sc-dial-hub::after {
  content: '';
  position: absolute;
  inset: 8%;
  border-radius: 50%;
  pointer-events: none;
  background:
    radial-gradient(circle at 35% 24%, rgba(255,255,255,.055), transparent 28%),
    radial-gradient(circle, transparent 0 58%, rgba(255,255,255,.02) 70%, transparent 72%);
  border-top: 1px solid rgba(255,255,255,.12);
  border-bottom: 1px solid rgba(0,0,0,.9);
  box-shadow: inset 0 -17px 19px rgba(0,0,0,.46);
}

.safe-cracker-game .sc-current-number {
  z-index: 10;
  width: 78px;
  height: 78px;
  border: 0;
  color: #e3b968;
  background:
    radial-gradient(circle at 36% 23%, rgba(255,255,255,.055), transparent 26%),
    radial-gradient(circle, #101416 0 42%, #020304 80%);
  box-shadow:
    inset 0 2px 0 rgba(255,255,255,.08),
    inset 0 -20px 26px rgba(0,0,0,.77),
    inset 0 0 22px rgba(0,0,0,.93);
  font-family: "DIN Condensed", "Roboto Condensed", "Arial Narrow", "Helvetica Neue Condensed", sans-serif;
  font-size: 2.72rem;
  font-weight: 600;
  letter-spacing: -.045em;
  text-shadow:
    0 4px 4px #000,
    0 -1px 0 rgba(255,239,199,.26);
}

.safe-cracker-game .sc-step-controls {
  gap: 22px;
  margin: 18px 0 11px;
}

.safe-cracker-game .sc-step-controls button {
  width: 108px;
  height: 58px;
  padding: 0 0 4px;
  display: grid;
  place-items: center;
  border: 4px solid #090d0f;
  border-radius: 12px;
  color: #eef3f4;
  background:
    linear-gradient(180deg, rgba(255,255,255,.12), transparent 28%),
    linear-gradient(180deg, #3b4448 0%, #1b2225 48%, #070a0c 100%);
  box-shadow:
    inset 0 0 0 2px #aab4b8,
    inset 0 0 0 5px #2b3438,
    inset 0 3px 0 rgba(255,255,255,.2),
    inset 0 -9px 11px rgba(0,0,0,.58),
    0 7px 0 #030506,
    0 14px 17px rgba(0,0,0,.64);
  font-size: 2.05rem;
  font-weight: 700;
  line-height: 1;
  text-shadow:
    0 3px 3px #000,
    0 -1px 0 rgba(255,255,255,.28);
}

.safe-cracker-game .sc-step-controls button:active {
  transform: translateY(4px);
  box-shadow:
    inset 0 0 0 2px #899499,
    inset 0 0 0 5px #20282c,
    inset 0 2px 0 rgba(255,255,255,.13),
    inset 0 -5px 8px rgba(0,0,0,.56),
    0 3px 0 #030506,
    0 7px 9px rgba(0,0,0,.58);
}

@media (max-width: 700px) {
  .safe-cracker-game .sc-dial-wrap { transform: translateY(-5px); }
  .safe-cracker-game .sc-dial-wrap::before { inset: -27px; }
  .safe-cracker-game .sc-dial-wrap::after { top: -61px; width: 76px; height: 35px; }
  .safe-cracker-game .sc-dial-pointer { top: -52px; width: 27px; height: 44px; }
  .safe-cracker-game .sc-dial { inset: -7px; transform: translateY(-7px) scale(1.038); }
  .safe-cracker-game .sc-dial.dragging { transform: translateY(-1px) scale(1.018); }
  .safe-cracker-game .sc-dial-number {
    --radius: min(28.6vw, 109px);
    font-size: min(5.9vw, 1.5rem);
  }
  .safe-cracker-game .sc-current-number {
    width: min(20.5vw, 78px);
    height: min(20.5vw, 78px);
    font-size: min(11.2vw, 2.72rem);
  }
  .safe-cracker-game .sc-step-controls { gap: 17px; margin-top: 14px; }
  .safe-cracker-game .sc-step-controls button { width: min(28vw, 104px); height: 52px; font-size: 1.9rem; }
}

@media (max-height: 720px) and (max-width: 700px) {
  .safe-cracker-game .sc-dial-wrap::before { inset: -20px; }
  .safe-cracker-game .sc-dial-wrap::after { top: -46px; width: 64px; height: 29px; }
  .safe-cracker-game .sc-dial-pointer { top: -38px; width: 22px; height: 37px; }
  .safe-cracker-game .sc-dial { inset: -4px; transform: translateY(-3px) scale(1.02); }
  .safe-cracker-game .sc-dial-number {
    --radius: min(23.6vw, 86px);
    font-size: min(5vw, 1.14rem);
  }
  .safe-cracker-game .sc-current-number { width: 66px; height: 66px; font-size: 2.18rem; }
  .safe-cracker-game .sc-step-controls { gap: 14px; margin: 7px 0 8px; }
  .safe-cracker-game .sc-step-controls button { width: 78px; height: 41px; font-size: 1.55rem; }
}
${cssEnd}`;

await writeFile(faceUrl, buildSafeCrackerReferenceDialSvg());

let css = await readFile(cssUrl, 'utf8');
const markerPattern = /\/\* SAFE_CRACKER_DIAL_DEPTH_V\d+_START \*\/[\s\S]*?\/\* SAFE_CRACKER_DIAL_DEPTH_V\d+_END \*\/\s*/gm;
css = css.replace(markerPattern, '').trimEnd() + `\n\n${dialDepth}\n`;
await writeFile(cssUrl, css);

let client = await readFile(clientUrl, 'utf8');
if (!client.includes('class="sc-dial-reference-plate"')) {
  const dialFaceOpening = '<div class="sc-dial-face" data-sc-dial-face style="transform:rotate(${runtime.rotation}deg)">';
  if (!client.includes(dialFaceOpening)) {
    throw new Error('Safe Cracker dial-depth patch could not find the rotating dial-face opening tag.');
  }
  client = client.replace(dialFaceOpening, `${dialFaceOpening}${plateMarkup}`);
}
await writeFile(clientUrl, client);

let html = await readFile(indexUrl, 'utf8');
html = html.replace(/\/assets\/safe-cracker\/safe-cracker\.css\?[^"'\s]*/g, value => {
  const clean = value.replace(/&dial=\d+/g, '');
  return `${clean}&dial=7`;
});
html = html.replace(/\/assets\/safe-cracker\/safe-cracker\.js\?[^"'\s]*/g, value => {
  const clean = value.replace(/&dial=\d+/g, '');
  return `${clean}&dial=7`;
});
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker reference dial depth v5: a real cache-busted flattened SVG plate now masks the legacy spoke wheel, with raised scratched grip blocks, thick brushed-silver bezel, wide black numeral annulus, short silver ticks and inner dividers, smaller layered hub, and elevated faceted pointer.');
