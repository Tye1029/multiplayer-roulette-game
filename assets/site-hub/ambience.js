/* Low-level ambience is opt-in through the shared sound setting and a gesture. */
(() => {
 'use strict';
 let heist,unlocked=false,timer;
 const active=()=>{const s=window.XanSiteAdapter?.current?.();return !document.hidden&&!window.XanPreferences?.muted&&['countdown','playing'].includes(s?.phase)?s.mode:'';};
 function sync(){
  const mode=active();if(!unlocked)return;
  if(mode==='safecracker'){if(!heist){heist=new Audio('/assets/site-hub/audio/vault-ostinato.wav');heist.loop=true;heist.volume=.28;}if(heist.paused)heist.play().catch(()=>{});}else heist?.pause();

 }
 document.addEventListener('pointerdown',()=>{const mode=window.XanSiteAdapter?.current?.().mode;if(mode!=='safecracker')return;unlocked=true;sync();},{passive:true});
 window.addEventListener('xan-preferences',sync);document.addEventListener('visibilitychange',sync);window.addEventListener('xan-navigation',sync);timer=setInterval(sync,1000);window.addEventListener('pagehide',()=>{clearInterval(timer);heist?.pause();});
})();
