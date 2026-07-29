import { readFile, writeFile, rm } from 'node:fs/promises';

const sourceUrl = new URL('./preview-regression.mjs', import.meta.url);
const runtimeUrl = new URL('./.preview-regression.runtime.mjs', import.meta.url);
const source = await readFile(sourceUrl, 'utf8');
let isolated = source.replace(
  'await gotoWithRetry(harness, target.href);',
  "await gotoWithRetry(harness, absolute('/lamp-calibration.html'));"
);
isolated = isolated.replace(
  '  await harness.evaluate(() => {\n    document.body.innerHTML =',
  `  await harness.addScriptTag({ content: \`var duelActive, rouletteLatestGame, rouletteVisualRuntime, rouletteOpeningCompletedGames, rouletteBind, rouletteMotionScale, rouletteQueueVisual, rouletteAnimate, rouletteRotationGlint, rouletteWait, rouletteSpinSound, rouletteMotionTransform, rouletteOrientToShotActor, rouletteRotateToTurn, rouletteOpeningSequence;\` });\n  await harness.evaluate(() => {\n    document.body.innerHTML =`
);

if (isolated === source || !isolated.includes('var duelActive, rouletteLatestGame')) {
  throw new Error('Preview regression harness substitutions were not applied.');
}
await writeFile(runtimeUrl, isolated);
try {
  await import(`${runtimeUrl.href}?run=${Date.now()}`);
} finally {
  await rm(runtimeUrl, { force: true });
}
