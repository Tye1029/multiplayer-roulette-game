import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const start = html.indexOf('    function duelSetPollRate(game = null) {');
const end = html.indexOf('    function duelFishingNoiseBuffer', start);
assert.ok(start >= 0 && end > start, 'Could not extract duelSetPollRate.');
const functionSource = html.slice(start, end);

let now = 1_000_000;
let nextTimerId = 1;
const intervals = new Map();
const delays = [];
const cleared = [];
const context = {
  console,
  Date: class extends Date { static now() { return now; } },
  document: { hidden: false },
  window: { __duelPollRate: 0 },
  duelCurrentGameId: 'game-1',
  duelPollTimer: null,
  duelCompletedActivityGameId: '',
  duelCompletedActivityAt: 0,
  duelFishingLatestGame: null,
  duelDrawLatestGame: null,
  duelDrawLocalTimer: null,
  duelSetSharedCountdown() {},
  duelRefresh() {},
  duelFishingResetRuntime() {},
  duelFishingStartOcean() {},
  duelFishingStartLocalClock() {},
  duelDrawLocalTick() {},
  setInterval(callback, delay) {
    const id = nextTimerId++;
    intervals.set(id, { callback, delay });
    delays.push(delay);
    return id;
  },
  clearInterval(id) {
    cleared.push(id);
    intervals.delete(id);
  }
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(`${functionSource}\nthis.duelSetPollRate = duelSetPollRate;`, context);

const completed = { gameId: 'game-1', mode: 'roulette', status: 'complete' };
context.duelSetPollRate(completed);
assert.equal(delays.at(-1), 2000, 'Completed game must begin at a 2 second poll rate.');
assert.equal(context.window.__duelPollRate, 2000);

now += 16_000;
context.duelSetPollRate(completed);
assert.equal(delays.at(-1), 5000, 'Idle completed game must back off to 5 seconds.');
assert.equal(context.window.__duelPollRate, 5000);

const timersBeforeHidden = delays.length;
context.document.hidden = true;
context.duelSetPollRate(completed);
assert.equal(context.duelPollTimer, null, 'Hidden tab must clear the multiplayer poll timer.');
assert.equal(context.window.__duelPollRate, 0, 'Hidden tab must report a zero poll rate.');
assert.equal(delays.length, timersBeforeHidden, 'Hidden tab must not create a replacement timer.');

context.document.hidden = false;
context.duelSetPollRate(completed);
assert.equal(delays.at(-1), 5000, 'Visible completed game must resume at its backed-off rate.');

const active = { gameId: 'game-1', mode: 'roulette', status: 'playing' };
context.duelSetPollRate(active);
assert.equal(delays.at(-1), 800, 'Active Roulette polling must remain at 800 ms for bot advancement.');

assert.ok(html.includes('if (!duelScreen || duelScreen.hidden || document.hidden) return;'), 'duelRefresh must not contact the server in a hidden tab.');
assert.ok(html.includes('if(document.hidden)return;'), 'Remote Bot scheduling loop must pause in hidden tabs.');
assert.ok(!html.includes("if(g?.remoteNetworkTest&&g.status==='complete')g=await rnbFetchAuthoritativeGame"), 'Remote Bot completed-game duplicate GET loop remains.');
assert.ok(html.includes('queueMicrotask(() => duelRefresh(true));'), 'Rematch action must trigger an immediate focused refresh.');

console.log(JSON.stringify({
  status: 'passed',
  completedInitialMs: 2000,
  completedIdleMs: 5000,
  hiddenPollRate: 0,
  activeRouletteMs: 800,
  timersCreated: delays,
  timersCleared: cleared.length
}, null, 2));
