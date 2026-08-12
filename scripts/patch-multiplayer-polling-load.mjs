import { readFile, writeFile } from 'node:fs/promises';

const indexUrl = new URL('../index.html', import.meta.url);
let html = await readFile(indexUrl, 'utf8');

function replaceOnce(source, label, before, after) {
  if (source.includes(after)) return source;
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Multiplayer polling cleanup could not find ${label}.`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Multiplayer polling cleanup found more than one ${label}.`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

function replaceRemoteBotCompletedLoop(source) {
  const replacement = ` setInterval(()=>{
   if(document.hidden)return;
   const g=(typeof duelLastActiveGame!=='undefined'&&duelLastActiveGame)||(typeof rouletteLatestGame!=='undefined'&&rouletteLatestGame)||null;
   rnbScheduleRematch(g);
  },1000);`;
  if (source.includes(replacement)) return source;
  const marker = `if(g?.remoteNetworkTest&&g.status==='complete')g=await rnbFetchAuthoritativeGame`;
  const markerAt = source.indexOf(marker);
  if (markerAt < 0) throw new Error('Multiplayer polling cleanup could not find the Remote Bot completed-game GET marker.');
  const start = source.lastIndexOf('setInterval(async()=>{', markerAt);
  const endMarker = '},650);';
  const end = source.indexOf(endMarker, markerAt);
  if (start < 0 || end < 0) throw new Error('Multiplayer polling cleanup could not isolate the Remote Bot completed-game polling loop.');
  return source.slice(0, start) + replacement.trimStart() + source.slice(end + endMarker.length);
}

if (!html.includes('let duelCompletedActivityGameId = "";')) {
  html = replaceOnce(
    html,
    'the completed polling state',
    `    let duelPollTimer = null;
    let duelBusy = false;`,
    `    let duelPollTimer = null;
    let duelCompletedActivityGameId = "";
    let duelCompletedActivityAt = 0;
    let duelBusy = false;`
  );
}

if (!html.includes('let completedPollRate = 2000;')) html = replaceOnce(
  html,
  'the completed game polling rate',
  `      const desired = sharedLifecycleLive ? 200 : drawPlaying ? 650 : rouletteLive ? 800 : fishingLive ? 450 : completedAwaitingRematch ? 700 : noFocusedGame ? 2000 : 1800;
      duelSetSharedCountdown(game);
      if (window.__duelPollRate !== desired || !duelPollTimer) {`,
  `      let completedPollRate = 2000;
      if (completedAwaitingRematch) {
        const completedGameId = String(game?.gameId || "");
        if (completedGameId !== duelCompletedActivityGameId) {
          duelCompletedActivityGameId = completedGameId;
          duelCompletedActivityAt = Date.now();
        }
        completedPollRate = Date.now() - duelCompletedActivityAt < 15000 ? 2000 : 5000;
      } else {
        duelCompletedActivityGameId = "";
        duelCompletedActivityAt = 0;
      }
      const desired = sharedLifecycleLive ? 200 : drawPlaying ? 650 : rouletteLive ? 800 : fishingLive ? 450 : completedAwaitingRematch ? completedPollRate : noFocusedGame ? 2000 : 1800;
      if (document.hidden) {
        if (duelPollTimer) clearInterval(duelPollTimer);
        duelPollTimer = null;
        window.__duelPollRate = 0;
        return;
      }
      duelSetSharedCountdown(game);
      if (window.__duelPollRate !== desired || !duelPollTimer) {`
);

if (!html.includes('if (!duelScreen || duelScreen.hidden || document.hidden) return;')) html = replaceOnce(
  html,
  'the hidden-tab focused refresh guard',
  `    async function duelRefresh(silent = false) {
      if (!duelScreen || duelScreen.hidden) return;`,
  `    async function duelRefresh(silent = false) {
      if (!duelScreen || duelScreen.hidden || document.hidden) return;`
);

if (!html.includes('if (document.hidden) {\n        if (duelPollTimer) clearInterval(duelPollTimer);')) html = replaceOnce(
  html,
  'the multiplayer visibility handler',
  `    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && multiplayerScreen && !multiplayerScreen.hidden) mpRefresh(true);
      if (!document.hidden && runnerScreen && !runnerScreen.hidden) runnerLoadActive(true);
      if (!document.hidden && duelScreen && !duelScreen.hidden) duelRefresh(true);
    });`,
  `    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        if (duelPollTimer) clearInterval(duelPollTimer);
        duelPollTimer = null;
        window.__duelPollRate = 0;
        return;
      }
      if (multiplayerScreen && !multiplayerScreen.hidden) mpRefresh(true);
      if (runnerScreen && !runnerScreen.hidden) runnerLoadActive(true);
      if (duelScreen && !duelScreen.hidden) {
        duelSetPollRate(duelLastActiveGame || null);
        duelRefresh(true);
      }
    });`
);

html = replaceRemoteBotCompletedLoop(html);

html = replaceOnce(
  html,
  'the local rematch activity timestamp',
  `        if (btn) { btn.disabled = true; btn.textContent = "Requesting rematch…"; }
        const data = await duelRequest("act", { gameId: duelCurrentGameId, choice: "rematch" });`,
  `        if (btn) { btn.disabled = true; btn.textContent = "Requesting rematch…"; }
        duelCompletedActivityGameId = String(duelCurrentGameId || "");
        duelCompletedActivityAt = Date.now();
        const data = await duelRequest("act", { gameId: duelCurrentGameId, choice: "rematch" });`
);

html = replaceOnce(
  html,
  'the accepted rematch immediate refresh',
  `          duelSetStatus("Rematch accepted. Both players must click Ready.", "good");
          return;`,
  `          duelSetStatus("Rematch accepted. Both players must click Ready.", "good");
          queueMicrotask(() => duelRefresh(true));
          return;`
);

html = replaceOnce(
  html,
  'the requested rematch immediate refresh',
  `        duelRenderActive(data.game, false);
        duelSetStatus("Rematch requested. Your opponent has 10 seconds to accept.", "good");`,
  `        duelRenderActive(data.game, false);
        duelSetPollRate(data.game || duelLastActiveGame || null);
        queueMicrotask(() => duelRefresh(true));
        duelSetStatus("Rematch requested. Your opponent has 10 seconds to accept.", "good");`
);

for (const required of [
  'let duelCompletedActivityAt = 0;',
  'completedPollRate = Date.now() - duelCompletedActivityAt < 15000 ? 2000 : 5000;',
  'if (!duelScreen || duelScreen.hidden || document.hidden) return;',
  'duelPollTimer = null;\n        window.__duelPollRate = 0;',
  'if(document.hidden)return;',
  'rnbScheduleRematch(g);\n  },1000);',
  'duelCompletedActivityAt = Date.now();',
  'queueMicrotask(() => duelRefresh(true));'
]) {
  if (!html.includes(required)) throw new Error(`Final multiplayer polling cleanup is missing ${required}`);
}

for (const forbidden of [
  'completedAwaitingRematch ? 700',
  `if(g?.remoteNetworkTest&&g.status==='complete')g=await rnbFetchAuthoritativeGame`,
  '},650);',
  'if (!duelScreen || duelScreen.hidden) return;'
]) {
  if (html.includes(forbidden)) throw new Error(`Old multiplayer polling behavior remains: ${forbidden}`);
}

await writeFile(indexUrl, html);
console.log('Reduced multiplayer load: completed polling backs off, hidden tabs pause, rematches refresh immediately, and the Remote Bot no longer duplicates completed-game GETs.');
