import { readFile, writeFile } from 'node:fs/promises';

const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);

const cssStart = '/* SAFE_CRACKER_LATCH_SEQUENCE_V1_START */';
const cssEnd = '/* SAFE_CRACKER_LATCH_SEQUENCE_V1_END */';
const runtimeMarker = '// SAFE_CRACKER_LATCH_SEQUENCE_V1_RUNTIME';
const helperMarker = '// SAFE_CRACKER_LATCH_SEQUENCE_V1_HELPER';

const latchCss = String.raw`${cssStart}
.safe-cracker-game .sc-confirm-button {
  overflow: visible !important;
  isolation: isolate;
  -webkit-appearance: none;
  appearance: none;
  -webkit-tap-highlight-color: transparent;
  background-color: #aab4b8 !important;
  background-image:
    linear-gradient(180deg,
      #e2e8ea 0%,
      #c4cdd1 31%,
      #929fa5 67%,
      #68757b 100%) !important;
  background-clip: padding-box !important;
  border: 3px solid #050708 !important;
  border-bottom-color: #050708 !important;
  outline: 0 !important;
  filter: none !important;
  box-shadow:
    inset 0 2px 0 rgba(255,255,255,.72),
    inset 0 -4px 6px rgba(10,14,16,.28),
    0 5px 10px rgba(0,0,0,.48) !important;
}

.safe-cracker-game .sc-confirm-button > span {
  position: relative;
  z-index: 2;
  color: #ddb362;
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
  text-shadow:
    -1px -1px 0 #050708,
    0 -1px 0 #050708,
    1px -1px 0 #050708,
    -1px 0 0 #050708,
    1px 0 0 #050708,
    -1px 1px 0 #050708,
    0 1px 0 #050708,
    1px 1px 0 #050708,
    0 2px 2px #000;
}

.safe-cracker-game .sc-confirm-button::before {
  content: none !important;
  display: none !important;
}

.safe-cracker-game .sc-confirm-button::after {
  content: '' !important;
  display: block !important;
  position: absolute;
  left: 2px;
  right: 2px;
  bottom: -7px;
  height: 7px;
  border: 0 !important;
  border-radius: 0 0 6px 6px;
  background: #050708 !important;
  box-shadow: none !important;
  z-index: -1;
  pointer-events: none;
  transition: bottom .08s ease, height .08s ease;
}

.safe-cracker-game .sc-confirm-button:disabled {
  filter: none !important;
}

.safe-cracker-game .sc-confirm-button:active {
  transform: translateY(4px) !important;
  filter: none !important;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.5),
    inset 0 -2px 5px rgba(10,14,16,.42),
    0 1px 4px rgba(0,0,0,.42) !important;
}

.safe-cracker-game .sc-confirm-button:active::after {
  bottom: -3px;
  height: 3px;
}

/* Six fixed mounting assemblies. The backplate and side flange remain bolted
   to the door while only the cylindrical latch body moves during release. */
.safe-cracker-game .sc-bolts {
  width: 62px;
  z-index: 8;
  overflow: visible;
  pointer-events: none;
}

.safe-cracker-game .sc-bolts.left {
  left: -5px;
  align-items: flex-start;
}

.safe-cracker-game .sc-bolts.right {
  right: -5px;
  align-items: flex-end;
}

.safe-cracker-game .sc-latch-mount {
  position: relative;
  display: block;
  width: 60px;
  height: 50px;
  flex: 0 0 50px;
  isolation: isolate;
}

.safe-cracker-game .sc-latch-mount::before {
  content: '';
  position: absolute;
  top: 3px;
  bottom: 3px;
  width: 45px;
  z-index: 0;
  border: 2px solid #11171a;
  background:
    linear-gradient(180deg, rgba(255,255,255,.2), transparent 18%),
    linear-gradient(90deg, #20282c 0%, #77848a 26%, #3d484e 54%, #171e22 100%);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.2),
    inset 0 -8px 12px rgba(0,0,0,.28),
    0 6px 9px rgba(0,0,0,.42);
}

.safe-cracker-game .sc-bolts.left .sc-latch-mount::before {
  left: 7px;
  border-radius: 7px 3px 3px 7px;
}

.safe-cracker-game .sc-bolts.right .sc-latch-mount::before {
  right: 7px;
  border-radius: 3px 7px 7px 3px;
  background:
    linear-gradient(180deg, rgba(255,255,255,.2), transparent 18%),
    linear-gradient(270deg, #20282c 0%, #77848a 26%, #3d484e 54%, #171e22 100%);
}

/* Inward-facing mounting ear with one recessed screw, matching the reference. */
.safe-cracker-game .sc-latch-mount::after {
  content: '';
  position: absolute;
  top: 8px;
  width: 21px;
  height: 34px;
  z-index: 1;
  border: 2px solid #0b1013;
  background:
    radial-gradient(circle at 50% 10px,
      rgba(255,255,255,.88) 0 1px,
      #9ba6ab 1.5px 3px,
      #333c40 3.5px 5px,
      #080b0d 5.5px 6.5px,
      transparent 7px),
    linear-gradient(180deg, rgba(255,255,255,.22), transparent 23%),
    linear-gradient(90deg, #1c2327, #68747a 48%, #20282c);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.18),
    inset 0 -7px 9px rgba(0,0,0,.3),
    0 4px 6px rgba(0,0,0,.46);
}

.safe-cracker-game .sc-bolts.left .sc-latch-mount::after {
  left: 34px;
  border-radius: 2px 6px 6px 2px;
}

.safe-cracker-game .sc-bolts.right .sc-latch-mount::after {
  right: 34px;
  border-radius: 6px 2px 2px 6px;
  background:
    radial-gradient(circle at 50% 10px,
      rgba(255,255,255,.88) 0 1px,
      #9ba6ab 1.5px 3px,
      #333c40 3.5px 5px,
      #080b0d 5.5px 6.5px,
      transparent 7px),
    linear-gradient(180deg, rgba(255,255,255,.22), transparent 23%),
    linear-gradient(270deg, #1c2327, #68747a 48%, #20282c);
}

.safe-cracker-game .sc-latch-mount > i {
  position: absolute;
  top: 7px;
  width: 28px;
  height: 37px;
  z-index: 3;
  display: block;
  border: 2px solid #0d1215;
  background:
    linear-gradient(180deg, rgba(255,255,255,.18), transparent 17%),
    linear-gradient(90deg,
      #151b1f 0%,
      #566269 18%,
      #c2cbce 46%,
      #7b878c 63%,
      #252d31 100%);
  box-shadow:
    inset 1px 0 1px rgba(255,255,255,.3),
    inset -4px 0 6px rgba(0,0,0,.34),
    inset 0 -7px 8px rgba(0,0,0,.24),
    0 7px 9px rgba(0,0,0,.54);
  will-change: transform, filter, opacity;
  transition:
    transform .82s cubic-bezier(.2,.85,.28,1),
    filter .58s ease,
    opacity .58s ease;
}

.safe-cracker-game .sc-bolts.left .sc-latch-mount > i {
  left: 0;
  border-radius: 5px 12px 12px 5px;
  transform-origin: left center;
}

.safe-cracker-game .sc-bolts.right .sc-latch-mount > i {
  right: 0;
  border-radius: 12px 5px 5px 12px;
  transform-origin: right center;
}

.safe-cracker-game .sc-bolts.right i.sc-latch-released {
  transform: translateX(17px) rotate(7deg);
  filter: brightness(.66) saturate(.72);
  opacity: .7;
  box-shadow:
    inset 2px 0 2px rgba(255,255,255,.08),
    0 5px 7px rgba(0,0,0,.66);
}

.safe-cracker-game .sc-bolts.right i.sc-latch-releasing {
  animation: scSafeCrackerLatchReleaseV1 1.15s cubic-bezier(.16,.82,.3,1) both;
}

@keyframes scSafeCrackerLatchReleaseV1 {
  0% {
    transform: translateX(0) rotate(0);
    filter: brightness(1) saturate(1);
    opacity: 1;
  }
  34% {
    transform: translateX(5px) rotate(-2deg) scaleX(1.055);
    filter: brightness(1.18) saturate(.88);
    opacity: 1;
  }
  68% {
    transform: translateX(19px) rotate(9deg) scaleX(.98);
    filter: brightness(.72) saturate(.74);
    opacity: .78;
  }
  100% {
    transform: translateX(17px) rotate(7deg);
    filter: brightness(.66) saturate(.72);
    opacity: .7;
  }
}

@media (max-width: 700px) {
  .safe-cracker-game .sc-bolts {
    width: 51px;
  }

  .safe-cracker-game .sc-bolts.left {
    left: -4px;
  }

  .safe-cracker-game .sc-bolts.right {
    right: -4px;
  }

  .safe-cracker-game .sc-latch-mount {
    width: 50px;
    height: 43px;
    flex-basis: 43px;
  }

  .safe-cracker-game .sc-latch-mount::before {
    top: 3px;
    bottom: 3px;
    width: 38px;
  }

  .safe-cracker-game .sc-bolts.left .sc-latch-mount::before { left: 6px; }
  .safe-cracker-game .sc-bolts.right .sc-latch-mount::before { right: 6px; }

  .safe-cracker-game .sc-latch-mount::after {
    top: 7px;
    width: 18px;
    height: 29px;
    background-size: auto, auto, auto;
  }

  .safe-cracker-game .sc-bolts.left .sc-latch-mount::after { left: 28px; }
  .safe-cracker-game .sc-bolts.right .sc-latch-mount::after { right: 28px; }

  .safe-cracker-game .sc-latch-mount > i {
    top: 6px;
    width: 24px;
    height: 32px;
  }

  .safe-cracker-game .sc-bolts.right i.sc-latch-released {
    transform: translateX(13px) rotate(7deg);
  }

  @keyframes scSafeCrackerLatchReleaseV1 {
    0% { transform: translateX(0) rotate(0); }
    34% { transform: translateX(4px) rotate(-2deg) scaleX(1.045); }
    68% { transform: translateX(15px) rotate(9deg) scaleX(.98); }
    100% { transform: translateX(13px) rotate(7deg); }
  }
}
${cssEnd}`;

let css = await readFile(cssUrl, 'utf8');
if (!css.includes('/* SAFE_CRACKER_DIAL_LAYOUT_V3_END */')) {
  throw new Error('Safe Cracker latch sequence requires the validated final dial-layout pass.');
}
const oldCssPattern = /\/\* SAFE_CRACKER_LATCH_SEQUENCE_V1_START \*\/[\s\S]*?\/\* SAFE_CRACKER_LATCH_SEQUENCE_V1_END \*\/\s*/gm;
css = css.replace(oldCssPattern, '').trimEnd() + `\n\n${latchCss}\n`;
await writeFile(cssUrl, css);

let client = await readFile(clientUrl, 'utf8');

if (!client.includes(runtimeMarker)) {
  const runtimePattern = /(\s+)feedbackTimer:\s*0,?/;
  if (!runtimePattern.test(client)) {
    throw new Error('Safe Cracker latch sequence could not find the persistent runtime state.');
  }
  client = client.replace(runtimePattern, (_match, indent) => [
    `${indent}feedbackTimer: 0,`,
    `${indent}${runtimeMarker}`,
    `${indent}latchGameId: '',`,
    `${indent}latchStage: 0,`
  ].join('\n'));
}

if (!client.includes(helperMarker)) {
  const renderAnchor = '  function render(game) {';
  if (!client.includes(renderAnchor)) {
    throw new Error('Safe Cracker latch sequence could not find the stable render function.');
  }
  const helper = [
    `  ${helperMarker}`,
    '  function safeCrackerLatchMount(latchClass = \'\') {',
    '    return `<span class="sc-latch-mount"><i class="${latchClass}"></i></span>`;',
    '  }',
    '',
    '  function safeCrackerStaticLatchBank(side) {',
    '    return `<div class="sc-bolts ${side}" data-sc-mounted-latches="true">${safeCrackerLatchMount()}${safeCrackerLatchMount()}${safeCrackerLatchMount()}</div>`;',
    '  }',
    '',
    '  function safeCrackerLatchBank(game, me) {',
    "    const latchGameId = String(game?.gameId || '');",
    '    const latchStage = Math.max(0, Math.min(STAGES, Number(me?.stage || 0)));',
    '    const releasingLatch = runtime.latchGameId === latchGameId && latchStage > runtime.latchStage',
    '      ? latchStage',
    '      : 0;',
    '    runtime.latchGameId = latchGameId;',
    '    runtime.latchStage = latchStage;',
    '    const latchClass = index => [',
    "      latchStage >= index ? 'sc-latch-released' : '',",
    "      releasingLatch === index ? 'sc-latch-releasing' : ''",
    "    ].filter(Boolean).join(' ');",
    '    return `<div class="sc-bolts right" data-sc-latch-stage="${latchStage}" data-sc-mounted-latches="true">${safeCrackerLatchMount(latchClass(1))}${safeCrackerLatchMount(latchClass(2))}${safeCrackerLatchMount(latchClass(3))}</div>`;',
    '  }',
    '',
    renderAnchor
  ].join('\n');
  client = client.replace(renderAnchor, helper);
}

const leftLatchPattern = /<div class="sc-bolts left">\s*<i><\/i>\s*<i><\/i>\s*<i><\/i>\s*<\/div>/;
if (leftLatchPattern.test(client)) {
  client = client.replace(leftLatchPattern, '${safeCrackerStaticLatchBank(\'left\')}');
} else if (!client.includes('${safeCrackerStaticLatchBank(\'left\')}')) {
  throw new Error('Safe Cracker latch sequence could not find the original three left-side safe bolts.');
}

const rightLatchPattern = /<div class="sc-bolts right">\s*<i><\/i>\s*<i><\/i>\s*<i><\/i>\s*<\/div>/;
if (rightLatchPattern.test(client)) {
  client = client.replace(rightLatchPattern, '${safeCrackerLatchBank(game, me)}');
} else if (!client.includes('${safeCrackerLatchBank(game, me)}')) {
  throw new Error('Safe Cracker latch sequence could not find the original three right-side safe bolts.');
}
client = client.replace(/RESETTING(?:…|\.\.\.)/gi, 'CHECK NUMBER');
await writeFile(clientUrl, client);

let html = await readFile(indexUrl, 'utf8');
html = html.replace(/\/assets\/safe-cracker\/safe-cracker\.css\?[^"'\s]*/g, value => {
  const clean = value.replace(/&latch=\d+/g, '');
  return `${clean}&latch=4`;
});
html = html.replace(/\/assets\/safe-cracker\/safe-cracker\.js\?[^"'\s]*/g, value => {
  const clean = value.replace(/&latch=\d+/g, '');
  return `${clean}&latch=4`;
});
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker latch sequence v4: all six latches now sit in fixed beveled mounting brackets with inward side flanges and recessed screws, while only the latch cylinders move during the existing release sequence.');
