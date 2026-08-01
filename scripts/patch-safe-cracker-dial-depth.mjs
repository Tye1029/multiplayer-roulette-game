import { readFile, writeFile } from 'node:fs/promises';

const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const cssStart = '/* SAFE_CRACKER_DIAL_DEPTH_V1_START */';
const cssEnd = '/* SAFE_CRACKER_DIAL_DEPTH_V1_END */';

const dialDepth = String.raw`${cssStart}
.safe-cracker-game .sc-dial-wrap {
  isolation: isolate;
  filter:
    drop-shadow(0 8px 7px rgba(0,0,0,.34))
    drop-shadow(0 22px 20px rgba(0,0,0,.5));
}

.safe-cracker-game .sc-dial-wrap::before {
  inset: -19px;
  border: 1px solid rgba(200,210,213,.24);
  background:
    radial-gradient(circle at 36% 24%, rgba(255,255,255,.12), transparent 19%),
    radial-gradient(circle at 50% 49%, transparent 0 72%, rgba(181,192,196,.26) 73%, rgba(30,38,42,.78) 75%, transparent 77%),
    repeating-conic-gradient(from 1deg, rgba(255,255,255,.025) 0 .7deg, transparent .7deg 7deg),
    radial-gradient(circle, #101619 0 70%, #5d686d 71% 73%, #20292d 74% 82%, #080c0e 83% 100%);
  box-shadow:
    inset 0 0 0 5px rgba(4,7,8,.94),
    inset 0 11px 18px rgba(255,255,255,.045),
    inset 0 -19px 27px rgba(0,0,0,.78),
    0 0 0 2px rgba(117,129,133,.18),
    0 8px 0 rgba(6,9,10,.72),
    0 19px 25px rgba(0,0,0,.55);
}

.safe-cracker-game .sc-dial-wrap::after {
  top: -30px;
  width: 48px;
  height: 24px;
  border-radius: 3px 3px 1px 1px;
  background:
    linear-gradient(180deg, rgba(255,255,255,.2), transparent 35%),
    linear-gradient(90deg, #111719 0%, #6f7a7f 46%, #30393d 67%, #0b1012 100%);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.22),
    inset 0 -4px 5px rgba(0,0,0,.42),
    0 6px 9px rgba(0,0,0,.58);
}

.safe-cracker-game .sc-dial-pointer {
  top: -22px;
  z-index: 10;
  width: 19px;
  height: 34px;
  border: 0;
  border-radius: 0;
  clip-path: polygon(18% 0, 82% 0, 96% 18%, 66% 64%, 50% 100%, 34% 64%, 4% 18%);
  background:
    linear-gradient(90deg, #3b2812 0%, #9a6c2d 17%, #f2d48d 45%, #b67e31 61%, #4a3013 100%);
  box-shadow:
    inset 1px 1px 0 rgba(255,255,255,.48),
    inset -2px -3px 3px rgba(31,18,5,.55),
    0 5px 6px rgba(0,0,0,.68);
  filter:
    drop-shadow(0 2px 1px rgba(0,0,0,.9))
    drop-shadow(0 0 5px rgba(222,183,100,.18));
}

.safe-cracker-game .sc-dial {
  inset: 6px;
  filter:
    drop-shadow(0 5px 2px rgba(255,255,255,.035))
    drop-shadow(0 15px 13px rgba(0,0,0,.62));
}

.safe-cracker-game .sc-dial.dragging {
  transform: scale(.994) translateY(1px);
  filter: drop-shadow(0 9px 9px rgba(0,0,0,.67));
}

.safe-cracker-game .sc-dial-face {
  overflow: visible;
  border: 8px solid #070b0d;
  background:
    url('/assets/safe-cracker/textures/dial-machined.svg') center / cover no-repeat,
    radial-gradient(circle at 34% 24%, rgba(255,255,255,.2), transparent 16%),
    radial-gradient(circle at 67% 76%, rgba(0,0,0,.34), transparent 34%),
    radial-gradient(circle,
      #151c20 0 34%,
      #313b40 35% 41%,
      #8c989c 42% 45%,
      #3b454a 46% 51%,
      #070a0c 52% 79%,
      #e2e7e8 80% 81.5%,
      #a2adb1 82% 85.5%,
      #edf1f1 86% 87%,
      #111719 88% 100%);
  box-shadow:
    inset 0 0 0 2px rgba(226,233,234,.64),
    inset 0 0 0 7px rgba(50,59,63,.9),
    inset 0 13px 17px rgba(255,255,255,.045),
    inset 0 -24px 29px rgba(0,0,0,.66),
    inset 0 0 34px rgba(0,0,0,.7),
    0 0 0 2px rgba(195,205,208,.12),
    0 5px 0 #06090a,
    0 15px 18px rgba(0,0,0,.58);
}

.safe-cracker-game .sc-dial-face::before {
  content: '';
  position: absolute;
  inset: 1px;
  border-radius: 50%;
  pointer-events: none;
  background:
    repeating-linear-gradient(104deg, rgba(255,255,255,.075) 0 1px, transparent 1px 7px),
    repeating-linear-gradient(76deg, rgba(0,0,0,.2) 0 1px, transparent 1px 9px),
    repeating-conic-gradient(from -1deg,
      rgba(238,242,242,.92) 0deg .55deg,
      rgba(95,104,108,.8) .55deg 1.25deg,
      #171d20 1.25deg 29.5deg,
      #30383c 29.5deg 33.8deg,
      #080c0e 33.8deg 35.25deg,
      rgba(242,245,245,.94) 35.25deg 36deg);
  -webkit-mask: radial-gradient(circle, transparent 0 87%, #000 88% 98%, transparent 99% 100%);
  mask: radial-gradient(circle, transparent 0 87%, #000 88% 98%, transparent 99% 100%);
  opacity: .98;
  filter:
    drop-shadow(0 1px 0 rgba(255,255,255,.08))
    drop-shadow(0 3px 2px rgba(0,0,0,.78));
}

.safe-cracker-game .sc-dial-face::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  pointer-events: none;
  background:
    repeating-conic-gradient(from -1.6deg,
      rgba(226,233,235,.96) 0deg .62deg,
      rgba(93,103,108,.7) .62deg 1deg,
      transparent 1deg 3.6deg);
  -webkit-mask: radial-gradient(circle, transparent 0 67.5%, #000 68% 70.7%, transparent 71.2% 100%);
  mask: radial-gradient(circle, transparent 0 67.5%, #000 68% 70.7%, transparent 71.2% 100%);
  opacity: .88;
  filter: drop-shadow(0 1px 0 rgba(0,0,0,.86));
}

.safe-cracker-game .sc-dial-number {
  --radius: 112px;
  width: 32px;
  height: 32px;
  margin: -16px;
  color: #e7ecec;
  font-size: 1.03rem;
  text-shadow:
    0 2px 2px #000,
    0 -1px 0 rgba(255,255,255,.14);
}

.safe-cracker-game .sc-dial-number > span {
  width: 27px;
  height: 27px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  transition: color .13s ease, transform .13s ease, text-shadow .13s ease;
}

.safe-cracker-game .sc-dial-number.selected > span {
  color: #fff2bd;
  transform: scale(1.12) translateY(-1px);
  border: 0;
  background: transparent;
  box-shadow: none;
  text-shadow:
    0 2px 2px #000,
    0 0 7px rgba(247,214,139,.42);
}

.safe-cracker-game .sc-dial-hub {
  width: 40%;
  overflow: visible;
  border: 7px solid #0a0f11;
  background:
    radial-gradient(circle at 35% 25%, rgba(255,255,255,.28), transparent 18%),
    radial-gradient(circle at 50% 54%, #7f8a8f 0 10%, #4c585e 24%, #222c31 49%, #0d1214 74%);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.18),
    inset 0 -12px 15px rgba(0,0,0,.56),
    inset 0 0 16px rgba(0,0,0,.72),
    0 0 0 3px #aeb8bb,
    0 0 0 6px #384247,
    0 0 0 8px #0b1012,
    0 8px 0 #070a0c,
    0 15px 16px rgba(0,0,0,.62);
}

.safe-cracker-game .sc-dial-hub::before {
  content: '';
  position: absolute;
  inset: -47%;
  border-radius: 50%;
  pointer-events: none;
  background:
    repeating-conic-gradient(from -1deg,
      rgba(235,240,241,.92) 0deg .9deg,
      rgba(96,106,111,.72) .9deg 1.45deg,
      transparent 1.45deg 36deg),
    radial-gradient(circle,
      transparent 0 62%,
      rgba(222,228,230,.88) 63% 66%,
      #778287 67% 72%,
      #293237 73% 78%,
      transparent 79% 100%);
  -webkit-mask: radial-gradient(circle, transparent 0 61%, #000 62% 78%, transparent 79% 100%);
  mask: radial-gradient(circle, transparent 0 61%, #000 62% 78%, transparent 79% 100%);
  filter:
    drop-shadow(0 -1px 0 rgba(255,255,255,.12))
    drop-shadow(0 3px 2px rgba(0,0,0,.72));
}

.safe-cracker-game .sc-dial-hub::after {
  content: '';
  position: absolute;
  inset: 9%;
  border-radius: 50%;
  pointer-events: none;
  border-top: 1px solid rgba(255,255,255,.17);
  border-bottom: 1px solid rgba(0,0,0,.62);
  box-shadow:
    inset 0 7px 10px rgba(255,255,255,.025),
    inset 0 -10px 12px rgba(0,0,0,.26);
}

.safe-cracker-game .sc-current-number {
  width: 66px;
  height: 66px;
  border: 0;
  color: #fff0b6;
  background:
    radial-gradient(circle at 39% 27%, rgba(255,255,255,.075), transparent 26%),
    radial-gradient(circle, #131719 0 58%, #070a0b 76%);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.08),
    inset 0 -13px 17px rgba(0,0,0,.5),
    inset 0 0 13px rgba(0,0,0,.76);
}

@media (max-width: 700px) {
  .safe-cracker-game .sc-dial-wrap::before { inset: -14px; }
  .safe-cracker-game .sc-dial-wrap::after { top: -26px; width: 44px; height: 22px; }
  .safe-cracker-game .sc-dial-pointer { top: -19px; width: 17px; height: 31px; }
  .safe-cracker-game .sc-dial-number { --radius: min(28.2vw, 108px); }
}

@media (max-height: 720px) and (max-width: 700px) {
  .safe-cracker-game .sc-dial-number { --radius: min(23.3vw, 86px); }
  .safe-cracker-game .sc-current-number { width: 57px; height: 57px; font-size: 1.72rem; }
}
${cssEnd}`;

let css = await readFile(cssUrl, 'utf8');
const markerPattern = /\/\* SAFE_CRACKER_DIAL_DEPTH_V1_START \*\/[\s\S]*?\/\* SAFE_CRACKER_DIAL_DEPTH_V1_END \*\/\s*/m;
css = css.replace(markerPattern, '').trimEnd() + `\n\n${dialDepth}\n`;
await writeFile(cssUrl, css);

console.log('Applied Safe Cracker dial depth pass: raised grip ring, brushed silver number trim, shortened metal ticks, and sharper index pointer.');
