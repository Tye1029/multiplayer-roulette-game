/* DICE_V2 — Kenney CC0 dice recordings and original result chords. */
(() => {
 'use strict';let context,loading;const recordings=[];const buffers=new Map(),voices=new Set();
 function init(){if(document.hidden||window.XanPreferences?.muted)return false;context||=new AudioContext();context.resume().catch(()=>{});loading||=Promise.all([1,2,3].map(async n=>{const r=await fetch('/assets/site-hub/audio/dice-throw-'+n+'.ogg');if(!r.ok)throw Error('Audio unavailable');recordings[n-1]=await context.decodeAudioData(await r.arrayBuffer());})).catch(()=>{loading=null;});return true;}
 function buffer(name,duration,fn){if(buffers.has(name))return buffers.get(name);const b=context.createBuffer(1,Math.ceil(context.sampleRate*duration),context.sampleRate),samples=b.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=Math.max(-.95,Math.min(.95,fn(i/context.sampleRate)));buffers.set(name,b);return b;}
 function play(b,gain,rate=1,delay=0){const source=context.createBufferSource(),volume=context.createGain();source.buffer=b;source.playbackRate.value=rate;volume.gain.value=gain;source.connect(volume).connect(context.destination);const v={source,volume};voices.add(v);source.onended=()=>{voices.delete(v);source.disconnect();volume.disconnect();};source.start(context.currentTime+delay);}
 const noise=()=>Math.random()*2-1;
 // Kenney Casino Audio (CC0): real dice on a tabletop, with quieter settling casts.
 function roll(){if(!init()||!recordings.length)return;const n=Math.floor(Math.random()*3);for(let i=0;i<3;i++){const sample=recordings[(n+i)%3];if(sample)play(sample,[.42,.25,.12][i],[1,.96,1.06][i],[0,.58,1.22][i]);}}
 function land(){/* The recording already contains the final contacts. */}
 function finish(outcome){if(!init())return;
  if(outcome==='win')play(buffer('win',1.8,t=>[523.25,659.25,783.99,1046.5].reduce((sum,f,i)=>{const x=t-i*.085;return sum+(x<0?0:(Math.sin(2*Math.PI*f*x)+.2*Math.sin(2*Math.PI*f*2.01*x))*Math.exp(-x*4)*Math.min(1,x*60)*.17);},0)+noise()*.07*Math.exp(-t*15)),.27);
  else if(outcome==='tie')play(buffer('tie',.7,t=>[392,587.33].reduce((sum,f)=>sum+Math.sin(2*Math.PI*f*t)*Math.exp(-t*7)*Math.min(1,t*80)*.18,0)),.18);
  else play(buffer('loss',.8,t=>(Math.sin(2*Math.PI*146.83*t)*.25+Math.sin(2*Math.PI*174.61*t)*.16+noise()*.1*Math.exp(-t*20))*Math.min(1,t*65)*Math.exp(-t*6)),.25);
 }
 function silence(){for(const v of voices){v.volume.gain.value=0;try{v.source.stop();}catch{}}voices.clear();}
 const safe=fn=>(...args)=>{try{fn(...args);}catch{silence();}};
 window.DiceDuelAudio={unlock:safe(init),ready:()=>loading||Promise.resolve(),roll:safe(roll),land:safe(land),finish:safe(finish),silence,get active(){return voices.size;}};
 window.addEventListener('xan-preferences',e=>{if(e.detail.muted)silence();});document.addEventListener('visibilitychange',()=>{if(document.hidden)silence();});window.addEventListener('pagehide',silence);
})();
