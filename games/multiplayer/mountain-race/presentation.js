// SITE_FRAGMENT_START: mountainRacePauseCompletedPolling_132547
function mountainRacePauseCompletedPolling(game) {
      if (String(game?.mode || '') !== 'mountainrace' || String(game?.status || '') !== 'complete' || !game?.remoteNetworkTest) return false;
      if (duelPollTimer) clearInterval(duelPollTimer);
      duelPollTimer = null;
      window.__duelPollRate = 0;
      return true;
    }
// SITE_FRAGMENT_END: mountainRacePauseCompletedPolling_132547

// SITE_FRAGMENT_START: mountainRaceSnapshotVersion_137719
function mountainRaceSnapshotVersion(game) {
      return {
        statusRank: Number(DUEL_STATUS_RANK[String(game?.status || 'waiting')] || 0),
        gameRevision: Math.max(-1, Number(game?.revision ?? -1)),
        stateRevision: Math.max(-1, Number(game?.mountainraceState?.revision ?? -1)),
        roundId: String(game?.mountainraceState?.roundId || '')
      };
    }
// SITE_FRAGMENT_END: mountainRaceSnapshotVersion_137719

// SITE_FRAGMENT_START: mountainRaceCompareVersions_138100
function mountainRaceCompareVersions(accepted, incoming) {
      const sameRound = !accepted?.roundId || !incoming?.roundId || accepted.roundId === incoming.roundId;
      if (!sameRound) return -1;
      if (incoming.stateRevision !== accepted.stateRevision) return incoming.stateRevision - accepted.stateRevision;
      if (incoming.statusRank !== accepted.statusRank) return incoming.statusRank - accepted.statusRank;
      if (incoming.gameRevision !== accepted.gameRevision) return incoming.gameRevision - accepted.gameRevision;
      return 0;
    }
// SITE_FRAGMENT_END: mountainRaceCompareVersions_138100

// SITE_FRAGMENT_START: mountainRaceAcceptSnapshot_138658
function mountainRaceAcceptSnapshot(game) {
    if (String(game?.mode || '') !== 'mountainrace' || !game?.gameId) return true;
    const id = String(game.gameId);
    const incoming = mountainRaceSnapshotVersion(game);
    const accepted = mountainRaceAcceptedSnapshotByGame.get(id);
    const differentRound = Boolean(accepted?.roundId && incoming.roundId && accepted.roundId !== incoming.roundId);
    if (accepted && differentRound && incoming.statusRank <= accepted.statusRank) {
      window.__mountainRaceSharedRejectedSnapshots = Number(window.__mountainRaceSharedRejectedSnapshots || 0) + 1;
      return false;
    }
    mountainRaceAcceptedSnapshotByGame.set(id, accepted ? {
      statusRank: Math.max(accepted.statusRank, incoming.statusRank),
      gameRevision: Math.max(accepted.gameRevision, incoming.gameRevision),
      stateRevision: Math.max(accepted.stateRevision, incoming.stateRevision),
      roundId: incoming.roundId || accepted.roundId
    } : incoming);
    return true;
  }
// SITE_FRAGMENT_END: mountainRaceAcceptSnapshot_138658

// SITE_FRAGMENT_START: mountainRaceCompletionLabel_155332
function mountainRaceCompletionLabel(game, player) {
      if (game?.mode !== "mountainrace" || String(game?.status || "") !== "complete") return "";
      if (game?.tie) return "TIED";
      return String(game?.winnerUserId || "") === String(player?.userId || "") ? "WINNER" : "RACE OVER";
    }
// SITE_FRAGMENT_END: mountainRaceCompletionLabel_155332
