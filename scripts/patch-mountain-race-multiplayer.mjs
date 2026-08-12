import { readFile, writeFile } from 'node:fs/promises';

const dataUrl = new URL('../netlify/functions/_data.js', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const serverStart = '// MOUNTAIN_RACE_SERVER_START';
const serverEnd = '// MOUNTAIN_RACE_SERVER_END';
const assetStart = '<!-- MOUNTAIN_RACE_MULTIPLAYER_ASSETS_START -->';
const assetEnd = '<!-- MOUNTAIN_RACE_MULTIPLAYER_ASSETS_END -->';

function replaceRequired(source, search, replacement, label) {
  if (source.includes(replacement)) return source;
  if (!source.includes(search)) throw new Error(`Summit Sprint multiplayer patch could not find ${label}.`);
  return source.replace(search, replacement);
}

function replaceAllRequired(source, search, replacement, label) {
  if (source.includes(replacement) && !source.includes(search)) return source;
  const count = source.split(search).length - 1;
  if (!count) throw new Error(`Summit Sprint multiplayer patch could not find ${label}.`);
  return source.split(search).join(replacement);
}

function upsertBlock(source, start, end, block, anchor, label) {
  const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`${escape(start)}[\\s\\S]*?${escape(end)}\\s*`, 'm');
  const clean = source.replace(pattern, '');
  if (!clean.includes(anchor)) throw new Error(`Summit Sprint multiplayer patch could not find ${label}.`);
  return clean.replace(anchor, `${block}\n\n${anchor}`);
}

const serverBlock = String.raw`${serverStart}
const mountainRaceIntegration = createMountainRaceIntegration({
  cleanUserId,
  int,
  mpCleanId,
  getRaw: duelGetRaw,
  getRawStrong: gameId => duelGetRawStrong(gameId, 1),
  saveGame: duelSaveGame,
  publicGame: duelPublicGame,
  completeResolved: duelCompleteWithResolved,
  getUserRecord
});
function mountainRaceInitialState(game, startMs) { return mountainRaceIntegration.initialState(game, startMs); }
function mountainRaceEnsureState(game) { return mountainRaceIntegration.ensureState(game); }
function mountainRaceHasValidState(game) { return mountainRaceIntegration.hasValidState(game); }
function mountainRacePublicState(game, viewerId) { return mountainRaceIntegration.publicState(game, viewerId); }
async function mountainRaceAdvanceAndSave(game) { return await mountainRaceIntegration.advance(game); }
async function mountainRaceAction(user, gameId, rawChoice, details) { return await mountainRaceIntegration.action(user, gameId, rawChoice, details); }
${serverEnd}`;

let data = await readFile(dataUrl, 'utf8');
data = replaceRequired(
  data,
  'const crypto = require("crypto");',
  'const crypto = require("crypto");\nconst { createMountainRaceIntegration } = require("./mountain-race/integration");',
  'Mountain Race integration import'
);
data = upsertBlock(data, serverStart, serverEnd, serverBlock, '// Shared duel ready lifecycle.', 'shared duel lifecycle anchor');
data = replaceRequired(data, '  safecracker: "Safe Cracker Duel",', '  safecracker: "Safe Cracker Duel",\n  mountainrace: "Summit Sprint",', 'duel mode registry');
data = replaceRequired(
  data,
  '    safecrackerState: game.safecrackerState && typeof game.safecrackerState === "object" ? game.safecrackerState : null,\n    ready:',
  '    safecrackerState: game.safecrackerState && typeof game.safecrackerState === "object" ? game.safecrackerState : null,\n    mountainraceState: game.mountainraceState && typeof game.mountainraceState === "object" ? game.mountainraceState : null,\n    ready:',
  'Mountain Race state sanitization'
);
data = replaceRequired(
  data,
  '  if (game.mode === "safecracker" && ["countdown","playing"].includes(game.status) && !safeCrackerHasValidState(game)) return false;\n  return true;',
  '  if (game.mode === "safecracker" && ["countdown","playing"].includes(game.status) && !safeCrackerHasValidState(game)) return false;\n  if (game.mode === "mountainrace" && ["countdown","playing"].includes(game.status) && !mountainRaceHasValidState(game)) return false;\n  return true;',
  'Mountain Race schema validation'
);
data = replaceRequired(
  data,
  '  if (next.mode === "safecracker") next.safecrackerState = safeCrackerInitialState(next, startMs);\n  return next;',
  '  if (next.mode === "safecracker") next.safecrackerState = safeCrackerInitialState(next, startMs);\n  if (next.mode === "mountainrace") next.mountainraceState = mountainRaceInitialState(next, startMs);\n  return next;',
  'Mountain Race countdown initialization'
);
data = replaceRequired(
  data,
  '      if (next.mode === "safecracker" && !safeCrackerHasValidState(next)) next.safecrackerState = safeCrackerInitialState(next, startMs);\n    }',
  '      if (next.mode === "safecracker" && !safeCrackerHasValidState(next)) next.safecrackerState = safeCrackerInitialState(next, startMs);\n      if (next.mode === "mountainrace" && !mountainRaceHasValidState(next)) next.mountainraceState = mountainRaceInitialState(next, startMs);\n    }',
  'Mountain Race playing-state recovery'
);
data = replaceRequired(
  data,
  '      safecrackerState: next.mode === "safecracker" ? null : next.safecrackerState\n    };',
  '      safecrackerState: next.mode === "safecracker" ? null : next.safecrackerState,\n      mountainraceState: next.mode === "mountainrace" ? null : next.mountainraceState\n    };',
  'Mountain Race ready reset'
);
data = replaceRequired(
  data,
  '  const safecrackerState = clean.mode === "safecracker" ? safeCrackerPublicState(clean, viewer) : clean.safecrackerState;\n  const drawCanAct',
  '  const safecrackerState = clean.mode === "safecracker" ? safeCrackerPublicState(clean, viewer) : clean.safecrackerState;\n  const mountainraceState = clean.mode === "mountainrace" ? mountainRacePublicState(clean, viewer) : clean.mountainraceState;\n  const drawCanAct',
  'Mountain Race public-state construction'
);
data = replaceRequired(data, '    safecrackerState,\n    actions:', '    safecrackerState,\n    mountainraceState,\n    actions:', 'Mountain Race public-state response');
data = replaceRequired(
  data,
  'clean.mode === "roulette" ? rouletteCanAct(clean, viewer) : clean.mode === "safecracker" ? Boolean(safecrackerState?.canSubmit) : (clean.status === "playing" && isPlayer && !myAction)',
  'clean.mode === "roulette" ? rouletteCanAct(clean, viewer) : clean.mode === "safecracker" ? Boolean(safecrackerState?.canSubmit) : clean.mode === "mountainrace" ? Boolean(mountainraceState?.canSubmit) : (clean.status === "playing" && isPlayer && !myAction)',
  'Mountain Race canAct policy'
);
data = replaceRequired(
  data,
  '  } else if (game.mode === "safecracker") {\n    let latest = duelNormalizeReadyState(game);\n    if (latest.status === "playing") latest = await safeCrackerAdvanceAndSave(latest);\n    game = latest;\n  } else {',
  '  } else if (game.mode === "safecracker") {\n    let latest = duelNormalizeReadyState(game);\n    if (latest.status === "playing") latest = await safeCrackerAdvanceAndSave(latest);\n    game = latest;\n  } else if (game.mode === "mountainrace") {\n    let latest = duelNormalizeReadyState(game);\n    if (latest.status === "playing") latest = await mountainRaceAdvanceAndSave(latest);\n    game = latest;\n  } else {',
  'Mountain Race focused polling'
);
data = replaceRequired(
  data,
  '  if (game.mode === "safecracker") {\n    return await safeCrackerAction(actorUser, gameId, rawChoice, details);\n  }\n\n  if (game.mode === "blackjack") {',
  '  if (game.mode === "safecracker") {\n    return await safeCrackerAction(actorUser, gameId, rawChoice, details);\n  }\n\n  if (game.mode === "mountainrace") {\n    return await mountainRaceAction(actorUser, gameId, rawChoice, details);\n  }\n\n  if (game.mode === "blackjack") {',
  'Mountain Race action routing'
);
data = replaceRequired(data, '["draw","fishing","roulette","blackjack","safecracker"].includes(clean.mode)', '["draw","fishing","roulette","blackjack","safecracker","mountainrace"].includes(clean.mode)', 'Mountain Race generic NPC exclusion');
data = replaceRequired(
  data,
  '  if (clean.mode === "safecracker") return await safeCrackerAdvanceAndSave(clean);\n  if (clean.status !== "playing"',
  '  if (clean.mode === "safecracker") return await safeCrackerAdvanceAndSave(clean);\n  if (clean.mode === "mountainrace") return await mountainRaceAdvanceAndSave(clean);\n  if (clean.status !== "playing"',
  'Mountain Race generic completion exclusion'
);
data = replaceRequired(
  data,
  'if (!["fishing", "draw", "roulette", "safecracker"].includes(game.mode)) throw new Error("The NPC is available for Fishing, DRAW!, Roulette, and Safe Cracker testing.");',
  'if (!["fishing", "draw", "roulette", "safecracker", "mountainrace"].includes(game.mode)) throw new Error("The NPC is available for Fishing, DRAW!, Roulette, Safe Cracker, and Summit Sprint testing.");',
  'Mountain Race simple NPC availability'
);
data = replaceRequired(
  data,
  'name: game.mode === "draw" ? "Quickdraw Opponent" : game.mode === "roulette" ? "Roulette Opponent" : game.mode === "safecracker" ? "Vault Cracker" : "Fishing Opponent",',
  'name: game.mode === "draw" ? "Quickdraw Opponent" : game.mode === "roulette" ? "Roulette Opponent" : game.mode === "safecracker" ? "Vault Cracker" : game.mode === "mountainrace" ? "Mountain Bot" : "Fishing Opponent",',
  'Mountain Race NPC name'
);
data = replaceRequired(data, '    safecrackerState: null,\n    ledgerIds:', '    safecrackerState: null,\n    mountainraceState: null,\n    ledgerIds:', 'Mountain Race simple NPC state reset');
data = replaceRequired(
  data,
  'if (!["roulette", "draw", "fishing", "safecracker"].includes(String(game.mode || ""))) throw new Error("Remote Network Bot supports Roulette, Draw, Fishing, and Safe Cracker.");',
  'if (!["roulette", "draw", "fishing", "safecracker", "mountainrace"].includes(String(game.mode || ""))) throw new Error("Remote Network Bot supports Roulette, Draw, Fishing, Safe Cracker, and Summit Sprint.");',
  'Mountain Race Remote Bot availability'
);
data = replaceRequired(data, 'blackjackState:null,drawState:null,fishingState:null,rouletteState:null,safecrackerState:null,', 'blackjackState:null,drawState:null,fishingState:null,rouletteState:null,safecrackerState:null,mountainraceState:null,', 'Mountain Race Remote Bot state reset');
data = replaceRequired(
  data,
  'if (latest.status !== "complete" || !["draw", "fishing", "roulette", "safecracker"].includes(String(latest.mode || ""))) throw new Error("Rematches are only available after a completed supported duel.");',
  'if (latest.status !== "complete" || !["draw", "fishing", "roulette", "safecracker", "mountainrace"].includes(String(latest.mode || ""))) throw new Error("Rematches are only available after a completed supported duel.");',
  'Mountain Race rematch support'
);
await writeFile(dataUrl, data);

const assetBlock = `${assetStart}\n  <link id="mountainRaceStyles" rel="stylesheet" href="/assets/mountain-race/mountain-race.css?v=3&multiplayer=1">\n  <script id="mountainRaceMultiplayerRuntime" src="/assets/mountain-race/mountain-race-multiplayer.js?v=1" defer></script>\n${assetEnd}`;
let html = await readFile(indexUrl, 'utf8');
html = upsertBlock(html, assetStart, assetEnd, assetBlock, '</head>', 'index head');
html = replaceRequired(html, 'choose one of the four multiplayer games.', 'choose one of the five multiplayer games.', 'multiplayer test instructions');
html = replaceRequired(
  html,
  '.sth-game[data-mode="roulette"]{background:#9d2739}.sth-game[data-mode="draw"]{background:#355f9d}.sth-game[data-mode="fishing"]{background:#24736b}.sth-game[data-mode="safecracker"]{background:linear-gradient(145deg,#8b6525,#564016)}',
  '.sth-game[data-mode="roulette"]{background:#9d2739}.sth-game[data-mode="draw"]{background:#355f9d}.sth-game[data-mode="fishing"]{background:#24736b}.sth-game[data-mode="safecracker"]{background:linear-gradient(145deg,#8b6525,#564016)}.sth-game[data-mode="mountainrace"]{background:linear-gradient(145deg,#557d45,#263e32)}',
  'Summit Sprint launcher color'
);
html = replaceRequired(
  html,
  '      <button class="sth-game" data-mode="roulette" disabled>Russian Roulette</button>\n      <button class="sth-game" data-mode="draw" disabled>Draw</button>\n      <button class="sth-game" data-mode="fishing" disabled>Fishing</button>\n      <button class="sth-game" data-mode="safecracker" disabled>Safe Cracker</button>',
  '      <button class="sth-game" data-mode="roulette" disabled>Russian Roulette</button>\n      <button class="sth-game" data-mode="draw" disabled>Draw</button>\n      <button class="sth-game" data-mode="fishing" disabled>Fishing</button>\n      <button class="sth-game" data-mode="safecracker" disabled>Safe Cracker</button>\n      <button class="sth-game" data-mode="mountainrace" disabled>Summit Sprint</button>',
  'Summit Sprint launcher button'
);
html = replaceRequired(html, "if(!['roulette','draw','fishing','safecracker'].includes(o.value))o.remove()", "if(!['roulette','draw','fishing','safecracker','mountainrace'].includes(o.value))o.remove()", 'multiplayer launcher mode whitelist');
html = replaceRequired(
  html,
  '.rnb-games [data-rnb-game="roulette"]{background:#9d2739}.rnb-games [data-rnb-game="draw"]{background:#355f9d}.rnb-games [data-rnb-game="fishing"]{background:#24736b}.rnb-games [data-rnb-game="safecracker"]{background:#7b5b20}',
  '.rnb-games [data-rnb-game="roulette"]{background:#9d2739}.rnb-games [data-rnb-game="draw"]{background:#355f9d}.rnb-games [data-rnb-game="fishing"]{background:#24736b}.rnb-games [data-rnb-game="safecracker"]{background:#7b5b20}.rnb-games [data-rnb-game="mountainrace"]{background:#3e673d}',
  'Summit Sprint Remote Bot color'
);
html = replaceRequired(
  html,
  '<div class="rnb-games"><button data-rnb-game="roulette">Roulette</button><button data-rnb-game="draw">Draw</button><button data-rnb-game="fishing">Fishing</button><button data-rnb-game="safecracker">Safe Cracker</button></div>',
  '<div class="rnb-games"><button data-rnb-game="roulette">Roulette</button><button data-rnb-game="draw">Draw</button><button data-rnb-game="fishing">Fishing</button><button data-rnb-game="safecracker">Safe Cracker</button><button data-rnb-game="mountainrace">Summit Sprint</button></div>',
  'Summit Sprint Remote Bot selector'
);
html = replaceRequired(html, 'st=g?.rouletteState||g?.drawState||g?.fishingState||g?.safecrackerState||{}', 'st=g?.rouletteState||g?.drawState||g?.fishingState||g?.safecrackerState||g?.mountainraceState||{}', 'Remote Bot live Summit Sprint state');
html = replaceRequired(
  html,
  'if (mode === "safecracker") return ["countdown","playing","complete"].includes(String(game?.status || "")) ? `<div data-safe-cracker-mount></div>` : `<div class="duel-mode-art"><div class="duel-safe-preview">🔐</div><div class="duel-simple">Crack your own three-number safe before your opponent. First door open wins.</div></div>`;',
  'if (mode === "safecracker") return ["countdown","playing","complete"].includes(String(game?.status || "")) ? `<div data-safe-cracker-mount></div>` : `<div class="duel-mode-art"><div class="duel-safe-preview">🔐</div><div class="duel-simple">Crack your own three-number safe before your opponent. First door open wins.</div></div>`;\n      if (mode === "mountainrace") return ["countdown","playing","complete"].includes(String(game?.status || "")) ? `<div data-mountain-race-mount></div>` : `<div class="duel-mode-art"><div class="duel-safe-preview">⛰️</div><div class="duel-simple">Hit the directional holds in order and climb to the summit before your opponent.</div></div>`;',
  'Summit Sprint game mount'
);
html = replaceRequired(
  html,
  '      if (game.mode === "safecracker") {\n        return "";\n      }',
  '      if (game.mode === "safecracker") {\n        return "";\n      }\n      if (game.mode === "mountainrace") {\n        return "";\n      }',
  'Summit Sprint generic action removal'
);
html = replaceAllRequired(html, '["draw", "fishing", "roulette", "safecracker"].includes(game.mode)', '["draw", "fishing", "roulette", "safecracker", "mountainrace"].includes(game.mode)', 'Summit Sprint completed-game ownership');
html = replaceRequired(
  html,
  '        body = game.mode === "roulette" ? "" : game.mode === "safecracker" ? "" : game.mode === "blackjack"',
  '        body = game.mode === "roulette" ? "" : game.mode === "safecracker" ? "" : game.mode === "mountainrace" ? "" : game.mode === "blackjack"',
  'Summit Sprint active body'
);
html = replaceRequired(
  html,
  'window.dispatchEvent(new CustomEvent("safecracker:state", { detail: { game } }));\n      }',
  'window.dispatchEvent(new CustomEvent("safecracker:state", { detail: { game } }));\n      }\n      if (game.mode === "mountainrace") {\n        window.__mountainRaceBridge = {\n          submit: async details => {\n            if (!duelGenericMountedGameMatches(game)) throw new Error("Summit Sprint board changed. Try again.");\n            const data = await duelRequest("act", { gameId: game.gameId, ...(details || {}) });\n            duelLastActiveGame = data.game || duelLastActiveGame;\n            if (data.game?.gameId) duelKnownRevisionByGame.set(String(data.game.gameId), String(data.game.mountainraceState?.revision || ""));\n            duelRenderActive(data.game, true);\n            return data;\n          },\n          refresh: () => duelRefresh(true),\n          rematch: () => duelRequestRematch(),\n          newGame: () => duelStartNewGame()\n        };\n        window.dispatchEvent(new CustomEvent("mountainrace:state", { detail: { game } }));\n      }',
  'Summit Sprint client bridge'
);
await writeFile(indexUrl, html);
console.log('Connected Summit Sprint to the multiplayer testing launcher, authoritative create/join flow, simple and Remote Bot testing, rematches, refresh persistence, and isolated mountain-race client assets.');
