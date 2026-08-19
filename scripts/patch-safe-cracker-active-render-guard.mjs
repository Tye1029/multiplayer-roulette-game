import { readFile, writeFile } from 'node:fs/promises';

const indexUrl = new URL('../index.html', import.meta.url);
const start = '// SAFE_CRACKER_ACTIVE_RENDER_GUARD_V13_START';
const end = '// SAFE_CRACKER_ACTIVE_RENDER_GUARD_V13_END';
const renderCallPattern = /duelRenderActive\(data\.game,\s*true\);/g;
const expectedRenderCalls = 3;

let html = await readFile(indexUrl, 'utf8');
const startCount = html.split(start).length - 1;
const endCount = html.split(end).length - 1;

if (startCount === expectedRenderCalls && endCount === expectedRenderCalls) {
  console.log('Safe Cracker active render guard v13 is already installed on every active-game renderer.');
} else {
  if (startCount !== 0 || endCount !== 0) {
    throw new Error(`Safe Cracker active render guard markers are inconsistent (${startCount}/${endCount}).`);
  }

  const renderCalls = [...html.matchAll(renderCallPattern)];
  if (renderCalls.length !== expectedRenderCalls) {
    throw new Error(`Safe Cracker active render guard expected ${expectedRenderCalls} active-game renderer calls, found ${renderCalls.length}.`);
  }

  const replacement = String.raw`(() => {
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
            ${end}
            return duelRenderActive(safeCrackerActiveRenderGame, true);
          })();`;

  html = html.replace(renderCallPattern, replacement);
  await writeFile(indexUrl, html);
  console.log('Applied Safe Cracker active render guard v13 to all active-game render paths: transient empty responses can no longer close ready, countdown, or playing boards.');
}
