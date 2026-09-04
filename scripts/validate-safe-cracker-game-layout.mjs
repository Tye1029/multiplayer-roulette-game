import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const client = await readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8');
const html = await readFile(new URL('index.html', root), 'utf8');
function section(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `Missing section ${start}`);
  return source.slice(from, to);
}
const context = vm.createContext({
  STAGES: 3, runtime: {busy:false},
  stateFor: game => game?.safecrackerState || {},
  myState: game => game?.safecrackerState?.me || {},
  serverNowMs: () => 10000,
  safeCrackerLocalCooldownReleased: () => false,
  duelFishingHtml: () => 'fishing-unchanged',
  rouletteHtml: () => 'roulette-unchanged'
});
vm.runInContext(section(html, 'function duelModeArt(game)', 'function duelResultText(game)'), context);
for (const status of ['waiting','ready','countdown','playing','complete']) {
  assert.equal(context.duelModeArt({mode:'safecracker',status}), '<div data-safe-cracker-mount></div>');
}
assert.equal(context.duelModeArt({mode:'fishing'}), 'fishing-unchanged');
assert.equal(context.duelModeArt({mode:'roulette'}), 'roulette-unchanged');
vm.runInContext(section(client, 'function secondsLeft(game', '// SAFE_CRACKER_START_COUNTDOWN_START'), context);
assert.equal(context.secondsLeft({status:'ready'}), 75);
assert.equal(context.secondsLeft({status:'waiting'}), 75);
assert.equal(context.secondsLeft({status:'complete',safecrackerState:{endAt:new Date(60000).toISOString()}}), 0);
assert.equal(context.secondsLeft({status:'playing',safecrackerState:{endAt:new Date(60000).toISOString()}}), 50);
vm.runInContext(section(client, 'function safeCrackerCanSubmit(game', 'function safeCrackerUpdateConfirmControl()'), context);
for (const status of ['waiting','ready','countdown','complete']) {
  assert.equal(context.safeCrackerCanSubmit({status,safecrackerState:{canSubmit:true,me:{stage:0}}}), false);
}
assert.equal(context.safeCrackerCanSubmit({status:'playing',safecrackerState:{canSubmit:true,me:{stage:0}}}), true);
vm.runInContext(section(client, 'function lockedCode(progress', '// SAFE_CRACKER_VISUAL_STABILITY_V5_END'), context);
const code = context.lockedCode({attempts:[{stage:0,guess:0,correct:true,tier:'green'},{stage:1,guess:6,correct:false,tier:'red'}]});
assert.ok(code.includes('Tumbler 1 locked at 0'));
assert.ok(code.includes('Tumbler 2 not locked'));
assert.ok(!code.includes('locked at 6'), 'Incorrect guesses must not become unlocked digits');
const template = section(client, 'if (!reusedMountedBoard) mount.innerHTML', 'runtime.feedbackFresh = false;');
assert.ok(template.indexOf('sc-instructions') < template.indexOf('sc-topbar'));
assert.ok(template.indexOf('sc-tip-bar') > template.indexOf('data-sc-confirm'));
assert.ok(!html.includes('Crack your own three-number safe before your opponent.'));
console.log('Safe Cracker layout: all lifecycle screens mount the real board, private unlocked digits stay accurate, pre-race guesses stay disabled, timer stops at completion, and other game routing is unchanged.');
