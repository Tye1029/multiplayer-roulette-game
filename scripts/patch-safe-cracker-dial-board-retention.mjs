import { readFile, writeFile } from 'node:fs/promises';

const indexUrl = new URL('../index.html', import.meta.url);
const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const rendererStart = '// SAFE_CRACKER_DIAL_BOARD_RETENTION_V15_START';
const rendererEnd = '// SAFE_CRACKER_DIAL_BOARD_RETENTION_V15_END';
const clientStart = '// SAFE_CRACKER_DIAL_ACTIVITY_V15_START';
const clientEnd = '// SAFE_CRACKER_DIAL_ACTIVITY_V15_END';

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Safe Cracker dial-board retention patch could not find ${label}.`);
  return source.replace(before, after);
}

let client = await readFile(clientUrl, 'utf8');
if (!client.includes(clientStart)) {
  client = replaceRequired(
    client,
    `        runtime.dragging = true;\n        runtime.pointerId = event.pointerId;`,
    `        runtime.dragging = true;\n        ${clientStart}\n        window.__safeCrackerDialInteractionV15 = {\n          gameId: String(game?.gameId || runtime.game?.gameId || ''),\n          active: true,\n          expiresAt: Date.now() + 10000\n        };\n        window.__safeCrackerDialInteractionStarts =\n          Number(window.__safeCrackerDialInteractionStarts || 0) + 1;\n        ${clientEnd}\n        runtime.pointerId = event.pointerId;`,
    'dial pointer-down activity marker'
  );

  client = replaceRequired(
    client,
    `        runtime.lastPointerAngle = angle;`,
    `        runtime.lastPointerAngle = angle;\n        if (\n          window.__safeCrackerDialInteractionV15 &&\n          String(window.__safeCrackerDialInteractionV15.gameId || '') === String(game?.gameId || '')\n        ) {\n          window.__safeCrackerDialInteractionV15.active = true;\n          window.__safeCrackerDialInteractionV15.expiresAt = Date.now() + 10000;\n        }`,
    'dial activity extension while moving'
  );

  client = replaceRequired(
    client,
    `        runtime.dragging = false;\n        runtime.pointerId = null;`,
    `        runtime.dragging = false;\n        const safeCrackerDialInteraction = window.__safeCrackerDialInteractionV15;\n        if (\n          safeCrackerDialInteraction &&\n          String(safeCrackerDialInteraction.gameId || '') === String(game?.gameId || '')\n        ) {\n          safeCrackerDialInteraction.active = false;\n          safeCrackerDialInteraction.expiresAt = Date.now() + 1200;\n        }\n        runtime.pointerId = null;`,
    'dial pointer-release grace period'
  );
}
await writeFile(clientUrl, client);

let html = await readFile(indexUrl, 'utf8');

html = replaceRequired(
  html,
  '${duelPlayerHtml(game.creator, "Creator", game.creatorReady)}',
  '${duelPlayerHtml(game.creator, "Creator", Boolean(game.creatorReady || (game.mode === "safecracker" && ["ready", "countdown", "playing", "complete"].includes(String(game.status || "")))))}',
  'Safe Cracker creator lifecycle label'
);
html = replaceRequired(
  html,
  '${duelPlayerHtml(joiner, "Joiner", game.joinerReady)}',
  '${duelPlayerHtml(joiner, "Joiner", Boolean(game.joinerReady || (game.mode === "safecracker" && ["ready", "countdown", "playing", "complete"].includes(String(game.status || "")))))}',
  'Safe Cracker joiner lifecycle label'
);

if (!html.includes(rendererStart)) {
  const renderNeedle = `    function duelRenderActive(game, force = false) {\n      if (!duelActive) return;`;
  const renderReplacement = `    function duelRenderActive(game, force = false) {\n      if (!duelActive) return;\n      ${rendererStart}\n      const safeCrackerDialNow = Date.now();\n      const safeCrackerDialInteraction = window.__safeCrackerDialInteractionV15 || null;\n      const safeCrackerDialInteractionGameId = String(safeCrackerDialInteraction?.gameId || '');\n      const safeCrackerDialInteractionLive = Boolean(\n        safeCrackerDialInteractionGameId &&\n        safeCrackerDialNow <= Number(safeCrackerDialInteraction?.expiresAt || 0)\n      );\n      const safeCrackerDialRemembered = window.__safeCrackerDialStableGameV15 || null;\n      const safeCrackerDialLastAccepted =\n        duelLastActiveGame?.mode === 'safecracker' ? duelLastActiveGame : null;\n      const safeCrackerDialActiveStatuses = ['ready', 'countdown', 'playing'];\n      const safeCrackerDialTerminalStatuses = ['complete', 'cancelled'];\n      const safeCrackerDialRetained =\n        safeCrackerDialRemembered?.mode === 'safecracker' &&\n        safeCrackerDialActiveStatuses.includes(String(safeCrackerDialRemembered.status || ''))\n          ? safeCrackerDialRemembered\n          : safeCrackerDialLastAccepted?.mode === 'safecracker' &&\n              safeCrackerDialActiveStatuses.includes(String(safeCrackerDialLastAccepted.status || ''))\n            ? safeCrackerDialLastAccepted\n            : null;\n      const safeCrackerDialRetainedId = String(safeCrackerDialRetained?.gameId || '');\n      const safeCrackerDialIncomingId = String(game?.gameId || '');\n      const safeCrackerDialSameGame = Boolean(\n        game?.mode === 'safecracker' &&\n        safeCrackerDialRetainedId &&\n        safeCrackerDialIncomingId === safeCrackerDialRetainedId\n      );\n      const safeCrackerDialIncomingStatus = String(game?.status || '');\n      const safeCrackerDialIncomingTerminal = Boolean(\n        safeCrackerDialSameGame &&\n        safeCrackerDialTerminalStatuses.includes(safeCrackerDialIncomingStatus)\n      );\n      const safeCrackerDialIncomingActive = Boolean(\n        safeCrackerDialSameGame &&\n        safeCrackerDialActiveStatuses.includes(safeCrackerDialIncomingStatus)\n      );\n      const safeCrackerDialStatusRank = { waiting: 0, ready: 1, countdown: 2, playing: 3, complete: 4, cancelled: 4 };\n      const safeCrackerDialIncomingRank = safeCrackerDialStatusRank[safeCrackerDialIncomingStatus] ?? -1;\n      const safeCrackerDialRetainedRank =\n        safeCrackerDialStatusRank[String(safeCrackerDialRetained?.status || '')] ?? -1;\n      const safeCrackerDialIncomingRevision = Number(game?.revision);\n      const safeCrackerDialRetainedRevision = Number(safeCrackerDialRetained?.revision);\n      const safeCrackerDialIncomingStateRevision = Number(\n        game?.safecrackerState?.revision ?? game?.state?.revision\n      );\n      const safeCrackerDialRetainedStateRevision = Number(\n        safeCrackerDialRetained?.safecrackerState?.revision ?? safeCrackerDialRetained?.state?.revision\n      );\n      const safeCrackerDialRegressed = Boolean(\n        safeCrackerDialSameGame &&\n        !safeCrackerDialIncomingTerminal &&\n        (\n          safeCrackerDialIncomingRank < safeCrackerDialRetainedRank ||\n          (\n            Number.isFinite(safeCrackerDialIncomingRevision) &&\n            Number.isFinite(safeCrackerDialRetainedRevision) &&\n            safeCrackerDialIncomingRevision < safeCrackerDialRetainedRevision\n          ) ||\n          (\n            Number.isFinite(safeCrackerDialIncomingStateRevision) &&\n            Number.isFinite(safeCrackerDialRetainedStateRevision) &&\n            safeCrackerDialIncomingStateRevision < safeCrackerDialRetainedStateRevision\n          )\n        )\n      );\n      const safeCrackerDialInteractionMatches = Boolean(\n        safeCrackerDialInteractionLive &&\n        safeCrackerDialRetained &&\n        safeCrackerDialInteractionGameId === safeCrackerDialRetainedId\n      );\n      if (safeCrackerDialInteractionMatches && !safeCrackerDialIncomingTerminal) {\n        if (safeCrackerDialIncomingActive && !safeCrackerDialRegressed) {\n          duelLastActiveGame = game;\n          window.__safeCrackerDialStableGameV15 = game;\n          if (typeof duelRememberCurrentGame === 'function') duelRememberCurrentGame(safeCrackerDialIncomingId);\n          window.dispatchEvent(new CustomEvent('safecracker:state', { detail: { game } }));\n          if (typeof duelSetPollRate === 'function') duelSetPollRate(game);\n          window.__safeCrackerDialInPlaceUpdates =\n            Number(window.__safeCrackerDialInPlaceUpdates || 0) + 1;\n        } else {\n          window.__safeCrackerDialBoardRecoveries =\n            Number(window.__safeCrackerDialBoardRecoveries || 0) + 1;\n        }\n        return;\n      }\n      if (\n        game?.mode === 'safecracker' &&\n        safeCrackerDialActiveStatuses.includes(String(game.status || ''))\n      ) {\n        window.__safeCrackerDialStableGameV15 = game;\n      } else if (safeCrackerDialIncomingTerminal) {\n        window.__safeCrackerDialStableGameV15 = null;\n        window.__safeCrackerDialInteractionV15 = null;\n      }\n      ${rendererEnd}`;
  html = replaceRequired(html, renderNeedle, renderReplacement, 'global active renderer entry point');
}
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker dial-board retention v15: live same-game snapshots update the existing Safe Cracker mount without replacing it during dial interaction, null/foreign/regressed renders are ignored, and active Safe Cracker players no longer display false WAITING labels.');
