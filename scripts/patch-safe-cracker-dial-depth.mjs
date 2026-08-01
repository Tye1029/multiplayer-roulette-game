import { readFile, writeFile } from 'node:fs/promises';

const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const cssStart = '/* SAFE_CRACKER_DIAL_DEPTH_V1_START */';
const cssEnd = '/* SAFE_CRACKER_DIAL_DEPTH_V1_END */';

const dialDepth = String.raw`${cssStart}
.safe-cracker-game .sc-dial-wrap {
  isolation: isolate;
  filter:
    drop-shadow(0 7px 5px rgba(255,255,255,.025))
    drop-shadow(0 14px 10px rgba(0,0,0,.46))
    drop-shadow(0 25px 23px rgba(0,0,0,.48));
}

.safe-cracker-game .sc-dial-wrap::before {
  inset: -20px;
  border: 1px solid rgba(205,214,218,.22);
  background:
    radial-gradient(circle at 35% 23%, rgba(255,255,255,.1), transparent 21%),
    radial-gradient(circle at 50% 49%,
      transparent 0 71%,
      rgba(10,14,16,.96) 72% 75%,
      rgba(129,140,145,.34) 76% 78%,
      rgba(29,36,40,.94) 79% 86%,
      #070a0c 87% 100%);
  box-shadow:
    inset 0 0 0 5px rgba(3,6,7,.96),
    inset 0 13px 18px rgba(255,255,255,.035),
    inset 0 -24px 30px rgba(0,0,0,.82),
    0 0 0 2px rgba(131,143,148,.16),
    0 7px 0 rgba(5,8,9,.82),
    0 20px 27px rgba(0,0,0,.58);
}

.safe-cracker-game .sc-dial-wrap::after {
  top: -31px;
  width: 58px;
  height: 27px;
  border: 2px solid #080b0d;
  border-radius: 5px 5px 2px 2px;
  background:
    linear-gradient(180deg, rgba(255,255,255,.22), transparent 34%),
    linear-gradient(90deg, #101518 0%, #505b60 20%, #b8c1c4 48%, #5e696e 72%, #111719 100%);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.27),
    inset 0 -5px 6px rgba(0,0,0,.54),
    0 5px 0 #06090a,
    0 10px 12px rgba(0,0,0,.62);
}

.safe-cracker-game .sc-dial-pointer {
  top: -25px;
  z-index: 12;
  width: 22px;
  height: 39px;
  border: 0;
  border-radius: 0;
  clip-path: polygon(13% 0, 87% 0, 100% 16%, 67% 67%, 50% 100%, 33% 67%, 0 16%);
  background:
    linear-gradient(90deg,
      #1c2428 0%,
      #778287 19%,
      #e7ecee 45%,
      #aab4b8 58%,
      #485257 76%,
      #111719 100%);
  box-shadow:
    inset 1px 1px 0 rgba(255,255,255,.55),
    inset -2px -4px 4px rgba(0,0,0,.58),
    0 5px 0 #070a0c,
    0 10px 10px rgba(0,0,0,.64);
  filter:
    drop-shadow(0 2px 1px rgba(0,0,0,.92))
    drop-shadow(0 0 5px rgba(213,225,229,.12));
}

.safe-cracker-game .sc-dial {
  inset: 5px;
  filter:
    drop-shadow(0 4px 1px rgba(255,255,255,.035))
    drop-shadow(0 10px 6px rgba(0,0,0,.55))
    drop-shadow(0 18px 16px rgba(0,0,0,.6));
}

.safe-cracker-game .sc-dial.dragging {
  transform: scale(.995) translateY(1px);
  filter:
    drop-shadow(0 7px 4px rgba(0,0,0,.62))
    drop-shadow(0 13px 11px rgba(0,0,0,.64));
}

.safe-cracker-game .sc-dial-face {
  overflow: visible;
  border: 8px solid #06090a;
  background:
    url('/assets/safe-cracker/textures/dial-machined.svg') center / cover no-repeat,
    radial-gradient(circle at 34% 23%, rgba(255,255,255,.17), transparent 17%),
    radial-gradient(circle at 69% 78%, rgba(0,0,0,.38), transparent 34%),
    radial-gradient(circle,
      #080b0d 0 27%,
      #252d31 28% 31%,
      #aeb8bb 32% 33%,
      #424c50 34% 39%,
      #111619 40% 57%,
      #5c676b 58% 59%,
      #101416 60% 79%,
      #d8dfe1 80% 81.5%,
      #788388 82% 84.2%,
      #e5eaeb 85% 86.2%,
      #181e21 87% 100%);
  box-shadow:
    inset 0 0 0 2px rgba(228,235,237,.6),
    inset 0 0 0 6px rgba(42,51,55,.94),
    inset 0 12px 18px rgba(255,255,255,.04),
    inset 0 -27px 34px rgba(0,0,0,.72),
    inset 0 0 38px rgba(0,0,0,.76),
    0 0 0 2px rgba(195,205,208,.13),
    0 5px 0 #050809,
    0 15px 18px rgba(0,0,0,.62);
}

.safe-cracker-game .sc-dial-face::before {
  content: '';
  position: absolute;
  inset: 1px;
  z-index: 1;
  border-radius: 50%;
  pointer-events: none;
  background:
    repeating-linear-gradient(103deg, rgba(255,255,255,.08) 0 1px, transparent 1px 8px),
    repeating-linear-gradient(77deg, rgba(0,0,0,.26) 0 1px, transparent 1px 11px),
    repeating-conic-gradient(from -.8deg,
      #080b0d 0deg 1.1deg,
      #343b3f 1.1deg 2.1deg,
      #111619 2.1deg 7.1deg,
      #262d31 7.1deg 8.15deg,
      #6f797d 8.15deg 8.6deg,
      #d9dfe1 8.6deg 9deg);
  -webkit-mask: radial-gradient(circle, transparent 0 87%, #000 88% 98%, transparent 99% 100%);
  mask: radial-gradient(circle, transparent 0 87%, #000 88% 98%, transparent 99% 100%);
  opacity: .98;
  filter:
    drop-shadow(0 -1px 0 rgba(255,255,255,.08))
    drop-shadow(0 4px 2px rgba(0,0,0,.8));
}

.safe-cracker-game .sc-dial-face::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 2;
  border-radius: 50%;
  pointer-events: none;
  background:
    repeating-conic-gradient(from -.55deg,
      rgba(226,233,235,.96) 0deg .34deg,
      rgba(79,89,94,.82) .34deg .58deg,
      transparent .58deg 3.6deg);
  -webkit-mask: radial-gradient(circle, transparent 0 74.8%, #000 75.2% 79.1%, transparent 79.6% 100%);
  mask: radial-gradient(circle, transparent 0 74.8%, #000 75.2% 79.1%, transparent 79.6% 100%);
  opacity: .92;
  filter:
    drop-shadow(0 -1px 0 rgba(255,255,255,.12))
    drop-shadow(0 1px 0 rgba(0,0,0,.88));
}

.safe-cracker-game .sc-dial-number {
  --radius: 105px;
  z-index: 4;
  width: 34px;
  height: 38px;
  margin: -19px -17px;
  color: #dce3e5;
  font-size: 1.2rem;
  font-weight: 800;
  letter-spacing: -.035em;
  text-shadow:
    0 3px 3px #000,
    0 -1px 0 rgba(255,255,255,.22),
    0 0 5px rgba(207,220,224,.08);
}

.safe-cracker-game .sc-dial-number > span {
  width: 31px;
  height: 36px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 0;
  color: inherit;
  background: transparent;
  box-shadow: none;
  transition: color .13s ease, transform .13s ease, text-shadow .13s ease;
}

.safe-cracker-game .sc-dial-number.selected {
  color: #f5f8f9;
  text-shadow:
    0 3px 3px #000,
    0 -1px 0 rgba(255,255,255,.34),
    0 0 8px rgba(222,234,238,.28);
}

.safe-cracker-game .sc-dial-number.selected > span {
  color: inherit;
  transform: scale(1.09) translateY(-1px);
  border: 0;
  background: transparent;
  box-shadow: none;
}

.safe-cracker-game .sc-dial-hub {
  z-index: 5;
  width: 45%;
  overflow: visible;
  border: 7px solid #070a0c;
  background:
    radial-gradient(circle at 36% 24%, rgba(255,255,255,.24), transparent 16%),
    radial-gradient(circle at 50% 54%,
      #1a2023 0 13%,
      #090c0e 14% 57%,
      #222a2e 58% 65%,
      #717c81 66% 69%,
      #151b1e 70% 100%);
  box-shadow:
    inset 0 2px 0 rgba(255,255,255,.17),
    inset 0 -15px 20px rgba(0,0,0,.66),
    inset 0 0 20px rgba(0,0,0,.78),
    0 0 0 3px #c7d0d3,
    0 0 0 6px #667176,
    0 0 0 9px #151b1e,
    0 0 0 12px #aeb8bb,
    0 0 0 15px #2f393d,
    0 7px 0 #06090a,
    0 17px 18px rgba(0,0,0,.66);
}

.safe-cracker-game .sc-dial-hub::before {
  content: '';
  position: absolute;
  inset: -39%;
  z-index: -1;
  border-radius: 50%;
  pointer-events: none;
  background:
    repeating-conic-gradient(from -1deg,
      rgba(226,233,235,.82) 0deg .75deg,
      rgba(67,76,80,.92) .75deg 1.3deg,
      transparent 1.3deg 35.15deg,
      rgba(11,15,17,.96) 35.15deg 36deg),
    radial-gradient(circle,
      transparent 0 57%,
      #2e373b 58% 60%,
      #858f93 61% 62.5%,
      #171d20 63% 78%,
      #596469 79% 80.5%,
      #cbd3d5 81% 82%,
      #222a2e 83% 86%,
      transparent 87% 100%);
  -webkit-mask: radial-gradient(circle, transparent 0 56%, #000 57% 86%, transparent 87% 100%);
  mask: radial-gradient(circle, transparent 0 56%, #000 57% 86%, transparent 87% 100%);
  filter:
    drop-shadow(0 -1px 0 rgba(255,255,255,.13))
    drop-shadow(0 5px 3px rgba(0,0,0,.74));
}

.safe-cracker-game .sc-dial-hub::after {
  content: '';
  position: absolute;
  inset: 7%;
  border-radius: 50%;
  pointer-events: none;
  background:
    radial-gradient(ellipse at 37% 23%, rgba(255,255,255,.13), transparent 31%),
    linear-gradient(180deg, rgba(255,255,255,.025), transparent 42%);
  border-top: 1px solid rgba(255,255,255,.18);
  border-bottom: 1px solid rgba(0,0,0,.7);
  box-shadow:
    inset 0 7px 11px rgba(255,255,255,.025),
    inset 0 -12px 14px rgba(0,0,0,.32);
}

.safe-cracker-game .sc-current-number {
  z-index: 8;
  width: 84px;
  height: 84px;
  border: 0;
  color: #eef3f4;
  background:
    radial-gradient(ellipse at 38% 25%, rgba(255,255,255,.13), transparent 27%),
    radial-gradient(circle, #151a1d 0 45%, #070a0c 72%);
  box-shadow:
    inset 0 2px 0 rgba(255,255,255,.1),
    inset 0 -17px 22px rgba(0,0,0,.58),
    inset 0 0 17px rgba(0,0,0,.82);
  font-size: 2.65rem;
  font-weight: 800;
  text-shadow:
    0 3px 4px #000,
    0 -1px 0 rgba(255,255,255,.28),
    0 0 12px rgba(219,232,236,.18);
}

.safe-cracker-game .sc-step-controls {
  gap: 14px;
  margin: 10px 0 10px;
}

.safe-cracker-game .sc-step-controls button {
  width: 88px;
  height: 47px;
  padding: 0 0 3px;
  display: grid;
  place-items: center;
  border: 3px solid #111719;
  border-radius: 10px;
  color: #e5ebed;
  background:
    linear-gradient(180deg, rgba(255,255,255,.08), transparent 31%),
    linear-gradient(180deg, #31393d 0%, #171d20 52%, #080b0d 100%);
  box-shadow:
    inset 0 0 0 2px #8b969a,
    inset 0 0 0 4px #222a2e,
    inset 0 2px 0 rgba(255,255,255,.18),
    inset 0 -7px 9px rgba(0,0,0,.52),
    0 5px 0 #050809,
    0 10px 13px rgba(0,0,0,.55);
  font-size: 1.7rem;
  font-weight: 700;
  line-height: 1;
  text-shadow:
    0 2px 2px #000,
    0 -1px 0 rgba(255,255,255,.25);
}

.safe-cracker-game .sc-step-controls button:active {
  transform: translateY(3px);
  box-shadow:
    inset 0 0 0 2px #788388,
    inset 0 0 0 4px #1b2225,
    inset 0 2px 0 rgba(255,255,255,.12),
    inset 0 -4px 7px rgba(0,0,0,.5),
    0 2px 0 #050809,
    0 5px 7px rgba(0,0,0,.52);
}

@media (max-width: 700px) {
  .safe-cracker-game .sc-dial-wrap::before { inset: -14px; }
  .safe-cracker-game .sc-dial-wrap::after { top: -27px; width: 50px; height: 24px; }
  .safe-cracker-game .sc-dial-pointer { top: -21px; width: 19px; height: 34px; }
  .safe-cracker-game .sc-dial-number { --radius: min(27.4vw, 105px); }
  .safe-cracker-game .sc-current-number { width: min(22vw, 84px); height: min(22vw, 84px); font-size: min(11vw, 2.65rem); }
  .safe-cracker-game .sc-step-controls button { width: 82px; height: 44px; }
}

@media (max-height: 720px) and (max-width: 700px) {
  .safe-cracker-game .sc-dial-number { --radius: min(22.9vw, 84px); }
  .safe-cracker-game .sc-current-number { width: 66px; height: 66px; font-size: 2rem; }
  .safe-cracker-game .sc-step-controls { margin-top: 5px; margin-bottom: 7px; }
  .safe-cracker-game .sc-step-controls button { width: 74px; height: 39px; font-size: 1.48rem; }
}
${cssEnd}`;

let css = await readFile(cssUrl, 'utf8');
const markerPattern = /\/\* SAFE_CRACKER_DIAL_DEPTH_V1_START \*\/[\s\S]*?\/\* SAFE_CRACKER_DIAL_DEPTH_V1_END \*\/\s*/m;
css = css.replace(markerPattern, '').trimEnd() + `\n\n${dialDepth}\n`;
await writeFile(cssUrl, css);

let html = await readFile(indexUrl, 'utf8');
html = html.replace(/\/assets\/safe-cracker\/safe-cracker\.css\?[^"'\s]*/g, value => {
  const clean = value.replace(/&dial=\d+/g, '');
  return `${clean}&dial=2`;
});
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker reference dial pass: silver layered rings, upright radial numerals, precision ticks, raised grip ribs, deep center knob, and reference-style step controls.');
