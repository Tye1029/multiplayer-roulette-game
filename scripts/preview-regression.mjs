import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const target = new URL(process.env.TARGET_URL || 'https://lamp-development--famous-piroshki-b621da.netlify.app/');
const chromePath = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const artifactsDir = new URL('../artifacts/preview-regression/', import.meta.url);
await mkdir(artifactsDir, { recursive: true });

const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const absolute = path => new URL(path, target).href;
const results = { target: target.href, checks: [] };
const pass = name => results.checks.push({ name, status: 'passed' });

async function gotoWithRetry(page, url, attempts = 12) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      if (response?.ok()) return response;
      lastError = new Error(`HTTP ${response?.status() || 'unknown'} for ${url}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(Math.min(15000, attempt * 1500));
  }
  throw lastError || new Error(`Could not load ${url}`);
}

async function setRange(page, key, value) {
  await page.locator(`input[data-k="${key}"]`).evaluate((input, nextValue) => {
    input.value = String(nextValue);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

const browser = await chromium.launch({
  headless: true,
  executablePath: chromePath,
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});

try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true
  });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: target.origin });

  const home = await context.newPage();
  const requests = [];
  home.on('request', request => requests.push(request.url()));
  const response = await gotoWithRetry(home, target.href);
  assert.equal(response.ok(), true);
  await home.waitForTimeout(1000);
  assert.match(await home.locator('meta[name="viewport"]').getAttribute('content') || '', /width=device-width/i);
  assert.equal(requests.some(url => /\/assets\/roulette\/smoke\.(?:css|js)(?:[?#]|$)/i.test(url)), false);
  assert.deepEqual(await home.evaluate(() => ({
    roomSmokeNodes: document.querySelectorAll('.rr-smoke-ambient,.rr-smoke-lit').length,
    permanentMarker: document.documentElement.innerHTML.includes('__rrPermanentSmokeV1'),
    smokeAssetTags: [...document.querySelectorAll('script[src],link[href]')]
      .map(element => element.src || element.href || '')
      .filter(url => /\/assets\/roulette\/smoke\.(?:css|js)(?:[?#]|$)/i.test(url))
  })), { roomSmokeNodes: 0, permanentMarker: false, smokeAssetTags: [] });
  pass('mobile Netlify preview and no-room-smoke loading');
  await home.screenshot({ path: new URL('mobile-preview.png', artifactsDir).pathname, fullPage: true });

  const calibration = await context.newPage();
  await gotoWithRetry(calibration, absolute('/lamp-calibration.html'));
  await calibration.locator('#toggle').click();
  await calibration.locator('#panel').waitFor({ state: 'visible' });
  assert.equal(await calibration.locator('#rows input[type="range"]').count(), 25);

  await calibration.evaluate(() => {
    document.getElementById('game').srcdoc = `<!doctype html><html><head><style>
      html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#1a120d}
      [data-roulette-game]{position:relative;width:100%;height:100%;overflow:hidden}
      .rr126-lamp-rig{position:absolute;inset:0}.rr126-chain{position:absolute;top:0}
      .rr126-chain>i{display:block;width:100%;background:#777}.rr126-swing{position:absolute}
      .rr-table{position:absolute;left:5%;top:32%;width:90%;height:58%;border-radius:48%;background:#4b2b18}
      .rr130-table-illumination{position:absolute;inset:0}
      .rr-gun-motion{position:absolute;left:62%;top:54%;width:120px;height:70px;background:#333}
    </style></head><body><main data-roulette-game>
      <div class="rr126-lamp-rig"><div class="rr126-chain"><i></i><i></i></div><div class="rr126-swing"></div></div>
      <div class="rr-table"><div class="rr130-table-illumination"></div><div class="rr-gun-motion"></div></div>
    </main></body></html>`;
  });
  await calibration.waitForFunction(() => document.getElementById('game')?.contentDocument?.querySelector('[data-roulette-game]'));
  await calibration.waitForFunction(() => document.getElementById('status')?.textContent?.includes('25/25'), null, { timeout: 10000 });

  for (const [key, value] of Object.entries({
    lampX: 52.25,
    lampArtX: 3.5,
    swing: 2.6,
    speed: 3.2,
    lightX: 63.5,
    lightY: 47.5,
    track: 11.25,
    trackSpeed: 3.2,
    wallDark: 0.58,
    gunGleam: 0.42
  })) await setRange(calibration, key, value);

  const frame = calibration.frames().find(candidate => candidate.parentFrame() === calibration.mainFrame());
  assert.ok(frame);
  const lampState = await frame.evaluate(() => {
    const game = document.querySelector('[data-roulette-game]');
    const swing = document.querySelector('.rr126-swing');
    const chain = document.querySelector('.rr126-chain');
    const light = document.querySelector('.rr130-table-illumination');
    const image = document.getElementById('rrLampPng');
    return {
      imageSource: image?.getAttribute('src') || '',
      imageX: image?.style.getPropertyValue('--rr-lamp-art-x') || '',
      swingLeft: swing?.style.left || '',
      chainLeft: chain?.style.left || '',
      swingDuration: swing?.getAnimations?.()[0]?.effect?.getTiming?.().duration || 0,
      lightDuration: light?.getAnimations?.()[0]?.effect?.getTiming?.().duration || 0,
      lightBackground: game?.style.getPropertyValue('--rr-cal-light-background') || '',
      trackDistance: game?.style.getPropertyValue('--rr-light-track-distance') || '',
      darkness: game?.style.getPropertyValue('--rr-room-darkness') || '',
      gleam: game?.style.getPropertyValue('--rr-gun-gleam') || '',
      roomSmokeNodes: document.querySelectorAll('.rr-smoke-ambient,.rr-smoke-lit').length
    };
  });
  assert.match(lampState.imageSource, /\/assets\/roulette\/decor\/lamp-1\.png$/);
  assert.equal(lampState.imageX, '3.5%');
  assert.equal(lampState.swingLeft, '52.25%');
  assert.equal(lampState.chainLeft, '52.25%');
  assert.equal(Number(lampState.swingDuration), 3200);
  assert.equal(Number(lampState.lightDuration), 3200);
  assert.match(lampState.lightBackground, /63\.5% 47\.5%/);
  assert.equal(lampState.trackDistance, '11.25%');
  assert.equal(lampState.darkness, '0.58');
  assert.equal(lampState.gleam, '0.42');
  assert.equal(lampState.roomSmokeNodes, 0);

  const before = await frame.evaluate(() => ({
    swing: document.querySelector('.rr126-swing')?.getAnimations?.()[0]?.currentTime || 0,
    light: document.querySelector('.rr130-table-illumination')?.getAnimations?.()[0]?.currentTime || 0
  }));
  await calibration.waitForTimeout(250);
  const after = await frame.evaluate(() => ({
    swing: document.querySelector('.rr126-swing')?.getAnimations?.()[0]?.currentTime || 0,
    light: document.querySelector('.rr130-table-illumination')?.getAnimations?.()[0]?.currentTime || 0
  }));
  assert.ok(after.swing > before.swing);
  assert.ok(after.light > before.light);

  await calibration.locator('#center').click();
  const centeredX = Number(await calibration.locator('input[data-k="lightX"]').inputValue());
  const centeredY = Number(await calibration.locator('input[data-k="lightY"]').inputValue());
  assert.ok(centeredX > 50 && centeredX < 90);
  assert.ok(centeredY > 30 && centeredY < 80);

  await calibration.locator('#save').click();
  const saved = await calibration.evaluate(() => JSON.parse(localStorage.getItem('rrLampCalibrationV9') || 'null'));
  assert.equal(saved.lampX, 52.25);
  assert.equal(saved.speed, 3.2);
  assert.equal(saved.trackSpeed, 3.2);

  await calibration.locator('#copy').click();
  await calibration.waitForFunction(() => document.getElementById('status')?.textContent === 'Calibration JSON copied');
  assert.equal(JSON.parse(await calibration.evaluate(() => navigator.clipboard.readText())).lampX, 52.25);

  const panel = await calibration.locator('#panel').boundingBox();
  assert.ok(panel && panel.x >= 0 && panel.y >= 0);
  assert.ok(panel.x + panel.width <= 391);
  assert.ok(panel.y + panel.height <= 845);
  pass('lamp movement, tracked lighting, calibration controls, persistence, and mobile panel');
  await calibration.screenshot({ path: new URL('mobile-calibration.png', artifactsDir).pathname, fullPage: true });

  const harness = await context.newPage();
  await gotoWithRetry(harness, target.href);
  await harness.evaluate(() => {
    document.body.innerHTML = `<main id="duelActive"><section data-roulette-game data-game-id="rotation-test">
      <div class="rr-gun-motion" data-roulette-motion><div class="rr-revolver"><span class="rr-metal-glint"></span></div><div class="rr-shot-flash"></div></div>
      <button class="rr-btn" type="button">Test</button></section></main>`;
    const creator = { userId: 'creator', name: 'Creator' };
    const joiner = { userId: 'joiner', name: 'Joiner' };
    window.__rotationTestGame = {
      gameId: 'rotation-test', status: 'playing', creator, joiner,
      rouletteState: { turnId: 'joiner', openingSpinWinnerId: 'joiner' }
    };
    window.duelActive = document.getElementById('duelActive');
    window.rouletteLatestGame = window.__rotationTestGame;
    window.rouletteVisualRuntime = { busy: false, openingDone: false, currentAngle: -4, angleHydrated: false, lastTurnId: '', displayTurnId: '', rotationTargetId: '' };
    window.rouletteOpeningCompletedGames = new Set();
    window.rouletteBind = root => root;
    window.rouletteMotionScale = () => 0.74;
    window.rouletteQueueVisual = callback => Promise.resolve().then(callback);
    window.rouletteAnimate = async (element, frames, timing) => {
      const animation = element.animate(frames, timing);
      await animation.finished;
      return animation;
    };
    window.rouletteRotationGlint = async () => {};
    window.rouletteWait = async () => {};
    window.rouletteSpinSound = volume => { window.__openingSpinVolume = volume; };
  });
  await harness.addScriptTag({ url: absolute('/assets/roulette/opening-spin-sync.js') });
  assert.equal(await harness.evaluate(() => Boolean(Audio.__rrOpeningSpinSyncV1)), true);
  await harness.addScriptTag({ url: absolute('/assets/roulette/turn-animation.js') });
  await harness.waitForFunction(() => Boolean(window.RouletteTurnLock && window.rouletteOpeningSequence));

  const opening = await harness.evaluate(async () => {
    const game = window.__rotationTestGame;
    await window.rouletteOpeningSequence(game, game.rouletteState, game.gameId);
    const root = document.querySelector('[data-roulette-game]');
    return {
      turnId: window.RouletteTurnLock.lock.turnId,
      angle: window.RouletteTurnLock.lock.angle,
      pendingTurnId: window.RouletteTurnLock.lock.pendingTurnId,
      opening: window.RouletteTurnLock.lock.opening,
      transform: root.querySelector('[data-roulette-facing]').style.transform,
      openingClass: root.classList.contains('rr-opening-active'),
      openingFlag: root.dataset.rouletteOpening,
      spinVolume: window.__openingSpinVolume
    };
  });
  assert.deepEqual(opening, {
    turnId: 'joiner', angle: 176, pendingTurnId: '', opening: false,
    transform: 'rotate(176deg)', openingClass: false, openingFlag: '0', spinVolume: 1.35
  });

  const rotations = await harness.evaluate(async () => {
    const game = window.__rotationTestGame;
    window.rouletteVisualRuntime.openingDone = true;
    window.rouletteOpeningCompletedGames.add(game.gameId);
    const snapshot = () => ({
      turnId: window.RouletteTurnLock.lock.turnId,
      angle: window.RouletteTurnLock.lock.angle,
      pendingTurnId: window.RouletteTurnLock.lock.pendingTurnId,
      lockedTurnId: document.querySelector('[data-roulette-game]').dataset.rouletteLockedTurnId
    });
    game.rouletteState.turnId = 'creator';
    await window.rouletteRotateToTurn(game, game.rouletteState, game.gameId, { duration: 140 });
    const first = snapshot();
    game.rouletteState.turnId = 'joiner';
    await window.rouletteRotateToTurn(game, game.rouletteState, game.gameId, { duration: 140 });
    return { first, second: snapshot() };
  });
  assert.deepEqual(rotations.first, { turnId: 'creator', angle: 356, pendingTurnId: '', lockedTurnId: 'creator' });
  assert.deepEqual(rotations.second, { turnId: 'joiner', angle: 176, pendingTurnId: '', lockedTurnId: 'joiner' });
  pass('approved opening spin and complete creator/joiner turn rotations');
  await harness.screenshot({ path: new URL('rotation-harness.png', artifactsDir).pathname, fullPage: true });

  await context.close();
  results.status = 'passed';
} catch (error) {
  results.status = 'failed';
  results.error = error?.stack || String(error);
  throw error;
} finally {
  await writeFile(new URL('results.json', artifactsDir), JSON.stringify(results, null, 2));
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));
