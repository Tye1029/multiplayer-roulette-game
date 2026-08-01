import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

function printRange(label, startNeedle, endNeedle) {
  const start = html.indexOf(startNeedle);
  const end = start < 0 ? -1 : html.indexOf(endNeedle, start + startNeedle.length);
  console.log(`\n===== ${label} =====`);
  console.log(`start=${start} end=${end}`);
  if (start < 0 || end < 0) return;
  console.log(html.slice(start, end));
}

printRange('duelRefresh', 'async function duelRefresh', 'async function duelCreate');
printRange('duelRenderActive', 'function duelRenderActive(game, force = false)', 'async function duelRefresh');
