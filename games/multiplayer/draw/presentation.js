// SITE_FRAGMENT_START: duelDrawSyncClock_164839
function duelDrawSyncClock(state = {}) {
      const key = `${state.startAt || ""}|${state.endAt || ""}`;
      if (!key || key === "|") return;
      if (key !== duelDrawClockAnchor.key) {
        const serverNowMs = Date.parse(state.serverNow || "");
        duelDrawClockAnchor = {
          key,
          serverNowMs: Number.isFinite(serverNowMs) ? serverNowMs : Date.now(),
          perfAt: performance.now()
        };
      }
    }
// SITE_FRAGMENT_END: duelDrawSyncClock_164839

// SITE_FRAGMENT_START: duelDrawNowMs_165285
function duelDrawNowMs(state = {}) {
      duelDrawSyncClock(state);
      if (duelDrawClockAnchor.key) {
        return duelDrawClockAnchor.serverNowMs + Math.max(0, performance.now() - duelDrawClockAnchor.perfAt);
      }
      return Date.now();
    }
// SITE_FRAGMENT_END: duelDrawNowMs_165285

// SITE_FRAGMENT_START: duelDrawSecondsLeft_165545
function duelDrawSecondsLeft(state = {}) {
      const end = Date.parse(state.endAt || 0);
      const now = duelDrawNowMs(state);
      return Math.max(0, Math.ceil((end - now) / 1000));
    }
// SITE_FRAGMENT_END: duelDrawSecondsLeft_165545

// SITE_FRAGMENT_START: duelDrawActiveEvents_165744
function duelDrawActiveEvents(state = {}) {
      const startAt = Date.parse(state.startAt || 0);
      const endAt = Date.parse(state.endAt || 0);
      const now = duelDrawNowMs(state);
      const events = Array.isArray(state.events) ? state.events : [];
      const bySlot = new Map();
      if (now >= endAt) return bySlot;
      events.forEach(event => {
        const start = Date.parse(event.startsAt || "") || (startAt + Number(event.startMs || 0));
        const end = Date.parse(event.endsAt || "") || (start + Math.max(500, Number(event.durationMs || (event.kind === "boss" ? 5500 : 2000))));
        const isBoss = event.kind === "boss";
        const pending = !isBoss && duelDrawPendingTargets.has(String(event.id || ""));
        const meId = duelDrawMyUserId();
        // Bosses are shared targets. Hide immediately on this player's third
        // optimistic hit, then let the database-confirmed claimedBy state decide
        // which player actually receives the boss and removes it for everyone.
        const localBoss = isBoss ? duelDrawBossOptimistic.get(String(event.id || "")) : null;
        const locallyDefeated = Boolean(isBoss && Number(localBoss?.localTotalHits || 0) >= 3);
        if (now < start || event.claimedBy || locallyDefeated || (pending && event.kind !== "boss")) return;
        if (now >= end) return;
        const slot = Number(event.slot);
        const current = bySlot.get(slot);
        if (!current || Number(event.startMs || 0) < Number(current.startMs || 0)) bySlot.set(slot, event);
      });
      return bySlot;
    }
// SITE_FRAGMENT_END: duelDrawActiveEvents_165744

// SITE_FRAGMENT_START: duelDrawPlayerCard_167327
function duelDrawPlayerCard(player = {}, score = 0, me = false) {
      const avatar = player?.avatarUrl ? `<img src="${escapeHtml(player.avatarUrl)}" alt="${escapeHtml(player.name || "Player")}">` : `<div class="duel-draw-avatar-fallback">🤠</div>`;
      return `<div class="duel-draw-score ${me ? "me" : ""}">
        <div class="duel-draw-score-main">
          ${avatar}
          <div class="duel-draw-text">
            <div class="duel-draw-name">${escapeHtml(player?.name || "Player")}</div>
            <div class="duel-draw-role">${me ? "You" : "Opponent"}</div>
          </div>
        </div>
        <div class="duel-draw-score-value">${Number(score || 0)}</div>
      </div>`;
    }
// SITE_FRAGMENT_END: duelDrawPlayerCard_167327

// SITE_FRAGMENT_START: duelDrawTargetHtml_168030
function duelDrawTargetHtml(event, meId) {
      if (!event) return `<div class="duel-draw-empty">…</div>`;
      const type = event.type === "civilian" ? "civilian" : "robber";
      const kind = String(event.kind || "standard");
      const variant = String(event.variant || (type === "robber" ? "bandit" : "townsperson"));
      const claimedBy = String(event.claimedBy || "");
      const isClaimed = Boolean(claimedBy);
      const pending = duelDrawPendingTargets.has(String(event.id || ""));
      const isBoss = kind === "boss";
      const isUniqueCivilian = false;
      const myHits = Number(event.hitsBy?.[meId] || 0);
      const totalBossHits = Math.min(3, Number(event.hitsBy?.[meId] || 0));
      const bossCompleted = Boolean(isBoss && claimedBy);
      const crackStage = totalBossHits;
      const claimedCls = isClaimed ? (claimedBy === meId ? "claimed-me" : "claimed-other") : "";
      const label = isBoss ? "BOSS" : type === "robber" ? "CRIMINAL" : "CIVILIAN";
      const marker = isBoss ? "★" : type === "robber" ? "!" : "✓";
      const name = "";
      const scoreTag = isBoss ? "+3 • 3 HITS" : type === "robber" ? "+1" : "−1";
      const inner = `<div class="duel-cutout ${type} ${variant} ${isBoss ? `boss-card crack-${crackStage}` : ""} ${isUniqueCivilian ? "unique-civilian-card" : ""}">
          <div class="hat-top"></div>
          <div class="hat-brim"></div>
          <div class="head"></div>
          ${type === "robber" ? '<div class="face-bandana"></div><div class="robber-gun"></div>' : '<div class="civ-hands"></div>'}
          <div class="arms"></div>
          <div class="body"></div>
          <div class="badge">${escapeHtml(label)}</div>
          ${name ? `<div class="draw-character-name">${escapeHtml(name)}</div>` : ""}
          <div class="draw-score-tag">${escapeHtml(scoreTag)}</div>
          ${isBoss ? `<div class="boss-hit-row"><span>Your hits ${myHits}/3</span></div><div class="boss-cracks" aria-hidden="true"></div>` : ""}
          <div class="mark">${marker}</div>
        </div>`;
      const claimBadge = isClaimed ? `<div class="duel-draw-claimed">${claimedBy === meId ? "Claimed by you" : `Claimed by ${escapeHtml(event.claimedName || "opponent")}`}</div>` : pending ? `<div class="duel-draw-claimed">${isBoss ? "Hit registering..." : "Shot..."}</div>` : "";
      if (isClaimed) return `<div class="duel-draw-target is-claimed ${claimedCls}" data-draw-event="${escapeHtml(event.id)}">${inner}${claimBadge}</div>`;
      return `<button class="duel-draw-target ${pending || bossCompleted ? "is-pending" : ""}" data-draw-target="${escapeHtml(event.id)}" data-draw-event="${escapeHtml(event.id)}" type="button" ${pending || bossCompleted ? "disabled" : ""}>${inner}${bossCompleted ? `<div class="duel-draw-claimed">Boss defeated</div>` : claimBadge}</button>`;
    }
// SITE_FRAGMENT_END: duelDrawTargetHtml_168030

// SITE_FRAGMENT_START: duelDrawEventById_170874
function duelDrawEventById(targetId) {
      const id = String(targetId || "");
      const events = duelDrawLatestGame?.drawState?.events || [];
      return events.find(event => String(event.id || "") === id) || null;
    }
// SITE_FRAGMENT_END: duelDrawEventById_170874

// SITE_FRAGMENT_START: duelDrawWarmWesternMusic_171969
function duelDrawWarmWesternMusic() {
      if (duelDrawWesternMusic.getAttribute("src")) return;
      duelDrawWesternMusic.preload = "auto";
      duelDrawWesternMusic.src = "assets/draw-western-theme.mp3";
      duelDrawWesternMusic.load();
    }
// SITE_FRAGMENT_END: duelDrawWarmWesternMusic_171969

// SITE_FRAGMENT_START: duelDrawFadeWesternMusic_172224
function duelDrawFadeWesternMusic(target, duration = 900, pauseAfter = false) {
      if (duelDrawWesternMusicRaf) cancelAnimationFrame(duelDrawWesternMusicRaf);
      const start = performance.now();
      const from = Number(duelDrawWesternMusic.volume || 0);
      const to = Math.max(0, Math.min(1, Number(target || 0)));
      if (Math.abs(from - to) < 0.0001) {
        duelDrawWesternMusicRaf = 0;
        if (pauseAfter && to <= 0.001) duelDrawWesternMusic.pause();
        return;
      }
      const tick = now => {
        const progress = Math.min(1, (now - start) / Math.max(1, duration));
        const eased = 1 - Math.pow(1 - progress, 3);
        duelDrawWesternMusic.volume = from + (to - from) * eased;
        if (progress < 1) duelDrawWesternMusicRaf = requestAnimationFrame(tick);
        else {
          duelDrawWesternMusicRaf = 0;
          if (pauseAfter && to <= 0.001) duelDrawWesternMusic.pause();
        }
      };
      duelDrawWesternMusicRaf = requestAnimationFrame(tick);
    }
// SITE_FRAGMENT_END: duelDrawFadeWesternMusic_172224

// SITE_FRAGMENT_START: duelDrawSyncWesternMusic_173243
function duelDrawSyncWesternMusic(game = duelDrawLatestGame) {
      if (document.hidden) {
        if (duelDrawWesternMusicRaf) cancelAnimationFrame(duelDrawWesternMusicRaf);
        duelDrawWesternMusicRaf = 0;
        duelDrawWesternMusic.pause();
        duelDrawWesternMusic.volume = 0;
        duelDrawWesternMusicWanted = false;
        return;
      }
      const drawVisible = Boolean(duelScreen && !duelScreen.hidden && game?.mode === "draw");
      const shouldPlay = Boolean(drawVisible && musicEnabled && userAudioStarted && !document.hidden);
      const resultDucked = String(game?.status || "") === "complete";
      duelDrawWesternMusicWanted = shouldPlay;
      if (!shouldPlay) {
        duelDrawFadeWesternMusic(0, 420, true);
        return;
      }
      pauseBackgroundJazz();
      const target = resultDucked ? 0.050 : 0.090;
      if (duelDrawWesternMusic.paused) {
        duelDrawWesternMusic.volume = 0;
        const playPromise = duelDrawWesternMusic.play();
        if (playPromise?.catch) playPromise.catch(() => {});
      }
      duelDrawFadeWesternMusic(target, resultDucked ? 650 : 1200, false);
    }
// SITE_FRAGMENT_END: duelDrawSyncWesternMusic_173243

// SITE_FRAGMENT_START: duelDrawGetAudioPool_174497
function duelDrawGetAudioPool(src, size = 3) {
      if (duelDrawAudioPools.has(src)) return duelDrawAudioPools.get(src);
      const pool = Array.from({ length: size }, () => {
        const audio = new Audio(src);
        audio.preload = "auto";
        audio.playsInline = true;
        return audio;
      });
      pool.cursor = 0;
      duelDrawAudioPools.set(src, pool);
      return pool;
    }
// SITE_FRAGMENT_END: duelDrawGetAudioPool_174497

// SITE_FRAGMENT_START: duelDrawFadeReaction_174905
function duelDrawFadeReaction(audio, targetVolume) {
      const startedAt = performance.now();
      const fadeInMs = 42;
      let raf = 0;
      const tick = () => {
        if (audio.paused || audio.ended) return;
        const elapsed = performance.now() - startedAt;
        let level = Math.min(1, elapsed / fadeInMs);
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          const remaining = audio.duration - audio.currentTime;
          if (remaining < 0.09) level *= Math.max(0, remaining / 0.09);
        }
        audio.volume = Math.max(0, Math.min(1, targetVolume * level));
        raf = requestAnimationFrame(tick);
      };
      const stop = () => { if (raf) cancelAnimationFrame(raf); };
      audio.addEventListener("ended", stop, { once: true });
      audio.addEventListener("error", stop, { once: true });
      raf = requestAnimationFrame(tick);
    }
// SITE_FRAGMENT_END: duelDrawFadeReaction_174905

// SITE_FRAGMENT_START: duelDrawPlaySample_175809
function duelDrawPlaySample(src, { volume = 0.5, poolSize = 3, reactionType = "" } = {}) {
      if (!src || !sfxEnabled || document.hidden) return false;
      try {
        const isReaction = Boolean(reactionType);
        if (isReaction) {
          for (const item of [...duelDrawActiveReactions]) {
            if (!item.audio || item.audio.ended || item.audio.paused) duelDrawActiveReactions.delete(item);
          }
          if (duelDrawActiveReactions.size >= 2) return false;
          if (reactionType === "civilian" && [...duelDrawActiveReactions].some(item => item.type === "civilian")) return false;
        }

        const pool = duelDrawGetAudioPool(src, poolSize);
        let audio = null;
        for (let i = 0; i < pool.length; i += 1) {
          const candidate = pool[(pool.cursor + i) % pool.length];
          if (candidate.paused || candidate.ended) {
            audio = candidate;
            pool.cursor = (pool.cursor + i + 1) % pool.length;
            break;
          }
        }
        if (!audio) {
          if (isReaction) return false;
          audio = pool[pool.cursor % pool.length];
          pool.cursor = (pool.cursor + 1) % pool.length;
          audio.pause();
        }

        audio.currentTime = 0;
        audio.volume = isReaction ? 0 : Math.max(0, Math.min(1, volume));
        let reactionRecord = null;
        if (isReaction) {
          reactionRecord = { audio, type: reactionType };
          duelDrawActiveReactions.add(reactionRecord);
          const clear = () => duelDrawActiveReactions.delete(reactionRecord);
          audio.addEventListener("ended", clear, { once: true });
          audio.addEventListener("error", clear, { once: true });
        }
        const promise = audio.play();
        if (promise?.catch) promise.catch(() => {
          if (reactionRecord) duelDrawActiveReactions.delete(reactionRecord);
        });
        if (isReaction) duelDrawFadeReaction(audio, volume);
        return true;
      } catch (_) { return false; }
    }
// SITE_FRAGMENT_END: duelDrawPlaySample_175809

// SITE_FRAGMENT_START: duelDrawPlayShotEffects_177837
function duelDrawPlayShotEffects(event) {
      if (!event || !sfxEnabled || document.hidden) return;
      const guns = duelDrawAudioFiles.gunshots;
      duelDrawPlaySample(guns[Math.floor(Math.random() * guns.length)], { volume: 0.50, poolSize: 5 });

      const now = performance.now();
      if (event.type === "civilian") {
        if (now - duelDrawLastCivilianAt < 300) return;
        if (duelDrawPlaySample(duelDrawAudioFiles.civilian, { volume: 0.48, poolSize: 2, reactionType: "civilian" })) {
          duelDrawLastCivilianAt = now;
        }
      } else {
        if (now - duelDrawLastCriminalAt < 140) return;
        const grunts = duelDrawAudioFiles.grunts;
        let index = Math.floor(Math.random() * grunts.length);
        if (grunts.length > 1 && index === duelDrawLastGruntIndex) index = (index + 1 + Math.floor(Math.random() * (grunts.length - 1))) % grunts.length;
        if (duelDrawPlaySample(grunts[index], { volume: 0.60, poolSize: 2, reactionType: "criminal" })) {
          duelDrawLastGruntIndex = index;
          duelDrawLastCriminalAt = now;
        }
      }
    }
// SITE_FRAGMENT_END: duelDrawPlayShotEffects_177837

// SITE_FRAGMENT_START: duelDrawPlayBossDefeat_178949
function duelDrawPlayBossDefeat() {}
// SITE_FRAGMENT_END: duelDrawPlayBossDefeat_178949

// SITE_FRAGMENT_START: duelDrawAddBulletHole_178991
function duelDrawAddBulletHole(targetId, pointerEvent) {
      const target = pointerEvent?.currentTarget || duelActive?.querySelector(`[data-draw-target="${CSS.escape(String(targetId || ""))}"]`);
      const slot = target?.closest?.(".duel-draw-slot");
      if (!slot) return;
      const rect = slot.getBoundingClientRect();
      let x = Number(pointerEvent?.clientX) - rect.left;
      let y = Number(pointerEvent?.clientY) - rect.top;
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        x = rect.width / 2;
        y = rect.height / 2;
      }
      x = Math.max(8, Math.min(rect.width - 8, x));
      y = Math.max(8, Math.min(rect.height - 8, y));
      const flash = document.createElement("span");
      flash.className = "duel-draw-muzzle-flash";
      flash.style.left = `${x}px`;
      flash.style.top = `${y}px`;
      slot.appendChild(flash);
      setTimeout(() => flash.remove(), 150);
      const hole = document.createElement("span");
      hole.className = "duel-draw-bullet-hole";
      hole.style.left = `${x}px`;
      hole.style.top = `${y}px`;
      slot.appendChild(hole);
      setTimeout(() => hole.remove(), 360);
    }
// SITE_FRAGMENT_END: duelDrawAddBulletHole_178991

// SITE_FRAGMENT_START: duelDrawShowFeedback_181443
function duelDrawShowFeedback(targetId, delta, bossProgress = null) {
      const id = String(targetId || "");
      const numericDelta = Number(delta || 0);
      playDrawHitFeedback(numericDelta > 0 || Boolean(bossProgress && !bossProgress.won) ? 1 : -1);
      const good = numericDelta > 0 || Boolean(bossProgress && !bossProgress.won);
      const feedback = bossProgress
        ? (bossProgress.won ? { cls: "boss", text: "+3" } : { cls: "good", text: `HIT ${bossProgress.totalHits}/${bossProgress.hitGoal}` })
        : numericDelta > 0 ? { cls: "good", text: "+1" }
        : { cls: "bad", text: "-1" };
      const target = [...(duelActive?.querySelectorAll("[data-draw-event]") || [])].find(el => String(el.dataset.drawEvent || "") === id);
      const slot = target?.closest(".duel-draw-slot");
      const host = slot || target || duelActive?.querySelector(".duel-draw-board");
      if (slot) {
        slot.classList.add(good ? "feedback-good" : "feedback-bad");
        setTimeout(() => slot.classList.remove("feedback-good", "feedback-bad"), 520);
      }
      const board = duelActive?.querySelector(".duel-draw-board");
      if (board) {
        board.classList.remove("impact-good", "impact-bad");
        void board.offsetWidth;
        board.classList.add(good ? "impact-good" : "impact-bad");
        setTimeout(() => board.classList.remove("impact-good", "impact-bad"), 240);
      }
      if (target) {
        target.classList.add(good ? "feedback-good" : "feedback-bad");
        setTimeout(() => target.classList.remove("feedback-good", "feedback-bad"), 520);
      }
      if (host) {
        const float = document.createElement("div");
        float.className = `duel-draw-float ${feedback.cls}`;
        float.textContent = feedback.text;
        host.appendChild(float);
        setTimeout(() => float.remove(), 1250);
      }
      const scoreCard = duelActive?.querySelector(gameIsCreatorView() ? ".duel-draw-score.me" : ".duel-draw-score.me");
      if (scoreCard) {
        scoreCard.classList.add(good ? "bump-good" : "bump-bad");
        setTimeout(() => scoreCard.classList.remove("bump-good", "bump-bad"), 520);
      }
    }
// SITE_FRAGMENT_END: duelDrawShowFeedback_181443

// SITE_FRAGMENT_START: duelDrawHtml_183711
function duelDrawHtml(game) {
      const state = game?.drawState || {};
      duelDrawSyncClock(state);
      const scores = state.scores || {};
      const meId = String(localStorage.getItem("tornVisitorUserId") || "");
      const creatorId = String(game?.creator?.userId || "");
      const joinerId = String(game?.joiner?.userId || "");
      const isPlaying = String(game?.status || "") === "playing";
      const seconds = isPlaying ? duelDrawSecondsLeft(state) : 30;
      const activeBySlot = isPlaying ? duelDrawActiveEvents(state) : new Map();
      const slots = [];
      for (let i = 0; i < 9; i += 1) {
        slots.push(`<div class="duel-draw-slot">${duelDrawTargetHtml(activeBySlot.get(i), meId)}</div>`);
      }
      const headerText = "Shoot criminals and spare civilians!";
      const complete = String(game?.status || "") === "complete";
      const winnerId = String(game?.winnerUserId || "");
      const meWon = Boolean(winnerId && winnerId === meId);
      const isTie = Boolean(game?.tie);
      const finalCreatorScore = Number(game?.result?.creator?.score ?? scores[creatorId] ?? 0);
      const finalJoinerScore = Number(game?.result?.joiner?.score ?? scores[joinerId] ?? 0);
      const completedAtMs = Date.parse(String(game?.completedAt || "")) || Date.now();
      const newGameDelayMs = Math.max(0, completedAtMs + 3000 - Date.now());
      const ticketsWon = meWon ? Math.max(0, Math.floor(Number(game?.payout || 0))) : 0;
      const resultTitle = isTie ? "DRAW AT HIGH NOON" : meWon ? "VICTORY, PARTNER!" : "YOU’VE BEEN OUTDRAWN";
      const resultKicker = isTie ? "No Winner This Time" : meWon ? "Fastest Hand in the West" : "Better Luck Next Round";
      const rematch = game?.rematch || {};
      const rematchRequests = rematch.requestedBy || {};
      const rematchExpiresMs = Date.parse(rematch.expiresAt || 0);
      const rematchActive = Boolean(rematchExpiresMs && rematchExpiresMs > Date.now());
      const myRematch = Boolean(rematchActive && rematchRequests[meId]);
      const opponentId = creatorId === meId ? joinerId : creatorId;
      const opponentPlayer = creatorId === opponentId ? game.creator : game.joiner;
      const opponentRematch = Boolean(rematchActive && rematchRequests[opponentId]);
      const rematchSeconds = rematchActive ? Math.max(0, Math.ceil((rematchExpiresMs - Date.now()) / 1000)) : 10;
      const firstRequesterId = rematchActive ? (Object.entries(rematchRequests).sort((a,b) => Date.parse(a[1] || 0) - Date.parse(b[1] || 0))[0]?.[0] || "") : "";
      const requesterPlayer = firstRequesterId === creatorId ? game.creator : firstRequesterId === joinerId ? game.joiner : null;
      const requesterAvatar = requesterPlayer?.avatarUrl
        ? `<img src="${escapeHtml(requesterPlayer.avatarUrl)}" alt="" class="duel-rematch-avatar">`
        : firstRequesterId ? `<span class="duel-rematch-avatar duel-rematch-avatar-fallback">${escapeHtml(String(requesterPlayer?.profileInitial || requesterPlayer?.name || "?").trim().slice(0,1).toUpperCase())}</span>` : "";
      const requesterName = escapeHtml(requesterPlayer?.name || "Player");
      const rematchLabel = rematchActive
        ? `${requesterAvatar}<span>${firstRequesterId === meId ? "Rematch requested" : `${requesterName} wants a rematch`} • ${rematchSeconds}s</span>`
        : `<span>Rematch</span>`;
      const resultOverlay = complete ? `<div class="duel-draw-result-overlay ${isTie ? "tie" : meWon ? "win" : "lose"}"><div class="duel-draw-result-card"><div class="duel-draw-result-kicker">${resultKicker}</div><div class="duel-draw-result-title">${resultTitle}</div><div class="duel-draw-result-score">Final score: ${finalCreatorScore} – ${finalJoinerScore}</div>${meWon ? `<div class="duel-draw-result-tickets">You won ${money(ticketsWon)}</div>` : `<div class="duel-draw-result-payout">${isTie ? "Both wagers were returned." : "The trail continues, partner."}</div>`}<div class="duel-draw-result-action"><button class="gold duel-rematch-btn ${myRematch ? "requested" : ""}" id="duelRematchBtn" type="button" ${myRematch ? "disabled" : ""}>${rematchLabel}</button><button class="secondary" id="duelNewGameBtn" type="button" ${newGameDelayMs > 0 ? "disabled" : ""}>${newGameDelayMs > 0 ? `New Game in ${Math.max(1, Math.ceil(newGameDelayMs / 1000))}…` : "Create a New Game"}</button></div></div></div>` : "";
      return `<div class="duel-draw-wrap">
        <div class="duel-draw-header">
          <div class="duel-draw-title">DRAW! Western Duel</div>
          <div class="duel-draw-timer">${seconds > 0 ? `${seconds}s` : "DONE"}</div>
        </div>
        <div class="duel-draw-scores">
          ${duelDrawPlayerCard(game.creator, Number(scores[creatorId] || 0), game.isCreator)}
          ${duelDrawPlayerCard(game.joiner || { name: "Waiting..." }, Number(scores[joinerId] || 0), game.isJoiner)}
        </div>
        <div class="duel-draw-board">${slots.join("")}</div>
        <div class="duel-draw-tip">${escapeHtml(headerText)}</div>
        ${resultOverlay}
      </div>`;
    }
// SITE_FRAGMENT_END: duelDrawHtml_183711

// SITE_FRAGMENT_START: duelDrawArtKey_188763
function duelDrawArtKey(game = {}) {
      const state = game.drawState || {};
      const activeBySlot = duelDrawActiveEvents(state);
      const active = [];
      for (let i = 0; i < 9; i += 1) {
        const event = activeBySlot.get(i);
        active.push(event ? `${i}:${event.id}:${event.type}:${event.kind || ""}:${event.variant || ""}:${event.name || ""}:${JSON.stringify(event.hitsBy || {})}:${event.globalHits || 0}:${event.defeatedAt || ""}:${event.claimedBy || ""}:${duelDrawPendingTargets.has(String(event.id || "")) ? "p" : ""}` : `${i}:empty`);
      }
      return JSON.stringify({
        id: game.gameId,
        status: game.status,
        active,
        revision: state.revision || 0,
        scores: state.scores || {},
        message: state.message || ""
      });
    }
// SITE_FRAGMENT_END: duelDrawArtKey_188763

// SITE_FRAGMENT_START: duelDrawMyUserId_189566
function duelDrawMyUserId(game = duelDrawLatestGame) {
      if (game?.isCreator) return String(game.creator?.userId || "");
      if (game?.isJoiner) return String(game.joiner?.userId || "");
      return String(localStorage.getItem("tornVisitorUserId") || "");
    }
// SITE_FRAGMENT_END: duelDrawMyUserId_189566

// SITE_FRAGMENT_START: duelDrawVisualScoreKey_189840
function duelDrawVisualScoreKey(game = duelDrawLatestGame) {
      return `${String(game?.gameId || "")}:${duelDrawMyUserId(game)}`;
    }
// SITE_FRAGMENT_END: duelDrawVisualScoreKey_189840

// SITE_FRAGMENT_START: duelDrawGetVisualScore_189984
function duelDrawGetVisualScore(game = duelDrawLatestGame) {
      const key = duelDrawVisualScoreKey(game);
      if (duelDrawVisualScores.has(key)) return Number(duelDrawVisualScores.get(key) || 0);
      const meId = duelDrawMyUserId(game);
      return Number(game?.drawState?.scores?.[meId] || 0);
    }
// SITE_FRAGMENT_END: duelDrawGetVisualScore_189984

// SITE_FRAGMENT_START: duelDrawSetVisualScore_190298
function duelDrawSetVisualScore(value, game = duelDrawLatestGame) {
      const key = duelDrawVisualScoreKey(game);
      const score = Number(value || 0);
      duelDrawVisualScores.set(key, score);
      const el = duelActive?.querySelector(".duel-draw-score.me .duel-draw-score-value");
      if (el && el.textContent !== String(score)) el.textContent = String(score);
      return score;
    }
// SITE_FRAGMENT_END: duelDrawSetVisualScore_190298

// SITE_FRAGMENT_START: duelDrawAdjustVisualScore_190701
function duelDrawAdjustVisualScore(delta, game = duelDrawLatestGame) {
      return duelDrawSetVisualScore(duelDrawGetVisualScore(game) + Number(delta || 0), game);
    }
// SITE_FRAGMENT_END: duelDrawAdjustVisualScore_190701

// SITE_FRAGMENT_START: duelDrawApplyBossOptimistic_190877
function duelDrawApplyBossOptimistic(game) {
      if (!game?.drawState?.events) return game;
      const meId = duelDrawMyUserId(game);
      for (const event of game.drawState.events) {
        const id = String(event?.id || "");
        const local = duelDrawBossOptimistic.get(id);
        if (!local || event.kind !== "boss") continue;
        event.hitsBy = { ...(event.hitsBy || {}) };
        const serverMyHits = Number(event.hitsBy[meId] || 0);
        if (local.pending > 0) event.hitsBy[meId] = Math.max(serverMyHits, Number(local.localMyHits || serverMyHits));
        // Keep global completion authoritative. Local hit feedback is shown immediately,
        // but the card disappears for this player when the server confirms their own third hit.
      }
      return game;
    }
// SITE_FRAGMENT_END: duelDrawApplyBossOptimistic_190877

// SITE_FRAGMENT_START: duelDrawPendingBossAward_191676
function duelDrawPendingBossAward() { return 0; }
// SITE_FRAGMENT_END: duelDrawPendingBossAward_191676

// SITE_FRAGMENT_START: duelDrawReconcileOptimistic_191731
function duelDrawReconcileOptimistic(game) {
      const meId = duelDrawMyUserId(game);
      const events = game?.drawState?.events || [];
      const confirmedActionIds = new Set((game?.drawState?.actionLedger || []).filter(row => String(row?.userId || "") === meId).map(row => String(row?.actionId || "")));
      for (const [actionId, claim] of duelDrawOptimisticClaims.entries()) {
        if (confirmedActionIds.has(actionId)) {
          duelDrawOptimisticClaims.delete(actionId);
          duelDrawPendingTargets.delete(String(claim?.targetId || ""));
        }
      }
      for (const [id, local] of duelDrawBossOptimistic.entries()) {
        const event = events.find(item => String(item?.id || "") === id);
        if (!event) continue;
        local.confirmedActionIds = local.confirmedActionIds || new Set();
        for (const actionId of [...(local.pendingActionIds || [])]) {
          if (confirmedActionIds.has(actionId)) {
            local.pendingActionIds.delete(actionId);
            local.pending = Math.max(0, Number(local.pending || 0) - 1);
          }
        }
        if (local.pending <= 0) {
          local.localMyHits = Number(event.hitsBy?.[meId] || 0);
          local.localTotalHits = Number(event.hitsBy?.[meId] || 0);
          duelDrawBossOptimistic.delete(id);
        }
      }
    }
// SITE_FRAGMENT_END: duelDrawReconcileOptimistic_191731

// SITE_FRAGMENT_START: duelDrawPatchDom_193064
function duelDrawPatchDom(game) {
      const art = duelActive?.querySelector("[data-duel-draw-art]");
      if (!art || !game) return false;
      const state = game.drawState || {};
      const revisionKey = String(game.gameId || "");
      const incomingRevision = Number(state.revision || 0);
      const latestRevision = Number(duelDrawLatestRevision.get(revisionKey) || 0);
      if (game.status === "playing" && incomingRevision < latestRevision) return true;
      duelDrawLatestRevision.set(revisionKey, Math.max(latestRevision, incomingRevision));
      duelDrawLatestGame = duelDrawApplyBossOptimistic(game);
      game = duelDrawLatestGame;
      duelDrawReconcileOptimistic(game);
      duelDrawSyncClock(state);
      const meId = duelDrawMyUserId(game);
      const creatorId = String(game.creator?.userId || "");
      const joinerId = String(game.joiner?.userId || "");
      const scores = state.scores || {};
      const scoreCards = art.querySelectorAll(".duel-draw-score");
      // Both live scoreboards use the exact same server-confirmed claim ledger as
      // the final result. Stale responses are rejected by revision above.
      const pendingDelta = Array.from(duelDrawOptimisticClaims.values()).reduce((sum, claim) => sum + Number(claim?.delta || 0), 0) + duelDrawPendingBossAward();
      const values = [Number(scores[creatorId] || 0), Number(scores[joinerId] || 0)];
      if (meId === creatorId) values[0] += pendingDelta;
      if (meId === joinerId) values[1] += pendingDelta;
      scoreCards.forEach((card, index) => {
        const value = card.querySelector(".duel-draw-score-value");
        if (value && value.textContent !== String(values[index])) value.textContent = String(values[index]);
      });
      const myValue = meId === creatorId ? values[0] : values[1];
      duelDrawSetVisualScore(Number(myValue || 0), game);

      const activeBySlot = duelDrawActiveEvents(state);
      const slots = art.querySelectorAll(".duel-draw-slot");
      slots.forEach((slot, index) => {
        const event = activeBySlot.get(index);
        const wantedId = event ? String(event.id || "") : "";
        const current = slot.querySelector("[data-draw-event]");
        const currentId = current ? String(current.dataset.drawEvent || "") : "";
        if (wantedId === currentId) {
          // A boss remains in the same slot across hits, so rebuild that one
          // card to display the new hit count/cracks. Standard cards do not need
          // this because they disappear after one claim.
          if (event?.kind === "boss") {
            slot.innerHTML = duelDrawTargetHtml(event, meId);
            duelBindDrawTargets(slot);
          }
          return;
        }
        if (!wantedId) {
          slot.innerHTML = `<div class="duel-draw-empty">…</div>`;
          return;
        }
        slot.innerHTML = duelDrawTargetHtml(event, meId);
        duelBindDrawTargets(slot);
      });

      const seconds = duelDrawSecondsLeft(state);
      const now = duelDrawNowMs(state);
      const timer = art.querySelector(".duel-draw-timer");
      if (timer) timer.textContent = seconds > 0 ? `${seconds}s` : "DONE";
      const tip = art.querySelector(".duel-draw-tip");
      const tipText = "Shoot criminals and spare civilians!";
      if (tip && tip.textContent !== tipText) tip.textContent = tipText;
      duelDrawLocalRenderKey = duelDrawArtKey(game);
      return true;
    }
// SITE_FRAGMENT_END: duelDrawPatchDom_193064

// SITE_FRAGMENT_START: duelDrawLocalTick_196844
function duelDrawLocalTick() {
      if (!duelDrawLatestGame || !duelActive || duelDrawLatestGame.mode !== "draw" || duelDrawLatestGame.status !== "playing" || duelScreen?.hidden) return;
      const art = duelActive.querySelector("[data-duel-draw-art]");
      if (!art) return;

      const state = duelDrawLatestGame.drawState || {};
      const seconds = duelDrawSecondsLeft(state);
      const now = duelDrawNowMs(state);
      const timer = art.querySelector(".duel-draw-timer");
      if (timer) timer.textContent = seconds > 0 ? `${seconds}s` : "DONE";
      const tip = art.querySelector(".duel-draw-tip");
      if (tip) {
        tip.textContent = "Shoot criminals and spare civilians!";
      }

      const key = duelDrawArtKey(duelDrawLatestGame);
      if (key !== duelDrawLocalRenderKey) duelDrawPatchDom(duelDrawLatestGame);

      if (seconds <= 0 && !window.__duelDrawFinalRefreshQueued) {
        window.__duelDrawFinalRefreshQueued = true;
        setTimeout(() => {
          window.__duelDrawFinalRefreshQueued = false;
          duelRefresh(true);
        }, 900);
      }
    }
// SITE_FRAGMENT_END: duelDrawLocalTick_196844

// SITE_FRAGMENT_START: duelDrawOptimisticScore_398558
function duelDrawOptimisticScore(delta) {
      duelDrawAdjustVisualScore(delta, duelDrawLatestGame);
    }
// SITE_FRAGMENT_END: duelDrawOptimisticScore_398558

// SITE_FRAGMENT_START: duelDrawClearTargetNow_398671
function duelDrawClearTargetNow(id) {
      const btn = duelActive?.querySelector(`[data-draw-target="${id}"]`);
      if (!btn) return;
      btn.disabled = true;
      const slot = btn.closest(".duel-draw-slot");
      btn.remove();
      if (slot) slot.innerHTML = `<div class="duel-draw-empty">…</div>`;
    }
// SITE_FRAGMENT_END: duelDrawClearTargetNow_398671
