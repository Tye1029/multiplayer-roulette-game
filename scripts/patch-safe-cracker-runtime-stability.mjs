import { readFile, writeFile } from 'node:fs/promises';

const indexUrl = new URL('../index.html', import.meta.url);
const rendererStart = '// SAFE_CRACKER_RENDERER_RETENTION_V17_START';
const rendererEnd = '// SAFE_CRACKER_RENDERER_RETENTION_V17_END';
const pollingStart = '// SAFE_CRACKER_POLL_STABILITY_V17_START';
const pollingEnd = '// SAFE_CRACKER_POLL_STABILITY_V17_END';

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Safe Cracker runtime-stability patch could not find ${label}.`);
  return source.replace(before, after);
}

let html = await readFile(indexUrl, 'utf8');

const renderNeedle = `    function duelRenderActive(game, force = false) {
      if (!duelActive) return;`;
const renderReplacement = `    function duelRenderActive(game, force = false) {
      if (!duelActive) return;
      ${rendererStart}
      const safeCrackerRendererStable = window.__safeCrackerStableActiveGame || null;
      const safeCrackerRendererCurrentId = String(duelCurrentGameId || "");
      const safeCrackerRendererStableActive = Boolean(
        safeCrackerRendererStable?.mode === "safecracker" &&
        ["ready", "countdown", "playing"].includes(String(safeCrackerRendererStable.status || "")) &&
        safeCrackerRendererCurrentId &&
        String(safeCrackerRendererStable.gameId || "") === safeCrackerRendererCurrentId
      );
      const safeCrackerRendererIncomingId = String(game?.gameId || "");
      const safeCrackerRendererUnexpectedReplacement = Boolean(
        game &&
        safeCrackerRendererStableActive &&
        safeCrackerRendererIncomingId !== safeCrackerRendererCurrentId
      );
      if ((!game || safeCrackerRendererUnexpectedReplacement) && safeCrackerRendererStableActive) {
        game = safeCrackerRendererStable;
        window.__safeCrackerRendererRecoveries = Number(window.__safeCrackerRendererRecoveries || 0) + 1;
      } else if (
        game?.mode === "safecracker" &&
        ["ready", "countdown", "playing"].includes(String(game.status || "")) &&
        (!safeCrackerRendererCurrentId || safeCrackerRendererIncomingId === safeCrackerRendererCurrentId)
      ) {
        window.__safeCrackerStableActiveGame = game;
        window.__safeCrackerStableActiveSeenAt = Date.now();
      } else if (
        game?.mode === "safecracker" &&
        ["complete", "cancelled"].includes(String(game.status || "")) &&
        safeCrackerRendererIncomingId === safeCrackerRendererCurrentId
      ) {
        window.__safeCrackerStableActiveGame = null;
        window.__safeCrackerStableActiveSeenAt = 0;
      }
      ${rendererEnd}`;
if (!html.includes(rendererStart)) {
  html = replaceRequired(html, renderNeedle, renderReplacement, 'renderer entry point');
}

const refreshNeedle = `    async function duelRefresh(silent = false) {
      if (!duelScreen || duelScreen.hidden || document.hidden || Number(window.__duelMutationRequestsInFlight || 0) > 0 || Number(window.__safeCrackerReadyRetryInFlight || 0) > 0) return;`;
const refreshReplacement = `    async function duelRefresh(silent = false) {
      ${pollingStart}
      const safeCrackerPollBackoffActive = Boolean(
        duelLastActiveGame?.mode === "safecracker" &&
        ["ready", "countdown", "playing"].includes(String(duelLastActiveGame.status || "")) &&
        Date.now() < Number(window.__safeCrackerPollBackoffUntil || 0)
      );
      ${pollingEnd}
      if (!duelScreen || duelScreen.hidden || document.hidden || Number(window.__duelMutationRequestsInFlight || 0) > 0 || Number(window.__safeCrackerReadyRetryInFlight || 0) > 0 || safeCrackerPollBackoffActive) return;`;
if (!html.includes(pollingStart)) {
  html = replaceRequired(html, refreshNeedle, refreshReplacement, 'refresh backoff entry point');
}

html = replaceRequired(
  html,
  `      const desired = safeCrackerLive ? (game.status === "playing" ? 2200 : 650) : sharedLifecycleLive ? 200 :`,
  `      const desired = safeCrackerLive ? (game.status === "playing" ? 2600 : 1600) : sharedLifecycleLive ? 200 :`,
  'Safe Cracker polling cadence'
);

html = replaceRequired(
  html,
  `            const got = await duelRequest("get", { gameId: duelCurrentGameId, knownRevision });
            if (refreshSequence !== duelRefreshSequence) return;`,
  `            const got = await duelRequest("get", { gameId: duelCurrentGameId, knownRevision });
            if (safeCrackerRefreshStable) {
              window.__safeCrackerPollFailures = 0;
              window.__safeCrackerPollBackoffUntil = 0;
            }
            if (refreshSequence !== duelRefreshSequence) return;`,
  'successful focused-poll reset'
);

html = replaceRequired(
  html,
  `          } catch (error) {
            focusedGetFailed = true;
            // Never tear down or replace an active board because one poll was`,
  `          } catch (error) {
            focusedGetFailed = true;
            if (safeCrackerRefreshStable) {
              const failures = Math.min(6, Number(window.__safeCrackerPollFailures || 0) + 1);
              window.__safeCrackerPollFailures = failures;
              window.__safeCrackerPollBackoffUntil = Date.now() + Math.min(6000, 700 * (2 ** Math.max(0, failures - 1)));
            }
            // Never tear down or replace an active board because one poll was`,
  'focused-poll failure backoff'
);

html = replaceRequired(
  html,
  `        if (duelRefreshPending) {
          duelRefreshPending = false;
          queueMicrotask(() => duelRefresh(true));
        }`,
  `        if (duelRefreshPending) {
          duelRefreshPending = false;
          const safeCrackerPendingRefresh = Boolean(
            duelLastActiveGame?.mode === "safecracker" &&
            ["ready", "countdown", "playing"].includes(String(duelLastActiveGame.status || ""))
          );
          if (!safeCrackerPendingRefresh) queueMicrotask(() => duelRefresh(true));
        }`,
  'pending-refresh storm prevention'
);

await writeFile(indexUrl, html);
console.log('Applied Safe Cracker runtime stability v17: the renderer retains the current live board, Ready/countdown polling is slower, failed reads back off exponentially, and delayed interval ticks cannot form an immediate refresh chain.');
