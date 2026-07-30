import { readFile, writeFile } from 'node:fs/promises';

const dataUrl = new URL('../netlify/functions/_data.js', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Safe Cracker Ready-storage patch could not find ${label}.`);
  return source.replace(before, after);
}

function replaceInsideFunction(source, functionMarker, before, after, label) {
  const start = source.indexOf(functionMarker);
  if (start < 0) throw new Error(`Safe Cracker Ready-storage patch could not find ${label} function.`);
  const nextAsync = source.indexOf('\nasync function ', start + functionMarker.length);
  const nextPlain = source.indexOf('\nfunction ', start + functionMarker.length);
  const candidates = [nextAsync, nextPlain].filter(value => value >= 0);
  const end = candidates.length ? Math.min(...candidates) : source.length;
  const section = source.slice(start, end);
  if (section.includes(after)) return source;
  if (!section.includes(before)) throw new Error(`Safe Cracker Ready-storage patch could not find ${label}.`);
  return source.slice(0, start) + section.replace(before, after) + source.slice(end);
}

function replaceSection(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0 || end <= start) throw new Error(`Safe Cracker Ready-storage patch could not isolate ${label}.`);
  return source.slice(0, start) + replacement + source.slice(end);
}

let data = await readFile(dataUrl, 'utf8');

const strongReader = `async function duelGetRawStrong(gameId, attempts = 4) {
  const id = mpCleanId(gameId);
  if (!id) return null;
  const total = Math.max(1, Math.min(6, int(attempts, 4)));
  const primaryStore = getUsersStore();
  let explicitStrongStore = null;
  for (let attempt = 0; attempt < total; attempt++) {
    try {
      const raw = await primaryStore.get(duelGameKey(id), { type: "json", consistency: "strong" });
      if (raw) return duelSanitizeGame(raw);
    } catch {}
    try {
      explicitStrongStore ||= duelGetStrongStore();
      const raw = await explicitStrongStore.get(duelGameKey(id), { type: "json", consistency: "strong" });
      if (raw) return duelSanitizeGame(raw);
    } catch {}
    if (attempt + 1 < total) await sleep(Math.min(900, 180 * (attempt + 1)));
  }
  return null;
}

`;
data = replaceSection(data, 'async function duelGetRawStrong(gameId, attempts = 4) {', 'async function duelJoinGame', strongReader, 'operation-level strong game reader');

data = replaceRequired(data, '    const pointer=await store.get(duelActiveKey(viewer),{type:"json"});', '    const pointer=await store.get(duelActiveKey(viewer),{type:"json",consistency:"strong"});', 'strong active-game pointer read');
data = replaceRequired(data, '      const g=await duelGetRaw(pointer.gameId);', '      const g=await duelGetRawStrong(pointer.gameId,2) || await duelGetRaw(pointer.gameId);', 'strong active-game record read');

const oldReadyLookup = `    let game = await duelGetRaw(gameId) || await duelGetRawStrong(gameId, 1);
    if (!game) {
      await sleep(160);
      game = await duelGetRaw(gameId) || await duelGetRawStrong(gameId, 1);
    }`;
const stableReadyLookup = `    const requestedGameId = mpCleanId(gameId);
    let game = null;
    for (let attempt = 0; attempt < 6 && !game; attempt += 1) {
      game = await duelGetRawStrong(requestedGameId, 1) || await duelGetRaw(requestedGameId);
      if (!game) {
        const active = await duelFindActiveGameForUser(user.id);
        if (active && active.gameId === requestedGameId) game = active;
      }
      if (!game && attempt < 5) await sleep(180 + attempt * 180);
    }`;
data = replaceInsideFunction(data, 'async function duelReadyGame(user, gameId, options = {}) {', oldReadyLookup, stableReadyLookup, 'authoritative Ready recovery loop');
await writeFile(dataUrl, data);

let html = await readFile(indexUrl, 'utf8');
const stableReadyHelper = `    // SAFE_CRACKER_READY_RETRY_START
    async function duelSafeCrackerReadyRequest(gameId) {
      const isSafeCracker = String(duelLastActiveGame?.mode || "") === "safecracker";
      if (!isSafeCracker) return await duelRequest("act", { gameId, choice: "ready" });
      const deadlineAt = Date.now() + 12000;
      let attempt = 0;
      let lastError = null;
      window.__safeCrackerReadyRetryInFlight = 1;
      try {
        while (Date.now() < deadlineAt) {
          try {
            return await duelRequest("act", { gameId, choice: "ready" });
          } catch (error) {
            lastError = error;
            attempt += 1;
            const delay = Math.min(1500, 280 + attempt * 180);
            if (Date.now() + delay >= deadlineAt) break;
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      } finally {
        window.__safeCrackerReadyRetryInFlight = 0;
      }
      throw lastError || new Error("Unable to mark ready.");
    }
    // SAFE_CRACKER_READY_RETRY_END

`;
html = replaceSection(html, '    // SAFE_CRACKER_READY_RETRY_START', '    async function duelReady() {', stableReadyHelper, 'single-tap Ready retry helper');
await writeFile(indexUrl, html);

console.log('Patched Safe Cracker operation-level strong reads and authoritative single-tap Ready recovery.');
