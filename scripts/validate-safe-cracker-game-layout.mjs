import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import crypto from 'node:crypto';

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
assert.equal(context.secondsLeft({status:'ready'}), 60);
assert.equal(context.secondsLeft({status:'waiting'}), 60);
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
assert.ok(!template.includes('sc-opponent-strip'), 'Opponent status strip must be removed from the board');
assert.ok(template.includes('Decide which direction to go!'));
assert.ok(!template.includes('Warmer means closer'));

// Exercise the authoritative round and public countdown, including its deadline.
const server = await readFile(new URL('netlify/functions/_data.js', root), 'utf8');
let now = 100000;
class Clock extends Date { static now() { return now; } }
const authority = vm.createContext({crypto, Date:Clock, cleanUserId:id=>String(id||''), int:(n,f=0)=>Number.isFinite(Number(n))?Math.trunc(Number(n)):f});
vm.runInContext(section(server, 'const SAFE_CRACKER_ROUND_MS', 'function safeCrackerSummary('), authority);
const match = {status:'ready',creator:{userId:'one'},joiner:{userId:'two'}};
assert.equal(authority.safeCrackerPublicState(match,'one').secondsLeft,60);
match.status='playing';
match.safecrackerState=authority.safeCrackerInitialState(match,now);
assert.equal(Date.parse(match.safecrackerState.endAt)-Date.parse(match.safecrackerState.startAt),60000);
assert.ok(authority.safeCrackerHasValidState(match));
assert.equal(authority.safeCrackerPublicState(match,'one').secondsLeft,60);
now+=59000;
assert.equal(authority.safeCrackerPublicState(match,'one').secondsLeft,1);
now+=1000;
assert.equal(authority.safeCrackerPublicState(match,'one').secondsLeft,0);
now+=1000;
assert.equal(authority.safeCrackerPublicState(match,'one').secondsLeft,0);
assert.equal(authority.safeCrackerPublicState(match,'one').opponent.code,undefined);
match.status='complete';
assert.equal(authority.safeCrackerPublicState(match,'one').canSubmit,false);

// Result comparisons use authoritative final codes and the viewer's role.
context.escapeHtml = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
context.funnyLoss = () => 'Try the next vault.';
context.resultVaultMechanism = () => '';
vm.runInContext(section(client, 'function resultOverlay(game)', '// SAFE_CRACKER_LATCH_SEQUENCE_V1_HELPER'), context);
const resultGame = {status:'complete',isCreator:true,winnerUserId:'one',payout:2000,creator:{userId:'one',name:'You <script>'},joiner:{userId:'two',name:'Rival'},safecrackerState:{revealedCodes:{my:'012',opponent:'987'},me:{stage:3,attemptCount:9},opponent:{stage:2,attemptCount:7}}};
const win = context.resultOverlay(resultGame);
assert.ok(win.includes('SAFE CRACKED!') && win.includes('2,000 Chips.'));
assert.ok(win.includes('You &lt;script>') && !win.includes('You <script>'));
assert.ok(win.includes('YOUR SAFE code 012') && win.includes('<b>0</b>'));
assert.ok(win.includes('data-sc-rematch') && win.includes('data-sc-new-game'));
assert.ok(win.includes('<dd>3 / 3</dd>') && win.includes('<dd>9</dd>'));
assert.ok(context.resultOverlay({...resultGame,winnerUserId:'two'}).includes('YOU LOSE'));
assert.ok(context.resultOverlay({...resultGame,isCreator:false,winnerUserId:'two'}).includes('SAFE CRACKED!'));
assert.ok(context.resultOverlay({...resultGame,tie:true,winnerUserId:''}).includes('Both wagers were returned.'));
assert.equal(context.resultOverlay({...resultGame,status:'playing'}),'');
console.log('Safe Cracker layout: all lifecycle screens mount the real board, private unlocked digits stay accurate, pre-race guesses stay disabled, timer stops at completion, and other game routing is unchanged.');
