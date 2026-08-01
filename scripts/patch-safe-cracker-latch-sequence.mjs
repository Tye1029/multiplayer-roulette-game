import { readFile, writeFile } from 'node:fs/promises';

const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);

const cssStart = '/* SAFE_CRACKER_LATCH_SEQUENCE_V1_START */';
const cssEnd = '/* SAFE_CRACKER_LATCH_SEQUENCE_V1_END */';
const runtimeMarker = '// SAFE_CRACKER_LATCH_SEQUENCE_V1_RUNTIME';
const renderMarker = '// SAFE_CRACKER_LATCH_SEQUENCE_V1_RENDER';

const latchCss = String.raw`${cssStart}
.safe-cracker-game .sc-confirm-button {
  background-color: #aab4b8 !important;
  background-image:
    linear-gradient(180deg,
      #e2e8ea 0%,
      #c4cdd1 31%,
      #929fa5 67%,
      #68757b 100%) !important;
  box-shadow:
    inset 0 2px 0 rgba(255,255,255,.72),
    inset 0 -4px 6px rgba(10,14,16,.28),
    0 5px 10px rgba(0,0,0,.48) !important;
}

.safe-cracker-game .sc-confirm-button:active {
  transform: translateY(4px) !important;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.5),
    inset 0 -2px 5px rgba(10,14,16,.42),
    0 1px 4px rgba(0,0,0,.42) !important;
}

.safe-cracker-game .sc-bolts.right {
  right: -4px;
  z-index: 8;
  overflow: visible;
  pointer-events: none;
}

.safe-cracker-game .sc-bolts.right i {
  position: relative;
  transform-origin: right center;
  will-change: transform, filter, opacity;
  transition:
    transform .42s cubic-bezier(.2,.85,.28,1),
    filter .28s ease,
    opacity .28s ease;
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
  animation: scSafeCrackerLatchReleaseV1 .58s cubic-bezier(.16,.82,.3,1) both;
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
  .safe-cracker-game .sc-bolts.right {
    right: -3px;
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

if (!client.includes(renderMarker)) {
  const latestLine = '    const latest = me.lastResult || null;';
  if (!client.includes(latestLine)) {
    throw new Error('Safe Cracker latch sequence could not find the authoritative render state.');
  }
  const latchRender = [
    latestLine,
    `    ${renderMarker}`,
    "    const latchGameId = String(game?.gameId || '');",
    '    const latchStage = Math.max(0, Math.min(STAGES, Number(me.stage || 0)));',
    '    const releasingLatch = runtime.latchGameId === latchGameId && latchStage > runtime.latchStage',
    '      ? latchStage',
    '      : 0;',
    '    runtime.latchGameId = latchGameId;',
    '    runtime.latchStage = latchStage;',
    '    const latchClass = index => [',
    "      latchStage >= index ? 'sc-latch-released' : '',",
    "      releasingLatch === index ? 'sc-latch-releasing' : ''",
    "    ].filter(Boolean).join(' ');"
  ].join('\n');
  client = client.replace(latestLine, latchRender);
}

const rightLatchPattern = /<div class="sc-bolts right"[^>]*>\s*<i[^>]*><\/i>\s*<i[^>]*><\/i>\s*<i[^>]*><\/i>\s*<\/div>/;
if (!rightLatchPattern.test(client)) {
  throw new Error('Safe Cracker latch sequence could not find the three right-side safe bolts.');
}
const rightLatchMarkup = '<div class="sc-bolts right" data-sc-latch-stage="${latchStage}"><i class="${latchClass(1)}"></i><i class="${latchClass(2)}"></i><i class="${latchClass(3)}"></i></div>';
client = client.replace(rightLatchPattern, rightLatchMarkup);
client = client.replace(/RESETTING(?:…|\.\.\.)/gi, 'CHECK NUMBER');
await writeFile(clientUrl, client);

let html = await readFile(indexUrl, 'utf8');
html = html.replace(/\/assets\/safe-cracker\/safe-cracker\.css\?[^"'\s]*/g, value => {
  const clean = value.replace(/&latch=\d+/g, '');
  return `${clean}&latch=1`;
});
html = html.replace(/\/assets\/safe-cracker\/safe-cracker\.js\?[^"'\s]*/g, value => {
  const clean = value.replace(/&latch=\d+/g, '');
  return `${clean}&latch=1`;
});
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker latch sequence v1: the final yellow button underlayer is removed, the Check Number control retains tactile press travel, and the three right-side latches release from top to bottom as authoritative tumblers are completed.');
