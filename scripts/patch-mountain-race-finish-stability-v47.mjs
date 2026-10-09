import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const runtimeUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', root);
const prototypeUrl = new URL('assets/mountain-race/mountain-race.js', root);
const cssUrl = new URL('assets/mountain-race/mountain-race.css', root);
const indexUrl = new URL('index.html', root);
const previewUrl = new URL('mountain-race-preview.html', root);
const marker = 'MOUNTAIN_RACE_FINISH_STABILITY_V47';

function required(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint V47 could not find ${label}.`);
  return source.replace(before, after);
}

const confettiHelper = `  // ${marker}
  function winnerConfetti() {
    return '<div class="mr-winner-confetti" aria-hidden="true">' + Array.from({ length: 20 }, (_, index) => '<i style="--mr-confetti-index:' + index + ';--mr-confetti-x:' + ((index * 37) % 100) + '%;--mr-confetti-drift:' + ((index - 10) * 3) + 'px"></i>').join('') + '</div>';
  }

`;

let [runtime, prototype, css, html, preview] = await Promise.all([
  readFile(runtimeUrl, 'utf8'), readFile(prototypeUrl, 'utf8'), readFile(cssUrl, 'utf8'),
  readFile(indexUrl, 'utf8'), readFile(previewUrl, 'utf8')
]);

if (!runtime.includes('MOUNTAIN_RACE_RUGGED_TERRAIN_V46')) {
  throw new Error('Summit Sprint V47 requires the V46 rugged terrain first.');
}

if (!runtime.includes('function winnerConfetti()')) {
  runtime = required(runtime, '  function renderLane(', `${confettiHelper}  function renderLane(`, 'multiplayer celebration helper insertion');
}
if (!prototype.includes('function winnerConfetti()')) {
  prototype = required(prototype, '  function renderLane(', `${confettiHelper}  function renderLane(`, 'prototype celebration helper insertion');
}

runtime = required(
  runtime,
  'Math.max(2400, 380 + total * 84)',
  'Math.max(2600, 580 + total * 84)',
  'multiplayer summit wall height'
);
prototype = required(
  prototype,
  'Math.max(2400, 380 + total * 84)',
  'Math.max(2600, 580 + total * 84)',
  'prototype summit wall height'
);

runtime = required(
  runtime,
  "    root.dataset.mrRuggedTerrain = '46';\n    // MOUNTAIN_RACE_VISUAL_REBOOT_V44",
  "    root.dataset.mrRuggedTerrain = '46';\n    root.dataset.mrFinishStability = '47';\n    // MOUNTAIN_RACE_VISUAL_REBOOT_V44",
  'multiplayer V47 dataset'
);
prototype = required(
  prototype,
  "    root.dataset.mrRuggedTerrain = '46';\n    // MOUNTAIN_RACE_VISUAL_REBOOT_V44",
  "    root.dataset.mrRuggedTerrain = '46';\n    root.dataset.mrFinishStability = '47';\n    // MOUNTAIN_RACE_VISUAL_REBOOT_V44",
  'prototype V47 dataset'
);

if (!html.includes(marker)) {
  html = required(
    html,
    '    function duelPlayerHtml(player, label, ready = false) {',
    `    // ${marker}
    function mountainRaceCompletionLabel(game, player) {
      if (game?.mode !== "mountainrace" || String(game?.status || "") !== "complete") return "";
      if (game?.tie) return "TIED";
      return String(game?.winnerUserId || "") === String(player?.userId || "") ? "WINNER" : "RACE OVER";
    }

    function duelPlayerHtml(player, label, ready = false, statusLabel = "") {`,
    'completed-state label helper'
  );
  html = required(
    html,
    '<div>${ready ? "LOCKED IN" : "WAITING"}</div></div>`;',
    '<div>${escapeHtml(statusLabel || (ready ? "LOCKED IN" : "WAITING"))}</div></div>`;',
    'player status label output'
  );
  html = required(
    html,
    '${duelPlayerHtml(game.creator, "Creator", Boolean(game.creatorReady || (game.mode === "safecracker" && ["ready", "countdown", "playing", "complete"].includes(String(game.status || "")))))}',
    '${duelPlayerHtml(game.creator, "Creator", Boolean(game.creatorReady || (game.mode === "safecracker" && ["ready", "countdown", "playing", "complete"].includes(String(game.status || "")))), mountainRaceCompletionLabel(game, game.creator))}',
    'creator completed-state label'
  );
  html = required(
    html,
    '${duelPlayerHtml(joiner, "Joiner", Boolean(game.joinerReady || (game.mode === "safecracker" && ["ready", "countdown", "playing", "complete"].includes(String(game.status || "")))))}',
    '${duelPlayerHtml(joiner, "Joiner", Boolean(game.joinerReady || (game.mode === "safecracker" && ["ready", "countdown", "playing", "complete"].includes(String(game.status || "")))), mountainRaceCompletionLabel(game, joiner))}',
    'joiner completed-state label'
  );
}

if (!css.includes(marker)) css += String.raw`

/* MOUNTAIN_RACE_FINISH_STABILITY_V47
   The extended wall keeps real terrain behind the final summit camera while the
   restored celebration helper keeps the completed scene mounted through results. */
[data-mountain-race-mount][data-mr-finish-stability="47"] .mr-mountain-wall {
  min-height: 2600px !important;
}
`;

function updateDocument(source) {
  return source.replace(/(?:&visual=\d+)+/g, '&visual=47');
}

html = updateDocument(html);
preview = updateDocument(preview);

await Promise.all([
  writeFile(runtimeUrl, runtime), writeFile(prototypeUrl, prototype), writeFile(cssUrl, css),
  writeFile(indexUrl, html), writeFile(previewUrl, preview)
]);

console.log('Applied Summit Sprint V47 finish stability: celebration/result rendering restored, summit wall coverage extended, and completed player labels corrected.');
