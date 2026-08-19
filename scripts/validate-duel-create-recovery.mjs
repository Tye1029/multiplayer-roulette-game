import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const data = await readFile(new URL('../netlify/functions/_data.js', import.meta.url), 'utf8');
const action = await readFile(new URL('../netlify/functions/duel-action.js', import.meta.url), 'utf8');
const injector = await readFile(new URL('./inject-lamp-assets.mjs', import.meta.url), 'utf8');

for (const required of [
  'const timeoutMs = ["create", "create-remote-bot"].includes(action) ? 30000 : 10000;',
  'timeoutError.code = "DUEL_TIMEOUT";',
  'const DUEL_PENDING_CREATE_KEY = "duelPendingCreateV2";',
  '/^duel-[a-z0-9_-]+-\\d{10,16}-[a-f0-9]{10,32}$/.test',
  'clientGameId: pending.gameId',
  'duelRecoverTimedOutCreate(pending.gameId)',
  'Your existing active game was reopened instead of creating a duplicate.'
]) if (!html.includes(required)) throw new Error(`Create recovery client validation is missing ${required}`);

for (const forbidden of [
  'const timeoutMs = action === "create" ? 12000 : 10000;',
  'Finish or cancel your current game before creating another one.',
  'const current = await duelRequest("get", { gameId: duelCurrentGameId });'
]) if (html.includes(forbidden)) throw new Error(`Old create behavior remains: ${forbidden}`);

for (const required of [
  'if(options?.scanFallback===false) return null;',
  'function duelClientCreateGameId(mode, value)',
  'const activeGame = await duelFindActiveGameForUser(user.id,"",{scanFallback:false});',
  'recoveredCreate:true',
  'resumedExisting:true',
  'ledgerResult.added ? wager : 0'
]) if (!data.includes(required)) throw new Error(`Create recovery server validation is missing ${required}`);

if (!action.includes('clientGameId: body.clientGameId')) throw new Error('Create handler does not forward clientGameId.');
if (!injector.includes("await import('./patch-duel-create-recovery.mjs');")) throw new Error('Create recovery patch is not part of the build.');

console.log('Duel create recovery validation passed: no preflight GET, pointer-only create checks, deterministic recovery IDs, longer timeouts for normal and atomic bot creation, and duplicate-safe escrow statistics.');
