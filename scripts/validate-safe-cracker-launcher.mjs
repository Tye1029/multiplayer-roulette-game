import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(`Safe Cracker launcher validation failed: ${message}`);
};

assert(html.includes('choose one of the four multiplayer games.'), 'launcher instructions still describe only three games');
assert(html.includes('class="sth-game" data-mode="safecracker" disabled>Safe Cracker</button>'), 'Safe Cracker launcher button is missing');
assert(html.includes("['roulette','draw','fishing','safecracker']"), 'launcher whitelist removes Safe Cracker');
assert(html.includes('data-rnb-game="safecracker">Safe Cracker</button>'), 'Safe Cracker Remote Bot button is missing');
assert(html.includes('g?.safecrackerState||{}'), 'Remote Bot debug panel does not read Safe Cracker state');
assert(html.includes('id="rnbControlPanel" data-collapsed="1"'), 'Remote Bot panel must start collapsed');
assert(html.includes('id="safe-cracker-compact-debug-dock"'), 'compact debug dock CSS is missing');
assert(html.includes('#rnbControlPanel .rnb-head>span:first-child::after{content:"BOT"}'), 'BOT square label is missing');
assert(html.includes('#rnbGamePanel .rnb-head>span:first-child::after{content:"GAME"}'), 'GAME square label is missing');
assert(html.includes('#rnbBotPanel .rnb-head>span:first-child::after{content:"LOG"}'), 'LOG square label is missing');
assert(html.includes("document.querySelectorAll('#rnbDock .rnb-panel').forEach"), 'compact dock must close sibling panels when one opens');
for (const mode of ['roulette', 'draw', 'fishing']) {
  assert(html.includes(`class="sth-game" data-mode="${mode}"`), `${mode} launcher was removed`);
  assert(html.includes(`data-rnb-game="${mode}"`), `${mode} Remote Bot button was removed`);
}
console.log('Safe Cracker launcher validation passed: four games, four bot selectors, and compact left-side controls are present.');
