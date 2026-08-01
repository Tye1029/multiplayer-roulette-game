import { readFile, writeFile } from 'node:fs/promises';

const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const cssStart = '/* SAFE_CRACKER_DIAL_DEPTH_V3_START */';
const cssEnd = '/* SAFE_CRACKER_DIAL_DEPTH_V3_END */';

const dialDepth = String.raw`${cssStart}
.safe-cracker-game .sc-dial-wrap {
  isolation: isolate;
  transform: translateY(-5px);
  filter:
    drop-shadow(0 5px 2px rgba(255,255,255,.025))
    drop-shadow(0 14px 7px rgba(0,0,0,.74))
    drop-shadow(0 33px 28px rgba(0,0,0,.78));
}

.safe-cracker-game .sc-dial-wrap::before {
  inset: -35px;
  border: 2px solid rgba(139,149,154,.18);
  pointer-events: none;
  background:
    radial-gradient(circle,
      transparent 0 66%,
      #020405 67% 72%,
      #273034 73% 74.5%,
      #080b0d 75.5% 100%);
  box-shadow:
    inset 0 0 0 8px #020304,
    inset 0 15px 20px rgba(255,255,255,.025),
    inset 0 -38px 44px rgba(0,0,0,.96),
    0 0 0 4px rgba(4,7,8,.94),
    0 11px 0 #010202,
    0 29px 34px rgba(0,0,0,.76);
}

.safe-cracker-game .sc-dial-wrap::after {
  top: -67px;
  z-index: 10;
  width: 88px;
  height: 38px;
  border: 3px solid #050708;
  border-radius: 9px 9px 4px 4px;
  pointer-events: none;
  background:
    linear-gradient(180deg, rgba(255,255,255,.17), transparent 28%),
    linear-gradient(90deg,
      #090c0e 0%,
      #343c40 20%,
      #8b9599 48%,
      #3a4347 74%,
      #080b0d 100%);
  box-shadow:
    inset 0 2px 0 rgba(255,255,255,.24),
    inset 0 -9px 11px rgba(0,0,0,.76),
    0 7px 0 #020304,
    0 16px 18px rgba(0,0,0,.78);
}

.safe-cracker-game .sc-dial-pointer {
  top: -54px;
  z-index: 14;
  width: 31px;
  height: 57px;
  border: 0;
  border-radius: 0;
  pointer-events: none;
  clip-path: polygon(11% 0, 89% 0, 100% 12%, 67% 70%, 50% 100%, 33% 70%, 0 12%);
  background:
    linear-gradient(90deg,
      #3e2409 0%,
      #9e621d 18%,
      #f2ce79 43%,
      #c88a2e 57%,
      #70400f 79%,
      #241305 100%);
  box-shadow:
    inset 2px 1px 0 rgba(255,245,211,.4),
    inset -3px -7px 7px rgba(52,23,3,.68),
    0 6px 0 #140b03,
    0 15px 16px rgba(0,0,0,.8);
  filter: drop-shadow(0 2px 1px rgba(0,0,0,.95));
}

.safe-cracker-game .sc-dial {
  inset: -7px;
  transform: translateY(-6px) scale(1.04);
  filter:
    drop-shadow(0 3px 1px rgba(255,255,255,.025))
    drop-shadow(0 13px 6px rgba(0,0,0,.76))
    drop-shadow(0 29px 24px rgba(0,0,0,.82));
}

.safe-cracker-game .sc-dial.dragging {
  transform: translateY(-1px) scale(1.022);
  filter:
    drop-shadow(0 8px 4px rgba(0,0,0,.74))
    drop-shadow(0 19px 16px rgba(0,0,0,.78));
}

.safe-cracker-game .sc-dial-face {
  overflow: visible;
  border: 0;
  background:
    url('/assets/safe-cracker/textures/dial-reference-face-v5.svg?dial=5') center / 100% 100% no-repeat,
    radial-gradient(circle, #111619 0 31%, #050708 32% 69%, #171d20 70% 100%);
  box-shadow:
    inset 0 0 0 2px rgba(232,237,239,.11),
    inset 0 -30px 37px rgba(0,0,0,.34),
    0 0 0 3px #020304,
    0 10px 0 #010202,
    0 25px 27px rgba(0,0,0,.8);
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
      rgba(255,255,255,.01) 2px 2.7px,
      transparent 2.7px 4.8px),
    radial-gradient(circle,
      transparent 0 78%,
      rgba(0,0,0,.13) 91%,
      rgba(0,0,0,.4) 100%);
  opacity: .62;
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
      transparent 0 63%,
      rgba(255,255,255,.018) 64%,
      transparent 65% 93%,
      rgba(0,0,0,.23) 100%);
  box-shadow:
    inset 0 3px 2px rgba(255,255,255,.03),
    inset 0 -15px 18px rgba(0,0,0,.27);
}

.safe-cracker-game .sc-dial-number {
  --radius: 109px;
  z-index: 5;
  width: 38px;
  height: 43px;
  margin: -21.5px -19px;
  color: #d9ad5d;
  font-family: "Roboto Condensed", "Arial Narrow", "Helvetica Neue Condensed", "Liberation Sans Narrow", sans-serif;
  font-size: 1.48rem;
  font-weight: 600;
  letter-spacing: -.045em;
  text-shadow:
    0 3px 3px #000,
    0 -1px 0 rgba(255,239,199,.25);
}

.safe-cracker-game .sc-dial-number > span {
  width: 36px;
  height: 43px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 0;
  color: inherit;
  background: transparent;
  box-shadow: none;
  transform: scaleX(.82);
  transform-origin: center;
  transition: color .13s ease, transform .13s ease, text-shadow .13s ease;
}

.safe-cracker-game .sc-dial-number.selected {
  color: #edc876;
  text-shadow:
    0 3px 3px #000,
    0 -1px 0 rgba(255,244,213,.34);
}

.safe-cracker-game .sc-dial-number.selected > span {
  color: inherit;
  transform: scaleX(.82) scale(1.055) translateY(-1px);
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.safe-cracker-game .sc-dial-hub {
  z-index: 7;
  width: 37%;
  overflow: visible;
  border: 7px solid #040607;
  background:
    radial-gradient(circle at 39% 31%,
      #23292c 0 12%,
      #0d1113 39%,
      #020304 78%,
      #111719 100%);
  box-shadow:
    inset 0 3px 2px rgba(255,255,255,.1),
    inset 0 -19px 25px rgba(0,0,0,.8),
    inset 0 0 25px rgba(0,0,0,.92),
    0 0 0 2px #b27b31,
    0 0 0 5px #2a1b08,
    0 0 0 8px #d9dfe1,
    0 0 0 12px #687378,
    0 0 0 16px #161c1f,
    0 8px 0 #020304,
    0 22px 24px rgba(0,0,0,.82);
}

.safe-cracker-game .sc-dial-hub::before {
  content: '';
  position: absolute;
  inset: -22%;
  z-index: -1;
  border-radius: 50%;
  border: 2px solid rgba(194,203,206,.62);
  pointer-events: none;
  background:
    radial-gradient(circle,
      transparent 0 65%,
      rgba(222,229,231,.68) 66% 68%,
      #596469 69% 73%,
      #121719 74% 100%);
  box-shadow:
    inset 0 3px 3px rgba(255,255,255,.08),
    inset 0 -10px 13px rgba(0,0,0,.72),
    0 7px 6px rgba(0,0,0,.8);
}

.safe-cracker-game .sc-dial-hub::after {
  content: '';
  position: absolute;
  inset: 8%;
  border-radius: 50%;
  pointer-events: none;
  background:
    radial-gradient(circle at 38% 28%, rgba(255,255,255,.06), transparent 30%),
    radial-gradient(circle, transparent 0 58%, rgba(255,255,255,.022) 70%, transparent 72%);
  border-top: 1px solid rgba(255,255,255,.13);
  border-bottom: 1px solid rgba(0,0,0,.88);
  box-shadow: inset 0 -16px 18px rgba(0,0,0,.44);
}

.safe-cracker-game .sc-current-number {
  z-index: 10;
  width: 84px;
  height: 84px;
  border: 0;
  color: #e1b867;
  background:
    radial-gradient(circle at 38% 26%, rgba(255,255,255,.045), transparent 28%),
    radial-gradient(circle, #101416 0 43%, #020304 79%);
  box-shadow:
    inset 0 2px 0 rgba(255,255,255,.075),
    inset 0 -20px 26px rgba(0,0,0,.75),
    inset 0 0 22px rgba(0,0,0,.92);
  font-family: "Roboto Condensed", "Arial Narrow", "Helvetica Neue Condensed", "Liberation Sans Narrow", sans-serif;
  font-size: 2.9rem;
  font-weight: 600;
  letter-spacing: -.045em;
  text-shadow:
    0 4px 4px #000,
    0 -1px 0 rgba(255,237,194,.25);
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
  .safe-cracker-game .sc-dial-wrap::before { inset: -24px; }
  .safe-cracker-game .sc-dial-wrap::after { top: -49px; width: 72px; height: 31px; }
  .safe-cracker-game .sc-dial-pointer { top: -40px; width: 25px; height: 45px; }
  .safe-cracker-game .sc-dial { inset: -5px; transform: translateY(-4px) scale(1.032); }
  .safe-cracker-game .sc-dial.dragging { transform: translateY(0) scale(1.016); }
  .safe-cracker-game .sc-dial-number {
    --radius: min(28.7vw, 109px);
    font-size: min(5.8vw, 1.48rem);
  }
  .safe-cracker-game .sc-current-number {
    width: min(22vw, 84px);
    height: min(22vw, 84px);
    font-size: min(12vw, 2.9rem);
  }
  .safe-cracker-game .sc-step-controls { gap: 17px; margin-top: 13px; }
  .safe-cracker-game .sc-step-controls button { width: min(28vw, 104px); height: 52px; font-size: 1.9rem; }
}

@media (max-height: 720px) and (max-width: 700px) {
  .safe-cracker-game .sc-dial-wrap::before { inset: -18px; }
  .safe-cracker-game .sc-dial-wrap::after { top: -38px; width: 62px; height: 27px; }
  .safe-cracker-game .sc-dial-pointer { top: -30px; width: 21px; height: 36px; }
  .safe-cracker-game .sc-dial { inset: -3px; transform: translateY(-2px) scale(1.018); }
  .safe-cracker-game .sc-dial-number {
    --radius: min(23.8vw, 87px);
    font-size: min(5vw, 1.14rem);
  }
  .safe-cracker-game .sc-current-number { width: 66px; height: 66px; font-size: 2.18rem; }
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
  return `${clean}&dial=5`;
});
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker reference dial depth v3: cache-busted tactile grip ring, thick brushed-silver bezel, clean black numeral band, short silver ticks and inner spokes, reduced layered center hub, and elevated faceted pointer.');