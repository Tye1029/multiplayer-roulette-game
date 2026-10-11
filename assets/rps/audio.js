/* Human performances and symphonic metal. Media starts only after a gesture. */
(() => {
  'use strict';
  let fadeFrame=0,crossfade=false,spare=null;
  let enabled=true,unlocked=false,silent=false,active=false,loopStarted=false,voice=null,effort=null;
  try { enabled=(localStorage.getItem('xan-muted')??localStorage.getItem('rps-muted'))!=='1'; } catch {}
  const clips=new Map(), failures=new Set();
  function clip(name,loop=false) {
    if(!clips.has(name)) {
      const a=new Audio('/assets/rps/audio/'+name+'.mp3?v=4');a.preload='none';a.loop=loop;
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
  function musicVolume(){return voice&&!voice.paused&&!voice.ended?.07:.18;}
  function mix() {if(!crossfade)for(const name of ['battle-intro','battle-loop'])if(clips.has(name))clips.get(name).volume=musicVolume();}
  function watchMusic(a,name){
    a.loop=false;
    a.ontimeupdate=()=>{
      if(crossfade||!active||!enabled||silent||document.hidden||!Number.isFinite(a.duration)||a.duration-a.currentTime>1.5)return;
      crossfade=true;const next=new Audio('/assets/rps/audio/battle-loop.mp3?v=4');next.preload='auto';spare=next;next.volume=0;
      next.play().then(()=>{const began=performance.now();const step=now=>{if(!active||document.hidden||!enabled||silent){a.pause();next.pause();crossfade=false;spare=null;return;}const t=Math.min(1,(now-began)/1400);a.volume=musicVolume()*(1-t);next.volume=musicVolume()*t;if(t<1)fadeFrame=requestAnimationFrame(step);else{a.pause();a.ontimeupdate=null;clips.delete(name);clips.set('battle-loop',next);loopStarted=true;crossfade=false;spare=null;watchMusic(next,'battle-loop');}};fadeFrame=requestAnimationFrame(step);}).catch(()=>{crossfade=false;spare=null;});
    };
    a.onended=()=>{if(crossfade)return;loopStarted=true;const n=clip('battle-loop');n.currentTime=0;ambience();};
  }
  function ambience() {
    if(!active||!enabled||!unlocked||document.hidden){for(const n of ['battle-intro','battle-loop','crowd'])clips.get(n)?.pause();spare?.pause();return;}
    const name=loopStarted?'battle-loop':'battle-intro',music=clip(name);watchMusic(music,name);
    if(silent){music.pause();spare?.pause();}else play(music,musicVolume());play(clip('crowd',true),silent?.035:.075);mix();
  }
  function stop(){active=false;cancelAnimationFrame(fadeFrame);crossfade=false;spare?.pause();spare=null;for(const a of clips.values())a.pause();voice=null;effort=null;}
  function say(name) {
    if(!active||!enabled||!unlocked||document.hidden)return;
    voice?.pause();effort?.pause();voice=clip('call-'+name);
    voice.onended=()=>{voice=null;mix();};play(voice,.88,true);mix();
  }
  window.RPSAudio={
    get enabled(){return enabled;},get unlocked(){return unlocked;},
    unlock(){const first=!unlocked;unlocked=true;active=true;if(first)for(const n of ['swish','cut','impact','gasp','cheer']){const a=clip(n);a.preload='auto';a.load();}ambience();},
    toggle(){enabled=!enabled;try{localStorage.setItem('rps-muted',enabled?'0':'1');}catch{}if(enabled){unlocked=true;active=true;ambience();}else stop();return enabled;},
    hush(value){if(silent===value)return;silent=value;ambience();if(value)clips.get('cheer')?.pause();},
    cue(name){if(['swish','cut','impact','cheer','gasp'].includes(name))play(clip(name),name==='cheer'?.5:.58,true);},
    round(number,final){say(final?'final-round':number<=3?'round-'+number:['prepare-yourself','ready','fight'][(number-4)%3]);},
    result({tie,won,youWon,flawless,round}){say(tie?(round%2?'tie':'tie-breaker'):won?(youWon?(flawless?'flawless-victory':'you-win'):'you-lose'):'winner');},
    effort(character,round,kind){
      const underCall=voice&&!voice.paused&&!voice.ended;
      effort?.pause();effort=clip(({lyra:'lyra',bryn:'bryn',sora:'lyra',nyx:'bryn'}[character]||'male')+'-'+kind+'-'+(round%3+1));play(effort,underCall?.35:.68,true);
    },
    diagnostics(){return {enabled,unlocked,active,hushed:silent,playing:[...clips].filter(([,a])=>!a.paused).map(([n])=>n),failed:[...failures]};},stop
  };
  window.addEventListener('xan-preferences',e=>{if(enabled===e.detail.muted)window.RPSAudio.toggle();});
  document.addEventListener('visibilitychange',()=>{document.body.classList.toggle('page-hidden',document.hidden);if(document.hidden){cancelAnimationFrame(fadeFrame);crossfade=false;spare?.pause();spare=null;for(const a of clips.values())a.pause();voice=null;effort=null;}else ambience();});
  window.addEventListener('pagehide',stop);
})();
