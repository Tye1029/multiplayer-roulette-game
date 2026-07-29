import { readFile, writeFile } from 'node:fs/promises';

const policyUrl = new URL('../assets/roulette/spin-audio-policy.js', import.meta.url);
let policy = await readFile(policyUrl, 'utf8');

function replaceOnce(source, label, before, after) {
  if (source.includes(after)) return source;
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Roulette turn audio patch could not find ${label}.`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Roulette turn audio patch found more than one ${label}.`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

function replaceSection(source, label, startMarker, endMarker, replacement) {
  if (source.includes(replacement)) return source;
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`Roulette turn audio patch could not find ${label}.`);
  return source.slice(0, start) + replacement + source.slice(end);
}

const directTurnMovement = `  function playTurnMovement(details = {}) {
    const gameId = String(details.gameId || '');
    const fromTurnId = String(details.fromTurnId || '');
    const turnId = String(details.turnId || '');
    const epoch = Number(details.epoch || 0);
    const duration = Math.max(500, Number(details.duration) || 1020);
    if (!gameId || !turnId || performance.now() < chamberSpinUntil) return false;

    const key = \`${'${gameId}:${fromTurnId}:${turnId}:${epoch}'}\`;
    const now = performance.now();
    if (key === lastTurnMovementKey && now - lastTurnMovementAt < 1600) return false;
    if (!claimAction('turn-move', key, Math.max(1800, duration + 600))) return false;
    lastTurnMovementKey = key;
    lastTurnMovementAt = now;

    stopGroup('turn-move', 32);
    playClip(TABLE_MOVE, {
      group: 'turn-move',
      volume: 0.044,
      rate: 1.08,
      start: 0.12,
      duration: 0.62,
      fadeIn: 0.02,
      fadeOut: 0.30
    });
    return true;
  }

`;

if (!policy.includes('function playTurnMovement(details = {})')) {
  policy = replaceOnce(
    policy,
    'the turn movement state',
    `  let lastGameId = '';
  let lastTurnId = '';`,
    `  let lastTurnMovementKey = '';
  let lastTurnMovementAt = -Infinity;`
  );
  policy = policy.replace('  let pollTimer = 0;\n', '');
  policy = replaceSection(
    policy,
    'the polling turn movement implementation',
    '  function currentGame() {',
    '  // Remove the manager\'s exported chamber/shot entry points.',
    directTurnMovement
  );
  policy = replaceOnce(
    policy,
    'the no-op turn movement export',
    `    turnRotate() { return null; }`,
    `    turnRotate(details) {
      if (!details || typeof details !== 'object') return false;
      return playTurnMovement(details);
    }`
  );
  policy = policy.replace(
    `  const poll = () => {
    syncTurnMovement();
    pollTimer = global.setTimeout(poll, 300);
  };
  poll();

`,
    ''
  );
  policy = replaceOnce(
    policy,
    'the turn movement diagnostics',
    `        lastGameId,
        lastTurnId,`,
    `        lastTurnMovementKey,
        lastTurnMovementAt,`
  );
  policy = replaceOnce(
    policy,
    'the direct turn movement diagnostics export',
    `    shotSequence,
    diagnostics()`,
    `    shotSequence,
    playTurnMovement,
    diagnostics()`
  );
  policy = policy.replace('    clearTimeout(pollTimer);\n', '');
}

for (const required of [
  'function playTurnMovement(details = {})',
  'const key = `${gameId}:${fromTurnId}:${turnId}:${epoch}`',
  "group: 'turn-move'",
  'volume: 0.044',
  'start: 0.12',
  'duration: 0.62',
  'fadeOut: 0.30',
  "if (!details || typeof details !== 'object') return false;",
  'return playTurnMovement(details);'
]) {
  if (!policy.includes(required)) throw new Error(`Final turn movement audio is missing ${required}`);
}
if (policy.includes('function syncTurnMovement()') || policy.includes('pollTimer')) {
  throw new Error('Turn movement audio is still driven by polling.');
}

await writeFile(policyUrl, policy);
console.log('Patched Roulette turn movement: the real animation starts an earlier sound every time and fades before the terminal knock.');
await import('./patch-roulette-turn-facing-guard.mjs');
await import('./patch-roulette-active-rotation-hold.mjs');
