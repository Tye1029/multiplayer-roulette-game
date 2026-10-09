/* Human performances and symphonic metal. Media starts only after a gesture. */
(() => {
  'use strict';
  let enabled=true,unlocked=false,silent=false,active=false,loopStarted=false,voice=null,effort=null;
  try { enabled=localStorage.getItem('rps-muted')!=='1'; } catch {}
  const clips=new Map(), failures=new Set();
  function clip(name,loop=false) {
    if(!clips.has(name)) {
      const a=new Audio('/assets/rps/audio/'+name+'.mp3?v=3');a.preload='none';a.loop=loop;
      a.addEventListener('error',()=>failures.add(name));clips.set(name,a);
    }
    return clips.get(name);
  }
  function play(a,volume,restart=false) {
    if(!enabled||!unlocked||document.hidden||!active)return;
    a.volume=volume;if(restart)a.currentTime=0;
    // Cuts, new calls and hidden tabs intentionally interrupt pending playback.
    a.play().catch(error=>{if(error.name!=='AbortError')failures.add(a.src.split('/').pop().split('?')[0]+' ('+error.name+')');});
  }
  function mix() {
    const duck=voice&&!voice.paused&&!voice.ended;
    for(const name of ['battle-intro','battle-loop']) if(clips.has(name)) clips.get(name).volume=duck?.12:.32;
  }
  function ambience() {
    if(silent||!active||!enabled||!unlocked||document.hidden) {
      for(const n of ['battle-intro','battle-loop','crowd']) clips.get(n)?.pause();return;
    }
    const music=clip(loopStarted?'battle-loop':'battle-intro',loopStarted);
    if(!loopStarted)music.onended=()=>{loopStarted=true;ambience();};
    play(music,.32);play(clip('crowd',true),.12);mix();
  }
  function stop() { active=false;for(const a of clips.values())a.pause();voice=null;effort=null; }
  function say(name) {
    if(!active||!enabled||!unlocked||document.hidden)return;
    voice?.pause();effort?.pause();voice=clip('call-'+name);
    voice.onended=()=>{voice=null;mix();};play(voice,.88,true);mix();
  }
  window.RPSAudio={
    get enabled(){return enabled;},get unlocked(){return unlocked;},
    unlock(){unlocked=true;active=true;ambience();},
    toggle(){enabled=!enabled;try{localStorage.setItem('rps-muted',enabled?'0':'1');}catch{}if(enabled){unlocked=true;active=true;ambience();}else stop();return enabled;},
    hush(value){if(silent===value)return;silent=value;ambience();if(value)clips.get('cheer')?.pause();},
    cue(name){if(['swish','cut','impact','cheer'].includes(name))play(clip(name),name==='cheer'?.5:.58,true);},
    round(number,final){say(final?'final-round':number<=3?'round-'+number:['prepare-yourself','ready','fight'][(number-4)%3]);},
    result({tie,won,youWon,flawless,round}){say(tie?(round%2?'tie':'tie-breaker'):won?(youWon?(flawless?'flawless-victory':'you-win'):'you-lose'):'winner');},
    effort(character,round,kind){
      const underCall=voice&&!voice.paused&&!voice.ended;
      effort?.pause();effort=clip((['lyra','bryn'].includes(character)?character:'male')+'-'+kind+'-'+(round%3+1));play(effort,underCall?.35:.68,true);
    },
    diagnostics(){return {enabled,unlocked,active,hushed:silent,playing:[...clips].filter(([,a])=>!a.paused).map(([n])=>n),failed:[...failures]};},stop
  };
  document.addEventListener('visibilitychange',()=>{document.body.classList.toggle('page-hidden',document.hidden);if(document.hidden){for(const a of clips.values())a.pause();voice=null;effort=null;}else ambience();});
  window.addEventListener('pagehide',stop);
})();
