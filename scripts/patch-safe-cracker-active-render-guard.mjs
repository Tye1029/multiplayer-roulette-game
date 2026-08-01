import { readFile, writeFile } from 'node:fs/promises';

const indexUrl = new URL('../index.html', import.meta.url);
const start = '// SAFE_CRACKER_ACTIVE_RENDER_GUARD_V13_START';
const end = '// SAFE_CRACKER_ACTIVE_RENDER_GUARD_V13_END';
const sourcePattern = /duelLastActiveGame = data\.game \|\| duelLastActiveGame;\s*duelRenderActive\(data\.game, true\);/g;

let html = await readFile(indexUrl, 'utf8');
const startCount = html.split(start).length - 1;
const endCount = html.split(end).length - 1;

if (startCount === 1 && endCount === 1) {
  console.log('Safe Cracker active render guard v13 is already installed.');
} else {
  if (startCount !== 0 || endCount !== 0) {
    throw new Error(`Safe Cracker active render guard markers are inconsistent (${startCount}/${endCount}).`);
  }

  const matches = [...html.matchAll(sourcePattern)];
  if (matches.length !== 1) {
    throw new Error(`Safe Cracker active render guard expected one active-game render bridge, found ${matches.length}.`);
  }

  const replacement = String.raw`duelLastActiveGame = data.game || duelLastActiveGame;
          ${start}
          const safeCrackerActiveRenderGame =
            data.game ||
            (
              duelLastActiveGame?.mode === 'safecracker' &&
              ['ready', 'countdown', 'playing'].includes(duelLastActiveGame.status)
                ? duelLastActiveGame
                : null
            );
          if (!data.game && safeCrackerActiveRenderGame) {
            window.__safeCrackerRenderGuardRecoveries =
              Number(window.__safeCrackerRenderGuardRecoveries || 0) + 1;
          }
          duelRenderActive(safeCrackerActiveRenderGame, true);
          ${end}`;

  html = html.replace(sourcePattern, replacement);
  await writeFile(indexUrl, html);
  console.log('Applied Safe Cracker active render guard v13: transient empty active-game responses can no longer close ready, countdown, or playing boards.');
}
