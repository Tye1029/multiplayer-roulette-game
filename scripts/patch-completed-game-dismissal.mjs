import { readFile, writeFile } from 'node:fs/promises';

const indexUrl = new URL('../index.html', import.meta.url);

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Completed-game dismissal patch could not find ${label}.`);
  return source.replace(before, after);
}

let html = await readFile(indexUrl, 'utf8');

const style = `  <style id="duel-completed-dismissal-style">
    .duel-end-screen-close-host{position:relative!important}
    .duel-end-screen-close{position:absolute!important;top:9px!important;right:9px!important;z-index:2147483000!important;width:36px!important;height:36px!important;min-width:36px!important;min-height:36px!important;padding:0!important;border:1px solid rgba(255,255,255,.72)!important;border-radius:50%!important;background:rgba(8,8,12,.88)!important;color:#fff!important;font:900 24px/32px Arial,sans-serif!important;text-align:center!important;box-shadow:0 4px 16px rgba(0,0,0,.5)!important;cursor:pointer!important;touch-action:manipulation!important}
    .duel-end-screen-close:active{transform:scale(.94)!important}
  </style>`;
if (!html.includes('id="duel-completed-dismissal-style"')) {
  if (!html.includes('</head>')) throw new Error('Completed-game dismissal patch could not find the document head.');
  html = html.replace('</head>', `${style}\n</head>`);
}

const helper = `    // DUEL_COMPLETED_DISMISSAL_START
    const DUEL_COMPLETED_SEEN_KEY = "torn-duel-completed-seen-v1";
    const duelCompletedVisibleThisSession = new Set();
    function duelReadCompletedSeen() {
      try {
        const parsed = JSON.parse(localStorage.getItem(DUEL_COMPLETED_SEEN_KEY) || "[]");
        return Array.isArray(parsed) ? parsed.map(value => String(value || "")).filter(Boolean).slice(0, 120) : [];
      } catch (_) {
        return [];
      }
    }
    function duelWriteCompletedSeen(ids) {
      try { localStorage.setItem(DUEL_COMPLETED_SEEN_KEY, JSON.stringify([...new Set(ids)].slice(0, 120))); } catch (_) {}
    }
    function duelMarkCompletedSeen(gameId) {
      const id = String(gameId || "");
      if (!id) return;
      const seen = duelReadCompletedSeen().filter(value => value !== id);
      seen.unshift(id);
      duelWriteCompletedSeen(seen);
    }
    function duelShouldSuppressCompletedGame(game) {
      if (String(game?.status || "") !== "complete") return false;
      const id = String(game?.gameId || "");
      if (!id || duelCompletedVisibleThisSession.has(id)) return false;
      // Safe Cracker owns a cinematic result portal. Never dismiss or mark that
      // result as seen until the player explicitly closes it or starts a rematch.
      if (String(game?.mode || "") === "safecracker") {
        duelCompletedVisibleThisSession.add(id);
        return false;
      }
      const alreadySeen = duelReadCompletedSeen().includes(id);
      if (alreadySeen) return true;
      duelCompletedVisibleThisSession.add(id);
      duelMarkCompletedSeen(id);
      return false;
    }
    function duelCloseCompletedScreen(gameId, restored = false) {
      const id = String(gameId || "");
      if (id) duelMarkCompletedSeen(id);
      duelCompletedVisibleThisSession.delete(id);
      if (String(duelCurrentGameId || "") === id) duelRememberCurrentGame("");
      if (String(duelLastActiveGame?.gameId || "") === id) duelLastActiveGame = null;
      if (String(duelDrawLatestGame?.gameId || "") === id) duelDrawLatestGame = null;
      if (String(duelFishingLatestGame?.gameId || "") === id) duelFishingLatestGame = null;
      if (String(rouletteLatestGame?.gameId || "") === id) rouletteLatestGame = null;
      duelKnownRevisionByGame.delete(id);
      duelAcceptedStatusByGame.delete(id);
      duelLastRenderKey = "";
      document.body.classList.remove('roulette-viewport-lock');
      if (duelActive) duelActive.innerHTML = '<p class="duel-status">' + (restored ? 'Previous game complete. Choose a game to play again.' : 'Game result closed. Choose a game to play again.') + '</p>';
      duelSetPollRate(null);
      setTimeout(() => duelRefresh(true), 0);
    }
    function duelScheduleCompletedCloseButton(game) {
      if (String(game?.status || "") !== "complete") return;
      const id = String(game?.gameId || "");
      const attach = () => {
        if (!duelActive || !id || String(duelLastActiveGame?.gameId || id) !== id) return;
        if (duelActive.querySelector('.duel-end-screen-close')) return;
        const target = duelActive.querySelector('.sc-result-card, [data-fishing-result-card], .roulette-result-card, .draw-result-card, [class*="result-card"], .sc-result-overlay > *, [class*="result-overlay"] > *, .duel-arena') || duelActive;
        target.classList.add('duel-end-screen-close-host');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'duel-end-screen-close';
        button.setAttribute('aria-label', 'Close game result');
        button.textContent = '×';
        button.addEventListener('click', event => {
          event.preventDefault();
          event.stopPropagation();
          duelCloseCompletedScreen(id, false);
        });
        target.appendChild(button);
      };
      queueMicrotask(attach);
      setTimeout(attach, 80);
      setTimeout(attach, 320);
    }
    // DUEL_COMPLETED_DISMISSAL_END

`;
html = replaceRequired(html, '    function duelBindResultButtons(game) {', `${helper}    function duelBindResultButtons(game) {`, 'result-button binding point');

const renderStart = `    function duelRenderActive(game, force = false) {
      if (!duelActive) return;`;
const renderWithDismissal = `    function duelRenderActive(game, force = false) {
      if (!duelActive) return;
      if (String(game?.status || "") === "complete") {
        if (duelShouldSuppressCompletedGame(game)) {
          duelCloseCompletedScreen(game.gameId, true);
          return;
        }
        duelScheduleCompletedCloseButton(game);
      }`;
html = replaceRequired(html, renderStart, renderWithDismissal, 'completed-game render guard');

await writeFile(indexUrl, html);
console.log('Patched completed-game dismissal: Safe Cracker results remain mounted until an explicit close or rematch, while other completed games retain persistent suppression.');