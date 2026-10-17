import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const integrationUrl = new URL('netlify/functions/mountain-race/integration.js', root);
const dataUrl = new URL('netlify/functions/_data.js', root);
const indexUrl = new URL('index.html', root);
const validatorUrl = new URL('scripts/validate-mountain-race-multiplayer.mjs', root);
const deploymentMarker = '<!-- MOUNTAIN_RACE_START_STABILITY_V1 -->';

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint start-stability patch could not find ${label}.`);
  return source.replace(before, after);
}

function functionBounds(source, marker, label) {
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Summit Sprint start-stability patch could not find ${label}.`);
  const nextAsync = source.indexOf('\nasync function ', start + marker.length);
  const nextPlain = source.indexOf('\nfunction ', start + marker.length);
  const candidates = [nextAsync, nextPlain].filter(value => value >= 0);
  return { start, end: candidates.length ? Math.min(...candidates) : source.length };
}

function replaceInsideFunction(source, marker, before, after, label) {
  const { start, end } = functionBounds(source, marker, label);
  const section = source.slice(start, end);
  if (section.includes(after)) return source;
  if (!section.includes(before)) throw new Error(`Summit Sprint start-stability patch could not find ${label}.`);
  return source.slice(0, start) + section.replace(before, after) + source.slice(end);
}

let integration = await readFile(integrationUrl, 'utf8');

integration = replaceRequired(
  integration,
  `const MOUNTAIN_RACE_BOT_ERROR_RATE = 0.08;
const MOUNTAIN_RACE_BOT_CATCH_UP_LIMIT = 10;`,
  `const MOUNTAIN_RACE_BOT_ERROR_RATE = 0.08;
const MOUNTAIN_RACE_BOT_CATCH_UP_LIMIT = 1;
const MOUNTAIN_RACE_BOT_REACTION_MIN_MS = 520;
const MOUNTAIN_RACE_BOT_REACTION_MAX_MS = 760;`,
  'paced bot constants'
);

integration = replaceRequired(
  integration,
  `  function botDelay(game) {
    const network = remoteNetworkConfig(game);
    const min = network ? Math.max(100, int(network.minDelayMs, 100)) : 430;
    const max = network ? Math.max(min, int(network.maxDelayMs, min + 220)) : 690;
    let delay = min + Math.floor(Math.random() * (max - min + 1));

    if (network && Math.random() < Number(network.stallChance || 0)) {
      delay += 900 + Math.floor(Math.random() * 1300);
    }
    if (network && Math.random() < Number(network.reconnectChance || 0)) {
      delay += 600 + Math.floor(Math.random() * 1200);
    }
    return delay;
  }`,
  `  function botDelay(game) {
    const network = remoteNetworkConfig(game);
    const rawMin = network ? Math.max(100, int(network.minDelayMs, 100)) : 180;
    const rawMax = network ? Math.max(rawMin, int(network.maxDelayMs, rawMin + 140)) : 320;
    const networkMin = Math.min(450, rawMin);
    const networkMax = Math.max(networkMin, Math.min(450, rawMax));
    const reaction = MOUNTAIN_RACE_BOT_REACTION_MIN_MS
      + Math.floor(Math.random() * (MOUNTAIN_RACE_BOT_REACTION_MAX_MS - MOUNTAIN_RACE_BOT_REACTION_MIN_MS + 1));
    const transport = networkMin + Math.floor(Math.random() * (networkMax - networkMin + 1));
    let delay = reaction + transport;

    if (network && Math.random() < Number(network.stallChance || 0)) {
      delay += 900 + Math.floor(Math.random() * 1300);
    }
    if (network && Math.random() < Number(network.reconnectChance || 0)) {
      delay += 600 + Math.floor(Math.random() * 1200);
    }
    return delay;
  }`,
  'human-paced bot delay'
);

integration = replaceRequired(
  integration,
  `            isBot: true,
            actionAtMs: scheduled,
            scheduleFromMs: scheduled,
            catchUpCount: processed + 1`,
  `            isBot: true,
            actionAtMs: scheduled,
            scheduleFromMs: Date.now(),
            catchUpCount: processed + 1`,
  'non-bursting bot reschedule point'
);

integration = replaceRequired(
  integration,
  `      // Serverless functions do not have a permanent background process. A focused
      // GET wakes this driver, which replays every bot action whose network timestamp
      // became due. Each replay uses the same action validation, prompt-index guard,
      // action-id dedupe, persistence, and winner settlement as a player request.`,
  `      // Serverless functions do not have a permanent background process. A focused
      // GET wakes this driver, but each request may execute only one due bot move.
      // The next move is scheduled from the current server time so delayed polling can
      // never replay a burst of invisible moves or let the bot reach the summit instantly.`,
  'single-move wake comment'
);

integration = replaceRequired(
  integration,
  `  MOUNTAIN_RACE_BOT_ERROR_RATE,
  MOUNTAIN_RACE_BOT_CATCH_UP_LIMIT,
  createMountainRaceIntegration`,
  `  MOUNTAIN_RACE_BOT_ERROR_RATE,
  MOUNTAIN_RACE_BOT_CATCH_UP_LIMIT,
  MOUNTAIN_RACE_BOT_REACTION_MIN_MS,
  MOUNTAIN_RACE_BOT_REACTION_MAX_MS,
  createMountainRaceIntegration`,
  'paced bot exports'
);

await writeFile(integrationUrl, integration);

let data = await readFile(dataUrl, 'utf8');

const safeCountdownLine = '  const startMs = atMs + (game?.mode === "safecracker" ? 3000 : DUEL_COUNTDOWN_MS);';
const effectiveCountdownLines = `${safeCountdownLine}\n  const effectiveStartMs = game?.mode === "mountainrace" ? atMs + 3000 : startMs;`;
data = replaceRequired(data, safeCountdownLine, effectiveCountdownLines, 'authoritative Summit Sprint countdown duration');

data = replaceInsideFunction(
  data,
  'function duelStartCountdown(game, atMs = Date.now()) {',
  '    startAt: new Date(startMs).toISOString(),',
  '    startAt: new Date(effectiveStartMs).toISOString(),',
  'Summit Sprint shared start timestamp'
);
for (const functionName of ['fishingInitialState', 'drawInitialState', 'rouletteInitialState', 'safeCrackerInitialState', 'mountainRaceInitialState']) {
  data = replaceInsideFunction(
    data,
    'function duelStartCountdown(game, atMs = Date.now()) {',
    `${functionName}(next, startMs)`,
    `${functionName}(next, effectiveStartMs)`,
    `${functionName} authoritative timestamp`
  );
}

data = replaceRequired(
  data,
  `      if (game.mode === "roulette" || game.mode === "safecracker") {
        // Roulette and Safe Cracker confirm the test opponent in the same`,
  `      if (game.mode === "mountainrace") {
        // Summit Sprint starts from one human Ready tap. The synthetic opponent
        // is confirmed in this same locked transaction, eliminating the delayed
        // second Ready window and the competing countdown start.
        ready[npcId] = true;
        game.npcReadyAt = null;
        game.npcReadyWindowId = activeWindowId;
      } else if (game.mode === "roulette" || game.mode === "safecracker") {
        // Roulette and Safe Cracker confirm the test opponent in the same`,
  'single-tap Summit Sprint readiness'
);

data = replaceRequired(
  data,
  `async function duelActionGame(user, gameId, details = {}) {
  let game = await duelGetRaw(gameId);`,
  `async function duelActionGame(user, gameId, details = {}) {
  const mountainRaceRequest = String(gameId || "").startsWith("duel-mountainrace-");
  let game = mountainRaceRequest
    ? await duelGetRawStrong(gameId, 2) || await duelGetRaw(gameId)
    : await duelGetRaw(gameId);`,
  'strong-first Summit Sprint action lookup'
);

data = replaceRequired(
  data,
  `async function duelGetGame(user, gameId, options = {}) {
  let game = await duelGetRaw(gameId);`,
  `async function duelGetGame(user, gameId, options = {}) {
  const mountainRaceRequest = String(gameId || "").startsWith("duel-mountainrace-");
  let game = mountainRaceRequest
    ? await duelGetRawStrong(gameId, 2) || await duelGetRaw(gameId)
    : await duelGetRaw(gameId);`,
  'strong-first Summit Sprint polling lookup'
);

data = replaceInsideFunction(
  data,
  'async function duelGetGame(user, gameId, options = {}) {',
  '      const latest = await duelGetRaw(gameId);',
  '      const latest = mountainRaceRequest\n        ? await duelGetRawStrong(gameId, 1) || await duelGetRaw(gameId)\n        : await duelGetRaw(gameId);',
  'strong Ready normalization read'
);

await writeFile(dataUrl, data);

let html = await readFile(indexUrl, 'utf8');

html = replaceRequired(
  html,
  `      if(game.mode==='safecracker'){
        duelHideCountdownPortal();
        duelStartLocallyAtAuthoritativeTime(game);
        return true;
      }`,
  `      if(game.mode==='mountainrace'){
        duelHideCountdownPortal();
        duelStartLocallyAtAuthoritativeTime(game);
        return true;
      }
      if(game.mode==='safecracker'){
        duelHideCountdownPortal();
        duelStartLocallyAtAuthoritativeTime(game);
        return true;
      }`,
  'dedicated Summit Sprint countdown ownership'
);

html = replaceRequired(
  html,
  `      const isSafeCracker = String(duelLastActiveGame?.mode || "") === "safecracker";
      if (!isSafeCracker) return await duelRequest("act", { gameId, choice: "ready" });`,
  `      const isStableReadyMode = ["safecracker", "mountainrace"].includes(String(duelLastActiveGame?.mode || ""));
      if (!isStableReadyMode) return await duelRequest("act", { gameId, choice: "ready" });`,
  'single-tap Summit Sprint Ready retry'
);

html = replaceRequired(
  html,
  'st=g?.rouletteState||g?.drawState||g?.fishingState||g?.safecrackerState||g?.mountainraceState||{}',
  'st=g?.mode===\'mountainrace\'?(g?.mountainraceState||{}):g?.rouletteState||g?.drawState||g?.fishingState||g?.safecrackerState||{}',
  'mode-specific Summit Sprint debug state'
);

if (!html.includes(deploymentMarker)) {
  if (!html.includes('</body>')) throw new Error('Summit Sprint start-stability patch could not mark the deployed page.');
  html = html.replace('</body>', `${deploymentMarker}\n</body>`);
}
await writeFile(indexUrl, html);

let validator = await readFile(validatorUrl, 'utf8');
validator = replaceRequired(
  validator,
  "assert(MOUNTAIN_RACE_BOT_CATCH_UP_LIMIT === 10, 'testing bot catch-up limit changed');",
  "assert(MOUNTAIN_RACE_BOT_CATCH_UP_LIMIT === 1, 'testing bot must execute at most one move per server wake');",
  'validator catch-up expectation'
);
validator = replaceRequired(
  validator,
  "  'const MOUNTAIN_RACE_BOT_CATCH_UP_LIMIT = 10;',",
  "  'const MOUNTAIN_RACE_BOT_CATCH_UP_LIMIT = 1;',",
  'validator source constant'
);
validator = replaceRequired(
  validator,
  `  // A fixed value keeps the bot accurate and its 120 ms network cadence stable.
  // The driver must catch up several separately validated actions per poll and
  // finish the full course even though no permanent server process is running.`,
  `  // A fixed value keeps the bot accurate. The first delayed wake may execute
  // exactly one move, then each later forced wake advances at most one more hold.`,
  'paced bot test comment'
);
validator = replaceRequired(
  validator,
  "  assert(firstWakeMoves > 1, 'one poll still advances the bot only once');",
  "  assert(firstWakeMoves === 1, 'one delayed poll advanced more than one bot move');",
  'single-move first wake assertion'
);
validator = replaceRequired(
  validator,
  `  for (let wake = 0; wake < 4 && botGame.status === 'playing'; wake += 1) {
    botGame = await integration.advance(botGame);
  }`,
  `  for (let wake = 0; wake < 40 && botGame.status === 'playing'; wake += 1) {
    botGame = {
      ...botGame,
      mountainraceState: {
        ...botGame.mountainraceState,
        npcActionAt: new Date(Date.now() - 1).toISOString()
      }
    };
    await saveGame(botGame);
    botGame = await integration.advance(botGame);
  }`,
  'paced full-race wake loop'
);
validator = replaceRequired(
  validator,
  'full Remote Network Bot catch-up and completion',
  'paced Remote Network Bot completion without burst catch-up',
  'validator completion message'
);
await writeFile(validatorUrl, validator);

console.log('Fixed Summit Sprint start stability: strong reads remove transient 500s, one Ready tap owns one three-second countdown, and the bot advances at a visible human-paced rate without catch-up bursts.');
