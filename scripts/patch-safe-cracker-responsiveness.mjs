import { readFile, writeFile } from 'node:fs/promises';

const dataUrl = new URL('../netlify/functions/_data.js', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const actionUrl = new URL('../netlify/functions/duel-action.js', import.meta.url);

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Safe Cracker responsiveness patch could not find ${label}.`);
  return source.replace(before, after);
}

function replaceInsideFunction(source, functionMarker, before, after, label) {
  const start = source.indexOf(functionMarker);
  if (start < 0) throw new Error(`Safe Cracker responsiveness patch could not find ${label} function.`);
  const nextFunction = source.indexOf('\nasync function ', start + functionMarker.length);
  const nextPlainFunction = source.indexOf('\nfunction ', start + functionMarker.length);
  const candidates = [nextFunction, nextPlainFunction].filter(value => value >= 0);
  const end = candidates.length ? Math.min(...candidates) : source.length;
  const section = source.slice(start, end);
  if (section.includes(after)) return source;
  if (!section.includes(before)) throw new Error(`Safe Cracker responsiveness patch could not find ${label}.`);
  return source.slice(0, start) + section.replace(before, after) + source.slice(end);
}

let data = await readFile(dataUrl, 'utf8');

data = replaceInsideFunction(
  data,
  'async function duelReadyGame(user, gameId, options = {}) {',
  '    let game = await duelGetRaw(gameId);',
  `    let game = await duelGetRaw(gameId) || await duelGetRawStrong(gameId, 1);
    if (!game) {
      await sleep(160);
      game = await duelGetRaw(gameId) || await duelGetRawStrong(gameId, 1);
    }`,
  'retryable Ready game lookup'
);

data = replaceRequired(
  data,
  '    let game = await duelGetRawStrong(gameId, 2) || await duelGetRaw(gameId);',
  '    let game = await duelGetRaw(gameId) || await duelGetRawStrong(gameId, 1);',
  'fast Safe Cracker action read'
);

data = replaceRequired(
  data,
  '    let latest = await duelGetRawStrong(gameId, 2) || await duelGetRaw(gameId) || game;',
  '    let latest = await duelGetRaw(gameId) || await duelGetRawStrong(gameId, 1) || game;',
  'fast Safe Cracker bot advancement read'
);

data = replaceRequired(
  data,
  '    let latest = await duelGetRawStrong(gameId, 2) || await duelGetRaw(gameId) || fallback;',
  '    let latest = await duelGetRaw(gameId) || await duelGetRawStrong(gameId, 1) || fallback;',
  'fast verified guess read'
);

data = replaceRequired(
  data,
  '      const confirmedComplete = await duelGetRawStrong(gameId, 2) || await duelGetRaw(gameId) || completed;',
  '      const confirmedComplete = await duelGetRawStrong(gameId, 1) || await duelGetRaw(gameId) || completed;',
  'single-attempt completed verification'
);

data = replaceRequired(
  data,
  '    const confirmed = await duelGetRawStrong(gameId, 2) || await duelGetRaw(gameId) || saved;',
  '    const confirmed = await duelGetRawStrong(gameId, 1) || await duelGetRaw(gameId) || saved;',
  'single-attempt action verification'
);

data = replaceRequired(
  data,
  '  return await duelGetRawStrong(gameId, 2) || await duelGetRaw(gameId) || fallback;',
  '  return await duelGetRawStrong(gameId, 1) || await duelGetRaw(gameId) || fallback;',
  'single-attempt final verification'
);

data = replaceRequired(
  data,
  '    secondsLeft: Number.isFinite(endMs) ? Math.max(0, Math.ceil((endMs - now) / 1000)) : 75,',
  '    secondsLeft: complete ? 0 : Number.isFinite(endMs) ? Math.max(0, Math.ceil((endMs - now) / 1000)) : 75,',
  'completed timer freeze'
);

await writeFile(dataUrl, data);

let html = await readFile(indexUrl, 'utf8');

const readyHelper = `    // SAFE_CRACKER_READY_RETRY_START
    async function duelSafeCrackerReadyRequest(gameId) {
      const isSafeCracker = String(duelLastActiveGame?.mode || "") === "safecracker";
      const attempts = isSafeCracker ? 3 : 1;
      let lastError = null;
      window.__safeCrackerReadyRetryInFlight = isSafeCracker ? 1 : 0;
      try {
        for (let attempt = 0; attempt < attempts; attempt += 1) {
          try {
            return await duelRequest("act", { gameId, choice: "ready" });
          } catch (error) {
            lastError = error;
            if (!isSafeCracker || attempt + 1 >= attempts) throw error;
            try {
              const check = await duelRequest("get", { gameId, knownRevision: "" });
              if (check?.game && ["countdown", "playing", "complete"].includes(String(check.game.status || ""))) return check;
            } catch (_) {}
            await new Promise(resolve => setTimeout(resolve, 260 + attempt * 260));
          }
        }
      } finally {
        window.__safeCrackerReadyRetryInFlight = 0;
      }
      throw lastError || new Error("Unable to mark ready.");
    }
    // SAFE_CRACKER_READY_RETRY_END

`;
if (!html.includes('// SAFE_CRACKER_READY_RETRY_START')) {
  html = replaceRequired(html, '    async function duelReady() {', `${readyHelper}    async function duelReady() {`, 'Ready retry helper insertion point');
}

html = replaceRequired(
  html,
  '        const data = await duelRequest("act", { gameId: duelCurrentGameId, choice: "ready" });',
  '        const data = await duelSafeCrackerReadyRequest(duelCurrentGameId);',
  'one-tap Ready retry call'
);

html = replaceRequired(
  html,
  '      const controller = typeof AbortController === "function" ? new AbortController() : null;',
  `      const controller = typeof AbortController === "function" ? new AbortController() : null;
      const safeCrackerFocusedGet = action === "get" && String(payload?.gameId || "") === String(duelCurrentGameId || "") && String(duelLastActiveGame?.mode || "") === "safecracker";
      if (safeCrackerFocusedGet && controller) window.__safeCrackerFocusedGetAbort = controller;`,
  'focused Safe Cracker GET abort handle'
);

html = replaceRequired(
  html,
  '        clearTimeout(timeout);',
  `        if (window.__safeCrackerFocusedGetAbort === controller) window.__safeCrackerFocusedGetAbort = null;
        clearTimeout(timeout);`,
  'focused GET abort cleanup'
);

html = replaceRequired(
  html,
  `   if(mutation){window.__duelMutationRequestsInFlight=Number(window.__duelMutationRequestsInFlight||0)+1;duelPausePollingForMutation()}`,
  `   if(mutation){
    const safeCrackerMutation=String(action||'')==='act'&&String(payload?.gameId||'')===String(duelCurrentGameId||'')&&String(duelLastActiveGame?.mode||'')==='safecracker';
    if(safeCrackerMutation){try{window.__safeCrackerFocusedGetAbort?.abort()}catch{}window.__safeCrackerFocusedGetAbort=null}
    window.__duelMutationRequestsInFlight=Number(window.__duelMutationRequestsInFlight||0)+1;duelPausePollingForMutation()
   }`,
  'Safe Cracker mutation poll cancellation'
);

html = replaceRequired(
  html,
  '      const sharedLifecycleLive = Boolean(game && ["ready", "countdown"].includes(game.status));',
  `      const safeCrackerLive = Boolean(game && game.mode === "safecracker" && ["ready", "countdown", "playing"].includes(game.status));
      const sharedLifecycleLive = Boolean(game && game.mode !== "safecracker" && ["ready", "countdown"].includes(game.status));`,
  'Safe Cracker polling state'
);

html = replaceRequired(
  html,
  '      const desired = sharedLifecycleLive ? 200 : drawPlaying ? 650 :',
  '      const desired = safeCrackerLive ? (game.status === "playing" ? 2200 : 650) : sharedLifecycleLive ? 200 : drawPlaying ? 650 :',
  'Safe Cracker polling cadence'
);

html = replaceRequired(
  html,
  '      if (!duelScreen || duelScreen.hidden || document.hidden || Number(window.__duelMutationRequestsInFlight || 0) > 0) return;',
  '      if (!duelScreen || duelScreen.hidden || document.hidden || Number(window.__duelMutationRequestsInFlight || 0) > 0 || Number(window.__safeCrackerReadyRetryInFlight || 0) > 0) return;',
  'Ready retry polling guard'
);

html = html.replaceAll('/assets/safe-cracker/safe-cracker.css?v=3', '/assets/safe-cracker/safe-cracker.css?v=4');
html = html.replaceAll('/assets/safe-cracker/safe-cracker.js?v=3', '/assets/safe-cracker/safe-cracker.js?v=4');
await writeFile(indexUrl, html);

let action = await readFile(actionUrl, 'utf8');
action = replaceRequired(
  action,
  'const DUEL_FUNCTION_BUILD = "safecracker-start-flow-v3";',
  'const DUEL_FUNCTION_BUILD = "safecracker-responsive-v4";',
  'responsive function bundle marker'
);
await writeFile(actionUrl, action);

console.log('Patched Safe Cracker automatic Ready retry, focused-poll cancellation, lighter polling, fast reads, and completed timer freeze.');
