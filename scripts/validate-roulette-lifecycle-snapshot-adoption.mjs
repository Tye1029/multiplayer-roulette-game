import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const injector = await readFile(new URL('./inject-lamp-assets.mjs', import.meta.url), 'utf8');

for (const required of [
  'statusRank:Number(DUEL_STATUS_RANK[String(game?.status||"waiting")]||0)',
  'const acceptedStatusRank=Number(accepted.statusRank??0);',
  'if(incoming.statusRank<acceptedStatusRank)return false;',
  'if(incoming.statusRank===acceptedStatusRank){',
  'if(incoming.gameRevision<accepted.gameRevision)return false;',
  'if(incoming.gameRevision===accepted.gameRevision&&incoming.rouletteRevision<accepted.rouletteRevision)return false;'
]) {
  if (!html.includes(required)) throw new Error(`Roulette lifecycle snapshot validation is missing ${required}`);
}

if (!injector.includes("await import('./patch-roulette-lifecycle-snapshot-adoption.mjs');")) {
  throw new Error('The Roulette lifecycle snapshot patch is not part of the build pipeline.');
}

console.log('Roulette lifecycle snapshot validation passed: forward waiting/ready/countdown/playing/complete changes outrank equal lifecycle revision checks, while same-state turn snapshots remain strictly ordered.');
