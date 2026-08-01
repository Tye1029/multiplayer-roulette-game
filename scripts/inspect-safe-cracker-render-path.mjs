import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const needles = [
  'duelRenderActive',
  'duelLastActiveGame',
  'duelKnownRevisionByGame',
  'data.game',
  'renderDuel',
  'duelRender',
  "status === 'waiting'",
  "status === 'playing'",
  'WAITING'
];

for (const needle of needles) {
  console.log(`\n===== ${needle} =====`);
  let offset = 0;
  let count = 0;
  while (count < 20) {
    const index = html.indexOf(needle, offset);
    if (index < 0) break;
    count += 1;
    const start = Math.max(0, index - 1400);
    const end = Math.min(html.length, index + needle.length + 1800);
    console.log(`\n--- occurrence ${count} at ${index} ---\n${html.slice(start, end)}\n`);
    offset = index + needle.length;
  }
  console.log(`count shown: ${count}`);
}
