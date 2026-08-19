import { readFile, writeFile } from 'node:fs/promises';

const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const start = '/* SAFE_CRACKER_VISUAL_SHELL_V1_START */';
const end = '/* SAFE_CRACKER_VISUAL_SHELL_V1_END */';

const visualShell = String.raw`${start}
.safe-cracker-game {
  --sc-room-black: #050708;
  --sc-room-deep: #0b1013;
  --sc-room-steel: #192126;
  --sc-room-warm: rgba(214, 157, 79, .18);
  width: min(100%, 980px);
  padding: clamp(10px, 2.2vw, 22px);
  overflow: hidden;
  border: 1px solid rgba(205, 216, 220, .12);
  border-radius: 30px;
  background:
    radial-gradient(ellipse at 50% 8%, rgba(245, 195, 122, .18), transparent 31%),
    radial-gradient(ellipse at 50% 58%, rgba(94, 118, 126, .14), transparent 46%),
    linear-gradient(180deg, #11171b 0%, #090d10 48%, #040607 100%);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.08),
    inset 0 -45px 90px rgba(0,0,0,.58),
    0 28px 70px rgba(0,0,0,.5);
}

.safe-cracker-game::before {
  content: '';
  position: absolute;
  z-index: -2;
  inset: 0;
  pointer-events: none;
  opacity: .72;
  background:
    linear-gradient(90deg, transparent 49.75%, rgba(255,255,255,.025) 50%, transparent 50.25%),
    repeating-linear-gradient(0deg, rgba(255,255,255,.016) 0 1px, transparent 1px 5px),
    repeating-linear-gradient(90deg, rgba(255,255,255,.012) 0 1px, transparent 1px 7px);
  mask-image: linear-gradient(#000 0 78%, transparent 100%);
}

.safe-cracker-game::after {
  content: '';
  position: absolute;
  z-index: -1;
  left: -8%;
  right: -8%;
  bottom: -15%;
  height: 42%;
  pointer-events: none;
  transform: perspective(500px) rotateX(62deg);
  transform-origin: bottom;
  background:
    linear-gradient(90deg, transparent 0 49.8%, rgba(255,255,255,.035) 50%, transparent 50.2%),
    repeating-linear-gradient(90deg, rgba(255,255,255,.02) 0 1px, transparent 1px 44px),
    linear-gradient(180deg, rgba(44,51,53,.42), rgba(3,5,6,.92));
  box-shadow: inset 0 18px 35px rgba(0,0,0,.7);
}

.sc-topbar,
.sc-opponent-strip {
  position: relative;
  z-index: 4;
}

.sc-player-card {
  border-color: rgba(193, 207, 212, .18);
  background:
    linear-gradient(180deg, rgba(100, 116, 122, .13), rgba(8, 12, 14, .75)),
    repeating-linear-gradient(90deg, rgba(255,255,255,.014) 0 1px, transparent 1px 5px);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.1),
    inset 0 -12px 20px rgba(0,0,0,.22),
    0 8px 20px rgba(0,0,0,.24);
}

.sc-opponent-strip {
  border-color: rgba(196, 208, 212, .14);
  background: linear-gradient(180deg, rgba(27,35,39,.92), rgba(6,9,11,.94));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.06), 0 8px 18px rgba(0,0,0,.24);
}

.sc-safe-shell {
  position: relative;
  isolation: isolate;
  padding: clamp(12px, 2vw, 20px);
  border: 1px solid rgba(199, 211, 215, .18);
  border-radius: 30px;
  background:
    radial-gradient(circle at 50% -12%, rgba(242, 195, 126, .12), transparent 38%),
    repeating-linear-gradient(94deg, rgba(255,255,255,.018) 0 1px, rgba(0,0,0,.018) 1px 4px),
    linear-gradient(145deg, #293238 0%, #11181c 42%, #090d0f 100%);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.12),
    inset 0 0 0 5px rgba(4,7,8,.62),
    inset 0 -26px 60px rgba(0,0,0,.48),
    0 24px 50px rgba(0,0,0,.42);
}

.sc-safe-shell::before {
  content: '';
  position: absolute;
  z-index: -1;
  inset: 7px;
  border: 1px solid rgba(211, 222, 225, .1);
  border-radius: 23px;
  pointer-events: none;
  box-shadow: inset 0 0 24px rgba(0,0,0,.55);
}

.sc-safe-shell::after {
  content: '';
  position: absolute;
  z-index: 3;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  background:
    radial-gradient(ellipse at 42% 1%, rgba(255,218,161,.1), transparent 30%),
    linear-gradient(115deg, transparent 0 38%, rgba(255,255,255,.025) 48%, transparent 58%);
  mix-blend-mode: screen;
}

.sc-safe-door {
  min-height: 510px;
  border: clamp(9px, 1.5vw, 14px) solid #090d0f;
  border-radius: 28px;
  background:
    radial-gradient(circle at 27% 13%, rgba(255,255,255,.2), transparent 18%),
    radial-gradient(circle at 74% 81%, rgba(0,0,0,.35), transparent 34%),
    repeating-linear-gradient(98deg, rgba(255,255,255,.023) 0 1px, rgba(0,0,0,.028) 1px 4px),
    linear-gradient(142deg, #69757b 0%, #39444a 26%, #20292e 61%, #4c585e 100%);
  box-shadow:
    inset 0 0 0 2px #89949a,
    inset 0 0 0 7px #252d31,
    inset 0 0 0 10px rgba(0,0,0,.62),
    inset 22px 22px 38px rgba(255,255,255,.035),
    inset -28px -34px 55px rgba(0,0,0,.58),
    0 18px 34px rgba(0,0,0,.54);
}

.sc-safe-door::before {
  inset: 17px;
  border: 1px solid rgba(222, 230, 232, .18);
  border-radius: 18px;
  box-shadow:
    inset 0 0 0 3px rgba(8,12,14,.5),
    inset 0 0 30px rgba(0,0,0,.42);
}

.sc-safe-door::after {
  content: '';
  position: absolute;
  inset: 8px;
  border-radius: 20px;
  pointer-events: none;
  opacity: .9;
  background:
    radial-gradient(circle at 11px 11px, #aeb7ba 0 2px, #30383c 3px 5px, transparent 6px),
    radial-gradient(circle at calc(100% - 11px) 11px, #aeb7ba 0 2px, #30383c 3px 5px, transparent 6px),
    radial-gradient(circle at 11px calc(100% - 11px), #aeb7ba 0 2px, #30383c 3px 5px, transparent 6px),
    radial-gradient(circle at calc(100% - 11px) calc(100% - 11px), #aeb7ba 0 2px, #30383c 3px 5px, transparent 6px),
    linear-gradient(118deg, transparent 0 31%, rgba(255,255,255,.045) 42%, transparent 54%);
}

.sc-bolts {
  z-index: 2;
  top: 17%;
  bottom: 17%;
}

.sc-bolts i {
  width: 26px;
  height: 38px;
  border: 1px solid #101619;
  border-radius: 6px;
  background:
    linear-gradient(90deg, #101518 0%, #3f4b50 19%, #a0aaad 48%, #505b60 73%, #151b1e 100%);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.28), 0 5px 9px rgba(0,0,0,.52);
}

.sc-safe-handle {
  border-color: #0d1214;
  background:
    radial-gradient(circle at 38% 30%, rgba(255,255,255,.36), transparent 18%),
    radial-gradient(circle, #899398 0 27%, #2a3439 30% 56%, #b08743 59% 65%, #161d20 68%);
  box-shadow:
    inset 0 0 12px rgba(0,0,0,.55),
    0 0 0 2px rgba(151,163,168,.32),
    0 10px 16px rgba(0,0,0,.56);
}

.sc-safe-handle span,
.sc-safe-handle::before,
.sc-safe-handle::after {
  background:
    linear-gradient(180deg, rgba(255,255,255,.2), transparent 32%),
    linear-gradient(#8f999d, #394348 56%, #151b1e);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.24), 0 4px 7px rgba(0,0,0,.45);
}

.sc-attempt-panel {
  border-color: rgba(198,210,214,.16);
  background:
    linear-gradient(180deg, rgba(28,36,40,.98), rgba(6,9,10,.98)),
    repeating-linear-gradient(90deg, rgba(255,255,255,.015) 0 1px, transparent 1px 5px);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.08),
    inset 0 0 26px rgba(0,0,0,.42),
    0 14px 28px rgba(0,0,0,.34);
}

@media (max-width: 700px) {
  .safe-cracker-game {
    border-radius: 22px;
    padding: 7px;
  }
  .sc-safe-shell {
    padding: 8px;
    border-radius: 22px;
  }
  .sc-safe-shell::before { inset: 5px; border-radius: 17px; }
  .sc-safe-door {
    min-height: 500px;
    border-width: 9px;
    border-radius: 21px;
  }
  .sc-safe-door::before { inset: 12px; border-radius: 14px; }
  .sc-safe-door::after { inset: 6px; border-radius: 16px; }
  .sc-attempt-panel { border-radius: 14px; }
}

@media (max-height: 720px) and (max-width: 700px) {
  .sc-safe-door { min-height: 448px; }
}
${end}`;

let css = await readFile(cssUrl, 'utf8');
const markerPattern = /\/\* SAFE_CRACKER_VISUAL_SHELL_V1_START \*\/[\s\S]*?\/\* SAFE_CRACKER_VISUAL_SHELL_V1_END \*\/\s*/m;
css = css.replace(markerPattern, '').trimEnd() + `\n\n${visualShell}\n`;
await writeFile(cssUrl, css);

let html = await readFile(indexUrl, 'utf8');
html = html.replaceAll('/assets/safe-cracker/safe-cracker.css?v=4', '/assets/safe-cracker/safe-cracker.css?v=5');
html = html.replaceAll('/assets/safe-cracker/safe-cracker.js?v=4', '/assets/safe-cracker/safe-cracker.js?v=5');
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker visual pass 1: cinematic vault room, professional safe shell, and integrated steel surfaces.');
