/* MIDNIGHT_RUN_V1 — recorded concrete footsteps, restrained city foley and original score. */
(() => {
 'use strict';
 let context,master,ambience,loaded=false,loadTask,stepAt=0,nextNote=0,note=0;const voices=new Set(),steps=[],cache=new Map();
 const enabled=()=>!document.hidden&&!window.XanPreferences?.muted;
 function init(){if(!enabled())return false;context||=new AudioContext();if(!master){master=context.createGain();master.gain.value=.48;master.connect(context.destination);}context.resume().catch(()=>{});return true;}
 async function unlock(){if(!init())return;loadTask||=Promise.all([1,2,3].map(async n=>{const response=await fetch('/assets/midnight-run/audio/step-'+n+'.ogg');if(!response.ok)throw Error('Audio unavailable');return context.decodeAudioData(await response.arrayBuffer());})).then(a=>{steps.push(...a);loaded=true;}).catch(()=>{loadTask=null;});await loadTask;}
 function buffer(name,duration,fn){if(cache.has(name))return cache.get(name);const b=context.createBuffer(1,Math.ceil(context.sampleRate*duration),context.sampleRate),a=b.getChannelData(0);for(let i=0;i<a.length;i++)a[i]=fn(i/context.sampleRate);cache.set(name,b);return b;}
 function play(b,volume,loop=false,rate=1){const s=context.createBufferSource(),g=context.createGain();s.buffer=b;s.loop=loop;s.playbackRate.value=rate;g.gain.value=volume;s.connect(g).connect(master);const voice={s,g};voices.add(voice);s.onended=()=>{voices.delete(voice);s.disconnect();g.disconnect();};s.start();return voice;}
 const noise=()=>Math.random()*2-1;
 function tone(freq,duration=.6,volume=.05){play(buffer('note-'+freq+'-'+duration,duration,t=>(Math.sin(2*Math.PI*freq*t)+.23*Math.sin(2*Math.PI*freq*2*t))*Math.min(1,t*60)*Math.exp(-t*6)),volume);}
 function tick(){if(init())play(buffer('zip',.22,t=>noise()*.4*Math.exp(-t*26)+Math.sin(2*Math.PI*140*t)*.25*Math.exp(-t*40)),.09);}
 function run(){
  if(!init()){silence();return;}
  if(!ambience){
   let brown=0;const b=buffer('rain-city',4,t=>{brown=(brown+noise()*.025)/1.015;return brown*.65+noise()*.025+Math.sin(2*Math.PI*49*t)*.012;});
   const a=b.getChannelData(0),fade=Math.floor(context.sampleRate*.08);for(let i=0;i<fade;i++){const p=i/fade;a[i]=a[a.length-fade+i]*(1-p)+a[i]*p;}
   ambience=play(b,.12,true);
  }
  const now=context.currentTime;
  if(now>=stepAt){stepAt=now+.3;if(loaded)play(steps[Math.floor(Math.random()*steps.length)],.23,false,.96+Math.random()*.12);}
  // A quiet, spacious minor ostinato; no loud repetitive arcade bleeps.
  if(now>=nextNote){nextNote=now+.6;const notes=[110,0,164.81,0,130.81,0,146.83,0];const f=notes[note++%notes.length];if(f)tone(f,1.1,.065);}
 }
 function stopRun(){if(ambience){ambience.g.gain.setTargetAtTime(0,context.currentTime,.08);try{ambience.s.stop(context.currentTime+.35);}catch{}ambience=null;}}
 function corner(){if(!init())return;play(buffer('bag-clasp',.25,t=>(noise()*.21+Math.sin(2*Math.PI*710*t)*.13)*Math.exp(-t*28)),.11);}
 function finish(win){stopRun();if(!init())return;
  if(win){play(buffer('escape',2.1,t=>[220,277.18,329.63,440].reduce((n,f,i)=>{const x=t-i*.13;return n+(x<0?0:(Math.sin(2*Math.PI*f*x)+.12*Math.sin(2*Math.PI*f*2*x))*Math.min(1,x*24)*Math.exp(-x*3)*.18);},0)),.25);}
  else{let phase=0;play(buffer('patrol-stop',1.9,t=>{phase+=(550+180*Math.sin(t*8))*2*Math.PI/context.sampleRate;return Math.sin(phase)*Math.min(1,t*12)*Math.exp(-t*1.8)*.16+noise()*.06*Math.exp(-t*8);}),.24);tone(65.41,1.6,.12);}
 }
 function silence(){for(const v of voices){v.g.gain.value=0;try{v.s.stop();}catch{}}voices.clear();ambience=null;}
 const safe=fn=>(...a)=>{try{const p=fn(...a);p?.catch?.(()=>{});}catch{silence();}};
 window.MidnightRunAudio={unlock:safe(unlock),tick:safe(tick),run:safe(run),stopRun:safe(stopRun),corner:safe(corner),finish:safe(finish),silence,get active(){return voices.size;},get loaded(){return loaded;}};
 window.addEventListener('xan-preferences',e=>{if(e.detail.muted)silence();else unlock();});document.addEventListener('visibilitychange',()=>{if(document.hidden)silence();});window.addEventListener('pagehide',silence);
})();
