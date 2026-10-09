// SITE_FRAGMENT_START: duelFishingClearAudioTimeouts_197953
function duelFishingClearAudioTimeouts(){
      for(const id of duelFishingAudioTimeouts) clearTimeout(id);
      duelFishingAudioTimeouts.clear();
    }
// SITE_FRAGMENT_END: duelFishingClearAudioTimeouts_197953

// SITE_FRAGMENT_START: duelFishingScheduleAudio_198111
function duelFishingScheduleAudio(fn, delay){
      const epoch=duelFishingAudioEpoch;
      const id=setTimeout(()=>{
        duelFishingAudioTimeouts.delete(id);
        if(epoch!==duelFishingAudioEpoch)return;
        fn();
      },delay);
      duelFishingAudioTimeouts.add(id);
      return id;
    }
// SITE_FRAGMENT_END: duelFishingScheduleAudio_198111

// SITE_FRAGMENT_START: duelFishingNoiseBuffer_202171
function duelFishingNoiseBuffer(duration = 0.5) {
      const ctx = getAudioContext();
      if (!ctx) return null;
      const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let smooth = 0;
      for (let i = 0; i < length; i += 1) {
        smooth = smooth * 0.58 + (Math.random() * 2 - 1) * 0.42;
        data[i] = smooth;
      }
      return buffer;
    }
// SITE_FRAGMENT_END: duelFishingNoiseBuffer_202171

// SITE_FRAGMENT_START: duelFishingStartOcean_202668
function duelFishingStartOcean() {
      const ctx = getAudioContext();
      if (!ctx || !musicGain || !musicEnabled || document.hidden || duelFishingOceanNodes) return;
      const source = ctx.createBufferSource();
      const buffer = duelFishingNoiseBuffer(4.8);
      if (!buffer) return;
      source.buffer = buffer;
      source.loop = true;
      const low = ctx.createBiquadFilter();
      low.type = "lowpass";
      low.frequency.value = 2400;
      low.Q.value = 0.18;
      const high = ctx.createBiquadFilter();
      high.type = "highpass";
      high.frequency.value = 45;
      const gain = ctx.createGain();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.type = "sine";
      lfo.frequency.value = 0.13;
      lfoGain.gain.value = 0.010;
      gain.gain.value = 0.030;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      source.connect(low);
      low.connect(high);
      high.connect(gain);
      gain.connect(musicGain);
      source.start();
      lfo.start();
      duelFishingOceanNodes = { source, lfo, gain };
    }
// SITE_FRAGMENT_END: duelFishingStartOcean_202668

// SITE_FRAGMENT_START: duelFishingStopOcean_203778
function duelFishingStopOcean(immediate=false) {
      const nodes = duelFishingOceanNodes;
      duelFishingOceanNodes = null;
      if (!nodes) return;
      const ctx=getAudioContext();
      const finish=()=>{
        try { nodes.source.stop(); } catch {}
        try { nodes.lfo.stop(); } catch {}
        try { nodes.source.disconnect(); nodes.lfo.disconnect(); nodes.gain.disconnect(); } catch {}
      };
      if(!immediate&&ctx&&nodes.gain){
        try{
          const now=ctx.currentTime;
          nodes.gain.gain.cancelScheduledValues(now);
          nodes.gain.gain.setValueAtTime(Math.max(.0001,nodes.gain.gain.value||.03),now);
          nodes.gain.gain.exponentialRampToValueAtTime(.0001,now+.32);
          setTimeout(finish,380);
          return;
        }catch{}
      }
      finish();
    }
// SITE_FRAGMENT_END: duelFishingStopOcean_203778

// SITE_FRAGMENT_START: duelFishingPlayNoise_204599
function duelFishingPlayNoise(duration, volume, lowpass, highpass = 40, pan = 0) {
      const ctx = getAudioContext();
      if (!ctx || !sfxGain || !sfxEnabled || document.hidden) return;
      const source = ctx.createBufferSource();
      const buffer = duelFishingNoiseBuffer(duration);
      if (!buffer) return;
      source.buffer = buffer;
      const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = highpass;
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = lowpass;
      const gain = ctx.createGain();
      const start = ctx.currentTime + 0.003;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(volume, start + Math.min(0.025, duration * 0.15));
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      source.connect(hp); hp.connect(lp); lp.connect(gain);
      if (ctx.createStereoPanner) { const panner = ctx.createStereoPanner(); panner.pan.value = Math.max(-1, Math.min(1, pan)); gain.connect(panner); panner.connect(sfxGain); }
      else gain.connect(sfxGain);
      source.start(start); source.stop(start + duration + 0.03);
    }
// SITE_FRAGMENT_END: duelFishingPlayNoise_204599

// SITE_FRAGMENT_START: duelFishingRippleRumble_205778
function duelFishingRippleRumble(active) {
      if(!active||!navigator.vibrate)return;
      const ripple=Math.max(28,Math.min(92,Number(active.ripple||48)));
      const strength=(ripple-28)/64;
      const first=Math.round(16+strength*42);
      const second=Math.round(22+strength*70);
      const gap=Math.round(55-strength*18);
      navigator.vibrate(strength>.72?[first,gap,second]:strength>.38?[first,46,Math.round(second*.62)]:[first]);
    }
// SITE_FRAGMENT_END: duelFishingRippleRumble_205778

// SITE_FRAGMENT_START: duelFishingPlayRipple_206236
function duelFishingPlayRipple() {
      const ctx=getAudioContext(); if(!ctx||!sfxGain||document.hidden)return;
      const t=ctx.currentTime+0.004;
      scheduleTone(185,t,.11,"sine",sfxGain,.025,{attack:.004,release:.09,sustain:.22,filterFrequency:650});
      scheduleTone(305,t+.025,.09,"sine",sfxGain,.014,{attack:.003,release:.07,sustain:.18,filterFrequency:950});
      duelFishingPlayNoise(.13,.025,1300,180,0);
    }
// SITE_FRAGMENT_END: duelFishingPlayRipple_206236

// SITE_FRAGMENT_START: duelFishingPlayBite_206668
function duelFishingPlayBite() {
      const ctx=getAudioContext(); if(!ctx||!sfxGain||document.hidden)return;
      const t=ctx.currentTime+0.003;
      scheduleTone(520,t,.055,"triangle",sfxGain,.035,{attack:.002,release:.045,sustain:.12,filterFrequency:2400});
      scheduleTone(285,t+.035,.10,"sine",sfxGain,.026,{attack:.003,release:.08,sustain:.14,filterFrequency:1100});
    }
// SITE_FRAGMENT_END: duelFishingPlayBite_206668

// SITE_FRAGMENT_START: duelFishingPlaySplash_207057
function duelFishingPlaySplash(side="center") {
      const pan=side==="left"?-.48:side==="right"?.48:0;
      duelFishingPlayNoise(.48,.12,4200,110,pan);
      const ctx=getAudioContext(); if(!ctx||!sfxGain||document.hidden)return;
      const t=ctx.currentTime+.005;
      scheduleTone(118,t,.24,"sine",sfxGain,.040,{attack:.008,release:.20,sustain:.20,filterFrequency:520});
      setTimeout(()=>duelFishingPlayNoise(.18,.055,2500,230,pan),105);
    }
// SITE_FRAGMENT_END: duelFishingPlaySplash_207057

// SITE_FRAGMENT_START: duelFishingPlayFlop_207516
function duelFishingPlayFlop(side="center") {
      const pan=side==="left"?-.38:side==="right"?.38:0;
      duelFishingPlayNoise(.11,.052,1250,85,pan);
      const ctx=getAudioContext(); if(!ctx||!sfxGain||document.hidden)return;
      const t=ctx.currentTime+.003;
      scheduleTone(105,t,.09,"triangle",sfxGain,.030,{attack:.002,release:.075,sustain:.12,filterFrequency:480});
      setTimeout(()=>duelFishingPlayNoise(.08,.035,950,75,pan),145);
    }
// SITE_FRAGMENT_END: duelFishingPlayFlop_207516

// SITE_FRAGMENT_START: duelFishingPlayTick_207976
function duelFishingPlayTick() {
      const ctx=getAudioContext(); if(!ctx||!sfxGain||document.hidden)return;
      scheduleTone(1120,ctx.currentTime+.003,.045,"square",sfxGain,.020,{attack:.001,release:.038,sustain:.08,filterFrequency:3300});
    }
// SITE_FRAGMENT_END: duelFishingPlayTick_207976

// SITE_FRAGMENT_START: duelFishingPlayTimeout_208231
function duelFishingPlayTimeout() {
      const ctx=getAudioContext(); if(!ctx||!sfxGain||document.hidden)return;
      const t=ctx.currentTime+.004;
      scheduleTone(210,t,.34,"sawtooth",sfxGain,.046,{attack:.006,release:.26,sustain:.28,filterFrequency:900});
      scheduleTone(145,t+.22,.42,"triangle",sfxGain,.040,{attack:.006,release:.34,sustain:.22,filterFrequency:620});
    }
// SITE_FRAGMENT_END: duelFishingPlayTimeout_208231

// SITE_FRAGMENT_START: duelFishingPlayResult_208621
function duelFishingPlayResult(game) {
      const ctx=getAudioContext(); if(!ctx||!sfxGain||document.hidden)return;
      const meId=String(localStorage.getItem("tornVisitorUserId")||"");
      const won=Boolean(game?.winnerUserId&&String(game.winnerUserId)===meId);
      const t=ctx.currentTime+.006;
      if(game?.tie){[392,466,392].forEach((f,i)=>scheduleTone(f,t+i*.13,.16,"triangle",sfxGain,.030,{attack:.005,release:.12,sustain:.25,filterFrequency:2200}));return;}
      if(won){[523,659,784,1047].forEach((f,i)=>scheduleTone(f,t+i*.105,.26,"triangle",sfxGain,.034,{attack:.004,release:.18,sustain:.24,filterFrequency:4300}));}
      else{[330,277,220].forEach((f,i)=>scheduleTone(f,t+i*.15,.24,"sine",sfxGain,.030,{attack:.006,release:.18,sustain:.24,filterFrequency:1500}));}
    }
// SITE_FRAGMENT_END: duelFishingPlayResult_208621

// SITE_FRAGMENT_START: duelFishingPlayAmbientDetail_209419
function duelFishingPlayAmbientDetail() {
      const ctx=getAudioContext();
      if(!ctx||!sfxGain||!sfxEnabled||document.hidden)return;
      const t=ctx.currentTime+.01;
      if(Math.random()<.58){
        scheduleTone(1450+Math.random()*420,t,.11,"sine",sfxGain,.006,{attack:.015,release:.09,sustain:.12,filterFrequency:3000});
        scheduleTone(1780+Math.random()*380,t+.10,.10,"sine",sfxGain,.0045,{attack:.012,release:.08,sustain:.1,filterFrequency:3400});
      }else{
        duelFishingPlayNoise(.55,.009,1800,120,Math.random()*.8-.4);
      }
    }
// SITE_FRAGMENT_END: duelFishingPlayAmbientDetail_209419

// SITE_FRAGMENT_START: duelFishingMaybeAmbient_209988
function duelFishingMaybeAmbient() {
      if(Date.now()<duelFishingAmbientNextAt)return;
      duelFishingAmbientNextAt=Date.now()+6500+Math.random()*8500;
      duelFishingPlayAmbientDetail();
    }
// SITE_FRAGMENT_END: duelFishingMaybeAmbient_209988

// SITE_FRAGMENT_START: duelFishingHandleAudio_210194
function duelFishingHandleAudio(game, state, active) {
      const gameId=String(game?.gameId||"");
      if(duelFishingAudioState.gameId!==gameId){
        duelFishingAudioState={gameId,seenRippleIds:new Set(),creatorCatchId:"",joinerCatchId:"",resultKey:"",lastSecond:null,timedOut:false};
      }
      if(game?.status==="playing") { duelFishingStartOcean(); duelFishingMaybeAmbient(); }
      const activeId=String(active?.id||"");
      if(activeId&&!duelFishingAudioState.seenRippleIds.has(activeId)){
        duelFishingAudioState.seenRippleIds.add(activeId);
        duelFishingPlayRipple();
        duelFishingRippleRumble(active);
        duelFishingScheduleAudio(duelFishingPlayBite,140);
      }
      for(const [role,c,side] of [["creator",state?.creatorCatch,"left"],["joiner",state?.joinerCatch,"right"]]){
        const key=String(c?.eventId||"");
        const field=role+"CatchId";
        if(key&&key!==duelFishingAudioState[field]){
          duelFishingPlaySplash(side);
          const ctx=getAudioContext();
          if(ctx&&sfxGain&&!document.hidden){
            const t=ctx.currentTime+.08;
            [410,470,535,610].forEach((f,i)=>scheduleTone(f,t+i*.07,.085,"triangle",sfxGain,.012,{attack:.003,release:.065,sustain:.12,filterFrequency:1900}));
          }
          duelFishingScheduleAudio(()=>duelFishingPlayFlop(side),360);
        }
        if(key) duelFishingAudioState[field]=key;
      }
      if(game?.status==="complete"){
        const resultKey=`${gameId}:${game?.winnerUserId||"tie"}:${game?.tie?1:0}`;
        if(resultKey!==duelFishingAudioState.resultKey){duelFishingAudioState.resultKey=resultKey;duelFishingScheduleAudio(()=>duelFishingPlayResult(game),480);}
      }
    }
// SITE_FRAGMENT_END: duelFishingHandleAudio_210194

// SITE_FRAGMENT_START: duelFishingBaseName_211995
function duelFishingBaseName(name){return FISHING_CATALOG.resolve(name).name;}
// SITE_FRAGMENT_END: duelFishingBaseName_211995

// SITE_FRAGMENT_START: duelFishingAssetSlug_212078
function duelFishingAssetSlug(name){return duelFishingBaseName(name).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");}
// SITE_FRAGMENT_END: duelFishingAssetSlug_212078

// SITE_FRAGMENT_START: duelFishingRarityBadge_212385
function duelFishingRarityBadge(value,stamp=false){
      const fish=FISHING_CATALOG.resolve(value),tier=FISHING_CATALOG.tiers.find(t=>t.id===fish.rarity);
      const seal=stamp?'<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><circle cx="16" cy="16" r="14"/><circle class="stamp-ring" cx="16" cy="16" r="11.5"/><path d="m16 7 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"/></svg>':"";
      return `<span class="${stamp?'fishing-log-rare-badge':'fishing-rarity-tag'} ${fish.rarity}" aria-label="${tier.label} fish">${seal}<span>${tier.label}</span></span>`;
    }
// SITE_FRAGMENT_END: duelFishingRarityBadge_212385

// SITE_FRAGMENT_START: duelFishingPerson_213503
function duelFishingPerson(name,side){return "";}
// SITE_FRAGMENT_END: duelFishingPerson_213503

// SITE_FRAGMENT_START: duelFishingSceneSvg_213557
function duelFishingSceneSvg(state){
      return `<img class="fishing-lake-art" src="/assets/fishing/images/v2/approved-preview-clean-v1.png" alt="" aria-hidden="true"><canvas class="fishing-water-canvas" aria-hidden="true"></canvas><div class="fishing-cloud-bank" aria-hidden="true"><img class="cloud-a" src="/assets/fishing/images/v2/clouds-v2.png" alt=""><img class="cloud-b" src="/assets/fishing/images/v2/clouds-v2.png" alt=""><img class="cloud-c" src="/assets/fishing/images/v2/clouds-v2.png" alt=""></div><div class="fishing-scene-art" aria-hidden="true"><div class="fishing-shore-rig left"><div class="fishing-dock left"></div><div class="fishing-angler left"><img src="/assets/fishing/images/v2/fisherman-v2.png" alt=""></div></div><div class="fishing-shore-rig right"><div class="fishing-dock right"></div><div class="fishing-angler right"><img src="/assets/fishing/images/v2/fisherman-blue-transparent-v3.png" alt=""></div></div><svg class="fishing-line-art" viewBox="0 0 1000 430" preserveAspectRatio="none"><path class="fishing-line-svg left" data-line-side="left" d="M270 68 Q380 92 420 286"/><path class="fishing-line-svg right" data-line-side="right" d="M730 68 Q620 92 580 286"/></svg><div class="fishing-hook-node left"><span class="fishing-hook-bobber" aria-hidden="true"></span>${duelFishingCatchSlot(state?.creatorCatch,"left",false,true)}</div><div class="fishing-hook-node right"><span class="fishing-hook-bobber" aria-hidden="true"></span>${duelFishingCatchSlot(state?.joinerCatch,"right",false,true)}</div></div>`;
    }
// SITE_FRAGMENT_END: duelFishingSceneSvg_213557

// SITE_FRAGMENT_START: duelFishingAlignLines_215109
function duelFishingAlignLines(root){
      root?._fishingController?.resize?.();
    }
// SITE_FRAGMENT_END: duelFishingAlignLines_215109

// SITE_FRAGMENT_START: duelFishingCatchSlot_215202
function duelFishingCatchSlot(c,side,animate=false,showCaption=true){
      if(!c)return `<div class="fishing-hook-catch ${side}" data-catch-id=""></div>`;
      // Keep the exact measurement secret throughout live gameplay. Players
      // can judge only the illustrated fish and the ripple that produced it.
      const fish=FISHING_CATALOG.resolve(c); const caption=showCaption?`<div class="fishing-catch-caption"><b>${escapeHtml(fish.name)}</b>${duelFishingRarityBadge(fish)}</div>`:"";
      return `<div class="fishing-hook-catch ${side}" data-catch-id="${escapeHtml(c.eventId||"")}"><div class="fishing-catch-unit${animate?" is-pulling":""}">${duelFishSvg(c.size,c.name,c)}${caption}</div></div>`;
    }
// SITE_FRAGMENT_END: duelFishingCatchSlot_215202

// SITE_FRAGMENT_START: duelFishingStatus_215918
function duelFishingStatus(game,state,active){
      const both=Boolean(state.creatorCatch&&state.joinerCatch),myRole=game.isCreator?"creator":"joiner",winner=game.result?.winnerRole||game.resolved?.winnerRole||"";
      if(game.status==="waiting")return"Waiting for an opponent — add a Remote Bot or another player to start";
      if(game.status==="ready")return"Both players are here — press Ready to begin";
      if(game.status==="countdown")return"Get ready...";
      if(both)return winner?(winner===myRole?"YOU WIN!":"YOU LOST"):"TIE GAME";
      if(state.myCatch)return"Fish secured — opponent is still fishing";
      return"";
    }
// SITE_FRAGMENT_END: duelFishingStatus_215918

// SITE_FRAGMENT_START: duelFishingTipsHtml_217218
function duelFishingTipsHtml(){
      return `<div class="fishing-tip-rotator" aria-label="Fishing tips">${FISHING_TIPS.map((tip,index)=>`<span class="fishing-tip" style="animation-delay:${index*8}s" ${index?'aria-hidden="true"':''}><b>Tip:</b> ${escapeHtml(tip)}</span>`).join("")}</div>`;
    }
// SITE_FRAGMENT_END: duelFishingTipsHtml_217218

// SITE_FRAGMENT_START: duelFishingFormatClock_217519
function duelFishingFormatClock(seconds){
      const safe=Math.max(0,Math.min(60,Math.ceil(Number(seconds)||0)));
      return `${Math.floor(safe/60)}:${String(safe%60).padStart(2,"0")}`;
    }
// SITE_FRAGMENT_END: duelFishingFormatClock_217519

// SITE_FRAGMENT_START: duelFishingClockHtml_217718
function duelFishingClockHtml(seconds,status="waiting"){
      const safe=Math.max(0,Math.min(60,Math.ceil(Number(seconds)||0)));
      const waiting=!['countdown','playing'].includes(String(status||''));
      const value=waiting?'—:—':duelFishingFormatClock(safe);
      const progress=waiting?100:(safe/60)*100;
      return `<div class="fishing-clock${safe<=10&&!waiting?' is-low':''}" data-fishing-clock data-clock-state="${escapeHtml(String(status||'waiting'))}" role="timer" aria-label="Round time remaining"><span class="fishing-clock-label">ROUND TIME</span><strong class="fishing-clock-value" data-fishing-clock-value>${value}</strong><span class="fishing-clock-track" aria-hidden="true"><i data-fishing-clock-progress style="--clock-progress:${progress}%"></i></span></div>`;
    }
// SITE_FRAGMENT_END: duelFishingClockHtml_217718

// SITE_FRAGMENT_START: duelFishingUpdateClock_218515
function duelFishingUpdateClock(root,seconds,status="playing"){
      const clock=root?.querySelector?.('[data-fishing-clock]');if(!clock)return;
      const safe=Math.max(0,Math.min(60,Math.ceil(Number(seconds)||0)));
      const waiting=!['countdown','playing'].includes(String(status||''));
      clock.dataset.clockState=String(status||'waiting');
      clock.classList.toggle('is-low',safe<=10&&!waiting);
      const value=clock.querySelector('[data-fishing-clock-value]');if(value)value.textContent=waiting?'—:—':duelFishingFormatClock(safe);
      const progress=clock.querySelector('[data-fishing-clock-progress]');if(progress)progress.style.setProperty('--clock-progress',`${waiting?100:(safe/60)*100}%`);
      clock.setAttribute('aria-label',waiting?'Round timer waiting to start':`${safe} seconds remaining`);
    }
// SITE_FRAGMENT_END: duelFishingUpdateClock_218515

// SITE_FRAGMENT_START: duelFishingDebugPanel_219348
function duelFishingDebugPanel(game,state,active,seconds){
      const role=game?.isCreator?"creator":"joiner";
      const bot=game?.creator?.isBot||game?.joiner?.isBot;
      return `<details class="fishing-debug-panel"><summary><span>Fishing Debug</span><b data-fishing-debug-health>${game?.status==="playing"?"LIVE":"READY"}</b></summary><div class="fishing-debug-grid"><span>Phase</span><strong data-fishing-debug-status>${escapeHtml(String(game?.status||"idle"))}</strong><span>Timer</span><strong data-fishing-debug-timer>${Number(seconds||0)}s</strong><span>Role</span><strong>${role}</strong><span>Bot</span><strong data-fishing-debug-bot>${bot?"connected":"none"}</strong><span>Ripple</span><strong data-fishing-debug-ripple>${active?escapeHtml(String(active.id||"active")):"waiting"}</strong><span>Your catch</span><strong data-fishing-debug-player>${state?.myCatch?"secured":"available"}</strong><span>Opponent</span><strong data-fishing-debug-catch>${state?.creatorCatch&&state?.joinerCatch?"secured":"waiting"}</strong><span>Last input</span><strong data-fishing-debug-input>none: No input yet</strong><div class="fishing-debug-actions"><button type="button" data-fishing-debug-copy>Copy Debug Report</button></div><p class="fishing-debug-copy-status" data-fishing-debug-copy-status>Copies mechanics, timing, bot, line-anchor, and recent event details.</p></div></details>`;
    }
// SITE_FRAGMENT_END: duelFishingDebugPanel_219348

// SITE_FRAGMENT_START: duelFishingCatchRumble_220747
function duelFishingCatchRumble(catchData){
      if(!catchData||!navigator.vibrate)return;
      const size=Math.max(12,Math.min(100,Number(catchData.measuredSize||catchData.size||12)));
      const strength=(size-12)/88;
      const shortPulse=Math.round(24+strength*66);
      const longPulse=Math.round(45+strength*125);
      const gap=Math.round(58-strength*20);
      const pattern=strength>=.78?[shortPulse,gap,longPulse,gap,longPulse]:strength>=.48?[shortPulse,gap,longPulse]:[shortPulse];
      navigator.vibrate(pattern);
    }
// SITE_FRAGMENT_END: duelFishingCatchRumble_220747

// SITE_FRAGMENT_START: duelFishingRumbleNewCatch_221290
function duelFishingRumbleNewCatch(game,state){
      const gameId=String(game?.gameId||"");
      if(!gameId)return;
      if(duelFishingLastCatchRumble.gameId!==gameId)duelFishingLastCatchRumble={gameId,creator:"",joiner:""};
      for(const [role,c] of [["creator",state?.creatorCatch],["joiner",state?.joinerCatch]]){
        const id=String(c?.eventId||c?.id||"");
        if(!id||duelFishingLastCatchRumble[role]===id)continue;
        duelFishingLastCatchRumble[role]=id;
        duelFishingCatchRumble(c);
      }
    }
// SITE_FRAGMENT_END: duelFishingRumbleNewCatch_221290

// SITE_FRAGMENT_START: duelFishingTick_221822
function duelFishingTick(){
      const g=duelFishingLatestGame;if(!g||g.mode!=="fishing")return;
      const s=duelFishingStableState(g),active=g.status==="playing"?duelFishingActiveEvent(s):null;
      const seconds=g.status==="playing"?Math.min(60,Math.max(0,Math.ceil(duelFishingRemainingMs(s)/1000))):60;
      const fishingRoot=duelActive?.querySelector("[data-fishing-game]");
      duelFishingUpdateClock(fishingRoot,seconds,g.status);
      const debugTimer=duelActive?.querySelector("[data-fishing-debug-timer]");if(debugTimer)debugTimer.textContent=`${seconds}s`;
      fishingRoot?._fishingController?.setTimer?.(seconds);
      fishingRoot?._fishingController?.setRipple?.(active?.id||"");
      if(g.status==="countdown")duelFishingPatchDom(g);
      const id=duelActive?.querySelector("[data-fishing-water]")?.dataset.fishId||"";if((active?.id||"")!==id)duelFishingPatchDom(g);
      // Presentation audio must never prevent the clock or bite window updating.
      try{
        if(g.status==="playing"){
          const ctx=getAudioContext();
          if(ctx&&ctx.state==="suspended"&&!document.hidden)ctx.resume().catch(()=>{});
          duelFishingStartOcean();
        }
        if(g.status==="playing"&&seconds<=10&&seconds>0&&seconds!==duelFishingAudioState.lastSecond)duelFishingPlayTick();
        if(g.status==="playing"&&seconds===0&&!duelFishingAudioState.timedOut){duelFishingAudioState.timedOut=true;duelFishingPlayTimeout();}
        duelFishingAudioState.lastSecond=seconds;
        duelFishingHandleAudio(g,s,active);
        duelFishingRumbleNewCatch(g,s);
      }catch(error){if(fishingRoot&&!fishingRoot.dataset.audioError){fishingRoot.dataset.audioError="1";console.warn("Fishing audio unavailable; gameplay continues",error);}}
    }
// SITE_FRAGMENT_END: duelFishingTick_221822

// SITE_FRAGMENT_START: duelFishingBeginOptimisticPull_223598
function duelFishingBeginOptimisticPull(water, game, active){
      if(!water||!game||!active)return null;
      const side=game.isCreator?"left":"right";
      const marker=document.createElement("div");
      marker.className=`fishing-pull-preview ${side}`;
      marker.dataset.pendingEvent=String(active.id||"");
      marker.setAttribute('aria-hidden','true');
      marker.style.setProperty('--ripple',`${Number(active.ripple||58)}px`);
      marker.innerHTML='<span class="pull-splash"></span>';
      water.appendChild(marker);
      // Let the water ring finish even if the server acknowledges the catch early.
      setTimeout(()=>marker.remove(),720);
      water.classList.add(side==="left"?"pull-left":"pull-right");
      const pullStarted=performance.now(),root=water.closest("[data-fishing-game]");
      const trackPull=()=>{duelFishingAlignLines(root);if(performance.now()-pullStarted<1180)requestAnimationFrame(trackPull);};
      requestAnimationFrame(trackPull);
      duelFishingPlaySplash(side);
      duelFishingScheduleAudio(()=>duelFishingPlayFlop(side),300);
      return {side,eventId:String(active.id||""),marker};
    }
// SITE_FRAGMENT_END: duelFishingBeginOptimisticPull_223598

// SITE_FRAGMENT_START: duelFishingClearOptimisticPull_224753
function duelFishingClearOptimisticPull(water, pending){
      if(!water||!pending)return;
      water.classList.remove("pull-left","pull-right");
    }
// SITE_FRAGMENT_END: duelFishingClearOptimisticPull_224753

// SITE_FRAGMENT_START: duelFishingEnsureController_224911
function duelFishingEnsureController(root){
      if(window.FishingSceneController||window.__fishingControllerLoading)return;
      window.__fishingControllerLoading=true;
      const script=document.createElement("script");
      script.src="/assets/fishing/fishing-controller.js?v=fishing-mechanics-v31&runtime=1";
      script.onload=()=>{window.__fishingControllerLoading=false;if(root?.isConnected)duelBindFishing(root);};
      script.onerror=()=>{window.__fishingControllerLoading=false;console.error("Fishing controller failed to load");};
      document.head.appendChild(script);
    }
// SITE_FRAGMENT_END: duelFishingEnsureController_224911

// SITE_FRAGMENT_START: duelFishingStopCompletionTicker_296100
function duelFishingStopCompletionTicker(){
      if(duelFishingCompleteUi.ticker){clearInterval(duelFishingCompleteUi.ticker);duelFishingCompleteUi.ticker=0;}
    }
// SITE_FRAGMENT_END: duelFishingStopCompletionTicker_296100

// SITE_FRAGMENT_START: duelFishingCompletionElapsed_296270
function duelFishingCompletionElapsed(game){
      const id=String(game?.gameId||"");
      if(!id)return 999999;
      if(duelFishingCompleteUi.gameId!==id){
        duelFishingStopCompletionTicker();
        duelFishingCompleteUi={gameId:id,firstSeen:Date.now(),firstSeenPerf:(window.performance?.now?.()||0),resultSoundPlayed:false,ticker:0};
      }
      const perfNow=window.performance?.now?.()||0;
      const perfElapsed=duelFishingCompleteUi.firstSeenPerf&&perfNow>=duelFishingCompleteUi.firstSeenPerf?perfNow-duelFishingCompleteUi.firstSeenPerf:0;
      const wallElapsed=Math.max(0,Date.now()-duelFishingCompleteUi.firstSeen);
      return Math.max(perfElapsed,wallElapsed);
    }
// SITE_FRAGMENT_END: duelFishingCompletionElapsed_296270

// SITE_FRAGMENT_START: duelFishingEnsureCompletionTicker_296967
function duelFishingEnsureCompletionTicker(game){
      if(!game||game.mode!=="fishing"||game.status!=="complete")return;
      duelFishingCompletionElapsed(game);
      if(duelFishingCompleteUi.ticker)return;
      duelFishingCompleteUi.ticker=setInterval(()=>{
        const latest=duelFishingLatestGame;
        if(!latest||latest.mode!=="fishing"||latest.status!=="complete"||String(latest.gameId||"")!==duelFishingCompleteUi.gameId){duelFishingStopCompletionTicker();return;}
        duelFishingPatchDom(latest);
        if(duelFishingComparisonPhase(latest)==="result")duelFishingStopCompletionTicker();
      },200);
    }
// SITE_FRAGMENT_END: duelFishingEnsureCompletionTicker_296967

// SITE_FRAGMENT_START: duelFishingResultPortal_297601
function duelFishingResultPortal(){
      let portal=document.getElementById('fishingResultPortal');
      if(!portal){portal=document.createElement('div');portal.id='fishingResultPortal';portal.hidden=true;document.body.appendChild(portal);}
      return portal;
    }
// SITE_FRAGMENT_END: duelFishingResultPortal_297601

// SITE_FRAGMENT_START: duelFishingHideResultPortal_297875
function duelFishingHideResultPortal(){
      const portal=document.getElementById('fishingResultPortal');
      if(portal){portal.hidden=true;portal.innerHTML='';}
      document.body.classList.remove('fishing-result-open');
    }
// SITE_FRAGMENT_END: duelFishingHideResultPortal_297875

// SITE_FRAGMENT_START: duelFishingShowResultPortal_298111
function duelFishingShowResultPortal(game,html){
      if(!html)return null;
      const portal=duelFishingResultPortal();
      if(!portal.querySelector('[data-fishing-result]'))portal.innerHTML=html;
      portal.hidden=false;
      document.body.classList.add('fishing-result-open');
      document.querySelectorAll('.result-pop,.duel-big-result').forEach(node=>node.remove());
      duelBindFishingLogbookPreview(portal);
      duelBindResultButtons(game);
      duelScheduleCompletedCloseButton(game);
      return portal.querySelector('[data-fishing-result]');
    }
// SITE_FRAGMENT_END: duelFishingShowResultPortal_298111

// SITE_FRAGMENT_START: duelFishingPlayerAvatar_298688
function duelFishingPlayerAvatar(player){
      return player?.avatarUrl?`<img class="fishing-compare-avatar" src="${escapeHtml(player.avatarUrl)}" alt="">`:`<div class="fishing-compare-avatar" style="display:grid;place-items:center">🎣</div>`;
    }
// SITE_FRAGMENT_END: duelFishingPlayerAvatar_298688

// SITE_FRAGMENT_START: duelFishingPlayerChip_298943
function duelFishingPlayerChip(player,label){
      const name=escapeHtml(String(player?.name||label||"Angler"));
      const initial=escapeHtml(String(player?.profileInitial||player?.name||"?").trim().slice(0,1).toUpperCase());
      const avatar=player?.avatarUrl
        ? `<img class="fishing-player-chip-avatar" src="${escapeHtml(player.avatarUrl)}" alt="">`
        : `<span class="fishing-player-chip-avatar fishing-player-chip-fallback">${initial}</span>`;
      return `<div class="fishing-player-chip">${avatar}<span><small>${escapeHtml(label)}</small><b>${name}</b></span></div>`;
    }
// SITE_FRAGMENT_END: duelFishingPlayerChip_298943

// SITE_FRAGMENT_START: duelFishingComparisonPhase_299545
function duelFishingComparisonPhase(game){
      const elapsed=duelFishingCompletionElapsed(game);
      if(elapsed<2200)return "compare";
      if(elapsed<5600)return "measuring";
      if(elapsed<6800)return "revealed";
      return "result";
    }
// SITE_FRAGMENT_END: duelFishingComparisonPhase_299545

// SITE_FRAGMENT_START: duelFishingComparisonOverlay_299800
function duelFishingComparisonOverlay(game){
      if(!game||game.mode!=="fishing"||game.status!=="complete")return"";
      const phase=duelFishingComparisonPhase(game);
      if(phase==="compare"||phase==="result")return"";
      const state=duelFishingStableState(game)||game.fishingState||{};
      const c=state.creatorCatch,j=state.joinerCatch;
      const winnerRole=game.result?.winnerRole||game.resolved?.winnerRole||"";
      const revealed=phase==="revealed";
      const leftWin=revealed&&winnerRole==="creator",rightWin=revealed&&winnerRole==="joiner";
      const leftSize=revealed?(c?Number(c.size||0)+" cm":"—"):"???";
      const rightSize=revealed?(j?Number(j.size||0)+" cm":"—"):"???";
      const title=phase==="compare"?"COMPARE THE CATCHES":phase==="measuring"?"MEASURING THE FISH...":"FINAL MEASUREMENTS";
      const sub=phase==="compare"?"Take a good look before the ruler comes out":phase==="measuring"?"The exact sizes are still hidden":"The larger catch takes it";
      const ruler=phase==="compare"?"":`<div class="fishing-compare-ruler" aria-hidden="true"><div class="fishing-compare-fill"></div><div class="fishing-ruler-labels"><span>0</span><span>25</span><span>50</span><span>75</span><span>100 cm</span></div></div>`;
      return `<div class="fishing-comparison-overlay ${phase}" data-fishing-comparison="1" data-comparison-phase="${phase}"><div class="fishing-comparison-title">${title}</div><div class="fishing-comparison-sub">${sub}</div><div class="fishing-comparison-fish"><div class="fishing-compare-side left ${leftWin?"winner":"pending-winner"}">${duelFishingPlayerAvatar(game.creator)}<div class="fishing-compare-art">${c?duelFishSvg(c.size,c.name,c):""}</div><div class="fishing-compare-name">${escapeHtml(c?FISHING_CATALOG.resolve(c).name:"No fish")}</div>${c?duelFishingRarityBadge(c):""}<div class="fishing-compare-size ${revealed?"":"concealed"}">${leftSize}</div></div><div class="fishing-compare-vs">VS</div><div class="fishing-compare-side right ${rightWin?"winner":"pending-winner"}">${duelFishingPlayerAvatar(game.joiner)}<div class="fishing-compare-art">${j?duelFishSvg(j.size,j.name,j):""}</div><div class="fishing-compare-name">${escapeHtml(j?FISHING_CATALOG.resolve(j).name:"No fish")}</div>${j?duelFishingRarityBadge(j):""}<div class="fishing-compare-size ${revealed?"":"concealed"}">${rightSize}</div></div></div>${ruler}</div>`;
    }
// SITE_FRAGMENT_END: duelFishingComparisonOverlay_299800

// SITE_FRAGMENT_START: duelFishingPreviewVariant_302203
function duelFishingPreviewVariant(speciesName){
      return FISHING_CATALOG.resolve(speciesName).variant;
    }
// SITE_FRAGMENT_END: duelFishingPreviewVariant_302203

// SITE_FRAGMENT_START: duelFishingIsRareFish_302321
function duelFishingIsRareFish(variant="standard",rarity="regular"){
      return FISHING_CATALOG.resolve({variant}).special;
    }
// SITE_FRAGMENT_END: duelFishingIsRareFish_302321

// SITE_FRAGMENT_START: duelFishingCanAcceptRematch_302457
function duelFishingCanAcceptRematch(game,now=Date.now()){
      const offer=game?.rematch||{},requested=offer.requestedBy||{};
      const expires=Date.parse(String(offer.expiresAt||""));
      return Boolean(game?.mode==="fishing"&&game.status==="complete"&&game.remoteNetworkTest&&game.joiner?.isRemoteBot&&!game.rematchGameId&&requested[game.creator?.userId]&&!requested[game.joiner?.userId]&&Number.isFinite(expires)&&expires>now);
    }
// SITE_FRAGMENT_END: duelFishingCanAcceptRematch_302457

// SITE_FRAGMENT_START: duelFishingRareBadge_302904
function duelFishingRareBadge(variant="standard",rarity="regular"){
      return duelFishingIsRareFish(variant,rarity)?duelFishingRarityBadge({variant},true):"";
    }
// SITE_FRAGMENT_END: duelFishingRareBadge_302904

// SITE_FRAGMENT_START: duelFishingLogbookHtml_303736
function duelFishingLogbookHtml(logbook, newSpecies=false) {
      const book=logbook&&typeof logbook==="object"?logbook:{};
      const caught=FISHING_CATALOG.records(book),discovered=caught.size;
      const totalCaught=Math.max(0,Number(book.totalCaught||0)),rareCaught=Math.max(0,Number(book.rareCaught||0));
      const speciesHtml=FISHING_CATALOG.tiers.map(tier=>{
        const rows=FISHING_CATALOG.ordered.filter(f=>f.rarity===tier.id).map(fish=>{
          const entry=caught.get(fish.name),name=escapeHtml(fish.name);
          const picture=duelFishSvg(entry?.bestSize||48,fish.name,fish);
          const badge=duelFishingRarityBadge(fish,fish.special);
          const attributes=`data-fish-rarity="${fish.rarity}" data-fish-species="${name}"`;
          if(!entry)return `<div class="fishing-log-entry locked" ${attributes}><div class="fishing-log-thumb" aria-hidden="true"><span class="fishing-log-question">?</span><span class="fishing-log-unlock-preview">${picture}</span></div><div class="fishing-log-copy"><b><span class="fishing-log-locked-name">???</span><span class="fishing-log-unlock-name">${name}</span></b>${badge}<span>Not caught yet</span></div></div>`;
          const best=Number(entry.bestSize||0);
          return `<div class="fishing-log-entry" ${attributes}><div class="fishing-log-thumb" aria-hidden="true">${picture}</div><div class="fishing-log-copy"><b>${name}</b>${badge}<span>Personal best <strong>${best>0?`${best} cm`:"—"}</strong></span><span>${Math.max(0,Number(entry.count||0))} caught</span></div></div>`;
        }).join("");
        return `<h3 class="fishing-log-section ${tier.id}" data-rarity-section="${tier.id}"><span>${tier.label}</span></h3>${rows}`;
      }).join("");
      return `<details class="fishing-logbook" data-fishing-logbook open><summary><span class="fishing-logbook-title"><i aria-hidden="true">▱</i><span>Angler's field log<small>Your personal fish collection</small></span></span>${newSpecies?'<span class="fishing-new-species">NEW SPECIES</span>':`<span class="fishing-logbook-count">${discovered} / ${FISHING_SPECIES.length}</span>`}</summary><div class="fishing-logbook-body"><div class="fishing-logbook-tools"><button type="button" class="fishing-log-unlock" data-fishing-log-unlock aria-pressed="false">Unlock all fish (testing)</button><small>Temporary collection preview</small></div><div class="fishing-logbook-stats"><div class="fishing-logbook-stat"><b>${discovered} / ${FISHING_SPECIES.length}</b>Discovered</div><div class="fishing-logbook-stat"><b>${totalCaught}</b>Total catches</div><div class="fishing-logbook-stat"><b>${rareCaught}</b>Special catches</div></div><div class="fishing-logbook-grid">${speciesHtml}</div></div></details>`;
    }
// SITE_FRAGMENT_END: duelFishingLogbookHtml_303736

// SITE_FRAGMENT_START: duelFishingResultOverlay_306472
function duelFishingResultOverlay(game) {
      if (!game || game.mode !== "fishing" || game.status !== "complete") return "";
      if(duelFishingCompletionElapsed(game)<2200)return "";
      if(duelFishingCompletionElapsed(game)<6800)return duelFishingComparisonOverlay(game);
      const state = duelFishingStableState(game) || game.fishingState || {};
      const meId = String(localStorage.getItem("tornVisitorUserId") || "");
      const myCatch = game.isCreator ? state.creatorCatch : game.isJoiner ? state.joinerCatch : state.myCatch;
      const opponentCatch = game.isCreator ? state.joinerCatch : state.creatorCatch;
      const meWon = Boolean(game.winnerUserId && String(game.winnerUserId) === meId);
      const isTie = Boolean(game.tie);
      const resultTitle = isTie ? "DEAD HEAT" : meWon ? "BIGGEST CATCH!" : "OUTFISHED";
      const resultClass = isTie ? "tie" : meWon ? "win" : "lose";
      const catchName = escapeHtml(myCatch?FISHING_CATALOG.resolve(myCatch).name:"No fish caught");
      const catchSize = myCatch ? `${Number(myCatch.size || 0)} cm` : "—";
      const opponentName = escapeHtml(opponentCatch?FISHING_CATALOG.resolve(opponentCatch).name:"No fish caught");
      const opponentSize = opponentCatch ? `${Number(opponentCatch.size || 0)} cm` : "—";
      const myBigger=!isTie&&Number(myCatch?.size||0)>Number(opponentCatch?.size||0);
      const oppBigger=!isTie&&Number(opponentCatch?.size||0)>Number(myCatch?.size||0);
      const ticketsWon = meWon ? Number(game.payout || 0) : 0;
      const rematch = game.rematch && typeof game.rematch === "object" ? game.rematch : {};
      const requestedBy = rematch.requestedBy && typeof rematch.requestedBy === "object" ? rematch.requestedBy : {};
      const entries = Object.entries(requestedBy).sort((a,b)=>Date.parse(a[1]||0)-Date.parse(b[1]||0));
      const firstRequesterId = String(entries[0]?.[0] || "");
      const expiresAt = Date.parse(rematch.expiresAt || 0);
      const rematchSeconds = expiresAt ? Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)) : 10;
      const myRematch = Boolean(requestedBy[meId]);
      const requesterPlayer = [game.creator, game.joiner].find(p => String(p?.userId || "") === firstRequesterId);
      const requesterName = escapeHtml(requesterPlayer?.name || "Opponent");
      const requesterAvatar = requesterPlayer?.avatarUrl
        ? `<img src="${escapeHtml(requesterPlayer.avatarUrl)}" alt="" class="duel-rematch-avatar">`
        : firstRequesterId ? `<span class="duel-rematch-avatar duel-rematch-avatar-fallback">${escapeHtml(String(requesterPlayer?.profileInitial || requesterPlayer?.name || "?").trim().slice(0,1).toUpperCase())}</span>` : "";
      const rematchActive = Boolean(firstRequesterId && expiresAt && expiresAt > Date.now());
      const rematchLabel = rematchActive ? `${requesterAvatar}<span>${firstRequesterId === meId ? "Rematch requested" : `${requesterName} wants a rematch`} • ${rematchSeconds}s</span>` : `<span>Rematch</span>`;
      const myArt=myCatch?duelFishSvg(myCatch.size,myCatch.name,myCatch):"";
      const oppArt=opponentCatch?duelFishSvg(opponentCatch.size,opponentCatch.name,opponentCatch):"";
      const myRecord=game.isCreator?game.result?.creator?.record:game.isJoiner?game.result?.joiner?.record:null;
      const opponentRecord=game.isCreator?game.result?.joiner?.record:game.result?.creator?.record;
      const myResultRole=game.isCreator?game.result?.creator:game.result?.joiner;
      const myLogbook=myResultRole?.logbook||{};
      const myNewSpecies=Boolean(myResultRole?.newSpecies);
      const resultSummary=isTie?"Identical measurements. Both wagers are returned.":meWon?"Your catch takes the tournament pot.":"The other angler landed the larger fish.";
      const tieEmblem=isTie?`<div class="fishing-tie-emblem">IDENTICAL MEASUREMENTS</div>`:"";

      const recordHtml=(record,label)=>{
        const current=Number(record?.currentSize||0);
        const previous=Number(record?.previousSize||0);
        const badge=record?.newRecord?`<span class="fishing-record-badge">🏆 NEW RECORD</span>`:"";
        const previousText=record?.newRecord&&previous>0?`<div class="fishing-record-previous">Previous: ${previous} cm</div>`:`<div class="fishing-record-previous"></div>`;
        return `<div class="fishing-record-row">${badge}<span>${label}: <b>${current>0?`${current} cm`:"—"}</b></span></div>${previousText}`;
      };
      const payoutText=isTie?"WAGERS RETURNED":meWon?`${money(ticketsWon)} WON`:"NEXT CAST AWAITS";
      return `<div class="fishing-result-overlay ${resultClass}" data-fishing-result="1" role="dialog" aria-label="Fishing match result"><div class="fishing-result-card" data-fishing-result-card="1"><header class="fishing-result-header"><div class="fishing-result-hook" aria-hidden="true">⌁</div><div><div class="fishing-result-kicker">TOURNAMENT WEIGH-IN</div><div class="fishing-result-title">${resultTitle}</div><p>${escapeHtml(resultSummary)}</p></div><div class="fishing-result-float" aria-hidden="true"><i></i></div></header><div class="fishing-result-content">${tieEmblem}<div class="fishing-result-catches"><div class="${myBigger?"winner":""}">${myBigger?'<span class="fishing-result-ribbon">LARGEST</span>':""}<span>Your catch</span><div class="fishing-result-fish-art">${myArt}</div><b>${catchName}${myCatch?duelFishingRarityBadge(myCatch):""}</b><strong>${catchSize}</strong>${recordHtml(myRecord,"Personal best")}</div><div class="${oppBigger?"winner":""}">${oppBigger?'<span class="fishing-result-ribbon">LARGEST</span>':""}<span>Opponent catch</span><div class="fishing-result-fish-art">${oppArt}</div><b>${opponentName}${opponentCatch?duelFishingRarityBadge(opponentCatch):""}</b><strong>${opponentSize}</strong>${recordHtml(opponentRecord,"Personal best")}</div></div>${duelFishingLogbookHtml(myLogbook,myNewSpecies)}<div class="fishing-result-payout"><span>RESULT</span><b>${payoutText}</b></div></div><footer class="fishing-result-actions"><button class="gold duel-rematch-btn ${myRematch ? "requested" : ""}" id="duelRematchBtn" type="button" ${myRematch ? "disabled" : ""}><i aria-hidden="true">↻</i>${rematchLabel}</button><button class="secondary" id="duelNewGameBtn" type="button"><i aria-hidden="true">＋</i><span>Create a New Game</span></button></footer></div></div>`;
    }
// SITE_FRAGMENT_END: duelFishingResultOverlay_306472

// SITE_FRAGMENT_START: duelFishingCountdownNow_412245
function duelFishingCountdownNow(game){
      const key=`${game?.gameId||""}:${game?.startAt||""}`;
      if(fishingCountdownAnchor.key!==key){
        const serverMs=Date.parse(String(game?.serverNow||""));
        fishingCountdownAnchor={key,serverMs:Number.isFinite(serverMs)?serverMs:Date.now(),perfAt:performance.now()};
      }
      return fishingCountdownAnchor.serverMs+Math.max(0,performance.now()-fishingCountdownAnchor.perfAt);
    }
// SITE_FRAGMENT_END: duelFishingCountdownNow_412245

// SITE_FRAGMENT_START: fishingV3Key_412695
function fishingV3Key(game){ const st=game?.fishingState||{}; const perspective=String(game?.controlPerspective||((game?.isJoiner&&!game?.isCreator)?"joiner":"creator")); return `${String(game?.gameId||"")}:${String(st.roundId||st.startAt||"pending")}:${perspective}`; }
// SITE_FRAGMENT_END: fishingV3Key_412695

// SITE_FRAGMENT_START: fishingV3StopAudio_412970
function fishingV3StopAudio(){
      duelFishingAudioEpoch+=1; duelFishingClearAudioTimeouts(); duelFishingStopOcean(true); duelFishingRippleRumble(false);
      try{ navigator.vibrate?.(0); }catch{}
    }
// SITE_FRAGMENT_END: fishingV3StopAudio_412970

// SITE_FRAGMENT_START: fishingV3Stop_413180
function fishingV3Stop(){ if(fishingV3.timer)clearInterval(fishingV3.timer); fishingV3.timer=null; duelFishingTimer=null; fishingV3StopAudio(); }
// SITE_FRAGMENT_END: fishingV3Stop_413180

// SITE_FRAGMENT_START: fishingV3Reset_413330
function fishingV3Reset(game=null){
      fishingV3Stop(); fishingV3.epoch+=1; fishingV3.key=game?fishingV3Key(game):""; fishingV3.game=game||null;
      fishingV3.endLocal=0; fishingV3.events=new Map(); fishingV3.creatorCatch=null; fishingV3.joinerCatch=null; fishingV3.myCatch=null;
      duelFishingLocalCatchLock={gameId:String(game?.gameId||""),locked:false};
      duelFishingAudioState={gameId:String(game?.gameId||""),seenRippleIds:new Set(),creatorCatchId:"",joinerCatchId:"",resultKey:"",lastSecond:null,timedOut:false};
    }
// SITE_FRAGMENT_END: fishingV3Reset_413330

// SITE_FRAGMENT_START: fishingV3Hydrate_413871
function fishingV3Hydrate(game){
      if(!game||game.mode!=="fishing")return null;
      const key=fishingV3Key(game); if(key!==fishingV3.key)fishingV3Reset(game); fishingV3.game=game;
      const st=game.fishingState||{}, now=Date.now();
      if(game.status==="playing"){
        const serverNow=Number(st.serverEpochMs||Date.parse(st.serverNow||game.serverNow||""));
        const serverEnd=Number(st.endEpochMs||Date.parse(st.endAt||""));
        const startMs=Date.parse(st.startAt||game.startAt||"");
        // A local countdown-to-playing transition may arrive before fish state.
        // Use the server's scheduled start, never a new sixty-second timer per poll.
        const endMs=Number.isFinite(serverEnd)?serverEnd:Number.isFinite(startMs)?startMs+60000:NaN;
        const remaining=Number.isFinite(serverNow)&&Number.isFinite(endMs)?Math.max(0,endMs-serverNow):Number.isFinite(st.remainingMs)?st.remainingMs:Number.isFinite(st.secondsLeft)?st.secondsLeft*1000:NaN;
        const projectedEnd=Number.isFinite(remaining)?now+Math.max(0,Math.min(60000,remaining)):0;
        // Anchor the deadline once per round. Network latency can make repeated
        // server projections move in both directions; a countdown must never rise.
        // We only accept a later poll when it shortens the remaining time materially.
        if(projectedEnd){
          if(!fishingV3.endLocal) fishingV3.endLocal=projectedEnd;
          else if(projectedEnd < fishingV3.endLocal - 750) fishingV3.endLocal=projectedEnd;
        }
      }else fishingV3.endLocal=0;
      if(Array.isArray(st.events))for(const e of st.events){
        const prior=fishingV3.events.get(String(e.id))||{};
        const serverNow=Number(st.serverEpochMs||Date.parse(st.serverNow||""));
        const at=Number(e.atMs||Date.parse(e.at||"")), end=Number(e.endAtMs||Date.parse(e.endAt||""));
        let localAt=prior.localAt,localEnd=prior.localEnd;
        const projectedAt=(Number.isFinite(serverNow)&&Number.isFinite(at))?now+(at-serverNow):NaN;
        const projectedEnd=(Number.isFinite(serverNow)&&Number.isFinite(end))?now+(end-serverNow):NaN;
        // Event windows are immutable for a round. Project each ripple once so
        // later polls cannot make an active ripple blink in and out from latency.
        if(Number.isFinite(projectedAt)&&Number.isFinite(projectedEnd)&&(!Number.isFinite(localAt)||!Number.isFinite(localEnd))){localAt=projectedAt;localEnd=projectedEnd;}
        fishingV3.events.set(String(e.id),{...prior,...e,claimedBy:e.claimedBy||prior.claimedBy||"",localAt,localEnd});
      }
      if(st.creatorCatch)fishingV3.creatorCatch={...st.creatorCatch};
      if(st.joinerCatch)fishingV3.joinerCatch={...st.joinerCatch};
      const mine=st.myCatch||(game.isCreator?st.creatorCatch:game.isJoiner?st.joinerCatch:null);
      if(mine){fishingV3.myCatch={...mine};duelFishingLocalCatchLock={gameId:String(game.gameId||""),locked:true};}
      return fishingV3State();
    }
// SITE_FRAGMENT_END: fishingV3Hydrate_413871

// SITE_FRAGMENT_START: fishingV3State_416855
function fishingV3State(){return {...(fishingV3.game?.fishingState||{}),events:[...fishingV3.events.values()],creatorCatch:fishingV3.creatorCatch,joinerCatch:fishingV3.joinerCatch,myCatch:fishingV3.myCatch};}
// SITE_FRAGMENT_END: fishingV3State_416855

// SITE_FRAGMENT_START: fishingV3Remaining_417068
function fishingV3Remaining(){return Math.max(0,fishingV3.endLocal-Date.now());}
// SITE_FRAGMENT_END: fishingV3Remaining_417068

// SITE_FRAGMENT_START: fishingV3Active_417153
function fishingV3Active(){const now=Date.now();return [...fishingV3.events.values()].find(e=>!e.claimedBy&&Number.isFinite(e.localAt)&&Number.isFinite(e.localEnd)&&now>=e.localAt&&now<=e.localEnd)||null;}
// SITE_FRAGMENT_END: fishingV3Active_417153

// SITE_FRAGMENT_START: fishingV3Start_417363
function fishingV3Start(){if(fishingV3.timer||!["countdown","playing"].includes(fishingV3.game?.status))return;const ep=fishingV3.epoch;fishingV3.timer=setInterval(()=>{if(ep!==fishingV3.epoch||!["countdown","playing"].includes(fishingV3.game?.status)){fishingV3Stop();return;}duelFishingTick();},100);duelFishingTimer=fishingV3.timer;duelFishingTick();}
// SITE_FRAGMENT_END: fishingV3Start_417363
