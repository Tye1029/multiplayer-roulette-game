import { readFile, writeFile } from 'node:fs/promises';

const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const jsStart = '// SAFE_CRACKER_REFERENCE_VISUALS_V13_START';
const jsEnd = '// SAFE_CRACKER_REFERENCE_VISUALS_V13_END';
const cssStart = '/* SAFE_CRACKER_REFERENCE_VISUALS_V13_START */';
const cssEnd = '/* SAFE_CRACKER_REFERENCE_VISUALS_V13_END */';

let client = await readFile(clientUrl, 'utf8');
if (!client.includes('// SAFE_CRACKER_RUNTIME_STABILITY_V12_START')) {
  throw new Error('Safe Cracker reference visuals require runtime stability v12 first.');
}

if (!client.includes(jsStart)) {
  const referenceRuntime = String.raw`
  ${jsStart}
  function safeCrackerReferencePot(game = runtime.game) {
    const direct = Number(game?.pot);
    if (Number.isFinite(direct) && direct >= 0) return Math.floor(direct);
    const wager = Number(game?.wager);
    if (Number.isFinite(wager) && wager >= 0) return Math.floor(wager * 2);
    return 0;
  }

  function safeCrackerMountReferenceFrame(game = runtime.game) {
    const root = document.querySelector('[data-safe-cracker-mount] .safe-cracker-game');
    if (!root) return;
    root.classList.add('sc-reference-visuals');
    const pot = safeCrackerReferencePot(game).toLocaleString('en-US');
    const header = document.createElement('header');
    header.className = 'sc-reference-header';
    header.setAttribute('aria-label', 'Safe Cracker Duel');
    header.innerHTML = '<div class="sc-reference-title"><i aria-hidden="true"></i><strong>SAFE CRACKER DUEL</strong><i aria-hidden="true"></i></div>' +
      '<div class="sc-reference-pot"><small>POT</small><span aria-hidden="true">▰</span><b>' + escapeHtml(pot) + '</b><em>TICKETS</em></div>';
    root.prepend(header);
  }

  const safeCrackerReferenceRender = render;
  render = function safeCrackerReferenceVisualRender(game) {
    const result = safeCrackerReferenceRender(game);
    safeCrackerMountReferenceFrame(game);
    return result;
  };
  ${jsEnd}
`;
  const closing = '\n})();';
  const closingIndex = client.lastIndexOf(closing);
  if (closingIndex < 0) throw new Error('Safe Cracker reference visuals could not find the runtime closure.');
  client = client.slice(0, closingIndex) + referenceRuntime + client.slice(closingIndex);
}

const jsRequirements = [
  jsStart,
  'function safeCrackerReferencePot(game = runtime.game)',
  'function safeCrackerMountReferenceFrame(game = runtime.game)',
  "header.className = 'sc-reference-header'",
  "root.classList.add('sc-reference-visuals')",
  'render = function safeCrackerReferenceVisualRender(game)'
];
for (const signature of jsRequirements) {
  if (!client.includes(signature)) throw new Error(`Safe Cracker reference visual runtime is missing ${signature}.`);
}
if (!client.includes('choice: `safecracker:guess:${runtime.selected}`')) {
  throw new Error('Safe Cracker reference visuals disturbed authoritative guess submission.');
}
if (client.split(jsStart).length - 1 !== 1 || client.split(jsEnd).length - 1 !== 1) {
  throw new Error('Safe Cracker reference visual runtime markers must appear exactly once.');
}
await writeFile(clientUrl, client);

const referenceCss = String.raw`${cssStart}
.safe-cracker-game.sc-reference-visuals {
  --sc-ref-gold-white: #fff2c8;
  --sc-ref-gold-hi: #f4cc72;
  --sc-ref-gold: #c68b32;
  --sc-ref-gold-mid: #8a571d;
  --sc-ref-gold-low: #3a2109;
  --sc-ref-black: #050708;
  --sc-ref-panel: #0b0e10;
  --sc-ref-steel-hi: #9b9a91;
  --sc-ref-steel: #464844;
  --sc-ref-steel-low: #181a19;
  width: min(100%, 620px);
  padding: 7px 7px 12px;
  border: 1px solid #2c2111;
  border-radius: 19px;
  color: #f4f1e9;
  background:
    radial-gradient(ellipse at 50% -4%, rgba(255, 191, 72, .16), transparent 29%),
    linear-gradient(90deg, rgba(255,255,255,.024), transparent 13%, transparent 87%, rgba(255,255,255,.018)),
    repeating-linear-gradient(0deg, rgba(255,255,255,.012) 0 1px, transparent 1px 4px),
    linear-gradient(180deg, #111416 0%, #07090a 43%, #030405 100%);
  box-shadow:
    inset 0 0 0 1px rgba(255, 204, 103, .12),
    inset 0 0 0 5px rgba(0,0,0,.62),
    inset 0 -60px 100px rgba(0,0,0,.72),
    0 20px 50px rgba(0,0,0,.58);
}

.safe-cracker-game.sc-reference-visuals::before {
  opacity: 1;
  background:
    radial-gradient(ellipse at 50% 8%, rgba(255, 192, 78, .13), transparent 31%),
    linear-gradient(112deg, transparent 0 38%, rgba(255,255,255,.022) 43%, transparent 49%),
    repeating-linear-gradient(90deg, rgba(255,255,255,.01) 0 1px, transparent 1px 7px);
}

.safe-cracker-game.sc-reference-visuals::after {
  content: '';
  position: absolute;
  inset: 7px;
  z-index: 6;
  border: 1px solid rgba(214, 153, 54, .22);
  border-radius: 14px;
  box-shadow:
    inset 0 1px 0 rgba(255, 231, 172, .13),
    inset 0 -1px 0 rgba(73, 42, 7, .72);
  pointer-events: none;
}

.sc-reference-header {
  position: relative;
  z-index: 4;
  margin: 0 4px 9px;
  display: grid;
  justify-items: center;
  filter: drop-shadow(0 9px 12px rgba(0,0,0,.5));
}

.sc-reference-title {
  position: relative;
  width: min(92%, 520px);
  min-height: 50px;
  padding: 8px 44px 10px;
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr) 26px;
  align-items: center;
  gap: 8px;
  clip-path: polygon(6% 0, 94% 0, 100% 50%, 94% 100%, 6% 100%, 0 50%);
  border: 1px solid rgba(248, 198, 95, .58);
  background:
    linear-gradient(180deg, rgba(255, 224, 153, .12), transparent 20%),
    repeating-linear-gradient(90deg, rgba(255,255,255,.018) 0 1px, transparent 1px 6px),
    linear-gradient(180deg, #242424 0%, #111313 48%, #080909 100%);
  box-shadow:
    inset 0 0 0 2px rgba(36, 21, 6, .95),
    inset 0 1px 0 rgba(255, 232, 177, .18),
    inset 0 -10px 18px rgba(0,0,0,.65);
}

.sc-reference-title::before,
.sc-reference-title::after {
  content: '';
  position: absolute;
  left: 8%;
  right: 8%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 209, 117, .55), transparent);
}
.sc-reference-title::before { top: 3px; }
.sc-reference-title::after { bottom: 3px; opacity: .46; }

.sc-reference-title strong {
  min-width: 0;
  text-align: center;
  white-space: nowrap;
  color: transparent;
  background: linear-gradient(180deg, #fff7df 0%, #e4d4b2 42%, #957039 50%, #f1d28b 72%, #80501a 100%);
  -webkit-background-clip: text;
  background-clip: text;
  font: 900 clamp(1.15rem, 4.8vw, 2rem)/1.02 Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif;
  letter-spacing: .055em;
  filter: drop-shadow(0 2px 0 #000) drop-shadow(0 0 5px rgba(255, 196, 78, .14));
}

.sc-reference-title i {
  position: relative;
  height: 14px;
  display: block;
  background: linear-gradient(180deg, var(--sc-ref-gold-white), var(--sc-ref-gold) 58%, var(--sc-ref-gold-low));
  clip-path: polygon(0 8%, 100% 28%, 72% 48%, 100% 68%, 0 92%, 34% 50%);
  filter: drop-shadow(0 2px 1px rgba(0,0,0,.7));
}
.sc-reference-title i:last-child { transform: scaleX(-1); }

.sc-reference-pot {
  position: relative;
  z-index: 2;
  min-width: min(72%, 350px);
  margin-top: -2px;
  padding: 5px 22px 6px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 7px;
  clip-path: polygon(8% 0, 92% 0, 100% 50%, 92% 100%, 8% 100%, 0 50%);
  border: 1px solid rgba(181, 124, 37, .5);
  color: #efc66f;
  background:
    linear-gradient(180deg, rgba(255,255,255,.045), transparent 22%),
    linear-gradient(180deg, #101314, #050607 72%);
  box-shadow: inset 0 1px 0 rgba(255,236,190,.08), 0 4px 8px rgba(0,0,0,.46);
}
.sc-reference-pot small,
.sc-reference-pot em {
  font-size: .66rem;
  font-weight: 900;
  font-style: normal;
  letter-spacing: .1em;
}
.sc-reference-pot span {
  color: #e9bd60;
  transform: skewX(-12deg) rotate(-5deg);
  text-shadow: 0 1px 0 #000, 0 0 5px rgba(255,190,64,.2);
}
.sc-reference-pot b {
  color: #f8d88e;
  font: 900 1.04rem/1 ui-monospace, SFMono-Regular, Menlo, monospace;
  text-shadow: 0 1px 0 #000, 0 0 8px rgba(255,185,61,.24);
}

.safe-cracker-game.sc-reference-visuals .sc-topbar {
  grid-template-columns: minmax(0, 1fr) 82px minmax(0, 1fr);
  gap: 7px;
  margin: 0 4px 8px;
}

.safe-cracker-game.sc-reference-visuals .sc-player-card,
.safe-cracker-game.sc-reference-visuals .sc-timer,
.safe-cracker-game.sc-reference-visuals .sc-opponent-strip {
  border-color: rgba(184, 122, 38, .58);
  background:
    radial-gradient(circle at 50% 0, rgba(255,195,81,.055), transparent 38%),
    linear-gradient(180deg, #1a1d1e 0%, #0a0c0d 58%, #050607 100%);
  box-shadow:
    inset 0 0 0 1px rgba(0,0,0,.9),
    inset 0 1px 0 rgba(255, 226, 161, .09),
    inset 0 -14px 24px rgba(0,0,0,.52),
    0 6px 12px rgba(0,0,0,.4);
}

.safe-cracker-game.sc-reference-visuals .sc-player-card {
  min-height: 82px;
  height: 82px;
  padding: 8px 9px;
  border-radius: 13px;
}
.safe-cracker-game.sc-reference-visuals .sc-player-card.me {
  border-left-color: rgba(239, 185, 78, .82);
}
.safe-cracker-game.sc-reference-visuals .sc-player-card.opponent {
  border-right-color: rgba(239, 185, 78, .82);
}

.safe-cracker-game.sc-reference-visuals .sc-player-card small {
  color: rgba(222, 216, 201, .56);
  font-size: .58rem;
  letter-spacing: .11em;
}
.safe-cracker-game.sc-reference-visuals .sc-player-card b {
  margin-top: 2px;
  color: #f6f4ed;
  font-size: .83rem;
  text-shadow: 0 2px 3px #000;
}

.safe-cracker-game.sc-reference-visuals .sc-avatar {
  flex-basis: 44px;
  width: 44px;
  height: 44px;
  border: 2px solid #d6a64f;
  background: radial-gradient(circle at 40% 30%, #48443a, #111315 68%);
  box-shadow:
    inset 0 0 0 2px #080909,
    inset 0 0 10px rgba(255,206,101,.1),
    0 0 0 1px #5e3c12,
    0 5px 10px rgba(0,0,0,.5);
}

.safe-cracker-game.sc-reference-visuals .sc-known-code {
  margin-top: 5px;
}
.safe-cracker-game.sc-reference-visuals .sc-known-code small { display: none; }
.safe-cracker-game.sc-reference-visuals .sc-known-code > div {
  grid-template-columns: repeat(3, 23px);
  gap: 4px;
}
.safe-cracker-game.sc-reference-visuals .sc-known-code span {
  width: 23px;
  height: 25px;
  border: 1px solid rgba(194, 133, 42, .56);
  border-radius: 5px;
  color: rgba(224, 216, 197, .32);
  background: linear-gradient(180deg, #1b1c1c, #080909 70%);
  box-shadow: inset 0 0 0 1px #020303, inset 0 4px 7px rgba(255,255,255,.025), 0 2px 3px rgba(0,0,0,.4);
  font-size: .8rem;
}
.safe-cracker-game.sc-reference-visuals .sc-known-code span.known {
  border-color: rgba(223, 166, 67, .9);
  color: #f5cd77;
  background: linear-gradient(180deg, #302412, #100b04 72%);
  box-shadow: inset 0 0 8px rgba(255,190,70,.12), 0 0 6px rgba(255,177,49,.1);
  text-shadow: 0 1px 2px #000, 0 0 5px rgba(255,191,67,.2);
}

.safe-cracker-game.sc-reference-visuals .sc-progress-lights {
  display: none;
}

.safe-cracker-game.sc-reference-visuals .sc-timer {
  position: relative;
  min-width: 82px;
  padding: 24px 5px 9px;
  border-radius: 12px;
  color: #ffd477;
  font-size: 1.2rem;
  letter-spacing: .035em;
  text-shadow: 0 0 6px rgba(255,187,50,.72), 0 0 15px rgba(255,157,24,.28);
}
.safe-cracker-game.sc-reference-visuals .sc-timer::before {
  top: 8px;
  color: rgba(216, 177, 101, .68);
  font-size: .43rem;
  letter-spacing: .08em;
}
.safe-cracker-game.sc-reference-visuals .sc-timer::after {
  content: '';
  position: absolute;
  inset: 2px;
  border-radius: 9px;
  background: linear-gradient(118deg, rgba(255,255,255,.06), transparent 33% 74%, rgba(255,184,52,.035));
  pointer-events: none;
}

.safe-cracker-game.sc-reference-visuals .sc-opponent-strip {
  min-height: 66px;
  margin: 0 4px 10px;
  padding: 10px 14px;
  grid-template-columns: minmax(0, 1fr) minmax(125px, 44%) minmax(75px, auto);
  border-radius: 13px;
}
.safe-cracker-game.sc-reference-visuals .sc-race-copy small {
  color: rgba(226, 218, 199, .55);
  font-size: .58rem;
  letter-spacing: .09em;
}
.safe-cracker-game.sc-reference-visuals .sc-race-progress {
  justify-content: center;
  padding: 7px 11px;
  border-color: rgba(171, 112, 32, .48);
  border-radius: 10px;
  color: #f1c66d !important;
  background: #060708;
  box-shadow: inset 0 0 0 1px #000, inset 0 0 12px rgba(255,184,53,.035);
}
.safe-cracker-game.sc-reference-visuals .sc-race-progress i {
  width: 12px;
  height: 16px;
  background: linear-gradient(90deg, #58370f, #f0c565 48%, #704713);
}
.safe-cracker-game.sc-reference-visuals .sc-race-signal {
  color: #d9aa4b;
  font-size: .62rem;
  letter-spacing: .07em;
  text-shadow: 0 0 7px rgba(255,175,42,.13);
}

.safe-cracker-game.sc-reference-visuals .sc-safe-shell {
  width: calc(100% - 8px);
  max-width: none;
  margin-inline: 4px;
  padding: 12px;
  border: 1px solid #655029;
  border-radius: 24px;
  background:
    linear-gradient(115deg, rgba(255,255,255,.075), transparent 12% 40%, rgba(255,211,127,.022) 46%, transparent 54%),
    repeating-linear-gradient(90deg, rgba(255,255,255,.014) 0 1px, transparent 1px 6px),
    linear-gradient(145deg, #373a37 0%, #171918 29%, #080a0a 68%, #202321 100%);
  box-shadow:
    inset 0 0 0 3px #080909,
    inset 0 0 0 6px rgba(177, 126, 45, .16),
    inset 0 1px 0 rgba(255,255,255,.15),
    inset 0 -34px 70px rgba(0,0,0,.64),
    0 18px 30px rgba(0,0,0,.52);
}

.safe-cracker-game.sc-reference-visuals .sc-safe-door {
  min-height: 500px;
  overflow: hidden;
  border: 1px solid #696b64;
  border-radius: 19px;
  outline: 1px solid #050606;
  outline-offset: -5px;
  background:
    radial-gradient(circle at 7% 7%, #c0bcae 0 2px, #2a2a27 3px 6px, transparent 7px),
    radial-gradient(circle at 93% 7%, #c0bcae 0 2px, #2a2a27 3px 6px, transparent 7px),
    radial-gradient(circle at 7% 93%, #918d83 0 2px, #20211f 3px 6px, transparent 7px),
    radial-gradient(circle at 93% 93%, #918d83 0 2px, #20211f 3px 6px, transparent 7px),
    linear-gradient(116deg, rgba(255,255,255,.16) 0 4%, transparent 10% 40%, rgba(255,219,141,.045) 47%, transparent 55%),
    radial-gradient(ellipse at 48% 32%, rgba(160,160,148,.13), transparent 37%),
    repeating-linear-gradient(92deg, rgba(255,255,255,.017) 0 1px, rgba(0,0,0,.012) 1px 5px),
    linear-gradient(145deg, #50514d 0%, #2c2e2b 18%, #121413 57%, #080a0a 78%, #272926 100%);
  box-shadow:
    inset 0 0 0 3px #111312,
    inset 0 0 0 7px rgba(133, 134, 126, .34),
    inset 18px 0 30px rgba(0,0,0,.46),
    inset -13px 0 24px rgba(0,0,0,.48),
    inset 0 -36px 70px rgba(0,0,0,.56),
    0 12px 20px rgba(0,0,0,.52);
}

.safe-cracker-game.sc-reference-visuals .sc-safe-door::before {
  content: '';
  position: absolute;
  inset: 15px;
  z-index: 0;
  border: 1px solid rgba(200, 163, 92, .34);
  border-radius: 13px;
  background:
    linear-gradient(118deg, rgba(255,255,255,.08), transparent 18% 66%, rgba(255,199,89,.028)),
    linear-gradient(180deg, transparent, rgba(0,0,0,.18));
  box-shadow:
    inset 0 0 0 3px rgba(0,0,0,.62),
    inset 0 1px 0 rgba(255,255,255,.08),
    0 0 0 1px rgba(0,0,0,.9);
  pointer-events: none;
}

.safe-cracker-game.sc-reference-visuals .sc-safe-door::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 8;
  background:
    linear-gradient(112deg, transparent 0 22%, rgba(255,255,255,.085) 29%, rgba(255,255,255,.015) 36%, transparent 44%),
    radial-gradient(ellipse at 50% 2%, rgba(255,194,75,.11), transparent 35%),
    linear-gradient(180deg, transparent 52%, rgba(0,0,0,.18));
  mix-blend-mode: screen;
  opacity: .68;
  pointer-events: none;
}

.safe-cracker-game.sc-reference-visuals .sc-display {
  z-index: 2;
  width: min(82%, 390px);
  min-height: 88px;
  margin: 24px auto 8px;
  padding: 12px 16px;
  border: 1px solid #a07839;
  border-radius: 7px;
  color: #efc974;
  background:
    linear-gradient(116deg, rgba(255,255,255,.055), transparent 26% 72%, rgba(255,188,54,.025)),
    linear-gradient(180deg, #181b1c 0%, #080a0b 60%, #030404 100%);
  box-shadow:
    inset 0 0 0 3px #050606,
    inset 0 0 0 5px rgba(127, 87, 28, .28),
    inset 0 -18px 28px rgba(0,0,0,.58),
    0 8px 13px rgba(0,0,0,.48);
}
.safe-cracker-game.sc-reference-visuals .sc-display-bezel {
  border-color: rgba(222, 175, 83, .38);
}
.safe-cracker-game.sc-reference-visuals .sc-display-glass {
  background: linear-gradient(180deg, rgba(255,255,255,.018), rgba(0,0,0,.12));
}
.safe-cracker-game.sc-reference-visuals .sc-display-status {
  color: #f0c979;
  font: 900 clamp(1.15rem, 5vw, 1.8rem)/1 Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif;
  letter-spacing: .075em;
  text-shadow: 0 2px 2px #000, 0 0 7px rgba(255,185,52,.14);
}
.safe-cracker-game.sc-reference-visuals .sc-display-meta {
  color: rgba(226, 216, 196, .56);
}
.safe-cracker-game.sc-reference-visuals .sc-display-meta small,
.safe-cracker-game.sc-reference-visuals .sc-display-meta b {
  color: rgba(226, 216, 196, .58);
  font-size: .62rem;
}
.safe-cracker-game.sc-reference-visuals .sc-feedback-meter {
  opacity: .42;
}

.safe-cracker-game.sc-reference-visuals .sc-dial-wrap {
  width: min(76vw, 330px);
  height: min(76vw, 330px);
  max-width: 330px;
  max-height: 330px;
  margin: 2px auto 12px;
}

.safe-cracker-game.sc-reference-visuals .sc-dial {
  inset: 7px;
  filter: drop-shadow(0 15px 15px rgba(0,0,0,.62));
}

.safe-cracker-game.sc-reference-visuals .sc-dial::before,
.safe-cracker-game.sc-reference-visuals .sc-dial::after {
  content: '';
  position: absolute;
  inset: -2px;
  z-index: 7;
  border-radius: 50%;
  pointer-events: none;
}
.safe-cracker-game.sc-reference-visuals .sc-dial::before {
  background:
    linear-gradient(128deg, rgba(255,255,255,.15) 1%, rgba(255,255,255,.02) 19%, transparent 37% 66%, rgba(255,187,54,.06) 82%, transparent 100%);
  mix-blend-mode: screen;
  opacity: .75;
}
.safe-cracker-game.sc-reference-visuals .sc-dial::after {
  border: 2px solid rgba(217, 168, 77, .34);
  box-shadow:
    inset 0 0 0 5px rgba(0,0,0,.58),
    inset 0 0 18px rgba(255,199,83,.055),
    0 0 0 2px #0b0c0c,
    0 0 0 4px rgba(115, 78, 25, .58);
}

.safe-cracker-game.sc-reference-visuals .sc-dial-face {
  border: 5px solid #0a0b0b;
  background:
    radial-gradient(circle at 36% 24%, rgba(255,255,255,.12), transparent 17%),
    radial-gradient(circle at 50% 50%, #050606 0 22%, transparent 23%),
    repeating-conic-gradient(from -1.5deg, #bd8b38 0deg 1deg, #3f2d10 1deg 2.2deg, #121414 2.2deg 35.2deg, #7c5621 35.2deg 36deg),
    radial-gradient(circle, #131515 0 63%, #090a0a 64% 72%, #b17e2d 73% 75%, #1c1d1c 76% 81%, #080909 82%);
  box-shadow:
    inset 0 0 0 2px #6f5327,
    inset 0 0 0 5px #171817,
    inset 0 0 32px rgba(0,0,0,.92),
    inset 8px 8px 14px rgba(255,255,255,.025);
}

.safe-cracker-game.sc-reference-visuals .sc-dial-pointer {
  top: -11px;
  width: 44px;
  height: 62px;
  border: 1px solid #5e3b0c;
  border-radius: 4px 4px 50% 50%;
  background:
    linear-gradient(118deg, rgba(255,255,255,.48), transparent 27%),
    linear-gradient(90deg, #6c410d, #ffe9a8 48%, #ad731e 54%, #3d2308);
  clip-path: polygon(17% 0, 83% 0, 100% 25%, 51% 100%, 0 25%);
  transform: translateX(-50%);
  filter: drop-shadow(0 4px 3px rgba(0,0,0,.76)) drop-shadow(0 0 6px rgba(255,188,49,.18));
}

.safe-cracker-game.sc-reference-visuals .sc-dial-number {
  --radius: 118px;
  color: #efc875;
  font-size: 1.15rem;
  text-shadow: 0 2px 2px #000, 0 0 5px rgba(255,185,58,.2);
}

.safe-cracker-game.sc-reference-visuals .sc-dial-hub {
  width: 40%;
  border: 4px solid #070808;
  background:
    linear-gradient(124deg, rgba(255,255,255,.12), transparent 28%),
    radial-gradient(circle at 50% 52%, #070808 0 46%, #191713 48% 59%, #c28c32 61% 66%, #2b1b08 68% 75%, #080909 77%);
  box-shadow:
    inset 0 0 18px rgba(0,0,0,.9),
    0 0 0 2px #d2a34f,
    0 0 0 5px #5b390e,
    0 10px 18px rgba(0,0,0,.64);
}

.safe-cracker-game.sc-reference-visuals .sc-current-number {
  width: 92px;
  height: 92px;
  color: #ffe7a2;
  font-size: 3.1rem;
  background:
    radial-gradient(circle at 40% 27%, rgba(255,228,160,.08), transparent 28%),
    radial-gradient(circle, #120e05 0%, #050505 69%, #000 100%);
  border-radius: 50%;
  box-shadow:
    inset 0 0 22px rgba(255,173,26,.08),
    0 0 18px rgba(255,171,28,.1);
  text-shadow: 0 3px 3px #000, 0 0 11px rgba(255,190,57,.55);
}

.safe-cracker-game.sc-reference-visuals .sc-step-controls {
  gap: 22px;
  margin: 8px 0 11px;
}
.safe-cracker-game.sc-reference-visuals .sc-step-controls button {
  width: 88px;
  height: 52px;
  border: 2px solid #6e4718;
  border-radius: 11px;
  color: #f2c76e;
  background:
    linear-gradient(124deg, rgba(255,255,255,.11), transparent 24% 72%, rgba(255,182,45,.035)),
    linear-gradient(180deg, #302f2b, #131514 58%, #080909);
  box-shadow:
    inset 0 0 0 2px #080909,
    inset 0 1px 0 rgba(255,232,177,.15),
    inset 0 -9px 15px rgba(0,0,0,.58),
    0 4px 0 #050505,
    0 8px 12px rgba(0,0,0,.45);
  font-size: 1.8rem;
  text-shadow: 0 2px 2px #000, 0 0 6px rgba(255,187,53,.14);
}

.safe-cracker-game.sc-reference-visuals .sc-confirm-button {
  width: min(82%, 390px);
  min-height: 64px;
  margin: 7px auto 14px;
  border: 2px solid #8a5a1d;
  border-radius: 13px;
  color: #f5d38c;
  background:
    linear-gradient(118deg, rgba(255,255,255,.13), transparent 22% 66%, rgba(255,190,56,.045)),
    linear-gradient(180deg, #3a352b 0%, #1a1a17 52%, #090a0a 100%);
  box-shadow:
    inset 0 0 0 3px #070808,
    inset 0 0 0 5px rgba(199, 139, 45, .32),
    inset 0 1px 0 rgba(255,237,194,.14),
    inset 0 -13px 20px rgba(0,0,0,.64),
    0 5px 0 #060606,
    0 11px 16px rgba(0,0,0,.48),
    0 0 14px rgba(255,174,34,.06);
  font: 900 clamp(.92rem, 4vw, 1.28rem)/1 Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif;
  letter-spacing: .075em;
  text-shadow: 0 2px 2px #000, 0 0 6px rgba(255,187,53,.18);
}
.safe-cracker-game.sc-reference-visuals .sc-confirm-button::after {
  content: '';
  position: absolute;
  left: 22%;
  right: 22%;
  bottom: -8px;
  height: 3px;
  border-radius: 50%;
  background: #eab64f;
  box-shadow: 0 0 8px rgba(255,174,38,.54);
}

.safe-cracker-game.sc-reference-visuals .sc-bolts i,
.safe-cracker-game.sc-reference-visuals .sc-safe-handle span,
.safe-cracker-game.sc-reference-visuals .sc-safe-handle::before,
.safe-cracker-game.sc-reference-visuals .sc-safe-handle::after {
  background:
    linear-gradient(105deg, rgba(255,255,255,.15), transparent 28%),
    linear-gradient(90deg, #111211, #787870 47%, #222320 58%, #0b0c0b);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.12), 0 5px 7px rgba(0,0,0,.55);
}

.safe-cracker-game.sc-reference-visuals .sc-safe-handle {
  opacity: .55;
  filter: sepia(.18) brightness(.75);
}

.safe-cracker-game.sc-reference-visuals .sc-display.red,
.safe-cracker-game.sc-reference-visuals .sc-display.orange,
.safe-cracker-game.sc-reference-visuals .sc-display.yellow,
.safe-cracker-game.sc-reference-visuals .sc-display.green {
  color: inherit;
  background:
    linear-gradient(116deg, rgba(255,255,255,.045), transparent 27% 70%, rgba(var(--sc-refine-state-rgb), .035)),
    linear-gradient(180deg, #151819, #060809 68%);
  box-shadow:
    inset 0 0 0 3px #050606,
    inset 0 0 0 5px rgba(var(--sc-refine-state-rgb), .13),
    inset 0 -18px 28px rgba(0,0,0,.58),
    0 0 12px rgba(var(--sc-refine-state-rgb), .08),
    0 8px 13px rgba(0,0,0,.48);
}

body > .sc-result-overlay[data-sc-result-portal] .sc-result-card {
  border-color: rgba(206, 151, 59, .74);
  background:
    linear-gradient(118deg, rgba(255,255,255,.075), transparent 23% 73%, rgba(255,185,48,.035)),
    linear-gradient(145deg, #282a28, #0b0d0d 61%, #171918);
  box-shadow:
    inset 0 0 0 2px #050606,
    inset 0 0 0 4px rgba(123, 81, 22, .3),
    inset 0 1px 0 rgba(255,232,175,.12),
    0 22px 65px rgba(0,0,0,.76);
}

@media (max-width: 700px) {
  .safe-cracker-game.sc-reference-visuals {
    width: 100%;
    padding: 5px 5px 10px;
    border-radius: 15px;
  }

  .sc-reference-header { margin-inline: 2px; }
  .sc-reference-title {
    width: 96%;
    min-height: 44px;
    padding-inline: 28px;
    grid-template-columns: 20px minmax(0, 1fr) 20px;
    gap: 5px;
  }
  .sc-reference-pot { min-width: 76%; }

  .safe-cracker-game.sc-reference-visuals .sc-topbar {
    grid-template-columns: minmax(0, 1fr) 72px minmax(0, 1fr);
    margin-inline: 2px;
    gap: 5px;
  }
  .safe-cracker-game.sc-reference-visuals .sc-player-card {
    min-height: 76px;
    height: 76px;
    padding: 6px;
    gap: 5px;
  }
  .safe-cracker-game.sc-reference-visuals .sc-player-card b {
    font-size: .72rem;
    max-width: 92px;
  }
  .safe-cracker-game.sc-reference-visuals .sc-avatar {
    width: 38px;
    height: 38px;
    flex-basis: 38px;
  }
  .safe-cracker-game.sc-reference-visuals .sc-known-code > div {
    grid-template-columns: repeat(3, minmax(18px, 22px));
  }
  .safe-cracker-game.sc-reference-visuals .sc-known-code span {
    width: auto;
    height: 22px;
  }
  .safe-cracker-game.sc-reference-visuals .sc-timer {
    min-width: 72px;
    padding-inline: 3px;
    font-size: 1.04rem;
  }

  .safe-cracker-game.sc-reference-visuals .sc-opponent-strip {
    min-height: 62px;
    margin-inline: 2px;
    grid-template-columns: minmax(0, .75fr) minmax(115px, 1.1fr);
    gap: 6px;
    padding: 8px 10px;
  }
  .safe-cracker-game.sc-reference-visuals .sc-race-signal {
    grid-column: 1 / -1;
    min-width: 0;
    text-align: center;
  }

  .safe-cracker-game.sc-reference-visuals .sc-safe-shell {
    width: calc(100% - 4px);
    margin-inline: 2px;
    padding: 8px;
  }
  .safe-cracker-game.sc-reference-visuals .sc-safe-door {
    min-height: 455px;
  }
  .safe-cracker-game.sc-reference-visuals .sc-display {
    min-height: 75px;
    margin-top: 15px;
  }
  .safe-cracker-game.sc-reference-visuals .sc-display-status {
    font-size: clamp(1rem, 5.7vw, 1.46rem);
  }
  .safe-cracker-game.sc-reference-visuals .sc-dial-wrap {
    width: min(72vw, 286px);
    height: min(72vw, 286px);
    margin-bottom: 9px;
  }
  .safe-cracker-game.sc-reference-visuals .sc-dial-number {
    --radius: min(26.2vw, 103px);
    font-size: 1rem;
  }
  .safe-cracker-game.sc-reference-visuals .sc-current-number {
    width: 76px;
    height: 76px;
    font-size: 2.55rem;
  }
  .safe-cracker-game.sc-reference-visuals .sc-step-controls {
    gap: 18px;
    margin-top: 5px;
  }
  .safe-cracker-game.sc-reference-visuals .sc-step-controls button {
    width: 76px;
    height: 45px;
  }
  .safe-cracker-game.sc-reference-visuals .sc-confirm-button {
    min-height: 56px;
    margin-bottom: 10px;
  }
}

@media (max-width: 390px) {
  .sc-reference-title strong { font-size: 1.03rem; }
  .sc-reference-pot { padding-inline: 15px; }
  .sc-reference-pot small,
  .sc-reference-pot em { font-size: .55rem; }
  .sc-reference-pot b { font-size: .9rem; }

  .safe-cracker-game.sc-reference-visuals .sc-player-card b { max-width: 75px; font-size: .65rem; }
  .safe-cracker-game.sc-reference-visuals .sc-avatar { width: 34px; height: 34px; flex-basis: 34px; }
  .safe-cracker-game.sc-reference-visuals .sc-known-code span { height: 20px; font-size: .68rem; }
  .safe-cracker-game.sc-reference-visuals .sc-timer { min-width: 66px; font-size: .93rem; }
  .safe-cracker-game.sc-reference-visuals .sc-safe-door { min-height: 430px; }
  .safe-cracker-game.sc-reference-visuals .sc-display { min-height: 68px; margin-top: 12px; }
  .safe-cracker-game.sc-reference-visuals .sc-dial-wrap { width: min(68vw, 250px); height: min(68vw, 250px); }
  .safe-cracker-game.sc-reference-visuals .sc-dial-number { --radius: min(24.5vw, 90px); font-size: .92rem; }
  .safe-cracker-game.sc-reference-visuals .sc-current-number { width: 68px; height: 68px; font-size: 2.25rem; }
  .safe-cracker-game.sc-reference-visuals .sc-step-controls button { width: 68px; height: 41px; }
  .safe-cracker-game.sc-reference-visuals .sc-confirm-button { min-height: 52px; font-size: .9rem; }
}

@media (max-width: 700px) and (max-height: 780px) {
  .sc-reference-title { min-height: 39px; padding-block: 6px 7px; }
  .sc-reference-pot { padding-block: 4px; }
  .safe-cracker-game.sc-reference-visuals .sc-player-card { min-height: 68px; height: 68px; }
  .safe-cracker-game.sc-reference-visuals .sc-opponent-strip { min-height: 52px; padding-block: 6px; }
  .safe-cracker-game.sc-reference-visuals .sc-safe-door { min-height: 390px; }
  .safe-cracker-game.sc-reference-visuals .sc-display { min-height: 62px; margin-top: 9px; margin-bottom: 4px; }
  .safe-cracker-game.sc-reference-visuals .sc-dial-wrap { width: min(57vw, 220px); height: min(57vw, 220px); margin-bottom: 6px; }
  .safe-cracker-game.sc-reference-visuals .sc-dial-number { --radius: min(20.7vw, 79px); font-size: .84rem; }
  .safe-cracker-game.sc-reference-visuals .sc-current-number { width: 62px; height: 62px; font-size: 2rem; }
  .safe-cracker-game.sc-reference-visuals .sc-step-controls { margin-block: 3px 6px; }
  .safe-cracker-game.sc-reference-visuals .sc-step-controls button { width: 62px; height: 37px; font-size: 1.45rem; }
  .safe-cracker-game.sc-reference-visuals .sc-confirm-button { min-height: 47px; margin-block: 4px 7px; }
}

@media (prefers-reduced-motion: reduce) {
  .safe-cracker-game.sc-reference-visuals .sc-dial::before,
  .safe-cracker-game.sc-reference-visuals .sc-safe-door::after {
    transition: none !important;
  }
}
${cssEnd}`;

let css = await readFile(cssUrl, 'utf8');
const markerPattern = /\/\* SAFE_CRACKER_REFERENCE_VISUALS_V13_START \*\/[\s\S]*?\/\* SAFE_CRACKER_REFERENCE_VISUALS_V13_END \*\/\s*/m;
css = css.replace(markerPattern, '').trimEnd() + `\n\n${referenceCss}\n`;
await writeFile(cssUrl, css);

let html = await readFile(indexUrl, 'utf8');
if (!html.includes('&stability=1&reference=1')) {
  html = html.replaceAll('&samples=1&stability=1', '&samples=1&stability=1&reference=1');
}
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker reference visuals v13: premium gold framing, shadowed black steel, fixed light reflections, cinematic dial highlights, and reference-matched mobile hierarchy.');
