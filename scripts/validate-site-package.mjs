import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const exists = async path => { try { await access(new URL(path, root)); return true; } catch { return false; } };
for (const entry of ['index.html', 'admin.html']) {
  assert.equal(await read(`dist/${entry}`), await read(entry), `Published ${entry} is stale`);
}
for (const excluded of ['scripts', 'node_modules', 'docs', '.github', 'shared/site', 'netlify']) {
  assert.equal(await exists(`dist/${excluded}`), false, `Source-only ${excluded} must not be published`);
}
const html = await read('dist/index.html');
assert.ok(html.includes('SITE_ORGANIZATION_ADMIN_V1_20261009'));
assert.ok(!html.includes('SITE_INCLUDE:'), 'The page must contain assembled executable source');
for (const retired of ['async function buildTicket(', 'async function runnerStart(', 'async function horseStartRace(', 'async function arcadePlay(']) {
  assert.ok(!html.includes(retired), `Retired player runtime remains: ${retired}`);
}
for (const endpoint of ['buy-ticket', 'record-bet', 'runner-action', 'horse-action', 'arcade-action']) {
  assert.equal(await exists(`netlify/functions/${endpoint}.js`), false, `Retired play endpoint remains: ${endpoint}`);
}
for (const entry of ['index.html', 'admin.html']) {
  const page = await read(`dist/${entry}`);
  for (const match of page.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="(\/[^"?]+)(?:\?[^" ]*)?"/g)) {
    assert.equal(await exists(`dist${match[1]}`), true, `Missing published dependency: ${match[1]}`);
  }
}
for (const game of ['roulette', 'draw', 'fishing', 'safe-cracker', 'mountain-race', 'blackjack-duel']) {
  assert.equal(await exists(`dist/games/multiplayer/${game}/index.html`), true, `Missing game entry: ${game}`);
  assert.equal(await exists(`dist/games/multiplayer/${game}/presentation.js`), false, 'Source fragments must not be separately executed');
}
console.log('Site package validated: assembled entries, six game routes, runtime dependencies, retired endpoints, and source exclusions.');
