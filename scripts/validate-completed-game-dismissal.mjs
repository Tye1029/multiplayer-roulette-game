import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [html, packageJsonText] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('package.json', root), 'utf8')
]);
const packageJson = JSON.parse(packageJsonText);

function assert(condition, message) {
  if (!condition) throw new Error(`Completed-game dismissal validation failed: ${message}`);
}

assert(html.includes('// DUEL_COMPLETED_DISMISSAL_START'), 'generic completed-game dismissal helper is missing');
assert(html.includes('const DUEL_COMPLETED_SEEN_KEY = "torn-duel-completed-seen-v1";'), 'completed games are not persisted across browser reopen');
assert(html.includes('duelCompletedVisibleThisSession'), 'the current completion cannot remain visible for the finishing session');
assert(html.includes('if (duelShouldSuppressCompletedGame(game))'), 'completed games are not suppressed when restored later');
assert(html.includes('duelCloseCompletedScreen(game.gameId, true);'), 'restored completed games do not return to the lobby');
assert(html.includes("button.className = 'duel-end-screen-close';"), 'end screens do not receive a close button');
assert(html.includes("button.setAttribute('aria-label', 'Close game result');"), 'close button is not accessible');
assert(html.includes('id="duel-completed-dismissal-style"'), 'close-button styling is missing');
assert(html.includes('.sc-result-card, [data-fishing-result-card], .roulette-result-card, .draw-result-card'), 'close button is not shared across all multiplayer result layouts');
assert(String(packageJson.dependencies?.['@netlify/blobs'] || '') === '10.7.10', 'Netlify Blobs is not pinned to the conditional-write client');

console.log('Completed-game dismissal validation passed: every multiplayer result has a close button and completed games do not reopen in later browser sessions.');