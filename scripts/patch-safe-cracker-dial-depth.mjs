import { readFile, writeFile } from 'node:fs/promises';

const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const cssStart = '/* SAFE_CRACKER_DIAL_DEPTH_V1_START */';
const cssEnd = '/* SAFE_CRACKER_DIAL_DEPTH_V1_END */';

const dialDepth = String.raw`${cssStart}
.safe-cracker-game .sc-dial-wrap {
  isolation: isolate;
  transform: translateY(-3px);
  filter:
    drop-shadow(0 7px 3px rgba(255,255,255,.035))
    drop-shadow(0 14px 7px rgba(0,0,0,.62))
    drop-shadow(0 30px 24px rgba(0,0,0,.64));
}

.safe-cracker-game .sc-dial-wrap::before {
  inset: -29px;
  border: 2px solid rgba(171,182,187,.26);
  background:
    radial-gradient(circle at 35% 23%, rgba(255,255,255,.12), transparent 19%),
    radial-gradient(circle,
      transparent 0 68%,
      rgba(1,3,4,.98) 69% 73%,
      #4c565b 74% 75.5%,
      #161d20 76% 83%,
      #070a0c 84% 100%);
  box-shadow:
    inset 0 0 0 7px rgba(2,4,5,.97),
    inset 0 15px 23px rgba(255,255,255,.035),
    inset 0 -31px 38px rgba(0,0,0,.9),
    0 0 0 3px rgba(109,120,125,.15),
    0 9px 0 #040607,
    0 23px 30px rgba(0,0,0,.68);
}

.safe-cracker-game .sc-dial-wrap::after {
  top: -48px;
  width: 82px;
  height: 39px;
  border: 3px solid #070a0c;
  border-radius: 7px 7px 3px 3px;
  background:
    linear-gradient(180deg, rgba(255,255,255,.24), transparent 31%),
    linear-gradient(90deg, #111719 0%, #505b60 18%, #c4cdd0 48%, #626d72 72%, #12181b 100%);
  box-shadow:
    inset 0 2px 0 rgba(255,255,255,.28),
    inset 0 -7px 9px rgba(0,0,0,.62),
    0 6px 0 #040607,
    0 14px 16px rgba(0,0,0,.72);
}

.safe-cracker-game .sc-dial-pointer {
  top: -42px;
  z-index: 14;
  width: 29px;
  height: 57px;
  border: 0;
  border-radius: 0;
  clip-path: polygon(10% 0, 90% 0, 100% 15%, 64% 74%, 50% 100%, 36% 74%, 0 15%);
  background:
    linear-gradient(90deg,
      #111719 0%,
      #515c61 16%,
      #dce4e6 42%,
      #f4f7f8 50%,
      #929da1 65%,
      #343d41 82%,
      #0a0e10 100%);
  box-shadow:
    inset 2px 2px 0 rgba(255,255,255,.55),
    inset -3px -6px 6px rgba(0,0,0,.65),
    0 6px 0 #050708,
    0 13px 13px rgba(0,0,0,.72);
  filter:
    drop-shadow(0 2px 1px rgba(0,0,0,.95))
    drop-shadow(0 0 7px rgba(221,232,235,.14));
}

.safe-cracker-game .sc-dial {
  inset: -7px;
  transform: translateY(-2px) scale(1.035);
  filter:
    drop-shadow(0 5px 2px rgba(255,255,255,.04))
    drop-shadow(0 12px 7px rgba(0,0,0,.62))
    drop-shadow(0 24px 21px rgba(0,0,0,.7));
}

.safe-cracker-game .sc-dial.dragging {
  transform: translateY(1px) scale(1.018);
  filter:
    drop-shadow(0 7px 4px rgba(0,0,0,.68))
    drop-shadow(0 15px 13px rgba(0,0,0,.72));
}

.safe-cracker-game .sc-dial-face {
  overflow: visible;
  border: 0;
  background:
    url('/assets/safe-cracker/textures/dial-reference-face.svg') center / 100% 100% no-repeat;
  box-shadow:
    inset 0 0 0 2px rgba(232,238,240,.16),
    inset 0 17px 22px rgba(255,255,255,.035),
    inset 0 -31px 38px rgba(0,0,0,.48),
    0 0 0 3px #050708,
    0 7px 0 #020405,
    0 19px 22px rgba(0,0,0,.72);
}

.safe-cracker-game .sc-dial-face::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 2;
  border-radius: 50%;
  pointer-events: none;
  background:
    radial-gradient(ellipse at 34% 20%, rgba(255,255,255,.15), transparent 22%),
    radial-gradient(circle at 50% 50%, transparent 0 82%, rgba(255,255,255,.04) 83%, transparent 87%),
    linear-gradient(151deg, rgba(255,255,255,.045), transparent 25% 72%, rgba(0,0,0,.17));
  box-shadow:
    inset 0 3px 4px rgba(255,255,255,.05),
    inset 0 -10px 15px rgba(0,0,0,.36);
}

.safe-cracker-game .sc-dial-face::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 3;
  border-radius: 50%;
  pointer-events: none;
  background:
    repeating-conic-gradient(from -1.8deg,
      rgba(235,240,242,.98) 0deg .54deg,
      rgba(92,103,108,.88) .54deg .82deg,
      transparent .82deg 3.6deg);
  -webkit-mask: radial-gradient(circle, transparent 0 73.8%, #000 74.4% 78.4%, transparent 79% 100%);
  mask: radial-gradient(circle, transparent 0 73.8%, #000 74.4% 78.4%, transparent 79% 100%);
  filter:
    drop-shadow(0 -1px 0 rgba(255,255,255,.12))
    drop-shadow(0 2px 1px rgba(0,0,0,.9));
}

.safe-cracker-game .sc-dial-number {
  --radius: 112px;
  z-index: 5;
  width: 36px;
  height: 40px;
  margin: -20px -18px;
  color: #e3eaec;
  font-size: 1.32rem;
  font-weight: 800;
  letter-spacing: -.04em;
  text-shadow:
    0 3px 4px #000,
    0 -1px 0 rgba(255,255,255,.25),
    0 0 6px rgba(210,223,227,.1);
}

.safe-cracker-game .sc-dial-number > span {
  width: 34px;
  height: 40px;
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
  color: #f8fbfc;
  text-shadow:
    0 3px 4px #000,
    0 -1px 0 rgba(255,255,255,.42),
    0 0 10px rgba(225,235,238,.32);
}

.safe-cracker-game .sc-dial-number.selected > span {
  color: inherit;
  transform: scale(1.1) translateY(-1px);
  border: 0;
  background: transparent;
  box-shadow: none;
}

.safe-cracker-game .sc-dial-hub {
  z-index: 7;
  width: 39%;
  overflow: visible;
  border: 8px solid #070a0c;
  background:
    radial-gradient(ellipse at 35% 23%, rgba(255,255,255,.28), transparent 19%),
    radial-gradient(circle at 50% 55%,
      #363f43 0 8%,
      #151a1d 24%,
      #07090b 62%,
      #1d2427 80%,
      #050708 100%);
  box-shadow:
    inset 0 2px 0 rgba(255,255,255,.2),
    inset 0 -17px 22px rgba(0,0,0,.7),
    inset 0 0 22px rgba(0,0,0,.82),
    0 0 0 3px #d6dee0,
    0 0 0 7px #778287,
    0 0 0 10px #171d20,
    0 0 0 14px #bcc6c9,
    0 0 0 18px #343e42,
    0 8px 0 #040607,
    0 20px 21px rgba(0,0,0,.75);
}

.safe-cracker-game .sc-dial-hub::before {
  content: '';
  position: absolute;
  inset: -23%;
  z-index: -1;
  border-radius: 50%;
  pointer-events: none;
  border: 3px solid rgba(188,199,202,.82);
  background:
    radial-gradient(circle,
      transparent 0 65%,
      rgba(224,231,233,.78) 66% 68%,
      #4f5a5f 69% 73%,
      #151b1e 74% 100%);
  box-shadow:
    inset 0 3px 4px rgba(255,255,255,.12),
    inset 0 -8px 11px rgba(0,0,0,.58),
    0 5px 4px rgba(0,0,0,.72);
}

.safe-cracker-game .sc-dial-hub::after {
  content: '';
  position: absolute;
  inset: 7%;
  border-radius: 50%;
  pointer-events: none;
  background:
    radial-gradient(ellipse at 35% 22%, rgba(255,255,255,.16), transparent 31%),
    linear-gradient(180deg, rgba(255,255,255,.035), transparent 44%);
  border-top: 1px solid rgba(255,255,255,.2);
  border-bottom: 1px solid rgba(0,0,0,.74);
  box-shadow:
    inset 0 9px 12px rgba(255,255,255,.025),
    inset 0 -14px 17px rgba(0,0,0,.38);
}

.safe-cracker-game .sc-current-number {
  z-index: 10;
  width: 88px;
  height: 88px;
  border: 0;
  color: #f0f5f6;
  background:
    radial-gradient(ellipse at 36% 23%, rgba(255,255,255,.16), transparent 28%),
    radial-gradient(circle, #171c1f 0 42%, #050708 76%);
  box-shadow:
    inset 0 2px 0 rgba(255,255,255,.12),
    inset 0 -19px 24px rgba(0,0,0,.64),
    inset 0 0 20px rgba(0,0,0,.86);
  font-size: 2.8rem;
  font-weight: 800;
  text-shadow:
    0 4px 5px #000,
    0 -1px 0 rgba(255,255,255,.32),
    0 0 13px rgba(222,234,238,.2);
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
  .safe-cracker-game .sc-dial-wrap { transform: translateY(-2px); }
  .safe-cracker-game .sc-dial-wrap::before { inset: -20px; }
  .safe-cracker-game .sc-dial-wrap::after { top: -39px; width: 70px; height: 33px; }
  .safe-cracker-game .sc-dial-pointer { top: -34px; width: 24px; height: 48px; }
  .safe-cracker-game .sc-dial { inset: -4px; transform: translateY(-1px) scale(1.025); }
  .safe-cracker-game .sc-dial.dragging { transform: translateY(1px) scale(1.01); }
  .safe-cracker-game .sc-dial-number { --radius: min(29.2vw, 112px); font-size: min(5.4vw, 1.32rem); }
  .safe-cracker-game .sc-current-number { width: min(23vw, 88px); height: min(23vw, 88px); font-size: min(11.7vw, 2.8rem); }
  .safe-cracker-game .sc-step-controls { gap: 17px; margin-top: 13px; }
  .safe-cracker-game .sc-step-controls button { width: min(28vw, 104px); height: 52px; font-size: 1.9rem; }
}

@media (max-height: 720px) and (max-width: 700px) {
  .safe-cracker-game .sc-dial-wrap::before { inset: -15px; }
  .safe-cracker-game .sc-dial-wrap::after { top: -31px; width: 60px; height: 28px; }
  .safe-cracker-game .sc-dial-pointer { top: -27px; width: 21px; height: 40px; }
  .safe-cracker-game .sc-dial { inset: -2px; transform: scale(1.012); }
  .safe-cracker-game .sc-dial-number { --radius: min(24.2vw, 89px); font-size: min(4.8vw, 1.08rem); }
  .safe-cracker-game .sc-current-number { width: 68px; height: 68px; font-size: 2.08rem; }
  .safe-cracker-game .sc-step-controls { gap: 14px; margin: 7px 0 8px; }
  .safe-cracker-game .sc-step-controls button { width: 78px; height: 41px; font-size: 1.55rem; }
}
${cssEnd}`;

let css = await readFile(cssUrl, 'utf8');
const markerPattern = /\/\* SAFE_CRACKER_DIAL_DEPTH_V1_START \*\/[\s\S]*?\/\* SAFE_CRACKER_DIAL_DEPTH_V1_END \*\/\s*/m;
css = css.replace(markerPattern, '').trimEnd() + `\n\n${dialDepth}\n`;
await writeFile(cssUrl, css);

let html = await readFile(indexUrl, 'utf8');
html = html.replace(/\/assets\/safe-cracker\/safe-cracker\.css\?[^"'\s]*/g, value => {
  const clean = value.replace(/&dial=\d+/g, '');
  return `${clean}&dial=3`;
});
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker reference dial rebuild: separate recessed cavity, tactile ribbed grip, thick brushed silver bezel, black numeral band, precision silver ticks, sloped segmented inner plate, convex center knob, raised pointer, and large reference-style step controls.');
