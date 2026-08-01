import { readFile, writeFile } from 'node:fs/promises';

const indexUrl = new URL('../index.html', import.meta.url);
const legacyVersions = [13, 14, 15];
const start = '// SAFE_CRACKER_ACTIVE_RENDER_GUARD_V16_START';
const end = '// SAFE_CRACKER_ACTIVE_RENDER_GUARD_V16_END';
const refreshStart = '// SAFE_CRACKER_REFRESH_SELECTOR_V16_START';
const refreshEnd = '// SAFE_CRACKER_REFRESH_SELECTOR_V16_END';
const rawRenderCallPattern = /duelRenderActive\(data\.game,\s*true\);/g;
const expectedRenderCalls = 3;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function legacyGuardPattern(version) {
  const legacyStart = `// SAFE_CRACKER_ACTIVE_RENDER_GUARD_V${version}_START`;
  const legacyEnd = `// SAFE_CRACKER_ACTIVE_RENDER_GUARD_V${version}_END`;
  return new RegExp(
    `\\(\\(\\) => \\{\\s*${escapeRegExp(legacyStart)}[\\s\\S]*?${escapeRegExp(legacyEnd)}\\s*return duelRenderActive\\(safeCrackerActiveRenderGame,\\s*true\\);\\s*\\}\\)\\(\\);`,
    'g'
  );
}

let html = await readFile(indexUrl, 'utf8');
let changed = false;

const replacement = String.raw`(() => {
            ${start}
            const safeCrackerIncomingGame = data.game || null;
            const safeCrackerLegacyCandidate =
              typeof duelLastActiveGame !== 'undefined' ? duelLastActiveGame : null;
            const safeCrackerStableGame =
              window.__safeCrackerStableActiveGame ||
              (safeCrackerLegacyCandidate?.mode === 'safecracker' ? safeCrackerLegacyCandidate : null);
            const safeCrackerActiveStatuses = ['ready', 'countdown', 'playing'];
            const safeCrackerPreActiveStatuses = ['waiting', 'ready', 'countdown'];
            const safeCrackerStatusRank = {
              waiting: 0,
              ready: 1,
              countdown: 2,
              playing: 3,
              complete: 4
            };
            const safeCrackerNow = Date.now();
            const safeCrackerRetentionMs = 30000;
            const safeCrackerStableSeenAt = Number(window.__safeCrackerStableActiveSeenAt || 0);
            const safeCrackerStableAge = safeCrackerStableSeenAt > 0
              ? Math.max(0, safeCrackerNow - safeCrackerStableSeenAt)
              : 0;
            const safeCrackerStableIsActive =
              safeCrackerStableGame?.mode === 'safecracker' &&
              safeCrackerActiveStatuses.includes(safeCrackerStableGame.status);
            const safeCrackerIncomingIsSafeCracker = safeCrackerIncomingGame?.mode === 'safecracker';
            const safeCrackerIncomingIsComplete =
              safeCrackerIncomingIsSafeCracker && safeCrackerIncomingGame.status === 'complete';
            const safeCrackerSameGame = Boolean(
              safeCrackerIncomingGame &&
              safeCrackerStableGame &&
              String(safeCrackerIncomingGame.gameId || '') === String(safeCrackerStableGame.gameId || '')
            );
            const safeCrackerIncomingRank = safeCrackerStatusRank[safeCrackerIncomingGame?.status] ?? -1;
            const safeCrackerStableRank = safeCrackerStatusRank[safeCrackerStableGame?.status] ?? -1;
            const safeCrackerIncomingRevision = Number(safeCrackerIncomingGame?.revision);
            const safeCrackerStableRevision = Number(safeCrackerStableGame?.revision);
            const safeCrackerRevisionRegressed = Boolean(
              safeCrackerSameGame &&
              !safeCrackerIncomingIsComplete &&
              Number.isFinite(safeCrackerIncomingRevision) &&
              Number.isFinite(safeCrackerStableRevision) &&
              safeCrackerIncomingRevision < safeCrackerStableRevision
            );
            const safeCrackerLifecycleRegressed = Boolean(
              safeCrackerIncomingIsSafeCracker &&
              safeCrackerStableIsActive &&
              safeCrackerSameGame &&
              !safeCrackerIncomingIsComplete &&
              safeCrackerIncomingRank < safeCrackerStableRank
            );
            const safeCrackerTransientEmpty = Boolean(
              !safeCrackerIncomingGame &&
              safeCrackerStableIsActive &&
              safeCrackerStableAge <= safeCrackerRetentionMs
            );
            const safeCrackerDifferentPreActive = Boolean(
              safeCrackerIncomingIsSafeCracker &&
              safeCrackerStableIsActive &&
              !safeCrackerSameGame &&
              safeCrackerPreActiveStatuses.includes(safeCrackerIncomingGame.status) &&
              safeCrackerStableAge <= safeCrackerRetentionMs
            );
            const safeCrackerUseStableGame =
              safeCrackerTransientEmpty ||
              safeCrackerLifecycleRegressed ||
              safeCrackerRevisionRegressed ||
              safeCrackerDifferentPreActive;
            const safeCrackerActiveRenderGame = safeCrackerUseStableGame
              ? safeCrackerStableGame
              : safeCrackerIncomingGame;

            if (safeCrackerUseStableGame) {
              window.__safeCrackerRenderGuardRecoveries =
                Number(window.__safeCrackerRenderGuardRecoveries || 0) + 1;
              if (safeCrackerLifecycleRegressed || safeCrackerRevisionRegressed || safeCrackerDifferentPreActive) {
                window.__safeCrackerRenderGuardRegressions =
                  Number(window.__safeCrackerRenderGuardRegressions || 0) + 1;
              }
            }

            if (
              safeCrackerActiveRenderGame?.mode === 'safecracker' &&
              safeCrackerActiveStatuses.includes(safeCrackerActiveRenderGame.status)
            ) {
              window.__safeCrackerStableActiveGame = safeCrackerActiveRenderGame;
              if (!safeCrackerUseStableGame || safeCrackerStableSeenAt <= 0) {
                window.__safeCrackerStableActiveSeenAt = safeCrackerNow;
              }
            } else if (safeCrackerIncomingGame) {
              window.__safeCrackerStableActiveGame = null;
              window.__safeCrackerStableActiveSeenAt = 0;
            } else if (safeCrackerStableIsActive && safeCrackerStableAge > safeCrackerRetentionMs) {
              window.__safeCrackerStableActiveGame = null;
              window.__safeCrackerStableActiveSeenAt = 0;
            }
            ${end}
            return duelRenderActive(safeCrackerActiveRenderGame, true);
          })();`;

const startCount = html.split(start).length - 1;
const endCount = html.split(end).length - 1;
if (startCount === expectedRenderCalls && endCount === expectedRenderCalls) {
  console.log('Safe Cracker active render guard v16 is already installed on every direct active-game renderer.');
} else {
  if (startCount !== 0 || endCount !== 0) {
    throw new Error(`Safe Cracker active render guard v16 markers are inconsistent (${startCount}/${endCount}).`);
  }

  let upgraded = false;
  for (const version of legacyVersions.reverse()) {
    const pattern = legacyGuardPattern(version);
    const guards = [...html.matchAll(pattern)];
    if (guards.length === expectedRenderCalls) {
      html = html.replace(pattern, replacement);
      upgraded = true;
      break;
    }
  }

  if (!upgraded) {
    const staleMarkerCount = legacyVersions.reduce((total, version) => {
      return total +
        html.split(`SAFE_CRACKER_ACTIVE_RENDER_GUARD_V${version}_START`).length - 1 +
        html.split(`SAFE_CRACKER_ACTIVE_RENDER_GUARD_V${version}_END`).length - 1;
    }, 0);
    if (staleMarkerCount !== 0) {
      throw new Error(`Safe Cracker legacy render guard markers are inconsistent and could not be upgraded (${staleMarkerCount} markers).`);
    }
    const renderCalls = [...html.matchAll(rawRenderCallPattern)];
    if (renderCalls.length !== expectedRenderCalls) {
      throw new Error(`Safe Cracker active render guard expected ${expectedRenderCalls} raw direct renderer calls, found ${renderCalls.length}.`);
    }
    html = html.replace(rawRenderCallPattern, replacement);
  }
  changed = true;
}

const refreshCaptureNeedle = `        let active = null;\n        let focusedGetFailed = false;`;
const refreshCaptureReplacement = `        let active = null;\n        ${refreshStart}\n        const safeCrackerRefreshStable = (\n          duelLastActiveGame?.mode === "safecracker" &&\n          String(duelLastActiveGame.gameId || "") === String(duelCurrentGameId || "") &&\n          ["ready", "countdown", "playing"].includes(String(duelLastActiveGame.status || ""))\n        ) ? duelLastActiveGame : null;\n        ${refreshEnd}\n        let focusedGetFailed = false;`;

const refreshApplyNeedle = `        if (active) duelLastActiveGame = active;`;
const refreshApplyReplacement = `        ${refreshStart}\n        if (safeCrackerRefreshStable) {\n          const safeCrackerRefreshIncoming = active || null;\n          const safeCrackerRefreshSameGame = Boolean(\n            safeCrackerRefreshIncoming?.mode === "safecracker" &&\n            String(safeCrackerRefreshIncoming.gameId || "") === String(safeCrackerRefreshStable.gameId || "")\n          );\n          const safeCrackerRefreshIncomingComplete = Boolean(\n            safeCrackerRefreshSameGame &&\n            String(safeCrackerRefreshIncoming.status || "") === "complete"\n          );\n          const safeCrackerRefreshRank = { waiting: 0, ready: 1, countdown: 2, playing: 3, complete: 4, cancelled: 4 };\n          const safeCrackerRefreshIncomingRank = safeCrackerRefreshRank[String(safeCrackerRefreshIncoming?.status || "")] ?? -1;\n          const safeCrackerRefreshStableRank = safeCrackerRefreshRank[String(safeCrackerRefreshStable.status || "")] ?? -1;\n          const safeCrackerRefreshIncomingRevision = Number(safeCrackerRefreshIncoming?.revision);\n          const safeCrackerRefreshStableRevision = Number(safeCrackerRefreshStable?.revision);\n          const safeCrackerRefreshIncomingStateRevision = Number(\n            safeCrackerRefreshIncoming?.state?.revision ??\n            safeCrackerRefreshIncoming?.safeCrackerState?.revision\n          );\n          const safeCrackerRefreshStableStateRevision = Number(\n            safeCrackerRefreshStable?.state?.revision ??\n            safeCrackerRefreshStable?.safeCrackerState?.revision\n          );\n          const safeCrackerRefreshLifecycleRegressed = Boolean(\n            safeCrackerRefreshSameGame &&\n            !safeCrackerRefreshIncomingComplete &&\n            safeCrackerRefreshIncomingRank < safeCrackerRefreshStableRank\n          );\n          const safeCrackerRefreshGameRevisionRegressed = Boolean(\n            safeCrackerRefreshSameGame &&\n            !safeCrackerRefreshIncomingComplete &&\n            Number.isFinite(safeCrackerRefreshIncomingRevision) &&\n            Number.isFinite(safeCrackerRefreshStableRevision) &&\n            safeCrackerRefreshIncomingRevision < safeCrackerRefreshStableRevision\n          );\n          const safeCrackerRefreshStateRevisionRegressed = Boolean(\n            safeCrackerRefreshSameGame &&\n            !safeCrackerRefreshIncomingComplete &&\n            Number.isFinite(safeCrackerRefreshIncomingStateRevision) &&\n            Number.isFinite(safeCrackerRefreshStableStateRevision) &&\n            safeCrackerRefreshIncomingStateRevision < safeCrackerRefreshStableStateRevision\n          );\n          const safeCrackerRefreshMissing = !safeCrackerRefreshIncoming;\n          const safeCrackerRefreshUseStable =\n            safeCrackerRefreshMissing ||\n            safeCrackerRefreshLifecycleRegressed ||\n            safeCrackerRefreshGameRevisionRegressed ||\n            safeCrackerRefreshStateRevisionRegressed;\n          if (safeCrackerRefreshUseStable) {\n            active = safeCrackerRefreshStable;\n            window.__safeCrackerRefreshSelectorRecoveries =\n              Number(window.__safeCrackerRefreshSelectorRecoveries || 0) + 1;\n            if (!safeCrackerRefreshMissing) {\n              window.__safeCrackerRefreshSelectorRegressions =\n                Number(window.__safeCrackerRefreshSelectorRegressions || 0) + 1;\n            }\n          }\n        }\n        ${refreshEnd}\n        if (active) duelLastActiveGame = active;`;

const refreshMarkerCount = html.split(refreshStart).length - 1;
if (refreshMarkerCount === 2 && html.split(refreshEnd).length - 1 === 2) {
  console.log('Safe Cracker refresh selector v16 is already installed before lobby/render selection.');
} else {
  if (refreshMarkerCount !== 0 || html.includes(refreshEnd)) {
    throw new Error('Safe Cracker refresh selector v16 markers are inconsistent.');
  }
  if (!html.includes(refreshCaptureNeedle)) {
    throw new Error('Safe Cracker refresh selector could not find the stable-snapshot capture point.');
  }
  if (!html.includes(refreshApplyNeedle)) {
    throw new Error('Safe Cracker refresh selector could not find the pre-render adoption point.');
  }
  html = html.replace(refreshCaptureNeedle, refreshCaptureReplacement);
  html = html.replace(refreshApplyNeedle, refreshApplyReplacement);
  changed = true;
}

if (changed) {
  await writeFile(indexUrl, html);
  console.log('Applied Safe Cracker guard v16: refresh state is selected before lobby/render decisions, missing and regressed same-game snapshots cannot replace a live board, direct response paths remain guarded, completion and explicit game changes still win, and Roulette remains untouched.');
}
