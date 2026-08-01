import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const targets = [
  ['duelRequest', '    async function duelRequest(', '    function duelPlayerHtml('],
  ['duelSetPollRate', '    function duelSetPollRate(', '    function duelSchedulePoll('],
  ['duelRefresh', '    async function duelRefresh(', '    async function duelCreate('],
  ['duelReady', '    async function duelSafeCrackerReadyRequest(', '    async function duelAddSimpleNpc('],
  ['completedDismissal', '    // DUEL_COMPLETED_DISMISSAL_START', '    function duelRenderActive(']
];

for (const [label, startNeedle, endNeedle] of targets) {
  const start = html.indexOf(startNeedle);
  const end = start >= 0 ? html.indexOf(endNeedle, start + startNeedle.length) : -1;
  console.log(`\n===== ${label} =====`);
  if (start < 0) {
    console.log(`missing start: ${startNeedle}`);
    continue;
  }
  console.log(html.slice(start, end > start ? end : Math.min(html.length, start + 14000)));
}
