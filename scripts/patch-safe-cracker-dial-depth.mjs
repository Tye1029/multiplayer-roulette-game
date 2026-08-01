import { readFile, writeFile } from 'node:fs/promises';

const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const cssStart = '/* SAFE_CRACKER_DIAL_DEPTH_V2_START */';
const cssEnd = '/* SAFE_CRACKER_DIAL_DEPTH_V2_END */';

const dialDepth = String.raw`${cssStart}
.safe-cracker-game .sc-dial-wrap {
  isolation: isolate;
  transform: translateY(-5px);
  filter:
    drop-shadow(0 4px 2px rgba(255,255,255,.025))
    drop-shadow(0 13px 7px rgba(0,0,0,.7))
    drop-shadow(0 31px 27px rgba(0,0,0,.74));
}

.safe-cracker-game .sc-dial-wrap::before {
  inset: -34px;
  border: 2px solid rgba(141,151,156,.2);
  pointer-events: none;
  background:
    radial-gradient(circle,
      transparent 0 67%,
      #030506 68% 73%,
      #20282c 74% 75.5%,
      #070a0c 76% 100%);
  box-shadow:
    inset 0 0 0 8px #020405,
    inset 0 14px 18px rgba(255,255,255,.028),
    inset 0 -34px 40px rgba(0,0,0,.94),
    0 0 0 4px rgba(5,8,9,.92),
    0 10px 0 #020304,
    0 28px 32px rgba(0,0,0,.72);
}

.safe-cracker-game .sc-dial-wrap::after {
  top: -69px;
  z-index: 10;
  width: 88px;
  height: 34px;
  border: 3px solid #050708;
  border-radius: 8px 8px 3px 3px;
  pointer-events: none;
  background:
    linear-gradient(180deg, rgba(255,255,255,.16), transparent 31%),
    linear-gradient(90deg,
      #0b0e10 0%,
      #373f43 20%,
      #828c90 48%,
      #3c4549 74%,
      #0a0d0f 100%);
  box-shadow:
    inset 0 2px 0 rgba(255,255,255,.24),
    inset 0 -8px 10px rgba(0,0,0,.72),
    0 7px 0 #020304,
    0 16px 18px rgba(0,0,0,.75);
}

.safe-cracker-game .sc-dial-pointer {
  top: -58px;
  z-index: 14;
  width: 32px;
  height: 53px;
  border: 0;
  border-radius: 0;
  pointer-events: none;
  clip-path: polygon(12% 0, 88% 0, 100% 12%, 68% 71%, 50% 100%, 32% 71%, 0 12%);
  background:
    linear-gradient(90deg,
      #4a2d0d 0%,
      #a76a21 18%,
      #efc56d 42%,
      #c98c31 56%,
      #7d4a15 78%,
      #2d1908 100%);
  box-shadow:
    inset 2px 1px 0 rgba(255,244,205,.35),
    inset -3px -6px 6px rgba(63,29,4,.62),
    0 6px 0 #170d04,
    0 14px 15px rgba(0,0,0,.78);
  filter: drop-shadow(0 2px 1px rgba(0,0,0,.95));
}

.safe-cracker-game .sc-dial {
  inset: -9px;
  transform: translateY(-5px) scale(1.045);
  filter:
    drop-shadow(0 3px 1px rgba(255,255,255,.025))
    drop-shadow(0 12px 6px rgba(0,0,0,.72))
    drop-shadow(0 28px 23px rgba(0,0,0,.78));
}

.safe-cracker-game .sc-dial.dragging {
  transform: translateY(0) scale(1.025);
  filter:
    drop-shadow(0 8px 4px rgba(0,0,0,.72))
    drop-shadow(0 18px 15px rgba(0,0,0,.76));
}

.safe-cracker-game .sc-dial-face {
  overflow: visible;
  border: 0;
  background:
    url('/assets/safe-cracker/textures/dial-reference-face.svg') center / 100% 100% no-repeat;
  box-shadow:
    inset 0 0 0 2px rgba(229,235,237,.12),
    inset 0 -28px 35px rgba(0,0,0,.34),
    0 0 0 3px #020304,
    0 9px 0 #010202,
    0 24px 25px rgba(0,0,0,.78);
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
      transparent 0 2px,
      rgba(255,255,255,.012) 2px 3px,
      transparent 3px 5px),
    radial-gradient(circle,
      transparent 0 80%,
      rgba(0,0,0,.14) 92%,
      rgba(0,0,0,.38) 100%);
  opacity: .72;
}

.safe-cracker-game .sc-dial-face::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 3;
  border-radius: 50%;
  pointer-events: none;
  background:
    radial-gradient(circle,
      transparent 0 62%,
      rgba(255,255,255,.018) 63%,
      transparent 64% 92%,
      rgba(0,0,0,.24) 100%);
  box-shadow:
    inset 0 3px 2px rgba(255,255,255,.035),
    inset 0 -14px 17px rgba(0,0,0,.26);
}

.safe-cracker-game .sc-dial-number {
  --radius: 108px;
  z-index: 5;
  width: 38px;
  height: 42px;
  margin: -21px -19px;
  color: #d8b36c;
  font-family: "Arial Narrow", "Roboto Condensed", "Franklin Gothic Medium", Impact, sans-serif;
  font-size: 1.42rem;
  font-weight: 700;
  font-stretch: condensed;
  letter-spacing: -.055em;
  text-shadow:
    0 3px 3px #000,
    0 -1px 0 rgba(255,238,195,.24);
}

.safe-cracker-game .sc-dial-number > span {
  width: 36px;
  height: 42px;
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
  color: #f0cd83;
  text-shadow:
    0 3px 3px #000,
    0 -1px 0 rgba(255,243,208,.34);
}

.safe-cracker-game .sc-dial-number.selected > span {
  color: inherit;
  transform: scale(1.075) translateY(-1px);
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.safe-cracker-game .sc-dial-hub {
  z-index: 7;
  width: 40%;
  overflow: visible;
  border: 8px solid #050708;
  background:
    radial-gradient(circle at 42% 36%,
      #292f32 0 17%,
      #0e1214 43%,
      #030506 78%,
      #141a1d 100%);
  box-shadow:
    inset 0 3px 2px rgba(255,255,255,.11),
    inset 0 -19px 25px rgba(0,0,0,.78),
    inset 0 0 25px rgba(0,0,0,.9),
    0 0 0 3px #dce2e4,
    0 0 0 7px #687378,
    0 0 0 11px #121719,
    0 0 0 15px #b9c2c5,
    0 0 0 19px #313a3e,
    0 9px 0 #020304,
    0 23px 24px rgba(0,0,0,.8);
}

.safe-cracker-game .sc-dial-hub::before {
  content: '';
  position: absolute;
  inset: -24%;
  z-index: -1;
  border-radius: 50%;
  border: 2px solid rgba(194,203,206,.64);
  pointer-events: none;
  background:
    radial-gradient(circle,
      transparent 0 64%,
      rgba(221,228,230,.72) 65% 67%,
      #596469 68% 72%,
      #141a1d 73% 100%);
  box-shadow:
    inset 0 3px 3px rgba(255,255,255,.09),
    inset 0 -10px 13px rgba(0,0,0,.7),
    0 7px 6px rgba(0,0,0,.78);
}

.safe-cracker-game .sc-dial-hub::after {
  content: '';
  position: absolute;
  inset: 8%;
  border-radius: 50%;
  pointer-events: none;
  background:
    radial-gradient(circle,
      transparent 0 56%,
      rgba(255,255,255,.025) 70%,
      transparent 72%);
  border-top: 1px solid rgba(255,255,255,.14);
  border-bottom: 1px solid rgba(0,0,0,.85);
  box-shadow:
    inset 0 -16px 18px rgba(0,0,0,.42);
}

.safe-cracker-game .sc-current-number {
  z-index: 10;
  width: 92px;
  height: 92px;
  border: 0;
  color: #e2bd70;
  background:
    radial-gradient(circle,
      #111517 0 44%,
      #030405 78%);
  box-shadow:
    inset 0 2px 0 rgba(255,255,255,.09),
    inset 0 -20px 26px rgba(0,0,0,.72),
    inset 0 0 22px rgba(0,0,0,.9);
  font-family: "Arial Narrow", "Roboto Condensed", "Franklin Gothic Medium", Impact, sans-serif;
  font-size: 3rem;
  font-weight: 700;
  font-stretch: condensed;
  letter-spacing: -.055em;
  text-shadow:
    0 4px 4px #000,
    0 -1px 0 rgba(255,236,188,.26);
}

.safe-cracker-game .sc-step-controls {
  gap: 22px;
  margin: 17px 0 11px;
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
  .safe-cracker-game .sc-dial-wrap { transform: translateY(-3px); }
  .safe-cracker-game .sc-dial-wrap::before { inset: -23px; }
  .safe-cracker-game .sc-dial-wrap::after { top: -48px; width: 72px; height: 30px; }
  .safe-cracker-game .sc-dial-pointer { top: -41px; width: 26px; height: 43px; }
  .safe-cracker-game .sc-dial { inset: -5px; transform: translateY(-3px) scale(1.032); }
  .safe-cracker-game .sc-dial.dragging { transform: translateY(0) scale(1.016); }
  .safe-cracker-game .sc-dial-number {
    --radius: min(28.4vw, 108px);
    font-size: min(5.7vw, 1.42rem);
  }
  .safe-cracker-game .sc-current-number {
    width: min(24vw, 92px);
    height: min(24vw, 92px);
    font-size: min(12.4vw, 3rem);
  }
  .safe-cracker-game .sc-step-controls { gap: 17px; margin-top: 13px; }
  .safe-cracker-game .sc-step-controls button { width: min(28vw, 104px); height: 52px; font-size: 1.9rem; }
}

@media (max-height: 720px) and (max-width: 700px) {
  .safe-cracker-game .sc-dial-wrap::before { inset: -17px; }
  .safe-cracker-game .sc-dial-wrap::after { top: -37px; width: 62px; height: 27px; }
  .safe-cracker-game .sc-dial-pointer { top: -31px; width: 22px; height: 34px; }
  .safe-cracker-game .sc-dial { inset: -3px; transform: translateY(-1px) scale(1.018); }
  .safe-cracker-game .sc-dial-number {
    --radius: min(23.5vw, 86px);
    font-size: min(5vw, 1.12rem);
  }
  .safe-cracker-game .sc-current-number { width: 70px; height: 70px; font-size: 2.25rem; }
  .safe-cracker-game .sc-step-controls { gap: 14px; margin: 7px 0 8px; }
  .safe-cracker-game .sc-step-controls button { width: 78px; height: 41px; font-size: 1.55rem; }
}
${cssEnd}`;

let css = await readFile(cssUrl, 'utf8');
const markerPattern = /\/\* SAFE_CRACKER_DIAL_DEPTH_V\d+_START \*\/[\s\S]*?\/\* SAFE_CRACKER_DIAL_DEPTH_V\d+_END \*\/\s*/gm;
css = css.replace(markerPattern, '').trimEnd() + `\n\n${dialDepth}\n`;
await writeFile(cssUrl, css);

let html = await readFile(indexUrl, 'utf8');
html = html.replace(/\/assets\/safe-cracker\/safe-cracker\.css\?[^"'\\s]*/g, value => {
  const clean = value.replace(/&dial=\d+/g, '');
  return `${clean}&dial=4`;
});
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker reference dial depth v2: deeper protruding wheel, raised scratched grip blocks, thick brushed-silver bezel, black numeral band with short silver ticks, compact raised inner spokes, dimensional hub, and elevated faceted pointer.');
