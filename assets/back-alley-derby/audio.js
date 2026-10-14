/* Original quiet pizzicato score and cues; recorded Kenney CC0 paw textures. */
(() => {
 'use strict';let ctx,master,unlocked=false,loading,clock=0,lastStep=0,lastDrop=0;const buffers=[],voices=new Set();
 const enabled=()=>unlocked&&!document.hidden&&!window.XanPreferences?.muted;
 function track(node){voices.add(node);node.onended=()=>{voices.delete(node);try{node.disconnect();}catch{}};return node;}
 function tone(freq,time=.2,level=.02,delay=0,type='sine',end=freq){if(!enabled()||!ctx||voices.size>24)return;const at=ctx.currentTime+delay,o=track(ctx.createOscillator()),g=ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,at);o.frequency.exponentialRampToValueAtTime(Math.max(20,end),at+time);g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(level,at+.012);g.gain.exponentialRampToValueAtTime(.0001,at+time);o.connect(g);g.connect(master);o.onended=()=>{voices.delete(o);o.disconnect();g.disconnect();};o.start(at);o.stop(at+time+.02);}
 async function unlock(){try{ctx||=new (window.AudioContext||window.webkitAudioContext)();if(!master){master=ctx.createGain();master.gain.value=.65;master.connect(ctx.destination);}unlocked=true;if(enabled())await ctx.resume();loading||=Promise.all([1,2,3].map(async(n)=>{try{const r=await fetch('/assets/back-alley-derby/audio/step-'+n+'.ogg');buffers[n-1]=await ctx.decodeAudioData(await r.arrayBuffer());}catch{}}));}catch{}}
 function paw(i){if(!enabled()||!buffers[i%3]||voices.size>24)return;const s=track(ctx.createBufferSource()),g=ctx.createGain(),filter=ctx.createBiquadFilter();s.buffer=buffers[i%3];s.playbackRate.value=1.8+(i%3)*.17;filter.type='lowpass';filter.frequency.value=2400;g.gain.value=.045;s.connect(filter);filter.connect(g);g.connect(master);s.onended=()=>{voices.delete(s);s.disconnect();g.disconnect();filter.disconnect();};s.start();}
 function tick(ms,racing){if(!enabled())return;if(racing&&ms-lastStep>145){lastStep=ms;paw(Math.floor(ms/145));}
  if(ms-clock>390){clock=ms;const beat=Math.floor(ms/390),notes=[110,0,164.81,0,130.81,0,146.83,0,110,0,164.81,196,130.81,0,146.83,0],n=notes[beat%notes.length];if(n)tone(n,.28,racing?.016:.009,0,'triangle');if(beat%4===2)tone(n?2*n:329.63,.4,.006);}
  if(ms-lastDrop>7300){lastDrop=ms;tone(650,.13,.006,0,'sine',240);}
 }
 function cue(name){if(name==='select')tone(420,.08,.018);if(name==='count')tone(330,.14,.035);if(name==='go'){[440,660,880].forEach((n,i)=>tone(n,.7,.03,i*.035));}if(name==='win'){[261.63,329.63,392,523.25,659.25].forEach((n,i)=>tone(n,.7,.035,i*.11,'triangle'));}if(name==='loss'){[220,196,164.81].forEach((n,i)=>tone(n,.45,.02,i*.13,'triangle'));}}
 function silence(){for(const v of voices){try{v.stop();}catch{}}voices.clear();}
 document.addEventListener('visibilitychange',()=>{if(document.hidden){silence();ctx?.suspend();}else if(enabled())ctx?.resume().catch(()=>{});});
 window.addEventListener('xan-preferences',()=>{if(!enabled())silence();});window.addEventListener('pagehide',()=>{silence();ctx?.suspend();});
 window.DerbyAudio={unlock,tick,cue,silence,get active(){return voices.size;}};
})();
