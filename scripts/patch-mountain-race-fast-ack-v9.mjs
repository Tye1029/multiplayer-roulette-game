import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const dataUrl = new URL('netlify/functions/_data.js', root);
const actionUrl = new URL('netlify/functions/duel-action.js', root);
const indexUrl = new URL('index.html', root);
const stateValidatorUrl = new URL('scripts/validate-mountain-race-state-sync.mjs', root);
const marker = '// MOUNTAIN_RACE_FAST_ACK_V9';
const htmlMarker = '<!-- MOUNTAIN_RACE_FAST_ACK_V9 -->';

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint fast-ack patch could not find ${label}.`);
  return source.replace(before, after);
}

let data = await readFile(dataUrl, 'utf8');
if (!data.includes(marker)) {
  const helper = `${marker}
async function mountainRaceFastSaveGame(game) {
  const clean = duelSanitizeGame({
    ...game,
    schemaVersion: DUEL_SCHEMA_VERSION,
    revision: int(game?.revision, 0) + 1,
    updatedAt: nowIso()
  });
  await getUsersStore().setJSON(duelGameKey(clean.gameId), clean);
  return clean;
}
`;
  data = replaceRequired(
    data,
    'const mountainRaceIntegration = createMountainRaceIntegration({',
    `${helper}\nconst mountainRaceIntegration = createMountainRaceIntegration({`,
    'Mountain Race integration host'
  );
  data = replaceRequired(
    data,
    '  saveGame: duelSaveGame,\n  publicGame: duelPublicGame,',
    '  saveGame: mountainRaceFastSaveGame,\n  publicGame: duelPublicGame,',
    'Mountain Race gameplay save function'
  );
}
if (!data.includes(marker)) throw new Error('Summit Sprint fast-save marker is missing.');
if (!data.includes('saveGame: mountainRaceFastSaveGame')) throw new Error('Summit Sprint still rewrites active pointers for every input batch.');
await writeFile(dataUrl, data);

let action = await readFile(actionUrl, 'utf8');
if (!action.includes(marker)) {
  action = replaceRequired(
    action,
    'const DUEL_PROFILE_CACHE_MS = 2 * 60 * 1000;',
    `const DUEL_PROFILE_CACHE_MS = 2 * 60 * 1000;
${marker}
const DUEL_SITE_USER_CACHE = globalThis.__DUEL_SITE_USER_CACHE || (globalThis.__DUEL_SITE_USER_CACHE = new Map());
const DUEL_SITE_USER_CACHE_MS = 10 * 60 * 1000;`,
    'site-user cache declaration'
  );
  action = replaceRequired(
    action,
    '    const siteUser = await resolveSiteUser(visitor, body.visitorId);',
    `    const siteCacheKey = \`${'${String(visitor.id || "")}:${String(body.visitorId || "")}'}\`;
    const cachedSiteUser = DUEL_SITE_USER_CACHE.get(siteCacheKey);
    const siteUser = cachedSiteUser && Date.now() - cachedSiteUser.at < DUEL_SITE_USER_CACHE_MS
      ? cachedSiteUser.user
      : await resolveSiteUser(visitor, body.visitorId);
    if (!cachedSiteUser || cachedSiteUser.user?.id !== siteUser?.id) {
      DUEL_SITE_USER_CACHE.set(siteCacheKey, { at: Date.now(), user: siteUser });
      if (DUEL_SITE_USER_CACHE.size > 120) {
        for (const [key, value] of DUEL_SITE_USER_CACHE.entries()) {
          if (Date.now() - value.at > DUEL_SITE_USER_CACHE_MS) DUEL_SITE_USER_CACHE.delete(key);
        }
      }
    }`,
    'site-user resolution'
  );
  action = replaceRequired(
    action,
    'result?.unchanged || result?.databaseAuthoritative',
    'result?.unchanged || result?.databaseAuthoritative || result?.skipBalanceLookup',
    'active-response balance bypass'
  );
}
if (!action.includes(marker)) throw new Error('Summit Sprint fast-ack route marker is missing.');
if (!action.includes('result?.skipBalanceLookup')) throw new Error('Active Summit Sprint inputs still wait for a balance read.');
if (!action.includes('DUEL_SITE_USER_CACHE')) throw new Error('Warm Summit Sprint requests still resolve the same site user repeatedly.');
await writeFile(actionUrl, action);

let html = await readFile(indexUrl, 'utf8');
if (!html.includes(htmlMarker)) {
  const anchor = html.includes('</body>') ? '</body>' : html.includes('</html>') ? '</html>' : '';
  html = anchor ? html.replace(anchor, `${htmlMarker}\n${anchor}`) : `${html}\n${htmlMarker}\n`;
}
html = html
  .replaceAll('mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=8', 'mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=9')
  .replaceAll('&sync=9&sync=9', '&sync=9');
if (!html.includes(htmlMarker)) throw new Error('Summit Sprint fast-ack deployment marker is missing.');
if (!html.includes('mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=9')) throw new Error('Summit Sprint fast-ack cache boundary is missing.');
await writeFile(indexUrl, html);

let stateValidator = await readFile(stateValidatorUrl, 'utf8');
stateValidator = stateValidator
  .replaceAll('mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=8', 'mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=9')
  .replaceAll('&sync=9&sync=9', '&sync=9');
await writeFile(stateValidatorUrl, stateValidator);

console.log('Added Summit Sprint Fast Ack V9: active batches write only the game blob, warm requests reuse the signed user mapping, and playing responses skip the unrelated balance read.');
