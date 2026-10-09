// SITE_FRAGMENT_START: safeCrackerSnapshotVersion_136492
function safeCrackerSnapshotVersion(game) {
      return {
        statusRank: Number(DUEL_STATUS_RANK[String(game?.status || "waiting")] || 0),
        gameRevision: Math.max(0, Number(game?.revision || 0)),
        stateRevision: Math.max(0, Number(game?.safecrackerState?.revision || 0))
      };
    }
// SITE_FRAGMENT_END: safeCrackerSnapshotVersion_136492

// SITE_FRAGMENT_START: safeCrackerAcceptSnapshot_136802
function safeCrackerAcceptSnapshot(game) {
      if (String(game?.mode || "") !== "safecracker" || !game?.gameId) return true;
      const id = String(game.gameId);
      const incoming = safeCrackerSnapshotVersion(game);
      const accepted = safeCrackerAcceptedSnapshotByGame.get(id);
      if (accepted && (
        incoming.statusRank < accepted.statusRank ||
        incoming.gameRevision < accepted.gameRevision ||
        incoming.stateRevision < accepted.stateRevision
      )) {
        window.__safeCrackerRejectedSnapshots = Number(window.__safeCrackerRejectedSnapshots || 0) + 1;
        return false;
      }
      safeCrackerAcceptedSnapshotByGame.set(id, incoming);
      return true;
    }
// SITE_FRAGMENT_END: safeCrackerAcceptSnapshot_136802
