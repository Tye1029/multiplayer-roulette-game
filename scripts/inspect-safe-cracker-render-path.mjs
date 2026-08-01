import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

function lineNumberAt(offset) {
  return html.slice(0, offset).split('\n').length;
}

function printOccurrences(needle, before = 900, after = 1100, limit = 12) {
  console.log(`\n===== ${needle} =====`);
  let offset = 0;
  let count = 0;
  while (count < limit) {
    const index = html.indexOf(needle, offset);
    if (index < 0) break;
    count += 1;
    const start = Math.max(0, index - before);
    const end = Math.min(html.length, index + needle.length + after);
    console.log(`\n--- occurrence ${count}, line ${lineNumberAt(index)}, offset ${index} ---`);
    console.log(html.slice(start, end));
    offset = index + needle.length;
  }
  console.log(`count shown: ${count}`);
}

for (const needle of [
  'duelRenderActive(data.game, true)',
  'duelRenderActive(',
  'duelRenderList(',
  'duelRenderLobby',
  'data.game){',
  'data.game) {',
  '!data.game',
  'duelLastActiveGame',
  'window.__safeCrackerStableActiveGame'
]) {
  printOccurrences(needle);
}
