import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../netlify/functions/duel-action.js', import.meta.url), 'utf8');
const secret = 'safe-cracker-local-test-secret';
const payload = Buffer.from(JSON.stringify({id: 'test-player', name: 'Test', exp: Date.now() + 60000})).toString('base64url');
const token = `${payload}.${crypto.createHmac('sha256', secret).update(payload).digest('base64url')}`;
let actionResult;
let balanceReads = 0;
const mocks = {
  initBlobs() {},
  resolveSiteUser: async () => ({id: 'test-player'}),
  duelActionGame: async () => actionResult,
  getUserRecord: async () => { balanceReads++; return {balance: 1200}; },
  getRecordBalance: record => record.balance
};
const context = vm.createContext({
  exports: {}, Buffer, console,
  process: {env: {DUEL_SESSION_SECRET: secret}},
  require: name => {
    if (name === 'crypto') return crypto;
    if (name === './_data') return mocks;
    throw new Error(`Unexpected test dependency ${name}`);
  }
});
vm.runInContext(source, context);
const event = {httpMethod: 'POST', body: JSON.stringify({visitorKey:'TestOnly1234', duelSessionToken: token, action:'act', gameId:'test-game', choice:'safecracker:guess:2'})};
async function run(result) {
  actionResult = result;
  balanceReads = 0;
  const response = await context.exports.handler(event);
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['X-Safe-Cracker-Feedback'], 'fast-authoritative-v1');
  return JSON.parse(response.body);
}
const active = await run({game:{mode:'safecracker',status:'playing'},skipBalanceLookup:true});
assert.equal(balanceReads, 0, 'Active guesses must not wait for an unchanged balance');
assert.equal(active.game.status, 'playing');
assert.ok(!('serverBalance' in active));
const finished = await run({game:{mode:'safecracker',status:'complete'},record:{balance:2200}});
assert.equal(finished.serverBalance, 2200, 'Completion must return the authoritative payout balance');
for (const mode of ['safecracker','roulette','mountainrace','fishing','blackjackduel']) {
  const ordinary = await run({game:{mode,status:'playing'}});
  assert.equal(balanceReads, 1, `${mode} normal responses must retain balance lookup`);
  assert.equal(ordinary.serverBalance, 1200);
}
for (const result of [{unchanged:true}, {databaseAuthoritative:true}]) {
  await run(result);
  assert.equal(balanceReads, 0, 'Existing shared fast responses must remain unchanged');
}
console.log('Safe Cracker feedback endpoint: fast guesses, completion balances, and other-game responses passed.');
