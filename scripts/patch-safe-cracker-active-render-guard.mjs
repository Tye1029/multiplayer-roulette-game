import { readFile, writeFile } from 'node:fs/promises';

const indexUrl = new URL('../index.html', import.meta.url);
const legacyStart = '// SAFE_CRACKER_ACTIVE_RENDER_GUARD_V13_START';
const legacyEnd = '// SAFE_CRACKER_ACTIVE_RENDER_GUARD_V13_END';
const start = '// SAFE_CRACKER_ACTIVE_RENDER_GUARD_V14_START';
const end = '// SAFE_CRACKER_ACTIVE_RENDER_GUARD_V14_END';
const rawRenderCallPattern = /duelRenderActive\(data\.game,\s*true\);/g;
const legacyGuardPattern = /\(\(\) => \{\s*\/\/ SAFE_CRACKER_ACTIVE_RENDER_GUARD_V13_START[\s\S]*?\/\/ SAFE_CRACKER_ACTIVE_RENDER_GUARD_V13_END\s*return duelRenderActive\(safeCrackerActiveRenderGame,\s*true\);\s*\}\)\(\);/g;
const expectedRenderCalls = 3;

let html = await readFile(indexUrl, 'utf8');
const startCount = html.split(start).length - 1;
const endCount = html.split(end).length - 1;

const replacement = String.raw`(() => {
            ${start}
            const safeCrackerIncomingGame = data.game || null;
            const safeCrackerStableGame = window.__safeCrackerStableActiveGame || null;
            const safeCrackerActiveStatuses = ['ready', 'countdown', 'playing'];
            const safeCrackerStatusRank = {
              waiting: 0,
              ready: 1,
              countdown: 2,
              playing: 3,
              complete: 4
            };
            const safeCrackerStableIsActive =
              safeCrackerStableGame?.mode === 'safecracker' &&
              safeCrackerActiveStatuses.includes(safeCrackerStableGame.status);
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
              Number.isFinite(safeCrackerIncomingRevision) &&
              Number.isFinite(safeCrackerStableRevision) &&
              safeCrackerIncomingRevision < safeCrackerStableRevision
            );
            const safeCrackerLifecycleRegressed = Boolean(
              safeCrackerIncomingGame?.mode === 'safecracker' &&
              safeCrackerStableIsActive &&
              safeCrackerSameGame &&
              safeCrackerIncomingGame.status !== 'complete' &&
              safeCrackerIncomingRank < safeCrackerStableRank
            );
            const safeCrackerTransientEmpty = !safeCrackerIncomingGame && safeCrackerStableIsActive;
            const safeCrackerUseStableGame =
              safeCrackerTransientEmpty ||
              safeCrackerLifecycleRegressed ||
              (safeCrackerStableIsActive && safeCrackerRevisionRegressed);
            const safeCrackerActiveRenderGame = safeCrackerUseStableGame
              ? safeCrackerStableGame
              : safeCrackerIncomingGame;

            if (safeCrackerUseStableGame) {
              window.__safeCrackerRenderGuardRecoveries =
                Number(window.__safeCrackerRenderGuardRecoveries || 0) + 1;
              if (safeCrackerLifecycleRegressed || safeCrackerRevisionRegressed) {
                window.__safeCrackerRenderGuardRegressions =
                  Number(window.__safeCrackerRenderGuardRegressions || 0) + 1;
              }
            }

            if (
              safeCrackerActiveRenderGame?.mode === 'safecracker' &&
              safeCrackerActiveStatuses.includes(safeCrackerActiveRenderGame.status)
            ) {
              window.__safeCrackerStableActiveGame = safeCrackerActiveRenderGame;
            } else if (safeCrackerIncomingGame) {
              window.__safeCrackerStableActiveGame = null;
            }
            ${end}
            return duelRenderActive(safeCrackerActiveRenderGame, true);
          })();`;

if (startCount === expectedRenderCalls && endCount === expectedRenderCalls) {
  console.log('Safe Cracker active render guard v14 is already installed on every active-game renderer.');
} else {
  if (startCount !== 0 || endCount !== 0) {
    throw new Error(`Safe Cracker active render guard v14 markers are inconsistent (${startCount}/${endCount}).`);
  }

  const legacyStartCount = html.split(legacyStart).length - 1;
  const legacyEndCount = html.split(legacyEnd).length - 1;
  const legacyGuards = [...html.matchAll(legacyGuardPattern)];
  if (legacyGuards.length === expectedRenderCalls) {
    html = html.replace(legacyGuardPattern, replacement);
  } else {
    if (legacyStartCount !== 0 || legacyEndCount !== 0) {
      throw new Error(`Safe Cracker legacy render guard markers are inconsistent (${legacyStartCount}/${legacyEndCount}) and could not be upgraded.`);
    }
    const renderCalls = [...html.matchAll(rawRenderCallPattern)];
    if (renderCalls.length !== expectedRenderCalls) {
      throw new Error(`Safe Cracker active render guard expected ${expectedRenderCalls} raw renderer calls or legacy guards, found ${renderCalls.length} raw calls and ${legacyGuards.length} legacy guards.`);
    }
    html = html.replace(rawRenderCallPattern, replacement);
  }

  await writeFile(indexUrl, html);
  console.log('Applied Safe Cracker active render guard v14 to all active-game render paths: empty responses, stale revisions, and backward same-game lifecycle snapshots can no longer close a live board.');
}
