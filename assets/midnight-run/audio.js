/* MIDNIGHT_RUN_V1 — recorded concrete footsteps, restrained city foley and original score. */
(() => {
 'use strict';
 let context,master,loaded=false,loadTask,stepAt=0,nextNote=0,nextBark=0,note=0,foot=0,barks=0;const voices=new Set(),steps=[],cache=new Map();
 const enabled=()=>!document.hidden&&!window.XanPreferences?.muted;
 function init(){if(!enabled())return false;context||=new AudioContext();if(!master){master=context.createGain();master.gain.value=.48;master.connect(context.destination);}if(context.state==='suspended')context.resume().catch(()=>{});return true;}
 async function unlock(){if(!init())return;loadTask||=Promise.all([1,2,3].map(async n=>{const response=await fetch('/assets/midnight-run/audio/step-'+n+'.ogg');if(!response.ok)throw Error('Audio unavailable');return context.decodeAudioData(await response.arrayBuffer());})).then(a=>{steps.push(...a);loaded=true;}).catch(()=>{loadTask=null;});await loadTask;}
 function buffer(name,duration,fn){if(cache.has(name))return cache.get(name);const b=context.createBuffer(1,Math.ceil(context.sampleRate*duration),context.sampleRate),a=b.getChannelData(0);for(let i=0;i<a.length;i++)a[i]=fn(i/context.sampleRate);cache.set(name,b);return b;}
 function play(b,volume,loop=false,rate=1,pan=0,cutoff=18000){const s=context.createBufferSource(),g=context.createGain(),filter=context.createBiquadFilter(),p=context.createStereoPanner();s.buffer=b;s.loop=loop;s.playbackRate.value=rate;g.gain.value=volume;filter.type='lowpass';filter.frequency.value=cutoff;p.pan.value=pan;s.connect(filter).connect(g).connect(p).connect(master);const voice={s,g};voices.add(voice);s.onended=()=>{voices.delete(voice);s.disconnect();filter.disconnect();g.disconnect();p.disconnect();};s.start();return voice;}
 const noise=()=>Math.random()*2-1;
 function tone(freq,duration=.6,volume=.05){play(buffer('note-'+freq+'-'+duration,duration,t=>(Math.sin(2*Math.PI*freq*t)+.23*Math.sin(2*Math.PI*freq*2*t))*Math.min(1,t*60)*Math.exp(-t*6)),volume);}
 function tick(){if(init())play(buffer('zip',.22,t=>noise()*.4*Math.exp(-t*26)+Math.sin(2*Math.PI*140*t)*.25*Math.exp(-t*40)),.09);}
 function ambient(){
  if(!init()){silence();return;}
  if(!nextBark)nextBark=context.currentTime+10+Math.random()*8;
  const now=context.currentTime;
  if(now>=nextBark){
   nextBark=now+18+Math.random()*22;barks++;
   // Original distant double bark: falling pitch, breath and a soft reflected tail.
   const b=buffer('distant-dog',1.2,t=>{let value=0;for(const start of [0,.27])for(const echo of [0,.14]){const u=t-start-echo;if(u<0||u>.42)continue;const env=Math.min(1,u*100)*Math.exp(-u*18),phase=2*Math.PI*(180*u-70*u*u);value+=(Math.sin(phase)+.4*Math.sin(phase*2)+.18*noise())*env*(echo?.18:.65);}return value;});
   play(b,.035,false,.9+Math.random()*.15,Math.random()<.5?-.65:.65,1050);
  }
 }
 function run(){
  ambient();if(!enabled()||!context)return;const now=context.currentTime;
  if(now>=stepAt){stepAt=now+.46;const pan=foot++%2?.12:-.12;if(loaded)play(steps[Math.floor(Math.random()*steps.length)],.19,false,.88+Math.random()*.09,pan,2600);
   play(buffer('wet-sole',.16,t=>noise()*Math.min(1,t*100)*Math.exp(-t*35)),.025,false,1,pan,3800);
  }
  // A quiet, spacious minor ostinato; no loud repetitive arcade bleeps.
  if(now>=nextNote){nextNote=now+.6;const notes=[110,0,164.81,0,130.81,0,146.83,0];const f=notes[note++%notes.length];if(f)tone(f,1.1,.065);}
 }
 function stopRun(){stepAt=0;}
 function corner(){if(!init())return;play(buffer('bag-clasp',.25,t=>(noise()*.21+Math.sin(2*Math.PI*710*t)*.13)*Math.exp(-t*28)),.11);}
 function finish(win){stopRun();nextBark=0;if(!init())return;
  if(win){play(buffer('escape',2.1,t=>[220,277.18,329.63,440].reduce((n,f,i)=>{const x=t-i*.13;return n+(x<0?0:(Math.sin(2*Math.PI*f*x)+.12*Math.sin(2*Math.PI*f*2*x))*Math.min(1,x*24)*Math.exp(-x*3)*.18);},0)),.25);}
  else{let phase=0;play(buffer('patrol-stop',1.9,t=>{phase+=(550+180*Math.sin(t*8))*2*Math.PI/context.sampleRate;return Math.sin(phase)*Math.min(1,t*12)*Math.exp(-t*1.8)*.16+noise()*.06*Math.exp(-t*8);}),.24);tone(65.41,1.6,.12);}
 }
 function silence(){for(const v of voices){v.g.gain.value=0;try{v.s.stop();}catch{}}voices.clear();stepAt=0;nextNote=0;nextBark=0;}
 const safe=fn=>(...a)=>{try{const p=fn(...a);p?.catch?.(()=>{});}catch{silence();}};
 window.MidnightRunAudio={unlock:safe(unlock),tick:safe(tick),run:safe(run),ambient:safe(ambient),stopRun:safe(stopRun),corner:safe(corner),finish:safe(finish),silence,get active(){return voices.size;},get loaded(){return loaded;},get diagnostics(){return {rain:false,barks,footfalls:foot};}};
 window.addEventListener('xan-preferences',e=>{if(e.detail.muted)silence();else unlock();});document.addEventListener('visibilitychange',()=>{if(document.hidden)silence();});window.addEventListener('pagehide',silence);
})();
