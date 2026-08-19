import { readFile, writeFile } from 'node:fs/promises';

const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const cssStart = '/* SAFE_CRACKER_VISUAL_REFINEMENT_V7_START */';
const cssEnd = '/* SAFE_CRACKER_VISUAL_REFINEMENT_V7_END */';

const refinement = String.raw`${cssStart}
.safe-cracker-game {
  --sc-refine-steel-hi: #87939a;
  --sc-refine-steel-mid: #3c474d;
  --sc-refine-steel-low: #151b1f;
  --sc-refine-brass-hi: #e7c575;
  --sc-refine-brass-mid: #8d662d;
  --sc-refine-brass-low: #38250e;
  --sc-refine-state-rgb: 197, 143, 62;
  --sc-refine-state-strength: .08;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  box-shadow: inset 0 0 90px rgba(0,0,0,.44);
}

.safe-cracker-game:has(.sc-display.red) {
  --sc-refine-state-rgb: 255, 70, 61;
  --sc-refine-state-strength: .105;
}

.safe-cracker-game:has(.sc-display.orange) {
  --sc-refine-state-rgb: 255, 145, 50;
  --sc-refine-state-strength: .11;
}

.safe-cracker-game:has(.sc-display.yellow) {
  --sc-refine-state-rgb: 255, 213, 91;
  --sc-refine-state-strength: .12;
}

.safe-cracker-game:has(.sc-display.green) {
  --sc-refine-state-rgb: 82, 255, 142;
  --sc-refine-state-strength: .13;
}

.sc-topbar {
  grid-template-columns: minmax(0, 1fr) 70px minmax(0, 1fr);
  align-items: stretch;
  gap: 8px;
  margin-bottom: 8px;
}

.sc-player-card {
  min-width: 0;
  min-height: 64px;
  height: 64px;
  padding: 7px 9px;
  border: 1px solid rgba(158, 172, 178, .34);
  border-radius: 11px;
  background:
    linear-gradient(180deg, rgba(116, 129, 135, .16), rgba(12, 17, 20, .96)),
    repeating-linear-gradient(90deg, rgba(255,255,255,.014) 0 1px, transparent 1px 5px);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.11),
    inset 0 -1px 0 rgba(0,0,0,.72),
    0 6px 14px rgba(0,0,0,.2);
  overflow: hidden;
}

.sc-player-card.me {
  border-left-color: rgba(231, 197, 117, .58);
}

.sc-player-card.opponent {
  border-right-color: rgba(139, 156, 163, .52);
}

.sc-player-card .sc-player-copy {
  min-width: 0;
  overflow: hidden;
}

.sc-player-card.opponent .sc-player-copy {
  text-align: right;
}

.sc-player-card small,
.sc-opponent-strip small,
.sc-display-meta small,
.sc-timer::before,
.sc-known-code small {
  font-size: .5rem;
  font-weight: 800;
  letter-spacing: .11em;
}

.sc-player-card b {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: .76rem;
  line-height: 1.08;
}

.sc-avatar {
  flex: 0 0 34px;
  width: 34px;
  height: 34px;
  border: 1px solid rgba(231, 197, 117, .42);
  box-shadow: inset 0 0 0 2px rgba(8,11,13,.72), 0 3px 8px rgba(0,0,0,.3);
}

.sc-known-code {
  margin-top: 3px;
  gap: 4px;
}

.sc-known-code > div {
  grid-template-columns: repeat(3, minmax(14px, 18px));
  gap: 2px;
}

.sc-known-code span {
  height: 18px;
  border-radius: 3px;
  border-color: rgba(145, 159, 165, .38);
  color: rgba(215, 224, 226, .36);
  background:
    linear-gradient(180deg, rgba(255,255,255,.055), rgba(2,5,6,.86));
  box-shadow:
    inset 0 1px 2px rgba(255,255,255,.05),
    inset 0 -3px 6px rgba(0,0,0,.72);
  font-size: .66rem;
}

.sc-known-code span.known {
  border-color: rgba(231, 197, 117, .66);
  color: #ffe7aa;
  background:
    linear-gradient(180deg, rgba(231,197,117,.17), rgba(34,24,8,.92));
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.12),
    inset 0 -5px 8px rgba(0,0,0,.48),
    0 0 7px rgba(231,197,117,.12);
  text-shadow: 0 1px 2px #000;
}

.sc-player-card.opponent .sc-progress-lights {
  justify-content: flex-end;
}

.sc-player-card.opponent .sc-stage-light {
  transform: scale(.9);
  transform-origin: right center;
}

.sc-timer {
  min-width: 70px;
  border: 1px solid rgba(151, 166, 171, .36);
  border-radius: 10px;
  color: #f2d48f;
  background:
    linear-gradient(180deg, rgba(75, 85, 90, .32), rgba(5, 8, 10, .96)),
    repeating-linear-gradient(0deg, rgba(255,255,255,.018) 0 1px, transparent 1px 4px);
  box-shadow:
    inset 0 0 0 2px rgba(0,0,0,.45),
    inset 0 1px 0 rgba(255,255,255,.1),
    0 6px 14px rgba(0,0,0,.22);
}

.sc-timer.danger {
  color: #ffd0ad;
  border-color: rgba(255, 92, 65, .5);
  box-shadow:
    inset 0 0 13px rgba(255,70,52,.14),
    inset 0 0 0 2px rgba(0,0,0,.45),
    0 0 12px rgba(255,70,52,.1);
}

.sc-opponent-strip {
  min-height: 46px;
  margin-bottom: 8px;
  padding: 7px 10px;
  border: 1px solid rgba(151, 164, 169, .27);
  border-radius: 10px;
  background:
    linear-gradient(180deg, rgba(81, 92, 97, .14), rgba(5, 8, 10, .9)),
    repeating-linear-gradient(90deg, rgba(255,255,255,.012) 0 1px, transparent 1px 6px);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.07), 0 5px 12px rgba(0,0,0,.18);
}

.sc-race-progress,
.sc-race-signal {
  letter-spacing: .055em;
}

.sc-safe-shell {
  border: 1px solid rgba(143, 158, 164, .38);
  border-radius: 24px;
  background:
    repeating-linear-gradient(91deg, rgba(255,255,255,.018) 0 1px, transparent 1px 7px),
    linear-gradient(145deg, #4b565c 0%, #20282d 24%, #10161a 58%, #303a40 100%);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.16),
    inset 0 0 0 5px rgba(4,7,8,.7),
    inset 0 -30px 68px rgba(0,0,0,.52),
    0 0 30px rgba(var(--sc-refine-state-rgb), var(--sc-refine-state-strength)),
    0 24px 48px rgba(0,0,0,.46);
  transition: box-shadow .24s ease, border-color .24s ease;
}

.sc-safe-door {
  border: 1px solid rgba(139, 153, 159, .4);
  outline: 1px solid rgba(0,0,0,.62);
  outline-offset: -5px;
  background:
    radial-gradient(circle, #b3bdc1 0 2px, #232b2f 3px 6px, transparent 7px) 10px 20% / 14px 14px no-repeat,
    radial-gradient(circle, #b3bdc1 0 2px, #232b2f 3px 6px, transparent 7px) 10px 80% / 14px 14px no-repeat,
    linear-gradient(90deg, #11171a, #7b878d 47%, #1b2226) 8px 17% / 18px 56px no-repeat,
    linear-gradient(90deg, #11171a, #7b878d 47%, #1b2226) 8px 83% / 18px 56px no-repeat,
    repeating-linear-gradient(90deg, rgba(255,255,255,.018) 0 1px, transparent 1px 6px),
    linear-gradient(145deg, #536067 0%, #252e33 28%, #11171b 68%, #354047 100%);
  box-shadow:
    inset 0 0 0 3px rgba(9,13,15,.76),
    inset 11px 0 18px rgba(0,0,0,.28),
    inset -8px 0 15px rgba(0,0,0,.24),
    0 9px 20px rgba(0,0,0,.42);
  transition: box-shadow .24s ease, filter .24s ease;
}

.sc-safe-shell.sc-gameplay-win::before {
  inset: 13px 12px 13px 18px;
  border-color: rgba(255, 214, 134, .5);
  background:
    linear-gradient(90deg, rgba(20,10,3,.92), rgba(82,42,9,.36) 18%, transparent 34%),
    radial-gradient(ellipse at 69% 50%, rgba(255,243,195,.98) 0 4%, rgba(255,188,70,.78) 17%, rgba(128,65,13,.4) 43%, rgba(20,10,3,.96) 72%);
  box-shadow:
    inset 18px 0 30px rgba(0,0,0,.76),
    inset 0 0 46px rgba(255,179,58,.48),
    0 0 38px rgba(255,166,48,.22);
}

.sc-safe-shell.sc-gameplay-win .sc-safe-door {
  border-right: 7px solid #171d20;
  box-shadow:
    inset 0 0 0 3px rgba(8,12,14,.76),
    inset -11px 0 15px rgba(0,0,0,.56),
    12px 2px 20px rgba(0,0,0,.46),
    8px 0 14px rgba(255,184,65,.12);
}

.sc-display {
  border-color: rgba(134, 148, 154, .5);
  background: linear-gradient(180deg, #3f4a50, #171e22 54%, #0c1114);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.13),
    inset 0 -4px 10px rgba(0,0,0,.58),
    0 0 15px rgba(var(--sc-refine-state-rgb), calc(var(--sc-refine-state-strength) * .72));
  transition: box-shadow .22s ease, border-color .22s ease;
}

.sc-display-glass {
  border-color: rgba(var(--sc-refine-state-rgb), .22);
}

.sc-stage-light {
  border-color: rgba(132, 146, 152, .38);
  background: linear-gradient(180deg, #465158, #1d252a 52%, #0c1114);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.09), inset 0 -4px 7px rgba(0,0,0,.52);
}

.sc-stage-light.active {
  border-color: rgba(231,197,117,.72);
  box-shadow: inset 0 0 10px rgba(231,197,117,.11), 0 0 8px rgba(231,197,117,.1);
}

.sc-stage-light.locked {
  border-color: rgba(82,255,142,.5);
  box-shadow: inset 0 0 10px rgba(82,255,142,.1), 0 0 7px rgba(82,255,142,.09);
}

.sc-step-controls button,
.sc-confirm-button {
  border-color: #101518;
  color: #f1d99f;
  background:
    linear-gradient(180deg, rgba(130,143,150,.34) 0 8%, transparent 9%),
    linear-gradient(180deg, #4d585e, #252e33 52%, #161d21);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.18),
    inset 0 -3px 7px rgba(0,0,0,.42),
    0 4px 0 #0a0e10,
    0 7px 11px rgba(0,0,0,.32);
  transition: transform .09s ease, box-shadow .09s ease, border-color .2s ease, color .2s ease;
}

.sc-step-controls button:not(:disabled):active,
.sc-confirm-button:not(:disabled):active {
  transform: translateY(3px);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.12),
    inset 0 -2px 5px rgba(0,0,0,.44),
    0 1px 0 #0a0e10,
    0 3px 6px rgba(0,0,0,.3);
}

.sc-confirm-button {
  width: min(72%, 270px);
  min-height: 48px;
  border-color: rgba(141,102,45,.9);
  background:
    linear-gradient(180deg, rgba(255,239,196,.16), transparent 11%),
    linear-gradient(180deg, #5e6870 0 42%, #4b3920 43% 66%, #20272b 67% 100%);
  color: #ffe5aa;
  text-shadow: 0 1px 2px #000;
}

.sc-confirm-button:disabled {
  opacity: 1;
  color: rgba(208,218,220,.38);
  border-color: rgba(85,96,101,.55);
  background:
    linear-gradient(180deg, rgba(255,255,255,.035), transparent 12%),
    linear-gradient(180deg, #2f383d, #171e22 58%, #111619);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.06),
    inset 0 0 0 2px rgba(0,0,0,.28),
    0 2px 0 #090d0f;
  filter: none;
}

.sc-dial-pointer {
  filter: drop-shadow(0 2px 2px rgba(0,0,0,.62)) drop-shadow(0 0 4px rgba(231,197,117,.18));
}

.sc-dial-number.selected,
.sc-dial-number[aria-current='true'] {
  text-shadow: 0 1px 2px #000, 0 0 8px rgba(231,197,117,.24);
}

@media (max-width: 700px) {
  .safe-cracker-game {
    padding: 8px 7px 13px;
  }

  .sc-topbar {
    grid-template-columns: minmax(0, 1fr) 62px minmax(0, 1fr);
    gap: 5px;
    margin-bottom: 6px;
  }

  .sc-player-card {
    height: 60px;
    min-height: 60px;
    padding: 6px 7px;
  }

  .sc-player-card.me .sc-avatar,
  .sc-player-card.opponent .sc-avatar {
    width: 30px;
    height: 30px;
    flex-basis: 30px;
  }

  .sc-player-card.me .sc-known-code {
    margin-top: 2px;
    display: flex;
    width: 48px;
  }

  .sc-player-card.me .sc-known-code > div {
    width: 48px;
  }

  .sc-known-code span {
    height: 16px;
    font-size: .56rem;
  }

  .sc-timer {
    min-width: 62px;
  }

  .sc-opponent-strip {
    min-height: 41px;
    margin-bottom: 6px;
    padding: 6px 8px;
  }

  .sc-safe-shell {
    border-radius: 19px;
    padding: 7px;
  }

  .sc-safe-door {
    min-height: 402px;
  }

  .sc-confirm-button {
    width: min(76%, 255px);
    min-height: 45px;
  }
}

@media (max-width: 390px) {
  .sc-player-card b {
    font-size: .7rem;
  }

  .sc-player-card.opponent .sc-stage-light {
    transform: scale(.82);
  }

  .sc-race-copy strong {
    max-width: 88px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

@media (max-width: 700px) and (max-height: 760px) {
  .safe-cracker-game {
    padding-top: 5px;
  }

  .sc-topbar {
    margin-bottom: 4px;
  }

  .sc-player-card {
    height: 56px;
    min-height: 56px;
  }

  .sc-opponent-strip {
    min-height: 37px;
    margin-bottom: 4px;
  }

  .sc-safe-door {
    min-height: 368px;
  }

  .sc-display {
    margin-top: 7px;
  }

  .sc-dial-wrap {
    width: min(56vw, 208px);
    height: min(56vw, 208px);
    margin-bottom: 9px;
  }

  .sc-dial-number {
    --radius: min(20vw, 73px);
  }

  .sc-step-controls {
    margin: 5px 0 5px;
  }

  .sc-confirm-button {
    min-height: 42px;
    margin-top: 4px;
    margin-bottom: 4px;
  }
}

@media (min-width: 390px) and (min-height: 840px) and (max-width: 700px) {
  .sc-dial-wrap {
    width: min(61vw, 236px);
    height: min(61vw, 236px);
  }

  .sc-dial-number {
    --radius: min(22vw, 84px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .sc-safe-shell,
  .sc-display,
  .sc-step-controls button,
  .sc-confirm-button {
    transition: none !important;
  }
}
${cssEnd}`;

let css = await readFile(cssUrl, 'utf8');
const markerPattern = /\/\* SAFE_CRACKER_VISUAL_REFINEMENT_V7_START \*\/[\s\S]*?\/\* SAFE_CRACKER_VISUAL_REFINEMENT_V7_END \*\/\s*/m;
css = css.replace(markerPattern, '').trimEnd() + `\n\n${refinement}\n`;
await writeFile(cssUrl, css);

let html = await readFile(indexUrl, 'utf8');
html = html.replaceAll('/assets/safe-cracker/safe-cracker.css?v=8&polish=2&fit=2&result=1&final=1', '/assets/safe-cracker/safe-cracker.css?v=8&polish=2&fit=2&result=1&final=1&refine=1');
html = html.replaceAll('/assets/safe-cracker/safe-cracker.js?v=8&polish=2&fit=2&result=1&final=1', '/assets/safe-cracker/safe-cracker.js?v=8&polish=2&fit=2&result=1&final=1&refine=1');
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker pass 7 visual refinement: deeper safe construction, unified materials, cleaner HUD, restrained state lighting, typography, and phone-height composition.');
