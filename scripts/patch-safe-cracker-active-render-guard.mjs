import { readFile, writeFile } from 'node:fs/promises';

const indexUrl = new URL('../index.html', import.meta.url);
const start = '// SAFE_CRACKER_ACTIVE_RENDER_GUARD_V13_START';
const end = '// SAFE_CRACKER_ACTIVE_RENDER_GUARD_V13_END';
const renderCallPattern = /duelRenderActive\(data\.game,\s*true\);/g;

let html = await readFile(indexUrl, 'utf8');
const startCount = html.split(start).length - 1;
const endCount = html.split(end).length - 1;

if (startCount === 1 && endCount === 1) {
  console.log('Safe Cracker active render guard v13 is already installed.');
} else {
  if (startCount !== 0 || endCount !== 0) {
    throw new Error(`Safe Cracker active render guard markers are inconsistent (${startCount}/${endCount}).`);
  }

  const renderCalls = [...html.matchAll(renderCallPattern)];
  const candidates = renderCalls.filter(match => {
    const context = html.slice(Math.max(0, match.index - 1800), match.index);
    const submitIndex = context.lastIndexOf('submit: async details =>');
    const retainedIndex = context.lastIndexOf('duelLastActiveGame = data.game || duelLastActiveGame;');
    const revisionIndex = context.lastIndexOf('duelKnownRevisionByGame.set');
    return submitIndex >= 0 && retainedIndex > submitIndex && revisionIndex > retainedIndex;
  });

  if (candidates.length !== 1) {
    throw new Error(`Safe Cracker active render guard expected one revision-tracked submission bridge, found ${candidates.length} among ${renderCalls.length} renderer calls.`);
  }

  const replacement = String.raw`${start}
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

  const target = candidates[0];
  html = html.slice(0, target.index) + replacement + html.slice(target.index + target[0].length);
  await writeFile(indexUrl, html);
  console.log('Applied Safe Cracker active render guard v13: transient empty submission responses can no longer close ready, countdown, or playing boards.');
}
