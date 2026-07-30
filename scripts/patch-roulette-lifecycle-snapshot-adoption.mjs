import { readFile, writeFile } from 'node:fs/promises';

const indexUrl = new URL('../index.html', import.meta.url);
let html = await readFile(indexUrl, 'utf8');

function replaceOnce(source, label, before, after) {
  if (source.includes(after)) return source;
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Roulette lifecycle snapshot patch could not find ${label}.`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Roulette lifecycle snapshot patch found more than one ${label}.`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

html = replaceOnce(
  html,
  'the Roulette snapshot ordering function',
  `    function rouletteSnapshotStamp(game){
      return {
        gameRevision:Number(game?.revision??-1),
        rouletteRevision:rouletteRevision(game),
        updatedAt:Date.parse(String(game?.updatedAt||''))||0
      };
    }
    function rouletteAcceptSnapshot(game){
      if(!game||game.mode!=="roulette"||!game.gameId)return true;
      const id=String(game.gameId),incoming=rouletteSnapshotStamp(game),accepted=rouletteAcceptedSnapshotByGame.get(id);
      if(accepted){
        // The top-level game revision is the server's transaction revision. The
        // roulette sub-revision can remain unchanged during ready/countdown and
        // opening-spin writes, so comparing it alone allowed older polls to win.
        if(incoming.gameRevision<accepted.gameRevision)return false;
        if(incoming.gameRevision===accepted.gameRevision&&incoming.rouletteRevision<accepted.rouletteRevision)return false;
        if(incoming.gameRevision===accepted.gameRevision&&incoming.rouletteRevision===accepted.rouletteRevision&&incoming.updatedAt<accepted.updatedAt)return false;
      }
      rouletteAcceptedSnapshotByGame.set(id,incoming);
      rouletteAcceptedRevisionByGame.set(id,incoming.rouletteRevision);
      return true;
    }`,
  `    function rouletteSnapshotStamp(game){
      return {
        statusRank:Number(DUEL_STATUS_RANK[String(game?.status||"waiting")]||0),
        gameRevision:Number(game?.revision??-1),
        rouletteRevision:rouletteRevision(game),
        updatedAt:Date.parse(String(game?.updatedAt||''))||0
      };
    }
    function rouletteAcceptSnapshot(game){
      if(!game||game.mode!=="roulette"||!game.gameId)return true;
      const id=String(game.gameId),incoming=rouletteSnapshotStamp(game),accepted=rouletteAcceptedSnapshotByGame.get(id);
      if(accepted){
        const acceptedStatusRank=Number(accepted.statusRank??0);
        // Lifecycle changes are authoritative even when adding a player leaves the
        // game and Roulette sub-revisions unchanged. Never let an older lifecycle
        // state replace a newer one; within the same state, retain strict revision
        // and timestamp ordering for active-turn protection.
        if(incoming.statusRank<acceptedStatusRank)return false;
        if(incoming.statusRank===acceptedStatusRank){
          if(incoming.gameRevision<accepted.gameRevision)return false;
          if(incoming.gameRevision===accepted.gameRevision&&incoming.rouletteRevision<accepted.rouletteRevision)return false;
          if(incoming.gameRevision===accepted.gameRevision&&incoming.rouletteRevision===accepted.rouletteRevision&&incoming.updatedAt<accepted.updatedAt)return false;
        }
      }
      rouletteAcceptedSnapshotByGame.set(id,incoming);
      rouletteAcceptedRevisionByGame.set(id,incoming.rouletteRevision);
      return true;
    }`
);

for (const required of [
  'statusRank:Number(DUEL_STATUS_RANK[String(game?.status||"waiting")]||0)',
  'const acceptedStatusRank=Number(accepted.statusRank??0);',
  'if(incoming.statusRank<acceptedStatusRank)return false;',
  'if(incoming.statusRank===acceptedStatusRank){'
]) {
  if (!html.includes(required)) throw new Error(`Roulette lifecycle snapshot patch is missing ${required}`);
}

await writeFile(indexUrl, html);
console.log('Patched Roulette snapshot adoption so waiting-to-ready bot attachment renders immediately while same-state turn revisions remain strictly ordered.');
