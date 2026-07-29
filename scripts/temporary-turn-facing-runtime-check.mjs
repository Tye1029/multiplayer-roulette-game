import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';

const chromePath = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const turnAnimationPath = fileURLToPath(new URL('../assets/roulette/turn-animation.js', import.meta.url));
const guardPath = fileURLToPath(new URL('../assets/roulette/turn-facing-guard.js', import.meta.url));

const browser = await chromium.launch({
  headless: true,
  executablePath: chromePath,
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error?.stack || error)));
  await page.setContent(`<!doctype html><html><head></head><body>
    <main id="duelActive">
      <section data-roulette-game data-game-id="guard-test" data-status="playing" data-turn-id="creator">
        <div class="rr-gun-motion" data-roulette-motion>
          <div class="rr-revolver"><span class="rr-metal-glint"></span></div>
        </div>
      </section>
    </main>
  </body></html>`);

  await page.evaluate(() => {
    const creator = { userId: 'creator', name: 'Creator' };
    const joiner = { userId: 'joiner', name: 'Joiner' };
    window.__guardCreator = creator;
    window.__guardJoiner = joiner;
    window.rouletteLatestGame = {
      mode: 'roulette',
      gameId: 'guard-test',
      status: 'playing',
      creator,
      joiner,
      rouletteState: { turnId: 'creator' }
    };
    window.duelLastActiveGame = window.rouletteLatestGame;
    window.duelActive = document.getElementById('duelActive');
    window.rouletteVisualRuntime = {
      busy: false,
      openingDone: true,
      currentAngle: -4,
      angleHydrated: false,
      lastTurnId: '',
      displayTurnId: '',
      rotationTargetId: ''
    };
    window.rouletteOpeningCompletedGames = new Set(['guard-test']);
    window.rouletteBind = root => root;
    window.rouletteMotionScale = () => 0.78;
    window.rouletteMotionTransform = () => '';
    window.rouletteOrientToShotActor = async () => {};
    window.rouletteRotateToTurn = async () => {};
    window.rouletteOpeningSequence = async () => {};
    window.rouletteQueueVisual = callback => Promise.resolve().then(callback);
    window.rouletteAnimate = async (element, frames, timing) => {
      const animation = element.animate(frames, timing);
      await animation.finished;
      return animation;
    };
    window.rouletteRotationGlint = async () => {};
    window.rouletteWait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
    window.rouletteSpinSound = () => {};
  });

  await page.addScriptTag({ path: turnAnimationPath });
  await page.addScriptTag({ path: guardPath });
  await page.waitForTimeout(120);
  assert.deepEqual(pageErrors, [], `Scripts raised page errors:\n${pageErrors.join('\n')}`);
  assert.equal(await page.evaluate(() => Boolean(window.RouletteTurnLock)), true);
  assert.equal(await page.evaluate(() => Boolean(window.RouletteFacingGuard)), true);
  await page.waitForTimeout(180);

  const initial = await page.evaluate(() => {
    const facing = document.querySelector('[data-roulette-facing]');
    return {
      transform: facing?.style.transform,
      turnId: facing?.dataset.rouletteFacingTurnId,
      lockTurnId: window.RouletteTurnLock.lock.turnId
    };
  });
  assert.deepEqual(initial, {
    transform: 'rotate(356deg)',
    turnId: 'creator',
    lockTurnId: 'creator'
  });

  await page.evaluate(() => {
    window.rouletteLatestGame = {
      ...window.rouletteLatestGame,
      rouletteState: { ...window.rouletteLatestGame.rouletteState, turnId: 'joiner' }
    };
    window.duelLastActiveGame = window.rouletteLatestGame;
    window.rouletteBind(window.duelActive);
  });
  await page.waitForTimeout(1320);

  const joinerFacing = await page.evaluate(() => {
    const facing = document.querySelector('[data-roulette-facing]');
    return {
      transform: facing?.style.transform,
      turnId: facing?.dataset.rouletteFacingTurnId,
      lockTurnId: window.RouletteTurnLock.lock.turnId,
      pendingTurnId: window.RouletteTurnLock.lock.pendingTurnId
    };
  });
  assert.deepEqual(joinerFacing, {
    transform: 'rotate(176deg)',
    turnId: 'joiner',
    lockTurnId: 'joiner',
    pendingTurnId: ''
  });

  const unauthorizedResult = await page.evaluate(async () => {
    const facing = document.querySelector('[data-roulette-facing]');
    const result = await window.rouletteAnimate(
      facing,
      [{ transform: 'rotate(176deg)' }, { transform: 'rotate(356deg)' }],
      { duration: 120, fill: 'forwards' }
    );
    await new Promise(resolve => setTimeout(resolve, 180));
    return {
      blockedResult: result === null,
      transform: facing.style.transform,
      blockedAnimations: window.RouletteFacingGuard.diagnostics().blockedAnimations
    };
  });
  assert.equal(unauthorizedResult.blockedResult, true);
  assert.equal(unauthorizedResult.transform, 'rotate(176deg)');
  assert.ok(unauthorizedResult.blockedAnimations >= 1);

  await page.evaluate(async () => {
    const facing = document.querySelector('[data-roulette-facing]');
    facing.style.transform = 'rotate(356deg)';
    await new Promise(resolve => setTimeout(resolve, 180));
  });
  assert.equal(
    await page.locator('[data-roulette-facing]').evaluate(element => element.style.transform),
    'rotate(176deg)'
  );

  await page.evaluate(() => {
    window.rouletteLatestGame = {
      ...window.rouletteLatestGame,
      rouletteState: { ...window.rouletteLatestGame.rouletteState, turnId: 'creator' }
    };
    window.duelLastActiveGame = window.rouletteLatestGame;
    window.rouletteBind(window.duelActive);
  });
  await page.waitForTimeout(1320);

  const creatorFacing = await page.evaluate(() => {
    const facing = document.querySelector('[data-roulette-facing]');
    return {
      transform: facing?.style.transform,
      turnId: facing?.dataset.rouletteFacingTurnId,
      lockTurnId: window.RouletteTurnLock.lock.turnId,
      pendingTurnId: window.RouletteTurnLock.lock.pendingTurnId
    };
  });
  assert.deepEqual(creatorFacing, {
    transform: 'rotate(356deg)',
    turnId: 'creator',
    lockTurnId: 'creator',
    pendingTurnId: ''
  });

  assert.deepEqual(pageErrors, [], `Runtime raised page errors:\n${pageErrors.join('\n')}`);
  console.log(JSON.stringify({
    status: 'passed',
    checks: [
      'creator facing locked at 356 degrees',
      'joiner rotation completed and locked at 176 degrees',
      'unauthorized facing animation blocked',
      'direct rogue transform automatically corrected',
      'return rotation completed and locked to creator'
    ]
  }, null, 2));
} finally {
  await browser.close();
}
