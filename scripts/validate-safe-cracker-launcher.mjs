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
for (const mode of ['roulette', 'draw', 'fishing']) {
  assert(html.includes(`class="sth-game" data-mode="${mode}"`), `${mode} launcher was removed`);
  assert(html.includes(`data-rnb-game="${mode}"`), `${mode} Remote Bot button was removed`);
}
console.log('Safe Cracker launcher validation passed: four game buttons and four Remote Bot selectors are present.');
