import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [client, css, index, patch, data, turnAnimation, turnFire] = await Promise.all([
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/safe-cracker.css', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-video-corrections.mjs', root), 'utf8'),
  readFile(new URL('netlify/functions/_data.js', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root)),
  readFile(new URL('assets/roulette/turn-fire.js', root))
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Safe Cracker video-correction validation failed: ${message}`);
}

function occurrences(source, value) {
  return source.split(value).length - 1;
}

assert(occurrences(client, '// SAFE_CRACKER_VIDEO_CORRECTION_V8_START') === 1, 'runtime marker must appear exactly once');
assert(occurrences(css, '/* SAFE_CRACKER_VIDEO_CORRECTION_V8_START */') === 1, 'style marker must appear exactly once');
assert(occurrences(css, '/* SAFE_CRACKER_VIDEO_CORRECTION_V8_END */') === 1, 'style end marker must appear exactly once');
assert(client.includes('function safeCrackerMonotonicCountdownLabel(game = runtime.game)'), 'monotonic countdown helper is missing');
assert(client.includes('if (proposedRank < runtime.countdownProgressRank) return runtime.countdownProgressLabel;'), 'countdown can still move backward');
assert(client.includes('const startCountdownLabel = safeCrackerMonotonicCountdownLabel(game);'), 'render does not use the monotonic countdown');
assert(client.includes('const label = safeCrackerMonotonicCountdownLabel(runtime.game);'), 'ticker does not use the monotonic countdown');
assert(client.includes('<span class="sc-race-copy"><small>OPPONENT STATUS</small></span>'), 'duplicate opponent-name race copy remains');
assert(!client.includes('<small>RACE STATUS</small><strong>${escapeHtml(opponentName'), 'old duplicated opponent race label remains');
assert(client.includes("const confirmLabel = runtime.busy"), 'purposeful confirm-button state labels are missing');
assert(client.includes("? 'RESETTING…'"), 'cooldown button does not identify its resetting state');
assert(client.includes('<span>${confirmLabel}</span>'), 'confirm button does not render the state label');
assert(client.includes("${Number(me.attemptCount || 0) === 1 ? 'ATTEMPT' : 'ATTEMPTS'}"), 'attempt grammar is not singular-aware');
assert(client.includes("choice: `safecracker:guess:${runtime.selected}`"), 'video corrections changed authoritative guess submission');
assert(css.includes('transform: rotate(var(--digit-angle)) translateY(calc(var(--radius) * -1));'), 'dial numerals do not rotate radially like a physical dial');
assert(!css.includes('transform: rotate(var(--digit-angle)) translateY(calc(var(--radius) * -1)) rotate(calc(var(--digit-angle) * -1));'), 'old always-screen-upright dial orientation remains active');
assert(css.includes('--sc-refine-state-strength: .07;'), 'green ambient reflection was not restrained');
assert(css.includes('box-shadow: inset 0 0 16px rgba(82,255,142,.22), 0 0 9px rgba(82,255,142,.12);'), 'green feedback display remains overlit');
assert(css.includes('.sc-confirm-button:disabled {\n  color: rgba(245, 226, 181, .66);'), 'disabled button text is not readable');
assert(index.includes('/assets/safe-cracker/safe-cracker.css?v=8&polish=2&fit=2&result=1&final=1&refine=1&correct=1'), 'correction stylesheet is not cache-busted');
assert(index.includes('/assets/safe-cracker/safe-cracker.js?v=8&polish=2&fit=2&result=1&final=1&refine=1&correct=1'), 'correction runtime is not cache-busted');
assert(data.includes('// SAFE_CRACKER_DIRECT_COMPLETION_START'), 'video corrections disturbed direct completion');
assert(turnAnimation.length > 0 && turnFire.length > 0, 'protected Roulette assets could not be read');
assert(!patch.includes("writeFile(new URL('../netlify/functions/_data.js'"), 'video-correction patch must not write server gameplay');
assert(!patch.includes("writeFile(new URL('../assets/roulette/turn-animation.js'"), 'video-correction patch must not write protected Roulette turn animation');
assert(!patch.includes("writeFile(new URL('../assets/roulette/turn-fire.js'"), 'video-correction patch must not write protected Roulette firing animation');

console.log('Safe Cracker video-correction validation passed: countdown is monotonic, dial numerals are physically oriented, state lighting is restrained, HUD copy is cleaner, controls are readable, and gameplay remains intact.');