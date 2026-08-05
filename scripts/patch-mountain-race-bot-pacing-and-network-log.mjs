import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const integrationUrl = new URL('netlify/functions/mountain-race/integration.js', root);
const indexUrl = new URL('index.html', root);

const integrationMarker = '// MOUNTAIN_RACE_BOT_PACING_AND_NETWORK_LOG_V2';
const htmlMarker = '<!-- MOUNTAIN_RACE_NETWORK_BOT_LOG_V2 -->';
const minStepIntervalMs = 800;

function assert(condition, message) {
  if (!condition) throw new Error(`Summit Sprint bot-pacing patch failed: ${message}`);
}

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint bot-pacing patch could not find ${label}.`);
  return source.replace(before, after);
}

function replaceAllRequired(source, before, after, label) {
  if (!source.includes(before)) {
    if (source.includes(after)) return source;
    throw new Error(`Summit Sprint bot-pacing patch could not find ${label}.`);
  }
  return source.split(before).join(after);
}

let integration = await readFile(integrationUrl, 'utf8');

if (!integration.includes(integrationMarker)) {
  integration = replaceRequired(
    integration,
    'const MOUNTAIN_RACE_BOT_REACTION_MAX_MS = 760;',
    `const MOUNTAIN_RACE_BOT_REACTION_MAX_MS = 760;\nconst MOUNTAIN_RACE_BOT_MIN_STEP_INTERVAL_MS = ${minStepIntervalMs};\n${integrationMarker}`,
    'minimum server bot-step interval constant'
  );

  integration = replaceRequired(
    integration,
    `      const currentNow = Date.now();
      const raceEndMs = Date.parse(state.endAt || '');`,
    `      const currentNow = Date.now();
      const lastBotActionMs = Date.parse(state.botLastActionAt || '');
      if (
        Number.isFinite(lastBotActionMs)
        && currentNow < lastBotActionMs + MOUNTAIN_RACE_BOT_MIN_STEP_INTERVAL_MS
      ) {
        // Both the game page and the detached Network Bot page poll this driver.
        // A server-time gate makes concurrent polls observational only until the
        // next visible move is genuinely due.
        return latest;
      }
      const raceEndMs = Date.parse(state.endAt || '');`,
    'server-time bot-step gate'
  );

  integration = replaceAllRequired(
    integration,
    '            actionAtMs: scheduled,',
    '            actionAtMs: currentNow,',
    'actual server-time bot action timestamps'
  );
  integration = replaceAllRequired(
    integration,
    '            scheduleFromMs: scheduled,',
    '            scheduleFromMs: currentNow,',
    'non-stale bot reschedule timestamps'
  );
  integration = replaceAllRequired(
    integration,
    '            scheduleFromMs: Date.now(),',
    '            scheduleFromMs: currentNow,',
    'stable bot reschedule timestamps'
  );

  integration = replaceRequired(
    integration,
    `    const cleanWinner = cleanUserId(winnerId);
    const finalState = {`,
    `    const cleanWinner = cleanUserId(winnerId);
    const totalHolds = Array.isArray(state?.sequence) ? state.sequence.length : 0;
    const winnerHolds = cleanWinner ? int(state.players?.[cleanWinner]?.promptIndex, 0) : 0;
    const raceEndMs = Date.parse(state?.endAt || '');
    const timeoutResolution = Number.isFinite(raceEndMs) && Date.now() >= raceEndMs;
    if (cleanWinner && winnerHolds < totalHolds && !timeoutResolution) {
      // Never settle a poll-driven race unless the reported winner actually
      // reached every hold. Timeout settlement remains valid after endAt.
      const repairedState = {
        ...state,
        winnerId: '',
        completedAt: null,
        revision: int(state.revision, 0) + 1
      };
      return await saveGame({ ...game, mountainraceState: repairedState, npcActionAt: repairedState.npcActionAt || null });
    }
    const finalState = {`,
    'premature winner settlement guard'
  );

  integration = replaceRequired(
    integration,
    `      tie: Boolean(complete && !winnerUserId),
      completedAt: state.completedAt || null`,
    `      tie: Boolean(complete && !winnerUserId),
      networkBotLog: (() => {
        const profile = botProfile(game);
        const botId = cleanUserId(profile?.userId || '');
        const botState = botId ? state.players?.[botId] || {} : {};
        return {
          enabled: Boolean(profile && isRemoteBotProfile(profile)),
          userId: botId,
          profile: String(game?.remoteNetworkProfile || ''),
          actionSequence: int(state.botActionSequence, 0),
          promptIndex: int(botState.promptIndex, 0),
          acceptedInputs: int(botState.acceptedInputs, 0),
          rejectedInputs: int(botState.rejectedInputs, 0),
          lastActionAt: state.botLastActionAt || null,
          nextActionAt: state.npcActionAt || null
        };
      })(),
      completedAt: state.completedAt || null`,
    'public Network Bot diagnostics'
  );

  integration = replaceRequired(
    integration,
    `  MOUNTAIN_RACE_BOT_REACTION_MIN_MS,
  MOUNTAIN_RACE_BOT_REACTION_MAX_MS,
  createMountainRaceIntegration`,
    `  MOUNTAIN_RACE_BOT_REACTION_MIN_MS,
  MOUNTAIN_RACE_BOT_REACTION_MAX_MS,
  MOUNTAIN_RACE_BOT_MIN_STEP_INTERVAL_MS,
  createMountainRaceIntegration`,
    'minimum bot-step interval export'
  );
}

assert(integration.includes('const MOUNTAIN_RACE_BOT_CATCH_UP_LIMIT = 1;'), 'each wake is not capped to one bot move');
assert(integration.includes(`const MOUNTAIN_RACE_BOT_MIN_STEP_INTERVAL_MS = ${minStepIntervalMs};`), 'minimum server bot-step interval is missing');
assert(integration.includes('currentNow < lastBotActionMs + MOUNTAIN_RACE_BOT_MIN_STEP_INTERVAL_MS'), 'concurrent poll gate is missing');
assert(!integration.includes('actionAtMs: scheduled'), 'a bot action still records an overdue timestamp');
assert(!integration.includes('scheduleFromMs: scheduled'), 'a bot action still reschedules from an overdue timestamp');
assert(integration.includes('networkBotLog: (() => {'), 'public Network Bot diagnostics are missing');
assert(integration.includes('winnerHolds < totalHolds && !timeoutResolution'), 'premature settlement guard is missing');
await writeFile(integrationUrl, integration);

let html = await readFile(indexUrl, 'utf8');
html = html
  .replace(/(["'])network poll\1/g, '$1network bot poll$1')
  .replace(/Remote Network Bot Debug/gi, 'Network Bot Log')
  .replace(/Remote Bot Debug/gi, 'Network Bot Log')
  .replace(/Remote Network Bot Logs?/gi, 'Network Bot Log')
  .replace(/Remote Bot Logs?/gi, 'Network Bot Log');

if (!html.includes(htmlMarker)) {
  assert(html.includes('</body>'), 'deployed page is missing </body>');
  const networkBotLogBootstrap = `${htmlMarker}
<script id="mountainRaceNetworkBotLogBootstrap">
(() => {
  const normalized = value => String(value || '').replace(/\\s+/g, ' ').trim();
  const isGameLogSibling = element => [...(element?.parentElement?.children || [])].some(sibling => {
    if (sibling === element) return false;
    return /(?:game.*log|log.*game)/i.test(normalized(sibling.textContent));
  });
  const renameNetworkBotLog = () => {
    const selectors = 'button,[role="tab"],summary,option,label,h1,h2,h3';
    for (const element of document.querySelectorAll(selectors)) {
      const text = normalized(element.textContent);
      const explicitLog = /(?:remote\\s+(?:network\\s+)?bot|network\\s+bot).*(?:debug|logs?)/i.test(text)
        || /(?:debug|logs?).*(?:remote\\s+(?:network\\s+)?bot|network\\s+bot)/i.test(text);
      const pairedTab = /^(?:remote\\s+(?:network\\s+)?bot|network\\s+bot)$/i.test(text)
        && isGameLogSibling(element);
      if (!explicitLog && !pairedTab) continue;
      element.textContent = 'Network Bot Log';
      element.setAttribute('data-network-bot-log', 'true');
      element.setAttribute('aria-label', 'Network Bot Log');
      element.title = 'Network Bot Log';
    }
  };
  const start = () => {
    renameNetworkBotLog();
    if (!document.body) return;
    new MutationObserver(renameNetworkBotLog).observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
</script>`;
  html = html.replace('</body>', `${networkBotLogBootstrap}\n</body>`);
}

assert(html.includes(htmlMarker), 'Network Bot Log bootstrap marker is missing');
assert(html.includes("element.textContent = 'Network Bot Log'"), 'second debug menu is not identified as the Network Bot Log');
await writeFile(indexUrl, html);

console.log('Prevented instant Summit Sprint completion: each Network Bot move is server-time gated, stale catch-up timestamps are removed, premature winner settlement is blocked, and the second debug menu is labeled Network Bot Log with authoritative bot diagnostics.');
