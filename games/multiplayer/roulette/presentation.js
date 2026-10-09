// SITE_FRAGMENT_START: rouletteResetVisualRuntime_232194
function rouletteResetVisualRuntime(gameId){
      const id=String(gameId||"");
      rouletteVisualRuntime.gameId=id;rouletteVisualRuntime.queue=Promise.resolve();rouletteVisualRuntime.openingDone=rouletteOpeningCompletedGames.has(id);rouletteVisualRuntime.openingPending=false;
      rouletteVisualRuntime.processed.clear();rouletteVisualRuntime.busy=false;rouletteVisualRuntime.lastTurnId="";rouletteVisualRuntime.displayTurnId="";rouletteVisualRuntime.rotationTargetId="";rouletteVisualRuntime.rotationEpoch=0;rouletteVisualRuntime.currentAngle=-4;rouletteVisualRuntime.angleHydrated=false;rouletteVisualRuntime.mountedRevision=-1;rouletteVisualRuntime.mountedStatus="";
      if(rouletteClientCountdown.timer){clearInterval(rouletteClientCountdown.timer);rouletteClientCountdown.timer=null;}
      rouletteClientCountdown.gameId=id;rouletteClientCountdown.startedAt=0;rouletteClientCountdown.done=rouletteOpeningCompletedGames.has(id);rouletteClientCountdown.lastLabel="";
    }
// SITE_FRAGMENT_END: rouletteResetVisualRuntime_232194

// SITE_FRAGMENT_START: rouletteQueueVisual_233182
function rouletteQueueVisual(task){
      const queuedGameId=rouletteVisualRuntime.gameId;
      rouletteVisualRuntime.queue=rouletteVisualRuntime.queue.then(async()=>{if(rouletteVisualRuntime.gameId!==queuedGameId)return;rouletteVisualRuntime.busy=true;try{await task()}finally{if(rouletteVisualRuntime.gameId===queuedGameId)rouletteVisualRuntime.busy=false}}).catch(e=>rouletteDebug('visual queue error',{message:String(e?.message||e)}));
      return rouletteVisualRuntime.queue;
    }
// SITE_FRAGMENT_END: rouletteQueueVisual_233182

// SITE_FRAGMENT_START: rouletteWait_233519
function rouletteWait(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
// SITE_FRAGMENT_END: rouletteWait_233519

// SITE_FRAGMENT_START: rouletteAnimate_233602
function rouletteAnimate(el,frames,options){return new Promise(resolve=>{if(!el||typeof el.animate!=="function"){resolve();return}let a;try{a=el.animate(frames,options);a.addEventListener('finish',resolve,{once:true});a.addEventListener('cancel',resolve,{once:true})}catch(_){resolve()}})}
// SITE_FRAGMENT_END: rouletteAnimate_233602

// SITE_FRAGMENT_START: rouletteDebug_233929
function rouletteDebug(message,data){
      const entry={time:new Date().toISOString(),message:String(message||''),data:data??null};
      rouletteDebugLines.push(entry);
      if(rouletteDebugLines.length>800)rouletteDebugLines.splice(0,rouletteDebugLines.length-800);
      console.info('[rr-debug]',message,data??'');
      window.dispatchEvent(new CustomEvent('roulette-debug',{detail:entry}));
    }
// SITE_FRAGMENT_END: rouletteDebug_233929

// SITE_FRAGMENT_START: rouletteNormalizeSnapshot_234598
function rouletteNormalizeSnapshot(game){
      if(!game||game.mode!=="roulette") return game;
      const raw=game.rouletteState&&typeof game.rouletteState==="object"?game.rouletteState:{};
      const phase=["turn","press_luck","complete"].includes(String(raw.phase||""))?String(raw.phase):"turn";
      const {remaining:_privateRemaining,blankRoundsRemaining:_privateBlanks,...publicState}=raw;
      const incomingSpinUsed=raw.spinUsed&&typeof raw.spinUsed==="object"?raw.spinUsed:{};
      const gameId=String(game.gameId||'');
      const sticky=rouletteStickySpinUsedByGame.get(gameId)||{};
      const spinUsed={...incomingSpinUsed};
      for(const [playerId,used] of Object.entries(sticky))if(used)spinUsed[playerId]=true;
      for(const [playerId,used] of Object.entries(spinUsed))if(used)sticky[playerId]=true;
      if(gameId)rouletteStickySpinUsedByGame.set(gameId,sticky);
      const normalized={...game,rouletteState:{...publicState,phase,revision:Math.max(0,Number(raw.revision||0)),spinUsed}};
      const me=rouletteMyUserId(normalized);
      const creatorId=String(game?.creator?.userId||''),joinerId=String(game?.joiner?.userId||'');
      const opponentId=me===creatorId?joinerId:creatorId;
      normalized.rouletteState.mySpinUsed=Boolean(me&&spinUsed[me]===true);
      normalized.rouletteState.opponentSpinUsed=Boolean(opponentId&&spinUsed[opponentId]===true);
      normalized.rouletteState.canSpin=Boolean(normalized.rouletteState.canSpin&&!normalized.rouletteState.mySpinUsed);
      return normalized;
    }
// SITE_FRAGMENT_END: rouletteNormalizeSnapshot_234598

// SITE_FRAGMENT_START: roulettePatchMountedRuntime_236143
function roulettePatchMountedRuntime(game){
      const oldRoot=duelActive?.querySelector?.('[data-roulette-game]');
      if(!oldRoot||String(oldRoot.dataset.gameId||'')!==String(game?.gameId||''))return false;
      const incomingStatus=String(game?.status||'');
      const oldStatus=String(oldRoot.dataset.status||'');
      // Waiting/Ready/Countdown use outer controls that live outside the roulette art.
      // Never patch only the gun scene across those lifecycle changes or the Ready
      // button can remain missing until a full-page refresh.
      if(!['playing','complete'].includes(incomingStatus)||!['playing','complete'].includes(oldStatus))return false;
      if(rouletteVisualRuntime.gameId!==String(game.gameId||''))rouletteResetVisualRuntime(game.gameId);
      rouletteLatestGame=game;
      const incomingRevision=Number(game?.rouletteState?.revision||0);
      const oldRevision=Number(oldRoot.dataset.revision||-1);
      const incomingTurnId=String(game?.rouletteState?.turnId||'');
      const oldTurnId=String(oldRoot.dataset.turnId||'');
      const incomingPhase=String(game?.rouletteState?.phase||'');
      const oldPhase=String(oldRoot.dataset.phase||'');
      const incomingMyTurn=incomingTurnId!==''&&incomingTurnId===rouletteMyUserId(game);
      const oldMyTurn=String(oldRoot.dataset.myTurn||'0')==='1';
      const incomingOpeningDone=rouletteOpeningCompletedGames.has(String(game?.gameId||''))||rouletteVisualRuntime.openingDone;
      const incomingControlsLocked=!incomingOpeningDone||!incomingMyTurn||incomingStatus==='complete';
      const oldControlsLocked=String(oldRoot.dataset.controlsLocked||'1')==='1';
      const incomingOpeningReady=rouletteOpeningCanStart(game);
      const oldOpeningReady=String(oldRoot.dataset.openingReady||'0')==='1';
      const openingFinished=rouletteOpeningCompletedGames.has(String(game?.gameId||''))||rouletteVisualRuntime.openingDone;
      const expectsControls=incomingStatus==='playing';
      const expectsWait=incomingStatus==='playing'&&openingFinished&&!incomingMyTurn;
      const hasControls=!!oldRoot.querySelector('.rr-controls');
      const hasShoot=!!oldRoot.querySelector('[data-roulette-shoot]');
      const hasSpin=!!oldRoot.querySelector('[data-roulette-spin]');
      const hasPass=!!oldRoot.querySelector('[data-roulette-pass]');
      const hasWait=!!oldRoot.querySelector('.rr-control-note');
      const permissions=[game.rouletteState?.canSpin,game.rouletteState?.canShoot,game.rouletteState?.canPass,game.rouletteState?.canExecute].map(Boolean).join();
      const permissionsMatch=oldRoot.dataset.actionPermissions===permissions;
      const controlsMatch=!expectsControls||(hasControls&&hasShoot&&hasSpin&&
        (incomingPhase!=='press_luck'||!incomingMyTurn||hasPass));
      const waitMatches=!expectsWait||hasWait;
      // Only preserve the mounted controls when both the server state and the
      // actual DOM structure agree. The opening animation temporarily removes
      // .rr-controls; without this structural guard, an unchanged poll could
      // incorrectly keep that control-less scene mounted forever.
      if(incomingRevision===oldRevision&&incomingStatus===oldStatus&&incomingTurnId===oldTurnId&&incomingPhase===oldPhase&&incomingMyTurn===oldMyTurn&&incomingControlsLocked===oldControlsLocked&&incomingOpeningReady===oldOpeningReady&&controlsMatch&&waitMatches&&permissionsMatch){
        rouletteVisualRuntime.mountedRevision=incomingRevision;
        rouletteVisualRuntime.mountedStatus=incomingStatus;
        requestAnimationFrame(()=>rouletteHandleEffects(game));
        return true;
      }
      const holder=document.createElement('div');holder.innerHTML=rouletteHtml(game);const freshRoot=holder.firstElementChild;if(!freshRoot)return false;
      const oldProps=oldRoot.querySelector('.rr-scene-props'),freshProps=freshRoot.querySelector('.rr-scene-props');
      if(oldProps&&freshProps)freshProps.replaceWith(oldProps);
      const oldTable=oldRoot.querySelector('.rr-table'),freshTable=freshRoot.querySelector('.rr-table');
      if(oldTable&&freshTable)freshTable.replaceWith(oldTable);
      const oldShotLight=oldRoot.querySelector('.rr-muzzle-room-light'),freshShotLight=freshRoot.querySelector('.rr-muzzle-room-light');
      if(oldShotLight&&freshShotLight)freshShotLight.replaceWith(oldShotLight);
      oldRoot.replaceWith(freshRoot);rouletteBind(duelActive);
      rouletteVisualRuntime.mountedRevision=incomingRevision;
      rouletteVisualRuntime.mountedStatus=incomingStatus;
      requestAnimationFrame(()=>rouletteHandleEffects(game));
      return true;
    }
// SITE_FRAGMENT_END: roulettePatchMountedRuntime_236143

// SITE_FRAGMENT_START: rouletteCompletionKey_240119
function rouletteCompletionKey(game){
      const st=game?.rouletteState||{};
      return `${String(game?.gameId||'')}:${Number(st.revision||0)}:${String(st.lastAction||'')}:${String(st.lastOutcome||'')}`;
    }
// SITE_FRAGMENT_END: rouletteCompletionKey_240119

// SITE_FRAGMENT_START: rouletteHoldLiveResult_240336
function rouletteHoldLiveResult(game){
      const st=game?.rouletteState||{};
      if(game?.mode!=="roulette"||game?.status!=="complete"||st.lastAction!=="shoot"||st.lastOutcome!=="live")return false;
      const gameId=String(game?.gameId||'');
      const root=duelActive?.querySelector?.(`[data-roulette-game][data-game-id="${CSS.escape(gameId)}"]`);
      if(!gameId||!root)return false;
      const key=rouletteCompletionKey(game);
      if(rouletteCompletionHold.released.has(key))return false;
      rouletteLatestGame=game;duelLastActiveGame=game;
      if(rouletteCompletionHold.pending.has(key))return true;
      rouletteCompletionHold.pending.add(key);
      root.classList.add('rr-animation-lock','rr-live-result-hold');
      root.querySelectorAll('button').forEach(button=>button.disabled=true);
      const title=root.querySelector('.rr-status strong');
      const sub=root.querySelector('.rr-status small');
      const localPlayerWasHit=String(st.loserId||game.loserUserId||'')===rouletteMyUserId(game);
      if(title)title.textContent=localPlayerWasHit?"YOU'VE BEEN SHOT":'LIVE ROUND';
      if(sub)sub.textContent=localPlayerWasHit?'':'The shot was fired…';
      const effectKey=`${gameId}:${st.revision}:${st.lastAction}:${st.lastOutcome}`;
      rouletteVisualRuntime.processed.add(effectKey);
      rouletteQueueVisual(async()=>{
        try{
          const shot=rouletteShotSequence(game,st,gameId);
          await rouletteWait(270);
          await shot;
          // Keep the table visible after the live shot so muzzle flash, smoke,
          // recoil, and the final settling motion can be seen before results.
          await rouletteWait(1500);
        }finally{
          rouletteCompletionHold.pending.delete(key);
          rouletteCompletionHold.released.add(key);
          duelLastRenderKey='';
          duelRenderActive(game,true);
        }
      });
      return true;
    }
// SITE_FRAGMENT_END: rouletteHoldLiveResult_240336

// SITE_FRAGMENT_START: rouletteRevision_242200
function rouletteRevision(game){return Number(game?.rouletteState?.revision??-1)}
// SITE_FRAGMENT_END: rouletteRevision_242200

// SITE_FRAGMENT_START: rouletteSnapshotStamp_242338
function rouletteSnapshotStamp(game){
      return {
        statusRank:Number(DUEL_STATUS_RANK[String(game?.status||"waiting")]||0),
        gameRevision:Number(game?.revision??-1),
        rouletteRevision:rouletteRevision(game),
        updatedAt:Date.parse(String(game?.updatedAt||''))||0
      };
    }
// SITE_FRAGMENT_END: rouletteSnapshotStamp_242338

// SITE_FRAGMENT_START: rouletteAcceptSnapshot_242650
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
    }
// SITE_FRAGMENT_END: rouletteAcceptSnapshot_242650

// SITE_FRAGMENT_START: roulettePlayerAvatar_243930
function roulettePlayerAvatar(p){return p?.avatarUrl?`<img class="rr-avatar" src="${escapeHtml(p.avatarUrl)}" alt="">`:`<div class="rr-avatar rr-avatar-fallback">👤</div>`}
// SITE_FRAGMENT_END: roulettePlayerAvatar_243930

// SITE_FRAGMENT_START: rouletteServerTime_244107
function rouletteServerTime(game){return Date.parse(String(game?.serverNow||''))||Date.now()}
// SITE_FRAGMENT_END: rouletteServerTime_244107

// SITE_FRAGMENT_START: rouletteStartTime_244205
function rouletteStartTime(game){return Date.parse(String(game?.startAt||''))||0}
// SITE_FRAGMENT_END: rouletteStartTime_244205

// SITE_FRAGMENT_START: rouletteCountdownFinished_244291
function rouletteCountdownFinished(game){const start=rouletteStartTime(game);return Boolean(start)&&rouletteServerTime(game)>=start}
// SITE_FRAGMENT_END: rouletteCountdownFinished_244291

// SITE_FRAGMENT_START: rouletteBothReady_244428
function rouletteBothReady(game){
      const creatorId=String(game?.creator?.userId||''),joinerId=String(game?.joiner?.userId||'');
      return Boolean(creatorId&&joinerId&&game?.ready?.[creatorId]&&game?.ready?.[joinerId]);
    }
// SITE_FRAGMENT_END: rouletteBothReady_244428

// SITE_FRAGMENT_START: rouletteOpeningCanStart_244665
function rouletteOpeningCanStart(game){
      const st=game?.rouletteState||{};
      return game?.status==='playing'&&rouletteBothReady(game)&&rouletteCountdownFinished(game)&&Boolean(st.openingSpinWinnerId)&&Boolean(st.turnId);
    }
// SITE_FRAGMENT_END: rouletteOpeningCanStart_244665

// SITE_FRAGMENT_START: rouletteMyUserId_244916
function rouletteMyUserId(game){
      if(game?.isCreator)return String(game?.creator?.userId||'');
      if(game?.isJoiner)return String(game?.joiner?.userId||'');
      return String(localStorage.getItem('tornVisitorUserId')||'');
    }
// SITE_FRAGMENT_END: rouletteMyUserId_244916

// SITE_FRAGMENT_START: rouletteClientCountdownLabel_245159
function rouletteClientCountdownLabel(){
      if(!rouletteClientCountdown.startedAt||rouletteClientCountdown.done)return "";
      const elapsed=Date.now()-rouletteClientCountdown.startedAt;
      if(elapsed<900)return "3";
      if(elapsed<1800)return "2";
      if(elapsed<2700)return "1";
      if(elapsed<3150)return "GO!";
      return "";
    }
// SITE_FRAGMENT_END: rouletteClientCountdownLabel_245159

// SITE_FRAGMENT_START: roulettePatchClientCountdown_245515
function roulettePatchClientCountdown(){
      const gameId=rouletteClientCountdown.gameId;
      if(!gameId||rouletteClientCountdown.done)return false;
      const label=rouletteClientCountdownLabel();
      const root=duelActive?.querySelector?.(`[data-roulette-game][data-game-id="${CSS.escape(gameId)}"]`);
      let holder=root?.querySelector?.('[data-roulette-countdown]');
      if(root&&!holder){
        holder=document.createElement('div');holder.className='rr-scene-countdown';holder.dataset.rouletteCountdown='1';
        holder.innerHTML='<div class="duel-countdown-number cue">3</div>';root.appendChild(holder);
      }
      const text=holder?.querySelector?.('.duel-countdown-number');
      if(label&&holder&&text){
        holder.hidden=false;
        if(rouletteClientCountdown.lastLabel!==label){
          rouletteClientCountdown.lastLabel=label;text.textContent=label;
          text.className=`duel-countdown-number cue ${label==='GO!'?'go':''}`;
          text.style.animation='none';void text.offsetWidth;text.style.animation='';
          duelPlayCountdownSound(rouletteLatestGame||duelLastActiveGame,label);
        }
        return true;
      }
      if(Date.now()-rouletteClientCountdown.startedAt>=3150){
        rouletteClientCountdown.done=true;
        holder?.remove();
        if(rouletteClientCountdown.timer){clearInterval(rouletteClientCountdown.timer);rouletteClientCountdown.timer=null;}
        requestAnimationFrame(()=>rouletteHandleEffects(rouletteLatestGame||duelLastActiveGame));
      }
      return false;
    }
// SITE_FRAGMENT_END: roulettePatchClientCountdown_245515

// SITE_FRAGMENT_START: rouletteEnsureClientCountdown_247080
function rouletteEnsureClientCountdown(game){
      if(!game||game.mode!=='roulette'||!game.gameId)return false;
      const gameId=String(game.gameId);
      try{if(localStorage.getItem(`rouletteOpeningDone:${gameId}`)==='1')rouletteOpeningCompletedGames.add(gameId);}catch(_){}
      if(rouletteClientCountdown.gameId!==gameId){
        if(rouletteClientCountdown.timer)clearInterval(rouletteClientCountdown.timer);
        rouletteClientCountdown.gameId=gameId;rouletteClientCountdown.startedAt=0;rouletteClientCountdown.done=rouletteOpeningCompletedGames.has(gameId);rouletteClientCountdown.timer=null;rouletteClientCountdown.lastLabel='';
      }
      const hasBothPlayers=Boolean(game.creator?.userId&&game.joiner?.userId);
      const lifecycleEligible=hasBothPlayers&&['countdown','playing'].includes(String(game.status||''))&&!rouletteOpeningCompletedGames.has(gameId);
      if(lifecycleEligible&&!rouletteClientCountdown.startedAt&&!rouletteClientCountdown.done){
        // Start from the first authoritative snapshot seen by this browser. This
        // intentionally guarantees a visible 3-2-1 even if network latency made
        // the server's countdown response arrive after it had already advanced.
        rouletteClientCountdown.startedAt=Date.now();rouletteClientCountdown.lastLabel='';
        rouletteClientCountdown.timer=setInterval(roulettePatchClientCountdown,50);
        requestAnimationFrame(roulettePatchClientCountdown);
      }
      return lifecycleEligible&&!rouletteClientCountdown.done;
    }
// SITE_FRAGMENT_END: rouletteEnsureClientCountdown_247080

// SITE_FRAGMENT_START: rouletteMarkSpinUsedLocally_248490
function rouletteMarkSpinUsedLocally(game,userId=rouletteMyUserId(game)){
      const gameId=String(game?.gameId||''),id=String(userId||'');if(!gameId||!id)return;
      const sticky=rouletteStickySpinUsedByGame.get(gameId)||{};sticky[id]=true;rouletteStickySpinUsedByGame.set(gameId,sticky);
      if(game?.rouletteState?.spinUsed&&typeof game.rouletteState.spinUsed==='object')game.rouletteState.spinUsed[id]=true;
      if(game?.rouletteState)game.rouletteState.mySpinUsed=true;
      const root=duelActive?.querySelector?.(`[data-roulette-game][data-game-id="${CSS.escape(gameId)}"]`);
      const button=root?.querySelector?.('[data-roulette-spin]');
      if(button){button.disabled=true;const title=button.querySelector('b');const note=button.querySelector('small');if(title)title.textContent='SPIN ×0';if(note)note.textContent='USED';}
      root?.querySelectorAll?.('.rr-player')?.forEach(card=>{const name=card.querySelector('b')?.textContent||'';const player=[game?.creator,game?.joiner].find(p=>String(p?.name||'')===name);if(String(player?.userId||'')===id){const badge=card.querySelector('span');if(badge)badge.textContent='SPIN USED';}});
    }
// SITE_FRAGMENT_END: rouletteMarkSpinUsedLocally_248490

// SITE_FRAGMENT_START: rouletteSpinWasUsed_249654
function rouletteSpinWasUsed(game,userId=rouletteMyUserId(game)){
      const id=String(userId||'');
      const map=game?.rouletteState?.spinUsed;
      return Boolean(id&&map&&typeof map==='object'&&map[id]===true);
    }
// SITE_FRAGMENT_END: rouletteSpinWasUsed_249654

// SITE_FRAGMENT_START: rouletteStableMessage_250265
function rouletteStableMessage(game, messages=rouletteHitMessages){
      const key=String(game?.gameId||'roulette');let hash=0;
      for(let i=0;i<key.length;i++)hash=((hash*31)+key.charCodeAt(i))>>>0;
      return messages[hash%messages.length];
    }
// SITE_FRAGMENT_END: rouletteStableMessage_250265

// SITE_FRAGMENT_START: rouletteCompactPot_250524
function rouletteCompactPot(value){
      const amount=Math.max(0,Number(value)||0);
      if(amount<10000)return new Intl.NumberFormat("en-US").format(Math.round(amount));
      const units=[[1e9,"B"],[1e6,"M"],[1e3,"K"]];
      for(const [size,suffix] of units){
        if(amount>=size){
          const scaled=amount/size;
          const digits=scaled>=100?0:(scaled>=10?1:2);
          return scaled.toFixed(digits).replace(/\.0+$|(?<=\.[0-9])0+$/g,"")+suffix;
        }
      }
      return String(Math.round(amount));
    }
// SITE_FRAGMENT_END: rouletteCompactPot_250524

// SITE_FRAGMENT_START: rouletteHtml_251060
function rouletteHtml(game){
      rouletteLatestGame=game;const clientCountdownActive=rouletteEnsureClientCountdown(game);const st=game.rouletteState||{},me=rouletteMyUserId(game),creator=game.creator||{},joiner=game.joiner||{};
      const waiting=game.status==='waiting',hasOpponent=Boolean(joiner&&joiner.userId),bothReady=rouletteBothReady(game),countdownFinished=rouletteCountdownFinished(game);
      const myTurn=String(st.turnId||'')===me,press=st.phase==='press_luck',complete=game.status==='complete',meWon=String(game.winnerUserId||'')===me;
      const rouletteGameId=String(game.gameId||'');
      const openingAlreadyCompleted=rouletteOpeningCompletedGames.has(rouletteGameId)||
        (rouletteVisualRuntime.gameId===rouletteGameId&&rouletteVisualRuntime.openingDone);
      const openingCanStart=rouletteOpeningCanStart(game);
      const openingConcealed=!complete&&!openingAlreadyCompleted;
      const preOpening=openingConcealed&&!openingCanStart;
      const chosenGun=window.RouletteArsenal?.selected();
      const revolverModel=chosenGun?.laser?'redshift-ranger':chosenGun?.cyber?'neon-frontier':'steel-walnut';
      const gunAsset=window.RouletteArsenal?.asset()||'assets/roulette/revolver-steel-walnut.png';
      const actor=String(st.turnId||'')===String(creator.userId||'')?creator:joiner;
      let status,sub,controlNote;
      if(!hasOpponent){status='WAITING FOR A PLAYER TO JOIN';sub='';controlNote='Waiting for other player';}
      else if(!bothReady){status='WAITING FOR BOTH PLAYERS';sub='Both players must press Ready before the countdown begins.';controlNote='Waiting for both players to ready up';}
      else if(!countdownFinished){status='GET READY';sub='';controlNote='Game starts after countdown';}
      else if(openingConcealed){status='';sub='';controlNote='';}
      else if(complete){
        status=meWon?'YOU SURVIVED':'YOU\'VE BEEN SHOT';
        sub=meWon?`You won ${money(game.payout||0)}.`:'';
        controlNote='';

        globalThis.RouletteAudioBindings?.playResult?.(
          meWon?'victory':'defeat',
          `${game.gameId}:${st.revision||game.revision||''}:${st.winnerId||game.winnerUserId||''}`
        );
      }
      else if(myTurn){status='YOUR TURN';sub='';controlNote='';}
      else{status=`${escapeHtml(actor.name||'Opponent')} HAS THE REVOLVER`;sub='';controlNote='Waiting for other player';}
      const opponent=String(me)===String(creator.userId||'')?joiner:creator;
      const controlsLocked=!openingAlreadyCompleted||!myTurn||complete;
      const mySpinUsed=rouletteSpinWasUsed(game,me);
      const spinCount=mySpinUsed?0:1;
      const shootLabel=press&&myTurn&&openingAlreadyCompleted?'SHOOT AGAIN':'SHOOT';
      const controls=complete?'<div class="rr-wait">DUEL COMPLETE</div>':`<div class="rr-controls ${press&&myTurn&&openingAlreadyCompleted?'rr-controls-three':'rr-controls-two'} ${controlsLocked?'rr-controls-disabled':''}">
        ${controlNote?`<div class="rr-control-note">${controlNote}</div>`:''}
        <button class="rr-btn rr-spin" data-roulette-spin type="button" ${(controlsLocked||!st.canSpin||mySpinUsed)?'disabled':''}><b>SPIN ×${spinCount}</b><small>${mySpinUsed?'USED':'ONCE PER GAME'}</small></button>
        <button class="rr-btn rr-shoot" data-roulette-shoot type="button" ${(controlsLocked||!st.canShoot)?'disabled':''}><b>${shootLabel}</b>${press&&myTurn&&openingAlreadyCompleted?'<small>KEEP YOUR TURN AND RISK IT</small>':''}</button>
        ${press&&myTurn&&openingAlreadyCompleted?`<button class="rr-btn rr-pass" data-roulette-pass type="button" ${(controlsLocked||!st.canPass)?'disabled':''}><b>PASS TO ${escapeHtml(String(opponent.name||'OPPONENT').toUpperCase())}</b><small>END YOUR TURN</small></button>`:''}
      </div>`;
      const rem=game.rematch&&typeof game.rematch==='object'?game.rematch:{};
      const rematchRequests=rem.requestedBy&&typeof rem.requestedBy==='object'?rem.requestedBy:{};
      const rematchExpiresAt=Date.parse(rem.expiresAt||0);
      const rematchActive=Boolean(rematchExpiresAt&&rematchExpiresAt>Date.now());
      const rematchSeconds=rematchActive?Math.max(0,Math.ceil((rematchExpiresAt-Date.now())/1000)):10;
      const myRem=Boolean(rematchActive&&rematchRequests[me]);
      const rematchPlayers=[creator,joiner].filter(player=>player?.userId&&rematchRequests[player.userId]);
      const rematchAvatars=rematchPlayers.map(player=>player.avatarUrl
        ?`<img src="${escapeHtml(player.avatarUrl)}" alt="${escapeHtml(player.name||'Player')} accepted" class="duel-rematch-avatar">`
        :`<span class="duel-rematch-avatar rr-rematch-initial">${escapeHtml(String(player.profileInitial||player.name||'?').charAt(0).toUpperCase())}</span>`).join('');
      const rematchButtonLabel=rematchActive
        ?`${rematchAvatars}<span>${rematchPlayers.length>=2?'Starting rematch…':myRem?'Waiting for opponent':'Accept Rematch'} · ${rematchSeconds}s</span>`
        :'<span>Rematch</span>';
      const final=complete?`<div class="rr-final ${meWon?'win':'lose'}"><div class="rr-final-card"><div class="rr-final-kicker">PRIVATE TABLE · FINAL ROUND</div><div class="rr-final-emblem" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="rr-final-title">${meWon?'YOU WALK AWAY':'YOU\'VE BEEN SHOT'}</div><p>${meWon?`The pot is yours — ${money(game.payout||0)}.`:escapeHtml(rouletteStableMessage(game))}</p><div class="rr-final-actions"><button class="gold duel-rematch-btn ${myRem?'requested':''}" id="duelRematchBtn" type="button" ${myRem?'disabled':''}>${rematchButtonLabel}</button><button class="secondary" id="duelNewGameBtn" type="button">Create a New Game</button></div></div></div>`:'';
      // A render is never allowed to choose a new gun direction. Once the
      // opening spin has settled, only rouletteRotateToTurn may change the
      // authoritative angle. This prevents action responses and polling
      // remounts from snapping the gun to either side mid-animation.
      const runtimeOwnsAngle=rouletteVisualRuntime.gameId===rouletteGameId&&rouletteVisualRuntime.angleHydrated&&Number.isFinite(rouletteVisualRuntime.currentAngle);
      const neutralAngle=!openingAlreadyCompleted?-4:(runtimeOwnsAngle?rouletteVisualRuntime.currentAngle:rouletteTurnAngle(game,st));
      return `<div class="rr-game ${!hasOpponent?'rr-waiting-player ':''}${openingConcealed?'rr-opening-active ':''}${st.lastOutcome==='live'?'rr-fired':''}" data-roulette-scene="rustic-v2" data-action-permissions="${[st.canSpin,st.canShoot,st.canPass,st.canExecute].map(Boolean).join()}" data-roulette-opening="${openingConcealed?'1':'0'}" data-roulette-game data-game-id="${escapeHtml(String(game.gameId||''))}" data-revision="${Number(st.revision||0)}" data-status="${escapeHtml(String(game.status||''))}" data-turn-id="${escapeHtml(String(st.turnId||''))}" data-my-turn="${myTurn?'1':'0'}" data-phase="${escapeHtml(String(st.phase||''))}" data-controls-locked="${controlsLocked?'1':'0'}" data-opening-ready="${openingCanStart?'1':'0'}">
        <div class="rr-backwall"></div><div class="rr-floor" aria-hidden="true"></div><div class="rr-scene-props" aria-hidden="true"><div class="rr-light-volume"></div><div class="rr126-lamp-rig"><div class="rr126-swing"><div class="rr126-chain"></div><img id="rrLampPng" src="/assets/roulette/decor/rustic-pendant-v2.png" alt="" draggable="false"></div></div></div>
        <div class="rr-top"><div class="rr-player ${openingAlreadyCompleted&&String(st.turnId||'')===String(creator.userId||'')?'active':''}">${roulettePlayerAvatar(creator)}<b>${escapeHtml(creator.name||'Player 1')}</b><span>${rouletteSpinWasUsed(game,creator.userId)?'SPIN USED':'SPIN READY'}</span></div><div class="rr-pot"><span>Pot</span><b>${rouletteCompactPot(game.pot||game.wager||0)}</b><small>Tickets</small><span class="rr-turn-clock" data-roulette-clock aria-label="Turn time remaining">60s</span></div><div class="rr-player ${openingAlreadyCompleted&&String(st.turnId||'')===String(joiner.userId||'')?'active':''}">${roulettePlayerAvatar(joiner)}<b>${escapeHtml(joiner.name||'Waiting for Player')}</b><span>${!hasOpponent?'OPEN SEAT':(rouletteSpinWasUsed(game,joiner.userId)?'SPIN USED':'SPIN READY')}</span></div></div>
        <div class="rr-status"><strong>${status}</strong><small>${sub}</small></div>
        ${clientCountdownActive?`<div class="rr-scene-countdown" data-roulette-countdown><div class="duel-countdown-number cue">${escapeHtml(rouletteClientCountdownLabel()||'3')}</div></div>`:''}
        ${openingCanStart&&openingConcealed?'<div class="rr-opening-banner">Choosing First Player</div>':''}
        <div class="rr-room-shade" aria-hidden="true"></div><div class="rr-muzzle-room-light" aria-hidden="true"></div><div class="rr-table"><img class="rr-table-pedestal" src="/assets/roulette/decor/oval-table-support-v3.webp" alt="" draggable="false"><img class="rr-table-art" src="/assets/roulette/decor/oval-table-v2.png" alt="" draggable="false"><div class="rr130-table-illumination" aria-hidden="true"><img src="/assets/roulette/decor/oval-table-v2.png" alt="" draggable="false"></div><div class="rr-table-shadow"></div>
        <div class="rr-gun-motion" data-roulette-motion style="visibility:hidden;transform:${rouletteMotionTransform(neutralAngle)}">
          <div class="rr-turn-facing" data-roulette-facing="1" style="transform:rotate(${neutralAngle}deg)"><div class="rr-gun-recoil" data-roulette-recoil="1">
          <div class="rr-revolver rr-photo-revolver" aria-label="Long-barrel side-view revolver" data-revolver-model="${escapeHtml(revolverModel)}">
            <img class="rr-gun-photo" src="${gunAsset}" alt="" draggable="false">
            <span class="rr-hammer-cover" aria-hidden="true"></span>
            <img class="rr-hammer-photo" src="${window.RouletteArsenal?.hammerAsset()||'assets/roulette/revolver-steel-walnut-hammer.png'}" alt="" draggable="false">
            <span class="rr-metal-glint" aria-hidden="true" style="--rr-gun-mask:url(&quot;${gunAsset}&quot;)"></span>
          </div>
          <i class="rr-muzzle-point" aria-hidden="true"></i><div class="rr-shot-flash" aria-hidden="true"></div>
          <div class="rr-shot-smoke" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
        </div></div></div><div class="rr-shell"></div></div>
        ${controls}<button class="rr-btn rr-execute" data-roulette-execute type="button" hidden>Shoot Em Dead</button>${window.RouletteArsenal?.menu()||''}${final}
      </div>`;
    }
// SITE_FRAGMENT_END: rouletteHtml_251060

// SITE_FRAGMENT_START: roulettePatchLiveDom_260493
function roulettePatchLiveDom(){return false}
// SITE_FRAGMENT_END: roulettePatchLiveDom_260493

// SITE_FRAGMENT_START: rouletteBind_260543
function rouletteBind(root=duelActive){
      const gameRoot=root?.querySelector('[data-roulette-game]');if(!gameRoot)return;
      gameRoot.querySelector('[data-roulette-spin]')?.addEventListener('click',(event)=>rouletteAct('roulette:spin',event));
      gameRoot.querySelector('[data-roulette-shoot]')?.addEventListener('click',(event)=>rouletteAct('roulette:shoot',event));
      gameRoot.querySelector('[data-roulette-pass]')?.addEventListener('click',(event)=>rouletteAct('roulette:pass',event));
      window.RouletteArsenal?.bind(gameRoot);
      window.RouletteTurnClock?.bind(gameRoot,rouletteLatestGame);
      duelBindResultButtons(rouletteLatestGame);
      gameRoot.querySelector('#duelNewGameBtn')?.addEventListener('click',duelStartNewGame);
      const boundGameId=String(gameRoot.dataset.gameId||'');
      if(rouletteVisualRuntime.gameId!==boundGameId)rouletteResetVisualRuntime(boundGameId);
      rouletteVisualRuntime.mountedRevision=Number(gameRoot.dataset.revision||-1);
      rouletteVisualRuntime.mountedStatus=String(gameRoot.dataset.status||'');
      rouletteDebug('bind',{gameId:boundGameId,revision:gameRoot.dataset.revision,revolver:!!gameRoot.querySelector('.rr-revolver'),cylinder:!!gameRoot.querySelector('.rr-cylinder'),openingDone:rouletteVisualRuntime.openingDone});
    }
// SITE_FRAGMENT_END: rouletteBind_260543

// SITE_FRAGMENT_START: rouletteMotionBase_261844
function rouletteMotionBase(){
      return matchMedia('(max-width:560px)').matches
        ? 'translate(-50%,-50%) rotate(-4deg) scale(.78)'
        : 'translate(-50%,-50%) rotate(-4deg) scale(.74)';
    }
// SITE_FRAGMENT_END: rouletteMotionBase_261844

// SITE_FRAGMENT_START: rouletteMotionScale_262055
function rouletteMotionScale(){return matchMedia('(max-width:560px)').matches?.78:.74}
// SITE_FRAGMENT_END: rouletteMotionScale_262055

// SITE_FRAGMENT_START: rouletteMotionTransform_262146
function rouletteMotionTransform(angle,scale=rouletteMotionScale(),x='-50%',y='-50%'){
      const normalized=((Number(angle)||0)%360+360)%360;
      if(normalized>=145&&normalized<=215){
        const local=normalized-180;
        return `translate(${x},${y}) rotate(${local}deg) scale(${-scale},${scale})`;
      }
      return `translate(${x},${y}) rotate(${angle}deg) scale(${scale})`;
    }
// SITE_FRAGMENT_END: rouletteMotionTransform_262146

// SITE_FRAGMENT_START: rouletteRotationGlint_262546
function rouletteRotationGlint(glint,duration=700,intensity=.34){
      if(!glint||matchMedia('(prefers-reduced-motion:reduce)').matches)return Promise.resolve();
      const sweeps=duration>2500?3:1,frames=[];
      for(let i=0;i<sweeps;i++){
        const start=i/sweeps,end=(i+1)/sweeps,span=end-start;
        frames.push({opacity:0,backgroundPosition:'116% 0',offset:start});
        frames.push({opacity:intensity,backgroundPosition:'76% 0',offset:start+span*.34});
        frames.push({opacity:intensity*.62,backgroundPosition:'38% 0',offset:start+span*.7});
        frames.push({opacity:0,backgroundPosition:'5% 0',offset:end});
      }
      return rouletteAnimate(glint,frames,{duration,easing:'cubic-bezier(.2,.55,.2,1)',fill:'none'}).finally(()=>{glint.getAnimations?.().forEach(a=>a.cancel());glint.style.opacity='0';glint.style.backgroundPosition='116% 0'});
    }
// SITE_FRAGMENT_END: rouletteRotationGlint_262546

// SITE_FRAGMENT_START: rouletteRotateToTurn_263429
async function rouletteRotateToTurn(game,st,gameId,{duration=1050,targetTurnId}={}){
      const requestedTurnId=String(targetTurnId||st?.turnId||'');
      if(!requestedTurnId)return;
      // A queued visual can become stale while a shot animation is finishing.
      // Only rotate when the newest authoritative snapshot still says this
      // exact player owns the turn.
      const latestAtStart=rouletteLatestGame;
      if(String(latestAtStart?.gameId||'')!==String(gameId)||
        latestAtStart?.status!=='playing'||
        String(latestAtStart?.rouletteState?.turnId||'')!==requestedTurnId){
        rouletteDebug('discarded stale turn rotation',{requestedTurnId,authoritativeTurnId:String(latestAtStart?.rouletteState?.turnId||'')});
        return;
      }
      // Direction is keyed only to the displayed turn. Polls and non-turn
      // actions cannot schedule another movement to the same player.
      if(rouletteVisualRuntime.displayTurnId===requestedTurnId||rouletteVisualRuntime.rotationTargetId===requestedTurnId)return;
      const liveRoot=duelActive?.querySelector(`[data-roulette-game][data-game-id="${CSS.escape(gameId)}"]`);
      const motion=liveRoot?.querySelector('[data-roulette-motion]');
      const glint=liveRoot?.querySelector('.rr-metal-glint');
      if(!liveRoot||!motion)return;
      const epoch=++rouletteVisualRuntime.rotationEpoch;
      rouletteVisualRuntime.rotationTargetId=requestedTurnId;
      const target=rouletteAngleForPlayer(game,requestedTurnId),scale=rouletteMotionScale();
      const from=Number.isFinite(rouletteVisualRuntime.currentAngle)?rouletteVisualRuntime.currentAngle:target;
      let delta=((((target-from)%360)+540)%360)-180;
      if(delta===-180)delta=180;
      if(Math.abs(delta)<.5){
        motion.getAnimations?.().forEach(a=>a.cancel());
        motion.style.transform=rouletteMotionTransform(target,scale);
        rouletteVisualRuntime.currentAngle=target;
        rouletteVisualRuntime.angleHydrated=true;
        rouletteVisualRuntime.lastTurnId=requestedTurnId;
        rouletteVisualRuntime.displayTurnId=requestedTurnId;
        rouletteVisualRuntime.rotationTargetId='';
        return;
      }
      liveRoot.classList.add('rr-animation-lock');
      try{
        motion.getAnimations?.().forEach(a=>a.cancel());
        await rouletteAnimate(motion,[{opacity:1},{opacity:.12}],{duration:120,easing:'ease-out',fill:'forwards'});
        motion.getAnimations?.().forEach(a=>a.cancel());
        motion.style.transform=rouletteMotionTransform(target,scale);
        await Promise.all([
          rouletteAnimate(motion,[{opacity:.12},{opacity:1}],{duration:180,easing:'ease-in',fill:'forwards'}),
          rouletteRotationGlint(glint,300,.18)
        ]);
      }finally{
        const latestAtFinish=rouletteLatestGame;
        const stillAuthoritative=String(latestAtFinish?.gameId||'')===String(gameId)&&
          latestAtFinish?.status==='playing'&&
          String(latestAtFinish?.rouletteState?.turnId||'')===requestedTurnId;
        if(epoch===rouletteVisualRuntime.rotationEpoch&&stillAuthoritative){
          motion.getAnimations?.().forEach(a=>a.cancel());
          motion.style.transform=rouletteMotionTransform(target,scale);
          rouletteVisualRuntime.currentAngle=target;
          rouletteVisualRuntime.angleHydrated=true;
          rouletteVisualRuntime.lastTurnId=requestedTurnId;
          rouletteVisualRuntime.displayTurnId=requestedTurnId;
          rouletteVisualRuntime.rotationTargetId='';
        }else if(epoch===rouletteVisualRuntime.rotationEpoch){
          motion.getAnimations?.().forEach(a=>a.cancel());
          motion.style.transform=rouletteMotionTransform(rouletteVisualRuntime.currentAngle,scale);
          rouletteVisualRuntime.rotationTargetId='';
          rouletteDebug('cancelled stale turn rotation finish',{requestedTurnId,authoritativeTurnId:String(latestAtFinish?.rouletteState?.turnId||'')});
        }
        if(glint){glint.getAnimations?.().forEach(a=>a.cancel());glint.style.opacity='0';glint.style.backgroundPosition='116% 0'}
        liveRoot.classList.remove('rr-animation-lock');
      }
    }
// SITE_FRAGMENT_END: rouletteRotateToTurn_263429

// SITE_FRAGMENT_START: rouletteAngleForPlayer_267585
function rouletteAngleForPlayer(game,userId){
      // The creator is seated on the left and the joiner on the right. The
      // revolver artwork's upright left-facing pose is -4deg.
      return String(userId||'')===String(game?.creator?.userId||'')?-4:176;
    }
// SITE_FRAGMENT_END: rouletteAngleForPlayer_267585

// SITE_FRAGMENT_START: rouletteOpeningFinalAngle_267856
function rouletteOpeningFinalAngle(game,st){return rouletteAngleForPlayer(game,st?.openingSpinWinnerId||st?.turnId)}
// SITE_FRAGMENT_END: rouletteOpeningFinalAngle_267856

// SITE_FRAGMENT_START: rouletteTurnAngle_267977
function rouletteTurnAngle(game,st){return rouletteAngleForPlayer(game,st?.turnId)}
// SITE_FRAGMENT_END: rouletteTurnAngle_267977

// SITE_FRAGMENT_START: rouletteOpeningSequence_268065
async function rouletteOpeningSequence(game,st,gameId){
      const liveRoot=duelActive?.querySelector(`[data-roulette-game][data-game-id="${CSS.escape(gameId)}"]`);
      const motion=liveRoot?.querySelector('[data-roulette-motion]');
      if(!liveRoot||!motion)throw new Error('Opening spin scene was not mounted.');
      liveRoot.classList.add('rr-animation-lock','rr-opening-active');
      liveRoot.dataset.rouletteOpening='1';
      liveRoot.querySelectorAll('.rr-btn').forEach(button=>button.disabled=true);
      motion.getAnimations().forEach(a=>a.cancel());
      motion.style.transform=rouletteMotionTransform(-4,rouletteMotionScale());
      rouletteVisualRuntime.currentAngle=-4;
      let banner=liveRoot.querySelector('.rr-opening-banner');
      if(!banner){banner=document.createElement('div');banner.className='rr-opening-banner';liveRoot.appendChild(banner)}
      banner.textContent='Choosing First Player';
      const finalAngle=rouletteOpeningFinalAngle(game,st);
      const scale=rouletteMotionScale();
      const glint=liveRoot.querySelector('.rr-metal-glint');
      const duration=4700;
      rouletteSpinSound(1.35);
      await Promise.all([
        rouletteAnimate(motion,[
          {transform:rouletteMotionTransform(-4,scale),offset:0},
          {transform:rouletteMotionTransform(116,scale*1.012),offset:.24},
          {transform:rouletteMotionTransform(386,scale*1.025),offset:.55},
          {transform:rouletteMotionTransform(finalAngle+720,scale*1.008),offset:.88},
          {transform:rouletteMotionTransform(finalAngle+711,scale),offset:.955},
          {transform:rouletteMotionTransform(finalAngle+720,scale),offset:1}
        ],{duration,easing:'cubic-bezier(.22,.58,.12,1)',fill:'forwards'}),
        rouletteRotationGlint(glint,duration,.28)
      ]);
      motion.style.transform=rouletteMotionTransform(finalAngle,scale);
      rouletteVisualRuntime.currentAngle=finalAngle;
      rouletteVisualRuntime.angleHydrated=true;
      rouletteVisualRuntime.lastTurnId=String(st?.turnId||'');rouletteVisualRuntime.displayTurnId=rouletteVisualRuntime.lastTurnId;rouletteVisualRuntime.rotationTargetId='';
      banner.textContent=String(st?.turnId||'')===String(game?.creator?.userId||'')
        ? `${String(game?.creator?.name||'PLAYER 1').toUpperCase()} GOES FIRST`
        : `${String(game?.joiner?.name||'PLAYER 2').toUpperCase()} GOES FIRST`;
      await rouletteWait(850);
      banner.remove();
      liveRoot.classList.remove('rr-animation-lock','rr-opening-active');
      liveRoot.dataset.rouletteOpening='0';
      // The queue owner marks opening complete and performs one authoritative
      // render from the newest accepted snapshot.
    }
// SITE_FRAGMENT_END: rouletteOpeningSequence_268065

// SITE_FRAGMENT_START: rouletteOrientToShotActor_270772
async function rouletteOrientToShotActor(game,st,gameId){
      const actorId=String(st?.lastActorId||st?.turnId||'');
      if(!actorId)return;
      const target=rouletteAngleForPlayer(game,actorId);
      const root=duelActive?.querySelector(`[data-roulette-game][data-game-id="${CSS.escape(gameId)}"]`);
      const motion=root?.querySelector('[data-roulette-motion]');
      if(!motion)return;
      const from=Number.isFinite(rouletteVisualRuntime.currentAngle)?rouletteVisualRuntime.currentAngle:target;
      const delta=Math.abs((((target-from)+540)%360)-180);
      motion.getAnimations?.().forEach(a=>a.cancel());
      if(delta>.75){
        await rouletteAnimate(motion,[
          {transform:rouletteMotionTransform(from,rouletteMotionScale())},
          {transform:rouletteMotionTransform(target,rouletteMotionScale())}
        ],{duration:Math.min(720,Math.max(260,delta*4)),easing:'cubic-bezier(.22,.7,.18,1)',fill:'forwards'});
      }
      motion.style.transform=rouletteMotionTransform(target,rouletteMotionScale());
      rouletteVisualRuntime.currentAngle=target;
      rouletteVisualRuntime.angleHydrated=true;
      rouletteVisualRuntime.lastTurnId=actorId;
      rouletteVisualRuntime.displayTurnId=actorId;
      rouletteVisualRuntime.rotationTargetId='';
      rouletteDebug('shot actor orientation locked',{gameId,actorId,target,lastOutcome:st?.lastOutcome});
    }
// SITE_FRAGMENT_END: rouletteOrientToShotActor_270772

// SITE_FRAGMENT_START: rouletteShotSequence_272172
async function rouletteShotSequence(game,st,gameId){
      await rouletteOrientToShotActor(game,st,gameId);
      const liveRoot=duelActive?.querySelector(`[data-roulette-game][data-game-id="${CSS.escape(gameId)}"]`);
      const motion=liveRoot?.querySelector('[data-roulette-motion]');
      const hammer=liveRoot?.querySelector('.rr-hammer-photo');
      const cover=liveRoot?.querySelector('.rr-hammer-cover');
      const glint=liveRoot?.querySelector('.rr-metal-glint');
      const flash=liveRoot?.querySelector('.rr-shot-flash');
      const smoke=[...(liveRoot?.querySelectorAll('.rr-shot-smoke i')||[])];
      if(!liveRoot||!motion)return;
      liveRoot.classList.add('rr-animation-lock');
      [motion,hammer,cover,glint,flash,...smoke].filter(Boolean).forEach(el=>el.getAnimations?.().forEach(a=>a.cancel()));
      if(cover)cover.style.opacity='0';
      if(hammer){
        hammer.style.opacity='1';
        rouletteShotIndexSound();
        const hammerMotion=rouletteAnimate(hammer,[
          {transform:'rotate(0deg)',offset:0},
          {transform:'rotate(23deg)',offset:.46},
          {transform:'rotate(23deg)',offset:.60},
          {transform:'rotate(-2.5deg)',offset:.76},
          {transform:'rotate(0deg)',offset:1}
        ],{duration:420,easing:'cubic-bezier(.22,.03,.16,1)',fill:'none'});
        // Begin the gun response at the hammer strike instead of waiting for
        // the hammer to finish returning to rest.
        await rouletteWait(255);
        liveRoot._rrHammerMotion=hammerMotion;
      }else await rouletteWait(255);
      const live=st.lastOutcome==='live';
      if(live){
        rouletteGunshotSound();navigator.vibrate?.([90,35,220]);
        const shotFx=[];
        if(flash)shotFx.push(rouletteAnimate(flash,[
          {opacity:0,transform:'translate(-50%,-50%) scale(.1)'},
          {opacity:1,transform:'translate(-50%,-50%) scale(1.7)',offset:.16},
          {opacity:.75,transform:'translate(-50%,-50%) scale(2.7)',offset:.42},
          {opacity:0,transform:'translate(-50%,-50%) scale(4.2)'}
        ],{duration:380,easing:'ease-out'}));
        smoke.forEach((p,i)=>shotFx.push(rouletteAnimate(p,[
          {opacity:0,transform:'translate(0,0) scale(.25)'},
          {opacity:.62,transform:`translate(${-18-i*7}px,${-8-i*5}px) scale(${.85+i*.14})`,offset:.24},
          {opacity:0,transform:`translate(${-55-i*18}px,${-32-i*13}px) scale(${1.7+i*.26})`}
        ],{duration:1050+i*170,delay:i*55,easing:'cubic-bezier(.2,.55,.2,1)'})));
        const base=Number.isFinite(rouletteVisualRuntime.currentAngle)?rouletteVisualRuntime.currentAngle:rouletteOpeningFinalAngle(game,st);
        const scale=rouletteMotionScale();
        const recoilMotion=rouletteAnimate(motion,[
          {transform:rouletteMotionTransform(base,scale)},
          {transform:rouletteMotionTransform(base+10,scale*1.035,'calc(-50% + 20px)','calc(-50% + 7px)'),offset:.2},
          {transform:rouletteMotionTransform(base-2,scale,'calc(-50% - 5px)','calc(-50% - 2px)'),offset:.55},
          {transform:rouletteMotionTransform(base,scale)}
        ],{duration:560,easing:'cubic-bezier(.16,.85,.2,1)'});
        await Promise.all([liveRoot._rrHammerMotion||Promise.resolve(),recoilMotion,...shotFx]);
      }else{
        rouletteBlankSound();navigator.vibrate?.(30);
        const current=getComputedStyle(motion).transform==='none'?rouletteMotionBase():motion.style.transform||rouletteMotionBase();
        await Promise.all([liveRoot._rrHammerMotion||Promise.resolve(),rouletteAnimate(motion,[
          {transform:current},
          {transform:`${current} translateX(-3px)`,offset:.42},
          {transform:current}
        ],{duration:165,easing:'ease-out'})]);
      }
      delete liveRoot._rrHammerMotion;
      if(hammer){hammer.style.opacity='1';hammer.style.transform='rotate(0deg)'}
      if(cover)cover.style.opacity='0';
      await rouletteWait(live?420:120);
      liveRoot.classList.remove('rr-animation-lock');
    }
// SITE_FRAGMENT_END: rouletteShotSequence_272172

// SITE_FRAGMENT_START: rouletteHandleEffects_276161
function rouletteHandleEffects(game){
      const st=game?.rouletteState||{},gameId=String(game?.gameId||'');
      const acceptedStamp=rouletteAcceptedSnapshotByGame.get(gameId);
      const incomingStamp=rouletteSnapshotStamp(game);
      if(acceptedStamp&&(incomingStamp.gameRevision<acceptedStamp.gameRevision||
        (incomingStamp.gameRevision===acceptedStamp.gameRevision&&incomingStamp.rouletteRevision<acceptedStamp.rouletteRevision))){
        rouletteDebug('blocked stale visual snapshot',{incoming:incomingStamp,accepted:acceptedStamp});
        return;
      }
      if(!gameId)return;
      if(rouletteVisualRuntime.gameId!==gameId)rouletteResetVisualRuntime(gameId);
      const root=duelActive?.querySelector(`[data-roulette-game][data-game-id="${CSS.escape(gameId)}"]`);
      if(!root)return;
      try{if(localStorage.getItem(`rouletteOpeningDone:${gameId}`)==='1')rouletteOpeningCompletedGames.add(gameId)}catch(_){}
      if(rouletteOpeningCompletedGames.has(gameId))rouletteVisualRuntime.openingDone=true;
      if(!rouletteVisualRuntime.openingDone&&rouletteEnsureClientCountdown(game))return;
      if(rouletteVisualRuntime.openingDone&&!rouletteVisualRuntime.angleHydrated&&st.turnId){
        const hydratedTurnId=String(st.turnId||'');
        const hydratedAngle=rouletteAngleForPlayer(game,hydratedTurnId);
        rouletteVisualRuntime.currentAngle=hydratedAngle;
        rouletteVisualRuntime.angleHydrated=true;
        rouletteVisualRuntime.lastTurnId=hydratedTurnId;
        rouletteVisualRuntime.displayTurnId=hydratedTurnId;
        const mountedMotion=root.querySelector('[data-roulette-motion]');
        if(mountedMotion){mountedMotion.getAnimations?.().forEach(a=>a.cancel());mountedMotion.style.transform=rouletteMotionTransform(hydratedAngle,rouletteMotionScale())}
        // A mounted historical snapshot is state, not a new animation command.
        if(st.lastAction)rouletteVisualRuntime.processed.add(`${gameId}:${st.revision}:${st.lastAction}:${st.lastOutcome}`);
      }
      if(!rouletteVisualRuntime.openingDone&&!rouletteOpeningCanStart(game)){
        const motion=root.querySelector('[data-roulette-motion]');
        if(motion){motion.getAnimations?.().forEach(a=>a.cancel());motion.style.transform=rouletteMotionTransform(-4,rouletteMotionScale())}
        rouletteVisualRuntime.currentAngle=-4;rouletteVisualRuntime.lastTurnId='';rouletteVisualRuntime.displayTurnId='';rouletteVisualRuntime.rotationTargetId='';
        return;
      }
      if(!rouletteVisualRuntime.openingDone&&rouletteOpeningCanStart(game)){
        if(!rouletteVisualRuntime.openingPending){
          rouletteVisualRuntime.openingPending=true;
          rouletteQueueVisual(async()=>{
            try{
              await rouletteOpeningSequence(game,st,gameId);
              if(rouletteVisualRuntime.gameId!==gameId)return;
              rouletteOpeningCompletedGames.add(gameId);
              try{localStorage.setItem(`rouletteOpeningDone:${gameId}`,'1')}catch(_){}
              rouletteVisualRuntime.openingDone=true;
              const newest=rouletteLatestGame||game;
              const newestState=newest?.rouletteState||st;
              const openingWinnerId=String(st?.openingSpinWinnerId||st?.turnId||'');
              const authoritativeTurnId=String(newestState?.turnId||openingWinnerId);
              const settledTurnId=window.RouletteTurnLock?.lock?.turnId||openingWinnerId;
              const settledAngle=rouletteAngleForPlayer(newest,settledTurnId);
              rouletteVisualRuntime.currentAngle=settledAngle;
              rouletteVisualRuntime.angleHydrated=true;
              rouletteVisualRuntime.lastTurnId=settledTurnId;
              rouletteVisualRuntime.displayTurnId=settledTurnId;
              rouletteVisualRuntime.rotationTargetId='';
              // Re-render only the text and controls. rouletteHtml reads the
              // runtime-owned angle, so this render cannot flip the gun.
              duelLastRenderKey='';
              duelRenderActive(newest,true);
              requestAnimationFrame(()=>{
                const settledRoot=duelActive?.querySelector(`[data-roulette-game][data-game-id="${CSS.escape(gameId)}"]`);
                const settledMotion=settledRoot?.querySelector('[data-roulette-motion]');
                if(settledMotion){
                  settledMotion.getAnimations?.().forEach(a=>a.cancel());
                  settledMotion.style.transform=rouletteMotionTransform(settledAngle,rouletteMotionScale());
                }
              });
            }catch(e){
              rouletteVisualRuntime.openingDone=false;
              rouletteDebug('opening sequence failed',{message:String(e?.message||e)});
            }finally{
              if(rouletteVisualRuntime.gameId===gameId)rouletteVisualRuntime.openingPending=false;
            }
          });
        }
        return;
      }
      const incomingTurnId=String(st.turnId||'');
      const turnChanged=rouletteVisualRuntime.openingDone&&incomingTurnId&&rouletteVisualRuntime.lastTurnId!==incomingTurnId;
      const effectKey=`${gameId}:${st.revision}:${st.lastAction}:${st.lastOutcome}`;
      const effectIsNew=Boolean(st.lastAction)&&!rouletteVisualRuntime.processed.has(effectKey);

      // Effects may animate internal gun parts, but they never own direction.
      // Direction changes are scheduled solely from a real turnId transition.
      if(effectIsNew&&st.lastAction==='shoot'){
        rouletteVisualRuntime.processed.add(effectKey);
        // Shot visuals own recoil and hammer movement only. The authoritative
        // facing guard observes any real turn change after the shot completes.
        rouletteQueueVisual(()=>rouletteShotSequence(game,st,gameId));
        return;
      }

      // Direction changes are owned exclusively by turn-facing-guard.js.
      // Pass, shoot, polling, and rerenders only publish authoritative state.

      if(!effectIsNew)return;
      rouletteVisualRuntime.processed.add(effectKey);
      if(st.lastAction==='spin'){
        rouletteQueueVisual(async()=>{
          const liveRoot=duelActive?.querySelector(`[data-roulette-game][data-game-id="${CSS.escape(gameId)}"]`);
          if(!liveRoot)return;
          // Cylinder spin feedback only. The revolver direction is untouched.
          liveRoot.classList.add('rr-animation-lock');rouletteSpinSound();await window.RouletteArsenal?.spin?.(liveRoot);liveRoot.classList.remove('rr-animation-lock');
        });
      }
    }
// SITE_FRAGMENT_END: rouletteHandleEffects_276161

// SITE_FRAGMENT_START: rouletteAct_282441
async function rouletteAct(choice,event){
      if(event){event.preventDefault();event.stopPropagation();}
      const now=Date.now();
      // Mobile browsers can dispatch a delayed synthetic click after the Spin
      // control is replaced by Shoot in the same screen position. Reject that
      // handoff click so spinning can never fire the gun automatically.
      if(choice==='roulette:shoot'&&now<rouletteInputLockUntil){
        rouletteDebug('blocked post-spin ghost shoot',{remainingMs:rouletteInputLockUntil-now});
        return;
      }
      if(rouletteActionPending||!duelCurrentGameId)return;
      // Reject rapid repeat taps while the previous trigger/hammer animation is
      // still settling. This applies to every roulette action, not only Spin.
      if(now<rouletteInputLockUntil){
        rouletteDebug('blocked rapid roulette input',{choice,remainingMs:rouletteInputLockUntil-now});
        return;
      }
      rouletteInputLockUntil=now+(choice==='roulette:shoot'?900:650);
      const st=rouletteLatestGame?.rouletteState||{};
      const spinButton=duelActive?.querySelector('[data-roulette-spin]');
      const previousSpinHtml=spinButton?.innerHTML||'';
      if(choice==='roulette:spin'){
        rouletteInputLockUntil=now+1400;
        // Update the visible counter immediately on the first tap. The server
        // remains authoritative, but the UI must not wait for a later poll or
        // scene remount to show that the one-use spin has been consumed.
        if(spinButton){
          spinButton.disabled=true;
          spinButton.innerHTML='<b>SPIN ×0</b><small>USED</small>';
          spinButton.dataset.optimisticSpin='1';
        }
      }
      rouletteActionPending=true;
      try{
        document.querySelectorAll('.rr-btn').forEach(b=>b.disabled=true);
        const data=await duelRequest('act',{gameId:duelCurrentGameId,choice,actionId:`rr-${Date.now()}-${Math.random().toString(36).slice(2)}`,expectedRevision:Number(st.revision||0),expectedTurnId:String(st.turnId||'')});
        if(data?.ignoredAction)rouletteDebug('server ignored stale duplicate action',{choice,reason:data.ignoreReason||'stale'});
        const returnedGame=data?.game;
        const accepted=rouletteAcceptSnapshot(returnedGame);
        if(returnedGame&&String(returnedGame.gameId||'')===String(duelCurrentGameId||'')){
          // A delayed action response may be older than a poll already accepted.
          // Never remount that rejected snapshot: doing so replayed effects and
          // pointed the gun at an obsolete turn. Rebuild controls from the newest
          // authoritative snapshot instead.
          const authoritativeGame=accepted
            ? returnedGame
            : ((rouletteLatestGame&&String(rouletteLatestGame.gameId||'')===String(duelCurrentGameId||''))
              ? rouletteLatestGame
              : ((duelLastActiveGame&&String(duelLastActiveGame.gameId||'')===String(duelCurrentGameId||''))?duelLastActiveGame:null));
          if(authoritativeGame){
            rouletteLatestGame=authoritativeGame;duelLastActiveGame=authoritativeGame;
            duelLastRenderKey='';
            const lockedRoot=duelActive?.querySelector('[data-roulette-game]');
            if(lockedRoot)lockedRoot.dataset.revision='-999999';
            duelRenderActive(authoritativeGame,true);
            const confirmedSpin=duelActive?.querySelector('[data-roulette-spin]');
            if(choice==='roulette:spin'&&confirmedSpin&&rouletteSpinWasUsed(authoritativeGame)){
              confirmedSpin.innerHTML='<b>SPIN ×0</b><small>USED</small>';
              confirmedSpin.disabled=true;delete confirmedSpin.dataset.optimisticSpin;
            }
          }
          if(!accepted)rouletteDebug('rejected stale action snapshot; restored newest accepted state',{choice,returnedRevision:returnedGame?.rouletteState?.revision,acceptedRevision:authoritativeGame?.rouletteState?.revision});
        }
      }catch(e){
        if(choice==='roulette:spin'){
          rouletteInputLockUntil=0;
          const rollbackSpin=duelActive?.querySelector('[data-roulette-spin]');
          if(rollbackSpin&&rollbackSpin.dataset.optimisticSpin==='1'){
            rollbackSpin.innerHTML=previousSpinHtml||'<b>SPIN ×1</b><small>AVAILABLE</small>';
            rollbackSpin.disabled=!(Boolean(st.canSpin)&&!rouletteSpinWasUsed(rouletteLatestGame));
            delete rollbackSpin.dataset.optimisticSpin;
          }
        }
        const message=String(e?.message||'Roulette action failed.');
        const stale=/stale roulette action|turn changed|not your turn/i.test(message);
        if(!stale)duelSetStatus(message,'bad');
        try{
          await duelRefresh(true);
          const latest=rouletteLatestGame||duelLastActiveGame;
          if(latest&&String(latest.gameId||'')===String(duelCurrentGameId||''))duelRenderActive(latest,true);
        }catch(_){
          document.querySelectorAll('.rr-btn').forEach(b=>b.disabled=false);
        }
      }finally{
        rouletteActionPending=false;
        // Final safety net: derive enabled/disabled controls from the latest
        // authoritative state after every request, including ignored duplicates.
        const latest=rouletteLatestGame||duelLastActiveGame;
        if(latest&&latest.mode==='roulette'&&String(latest.gameId||'')===String(duelCurrentGameId||'')){
          setTimeout(()=>{if(!rouletteActionPending){
            duelLastRenderKey='';
            const lockedRoot=duelActive?.querySelector('[data-roulette-game]');
            if(lockedRoot)lockedRoot.dataset.revision='-999999';
            duelRenderActive(rouletteLatestGame||latest,true);
          }},40);
        }
      }
    }
// SITE_FRAGMENT_END: rouletteAct_282441

// SITE_FRAGMENT_START: rouletteAudioCtx_288150
function rouletteAudioCtx(){const ctx=getAudioContext?.();if(ctx&&ctx.state==='suspended')ctx.resume().catch(()=>{});return ctx}
// SITE_FRAGMENT_END: rouletteAudioCtx_288150

// SITE_FRAGMENT_START: rouletteClickTone_288283
function rouletteClickTone(freq=420,dur=.055,gain=.09){const ctx=rouletteAudioCtx();if(!ctx||!sfxGain||document.hidden)return;const o=ctx.createOscillator(),g=ctx.createGain(),f=ctx.createBiquadFilter();o.type='square';o.frequency.setValueAtTime(freq,ctx.currentTime);f.type='bandpass';f.frequency.value=freq;f.Q.value=2.5;g.gain.setValueAtTime(gain,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+dur);o.connect(f);f.connect(g);g.connect(sfxGain);o.start();o.stop(ctx.currentTime+dur)}
// SITE_FRAGMENT_END: rouletteClickTone_288283

// SITE_FRAGMENT_START: rouletteSpinSound_288801
function rouletteSpinSound(speedMultiplier=1){const ctx=rouletteAudioCtx();if(!ctx||document.hidden)return;let t=0;for(let i=0;i<24;i++){const step=(24+Math.pow(i/23,2)*86)*speedMultiplier;setTimeout(()=>{rouletteClickTone(230+(i%4)*34,.032+(i/23)*.025,.045+(i/23)*.035)},t);t+=step}setTimeout(()=>rouletteClickTone(118,.16,.14),t+35)}
// SITE_FRAGMENT_END: rouletteSpinSound_288801

// SITE_FRAGMENT_START: rouletteShotIndexSound_289141
function rouletteShotIndexSound(){rouletteClickTone(310,.025,.07);setTimeout(()=>rouletteClickTone(235,.035,.085),72);setTimeout(()=>rouletteClickTone(128,.075,.12),145)}
// SITE_FRAGMENT_END: rouletteShotIndexSound_289141

// SITE_FRAGMENT_START: rouletteBlankSound_289316
function rouletteBlankSound(){rouletteClickTone(520,.025,.08);setTimeout(()=>rouletteClickTone(142,.105,.18),32);setTimeout(()=>rouletteClickTone(88,.09,.08),105)}
// SITE_FRAGMENT_END: rouletteBlankSound_289316

// SITE_FRAGMENT_START: rouletteGunshotSound_289484
function rouletteGunshotSound(){try{const a=new Audio(`assets/gunshot_punchy_${1+Math.floor(Math.random()*4)}.wav`);a.volume=.82;a.play().catch(()=>rouletteExplosionSound())}catch(_){rouletteExplosionSound()}}
// SITE_FRAGMENT_END: rouletteGunshotSound_289484

// SITE_FRAGMENT_START: rouletteTone_289698
function rouletteTone(){rouletteClickTone(360,.06,.07)}
// SITE_FRAGMENT_END: rouletteTone_289698

// SITE_FRAGMENT_START: rouletteExplosionSound_289758
function rouletteExplosionSound(){const ctx=rouletteAudioCtx();if(!ctx||!sfxGain||document.hidden)return;const len=Math.floor(ctx.sampleRate*.6),buf=ctx.createBuffer(1,len,ctx.sampleRate),d=buf.getChannelData(0);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,3);const src=ctx.createBufferSource(),g=ctx.createGain(),f=ctx.createBiquadFilter();src.buffer=buf;f.type='lowpass';f.frequency.setValueAtTime(3200,ctx.currentTime);f.frequency.exponentialRampToValueAtTime(180,ctx.currentTime+.55);g.gain.setValueAtTime(.7,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.6);src.connect(f);f.connect(g);g.connect(sfxGain);src.start()}
// SITE_FRAGMENT_END: rouletteExplosionSound_289758
