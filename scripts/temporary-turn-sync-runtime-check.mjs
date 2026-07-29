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
  await page.setContent(`<!doctype html><html><body>
    <main id="duelActive">
      <section data-roulette-game data-game-id="sync-test" data-status="playing" data-turn-id="creator" data-revision="11" data-roulette-opening="0">
        <div class="rr-gun-motion" data-roulette-motion>
          <div class="rr-revolver"><span class="rr-metal-glint"></span></div>
        </div>
      </section>
    </main>
  </body></html>`);

  await page.evaluate(() => {
    const creator = { userId: 'creator', name: 'Creator' };
    const joiner = { userId: 'joiner', name: 'Joiner' };
    const makeGame = (revision, turnId) => ({
      mode: 'roulette',
      gameId: 'sync-test',
      status: 'playing',
      revision,
      updatedAt: new Date(1700000000000 + revision * 1000).toISOString(),
      creator,
      joiner,
      rouletteState: { revision, turnId }
    });

    window.__makeSyncGame = makeGame;
    window.rouletteLatestGame = makeGame(10, 'joiner');
    window.duelLastActiveGame = makeGame(11, 'creator');
    window.duelActive = document.getElementById('duelActive');
    window.rouletteVisualRuntime = {
      busy: false,
      openingDone: true,
      currentAngle: 176,
      angleHydrated: true,
      lastTurnId: 'joiner',
      displayTurnId: 'joiner',
      rotationTargetId: ''
    };
    window.rouletteOpeningCompletedGames = new Set(['sync-test']);
    window.rouletteQueueVisual = callback => Promise.resolve().then(callback);
    window.rouletteMotionScale = () => 0.78;
    window.rouletteRotationGlint = async () => {};
    window.rouletteWait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
    window.rouletteSpinSound = () => {};
    window.__rotationEvents = [];
    window.__soundEvents = [];
    window.RouletteAudio = {
      turnRotate(details) {
        window.__soundEvents.push({ ...details, at: performance.now() });
        return true;
      }
    };
    window.rouletteAnimate = async (element, frames, timing) => {
      window.__rotationEvents.push({
        at: performance.now(),
        duration: Number(timing?.duration || 0),
        from: frames?.[0]?.transform || '',
        to: frames?.[frames.length - 1]?.transform || ''
      });
      const animation = element.animate(frames, timing);
      await animation.finished;
      return animation;
    };
    window.rouletteBind = root => root;
  });

  await page.addScriptTag({ path: turnAnimationPath });
  await page.addScriptTag({ path: guardPath });
  await page.waitForFunction(() => Boolean(window.RouletteTurnLock && window.RouletteFacingGuard));

  await page.waitForFunction(() => {
    const facing = document.querySelector('[data-roulette-facing]');
    return facing?.dataset.rouletteFacingTurnId === 'creator' && facing.style.transform === 'rotate(356deg)';
  }, null, { timeout: 5000 });

  const initial = await page.evaluate(() => ({
    turnId: document.querySelector('[data-roulette-facing]')?.dataset.rouletteFacingTurnId,
    transform: document.querySelector('[data-roulette-facing]')?.style.transform,
    sounds: window.__soundEvents.length
  }));
  assert.equal(initial.turnId, 'creator');
  assert.equal(initial.transform, 'rotate(356deg)');

  async function setTurn(turnId, revision) {
    await page.evaluate(({ turnId, revision }) => {
      const game = window.__makeSyncGame(revision, turnId);
      window.rouletteLatestGame = game;
      window.duelLastActiveGame = game;
      const root = document.querySelector('[data-roulette-game]');
      root.dataset.turnId = turnId;
      root.dataset.revision = String(revision);
      root.dataset.status = 'playing';
      window.rouletteBind(window.duelActive);
      window.RouletteFacingGuard.reconcile();
    }, { turnId, revision });
    await page.waitForFunction(expected => {
      const facing = document.querySelector('[data-roulette-facing]');
      return facing?.dataset.rouletteFacingTurnId === expected;
    }, turnId, { timeout: 5000 });
  }

  await setTurn('joiner', 12);
  await setTurn('creator', 13);

  const alternating = await page.evaluate(() => ({
    transform: document.querySelector('[data-roulette-facing]')?.style.transform,
    turnId: document.querySelector('[data-roulette-facing]')?.dataset.rouletteFacingTurnId,
    sounds: window.__soundEvents,
    rotations: window.__rotationEvents
  }));
  assert.equal(alternating.turnId, 'creator');
  assert.equal(alternating.transform, 'rotate(356deg)');
  assert.ok(alternating.sounds.length >= 3, 'each real rotation should start a sound, including a quick return to creator');
  assert.equal(alternating.sounds.length, alternating.rotations.length);
  for (let index = 0; index < alternating.sounds.length; index += 1) {
    assert.ok(alternating.sounds[index].at <= alternating.rotations[index].at + 1,
      `sound ${index} should start before its animation`);
  }

  const blocked = await page.evaluate(async () => {
    window.rouletteLatestGame = window.__makeSyncGame(12, 'joiner');
    window.duelLastActiveGame = window.__makeSyncGame(13, 'creator');
    const root = document.querySelector('[data-roulette-game]');
    root.dataset.turnId = 'creator';
    root.dataset.revision = '13';
    const facing = document.querySelector('[data-roulette-facing]');
    const result = await window.rouletteAnimate(
      facing,
      [{ transform: 'rotate(356deg)' }, { transform: 'rotate(176deg)' }],
      { duration: 150, fill: 'forwards' }
    );
    await new Promise(resolve => setTimeout(resolve, 220));
    return {
      blockedResult: result === null,
      transform: facing.style.transform,
      turnId: facing.dataset.rouletteFacingTurnId,
      diagnostics: window.RouletteFacingGuard.diagnostics()
    };
  });
  assert.equal(blocked.blockedResult, true);
  assert.equal(blocked.turnId, 'creator');
  assert.equal(blocked.transform, 'rotate(356deg)');
  assert.ok(blocked.diagnostics.blockedAnimations >= 1);

  console.log(JSON.stringify({
    status: 'passed',
    checks: [
      'newest snapshot overrides stale turn data',
      'creator and joiner rotations finish at exact authoritative angles',
      'rapid return to the same player still plays rotation sound',
      'rotation sound starts before the real animation call',
      'unauthorized stale reverse animation is blocked'
    ],
    soundCount: alternating.sounds.length,
    rotationCount: alternating.rotations.length,
    diagnostics: blocked.diagnostics
  }, null, 2));
} finally {
  await browser.close();
}
