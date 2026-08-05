import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const indexUrl = new URL('index.html', root);

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint terminal-drain rematch patch could not find ${label}.`);
  return source.replace(before, after);
}

let html = await readFile(indexUrl, 'utf8');
html = replaceRequired(
  html,
  `      const remembered = window.__mountainRaceLastCompletedGame || null;`,
  `      let remembered = window.__mountainRaceLastCompletedGame || null;`,
  'mutable remembered terminal game'
);
html = replaceRequired(
  html,
  `        if (newerRound) window.__mountainRaceLastCompletedGame = null;`,
  `        if (newerRound) {
          window.__mountainRaceLastCompletedGame = null;
          remembered = null;
        }`,
  'same-call rematch release'
);

if (!html.includes('remembered = null;')) throw new Error('Summit Sprint terminal drain can still retain a completed race during a higher-revision rematch.');
await writeFile(indexUrl, html);

console.log('Preserved Summit Sprint rematches after Terminal Drain V12 by releasing both the global and same-call remembered terminal state when a higher revision or new round starts.');
