import { readFile, writeFile } from 'node:fs/promises';

const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const cssStart = '/* SAFE_CRACKER_DIAL_DEPTH_V4_START */';
const cssEnd = '/* SAFE_CRACKER_DIAL_DEPTH_V4_END */';

const dialDepth = String.raw`${cssStart}
.safe-cracker-game .sc-dial-wrap {
  isolation: isolate;
  transform: translateY(-8px);
  filter:
    drop-shadow(0 5px 2px rgba(255,255,255,.025))
    drop-shadow(0 16px 8px rgba(0,0,0,.78))
    drop-shadow(0 36px 30px rgba(0,0,0,.84));
}

.safe-cracker-game .sc-dial-wrap::before {
  inset: -37px;
  border: 2px solid rgba(143,153,158,.18);
  pointer-events: none;
  background:
    radial-gradient(circle,
      transparent 0 64%,
      #010203 65% 70%,
      #313a3e 71% 72.5%,
      #0c1012 73.5% 86%,
      #030405 87% 100%);
  box-shadow:
    inset 0 0 0 9px #010203,
    inset 0 17px 22px rgba(255,255,255,.026),
    inset 0 -42px 48px rgba(0,0,0,.97),
    0 0 0 5px rgba(3,5,6,.96),
    0 12px 0 #010202,
    0 32px 37px rgba(0,0,0,.8);
}

.safe-cracker-game .sc-dial-wrap::after {
  top: -82px;
  z-index: 10;
  width: 92px;
  height: 42px;
  border: 3px solid #040607;
  border-radius: 8px 8px 3px 3px;
  pointer-events: none;
  background:
    linear-gradient(180deg, rgba(255,255,255,.18), transparent 27%),
    linear-gradient(90deg,
      #070a0c 0%,
      #323a3e 18%,
      #8f999d 47%,
      #3a4347 73%,
      #080b0d 100%);
  box-shadow:
    inset 0 2px 0 rgba(255,255,255,.25),
    inset 0 -10px 12px rgba(0,0,0,.78),
    0 8px 0 #010203,
    0 18px 20px rgba(0,0,0,.82);
}

.safe-cracker-game .sc-dial-pointer {
  top: -69px;
  z-index: 14;
  width: 34px;
  height: 54px;
  border: 0;
  border-radius: 0;
  pointer-events: none;
  clip-path: polygon(10% 0, 90% 0, 100% 12%, 69% 68%, 50% 100%, 31% 68%, 0 12%);
  background:
    linear-gradient(90deg,
      #332005 0%,
      #96601a 16%,
      #f4d080 43%,
      #d09330 57%,
      #74440e 79%,
      #231304 100%);
  box-shadow:
    inset 2px 1px 0 rgba(255,247,219,.43),
    inset -3px -7px 7px rgba(48,20,2,.7),
    0 7px 0 #120a02,
    0 17px 18px rgba(0,0,0,.84);
  filter:
    drop-shadow(0 2px 1px rgba(0,0,0,.96))
    drop-shadow(0 5px 3px rgba(0,0,0,.75));
}

.safe-cracker-game .sc-dial {
  inset: -9px;
  transform: translateY(-8px) scale(1.045);
  filter:
    drop-shadow(0 3px 1px rgba(255,255,255,.025))
    drop-shadow(0 14px 7px rgba(0,0,0,.79))
    drop-shadow(0 32px 27px rgba(0,0,0,.86));
}

.safe-cracker-game .sc-dial.dragging {
  transform: translateY(-2px) scale(1.023);
  filter:
    drop-shadow(0 9px 4px rgba(0,0,0,.76))
    drop-shadow(0 22px 18px rgba(0,0,0,.82));
}

.safe-cracker-game .sc-dial-face {
  overflow: visible;
  border: 0;
  background-color: #050708;
  background-image:
    url('/assets/safe-cracker/textures/dial-reference-face-v6.svg?dial=6');
  background-position: center;
  background-size: 100% 100%;
  background-repeat: no-repeat;
  box-shadow:
    inset 0 0 0 2px rgba(235,240,242,.1),
    inset 0 -34px 41px rgba(0,0,0,.32),
    0 0 0 4px #010203,
    0 11px 0 #010202,
    0 28px 30px rgba(0,0,0,.84);
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
      rgba(255,255,255,.009) 2.2px 2.75px,
      transparent 2.75px 5px),
    radial-gradient(circle,
      transparent 0 72%,
      rgba(0,0,0,.07) 84%,
      rgba(0,0,0,.28) 100%);
  opacity: .5;
}

.safe-cracker-game .sc-dial-face::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 3;
  border-radius: 50%;
  pointer-events: none;
  box-shadow:
    inset 0 4px 3px rgba(255,255,255,.025),
    inset 0 -17px 21px rgba(0,0,0,.3);
}

.safe-cracker-game .sc-dial-number {
  --radius: 110px;
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
    0 24px 26px rgba(0,0,0,.84);
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
    0 8px 7px rgba(0,0,0,.82);
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
  .safe-cracker-game .sc-dial-wrap { transform: translateY(-5px); }
  .safe-cracker-game .sc-dial-wrap::before { inset: -26px; }
  .safe-cracker-game .sc-dial-wrap::after { top: -60px; width: 75px; height: 34px; }
  .safe-cracker-game .sc-dial-pointer { top: -51px; width: 27px; height: 43px; }
  .safe-cracker-game .sc-dial { inset: -6px; transform: translateY(-6px) scale(1.035); }
  .safe-cracker-game .sc-dial.dragging { transform: translateY(-1px) scale(1.017); }
  .safe-cracker-game .sc-dial-number {
    --radius: min(29vw, 110px);
    font-size: min(5.9vw, 1.5rem);
  }
  .safe-cracker-game .sc-current-number {
    width: min(20.5vw, 78px);
    height: min(20.5vw, 78px);
    font-size: min(11.2vw, 2.72rem);
  }
  .safe-cracker-game .sc-step-controls { gap: 17px; margin-top: 13px; }
  .safe-cracker-game .sc-step-controls button { width: min(28vw, 104px); height: 52px; font-size: 1.9rem; }
}

@media (max-height: 720px) and (max-width: 700px) {
  .safe-cracker-game .sc-dial-wrap::before { inset: -19px; }
  .safe-cracker-game .sc-dial-wrap::after { top: -44px; width: 64px; height: 29px; }
  .safe-cracker-game .sc-dial-pointer { top: -36px; width: 22px; height: 34px; }
  .safe-cracker-game .sc-dial { inset: -3px; transform: translateY(-3px) scale(1.02); }
  .safe-cracker-game .sc-dial-number {
    --radius: min(24vw, 88px);
    font-size: min(5.1vw, 1.16rem);
  }
  .safe-cracker-game .sc-current-number { width: 62px; height: 62px; font-size: 2.06rem; }
  .safe-cracker-game .sc-step-controls { gap: 14px; margin: 7px 0 8px; }
  .safe-cracker-game .sc-step-controls button { width: 78px; height: 41px; font-size: 1.55rem; }
}
${cssEnd}`;

let css = await readFile(cssUrl, 'utf8');
const markerPattern = /\/\* SAFE_CRACKER_DIAL_DEPTH_V\d+_START \*\/[\s\S]*?\/\* SAFE_CRACKER_DIAL_DEPTH_V\d+_END \*\/\s*/gm;
css = css.replace(markerPattern, '').trimEnd() + `\n\n${dialDepth}\n`;
await writeFile(cssUrl, css);

let html = await readFile(indexUrl, 'utf8');
html = html.replace(/\/assets\/safe-cracker\/safe-cracker\.css\?[^"'\s]*/g, value => {
  const clean = value.replace(/&dial=\d+/g, '');
  return `${clean}&dial=6`;
});
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker reference dial depth v4: deeply protruding wheel, tactile scratched grip blocks, thick brushed-silver bezel, wide black numeral annulus, short silver ticks, isolated sloped inner plate, compact silver dividers, reduced center hub, and elevated faceted pointer.');
