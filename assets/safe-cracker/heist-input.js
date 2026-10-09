/* Immediate tool presentation; all writes still use the authoritative action API. */
(function (scope) {
  'use strict';
  function project(current, command, actionId) {
    if (!current || current.failed) return current;
    const h = JSON.parse(JSON.stringify(current));
    const [kind, target, tool] = command.split(':');
    let effect;
    if (kind === 'screw' && h.phase === 0) {
      const s = h.screws[Number(target)];
      if (!s || s.removed) return current;
      if (s.type !== tool) { s.stripped = true; effect = 'strip'; }
      else { s.turns++; s.removed = s.turns >= (s.stripped ? 3 : 1); effect = s.removed ? 'remove' : 'turn'; }
      h.removed = h.screws.filter(s => s.removed).length;
      if (h.removed === 8) h.phase = 1;
    } else if (kind === 'card' && h.phase === 1) {
      h.cardOpen = target === 'open'; effect = h.cardOpen ? 'card-open' : 'card-close';
    } else if (kind === 'cut' && h.phase === 1 && !h.cardOpen) {
      if (!h.wireColors.includes(target) || h.cut.includes(target)) return current;
      const next = h.notePlan.find(item => !h.cut.includes(item.color));
      effect = next?.color === target ? 'cut' : 'zap';
      h.cut.push(target); h.cutCount = h.cut.length;
      if (effect === 'zap') h.mistakes++;
      h.failed = h.mistakes >= 5;
      if (!h.failed && h.cutCount === h.wireCount) h.phase = 2;
    } else return current;
    h.instructions = h.cardOpen ? h.notePlan.map(item => ({...item, done:h.cut.includes(item.color)})) : undefined;
    h.lastAction = {kind, target, effect, actionId};
    return h;
  }
  function createQueue({submit, onChange, onError, isActive = () => true}) {
    let base = null, pending = [], flight = null, epoch = 0;
    const view = () => pending.reduce((h, item) => project(h, item.command, item.actionId), base?.safecrackerState?.me?.heist);
    function receive(game) {
      if (base?.gameId !== game.gameId) { epoch++; pending = []; flight = null; }
      else if (base.status === 'complete' && game.status !== 'complete') return;
      else if (Number(game.safecrackerState?.revision || 0) < Number(base.safecrackerState?.revision || 0)) return;
      base = game;
      const ack = game.safecrackerState?.me?.heist?.lastAction?.actionId;
      const index = pending.findIndex(item => item.actionId === ack);
      if (index >= 0) pending.splice(0, index + 1);
      if (game.status !== 'playing') pending = [];
    }
    async function pump() {
      if (flight || !pending.length || base?.status !== 'playing') return;
      if (!isActive(base.gameId)) { pending = []; return; }
      const item = flight = pending[0], round = epoch, id = base.gameId;
      try {
        let response;
        for (let attempt = 0; attempt < 2; attempt++) {
          try { response = await submit(item, id); break; }
          catch (error) {
            // A lost response may already have committed. Retry the SAME id once.
            if (round !== epoch || !isActive(id) || !pending.includes(item)) return;
            if (attempt) throw error;
          }
        }
        if (round !== epoch || !isActive(id)) return;
        if (response?.game) receive(response.game);
        if (pending.includes(item)) throw new Error('That action was not accepted. Please try again.');
        onChange(base);
      } catch (error) {
        if (round !== epoch || !isActive(id)) return;
        pending = [];
        onChange(base);
        onError(error);
      } finally {
        if (round === epoch && flight === item) { flight = null; pump(); }
      }
    }
    return {
      receive, view,
      get length() { return pending.length; },
      enqueue(command, actionId) {
        if (base?.status !== 'playing' || pending.length >= 32 || view()?.failed) return false;
        const before = view();
        if (project(before, command, actionId) === before) return false;
        pending.push({command, actionId});
        onChange(base); pump(); return true;
      }
    };
  }
  if (typeof module !== 'undefined') module.exports = {project, createQueue};
  else scope.SafeCrackerHeistInput = {project, createQueue};
})(typeof window === 'undefined' ? globalThis : window);
