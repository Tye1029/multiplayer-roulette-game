import { readFile, writeFile } from 'node:fs/promises';

const indexUrl = new URL('../index.html', import.meta.url);
const v13Start = '// SAFE_CRACKER_ACTIVE_RENDER_GUARD_V13_START';
const v13End = '// SAFE_CRACKER_ACTIVE_RENDER_GUARD_V13_END';
const v14Start = '// SAFE_CRACKER_ACTIVE_RENDER_GUARD_V14_START';
const v14End = '// SAFE_CRACKER_ACTIVE_RENDER_GUARD_V14_END';
const start = '// SAFE_CRACKER_ACTIVE_RENDER_GUARD_V15_START';
const end = '// SAFE_CRACKER_ACTIVE_RENDER_GUARD_V15_END';
const rawRenderCallPattern = /duelRenderActive\(data\.game,\s*true\);/g;
const v13GuardPattern = /\(\(\) => \{\s*\/\/ SAFE_CRACKER_ACTIVE_RENDER_GUARD_V13_START[\s\S]*?\/\/ SAFE_CRACKER_ACTIVE_RENDER_GUARD_V13_END\s*return duelRenderActive\(safeCrackerActiveRenderGame,\s*true\);\s*\}\)\(\);/g;
const v14GuardPattern = /\(\(\) => \{\s*\/\/ SAFE_CRACKER_ACTIVE_RENDER_GUARD_V14_START[\s\S]*?\/\/ SAFE_CRACKER_ACTIVE_RENDER_GUARD_V14_END\s*return duelRenderActive\(safeCrackerActiveRenderGame,\s*true\);\s*\}\)\(\);/g;
const expectedRenderCalls = 3;

let html = await readFile(indexUrl, 'utf8');
const startCount = html.split(start).length - 1;
const endCount = html.split(end).length - 1;

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

if (startCount === expectedRenderCalls && endCount === expectedRenderCalls) {
  console.log('Safe Cracker active render guard v15 is already installed on every active-game renderer.');
} else {
  if (startCount !== 0 || endCount !== 0) {
    throw new Error(`Safe Cracker active render guard v15 markers are inconsistent (${startCount}/${endCount}).`);
  }

  const v14Guards = [...html.matchAll(v14GuardPattern)];
  const v13Guards = [...html.matchAll(v13GuardPattern)];
  if (v14Guards.length === expectedRenderCalls) {
    html = html.replace(v14GuardPattern, replacement);
  } else if (v13Guards.length === expectedRenderCalls) {
    html = html.replace(v13GuardPattern, replacement);
  } else {
    const staleMarkerCount =
      html.split(v13Start).length - 1 +
      html.split(v13End).length - 1 +
      html.split(v14Start).length - 1 +
      html.split(v14End).length - 1;
    if (staleMarkerCount !== 0) {
      throw new Error(`Safe Cracker legacy render guard markers are inconsistent and could not be upgraded (${staleMarkerCount} markers).`);
    }
    const renderCalls = [...html.matchAll(rawRenderCallPattern)];
    if (renderCalls.length !== expectedRenderCalls) {
      throw new Error(`Safe Cracker active render guard expected ${expectedRenderCalls} raw renderer calls or complete legacy guards, found ${renderCalls.length} raw calls, ${v13Guards.length} v13 guards and ${v14Guards.length} v14 guards.`);
    }
    html = html.replace(rawRenderCallPattern, replacement);
  }

  await writeFile(indexUrl, html);
  console.log('Applied Safe Cracker active render guard v15 to all active-game render paths: the existing active cache bootstraps the selector, transient empty and competing pre-active snapshots cannot close the board, stale same-game snapshots remain blocked, and explicit completion still wins.');
}
