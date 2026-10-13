/* DICE_DUEL_V1 — original resin dice clatter, felt impacts and result chords. */
(() => {
 'use strict';let context;const buffers=new Map(),voices=new Set();
 function init(){if(document.hidden||window.XanPreferences?.muted)return false;context||=new AudioContext();context.resume().catch(()=>{});return true;}
 function buffer(name,duration,fn){if(buffers.has(name))return buffers.get(name);const b=context.createBuffer(1,Math.ceil(context.sampleRate*duration),context.sampleRate),samples=b.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=Math.max(-.95,Math.min(.95,fn(i/context.sampleRate)));buffers.set(name,b);return b;}
 function play(b,gain,rate=1){const source=context.createBufferSource(),volume=context.createGain();source.buffer=b;source.playbackRate.value=rate;volume.gain.value=gain;source.connect(volume).connect(context.destination);const v={source,volume};voices.add(v);source.onended=()=>{voices.delete(v);source.disconnect();volume.disconnect();};source.start();}
 const noise=()=>Math.random()*2-1;
 // Each collision combines a short hard-shell click, inharmonic resin resonance
 // and a lower, muffled felt contact. Increasing gaps make the roll decelerate.
 const impact=(t,hard=1)=>t<0||t>.16?0:(noise()*.42*Math.exp(-t*180)+Math.sin(t*2*Math.PI*1267)*.25*Math.exp(-t*95)+Math.sin(t*2*Math.PI*2131)*.11*Math.exp(-t*130))*hard+Math.sin(t*2*Math.PI*164)*.25*Math.exp(-t*62);
 function roll(){if(!init())return;const times=[0,.032,.075,.129,.2,.3,.415,.57,.76,.99,1.25,1.58,1.94];play(buffer('roll',2.3,t=>times.reduce((sum,at,i)=>sum+impact(t-at,.8-i*.035),0)+noise()*.08*Math.exp(-Math.abs(t-.08)*25)),.33);}
 function land(i){if(!init())return;play(buffer('land',.18,t=>impact(t,.8)),.2,1+(i%2)*.12);}
 function finish(outcome){if(!init())return;
  if(outcome==='win')play(buffer('win',1.8,t=>[523.25,659.25,783.99,1046.5].reduce((sum,f,i)=>{const x=t-i*.085;return sum+(x<0?0:(Math.sin(2*Math.PI*f*x)+.2*Math.sin(2*Math.PI*f*2.01*x))*Math.exp(-x*4)*Math.min(1,x*60)*.17);},0)+noise()*.07*Math.exp(-t*15)),.27);
  else if(outcome==='tie')play(buffer('tie',.7,t=>[392,587.33].reduce((sum,f)=>sum+Math.sin(2*Math.PI*f*t)*Math.exp(-t*7)*Math.min(1,t*80)*.18,0)),.18);
  else play(buffer('loss',.8,t=>(Math.sin(2*Math.PI*146.83*t)*.25+Math.sin(2*Math.PI*174.61*t)*.16+noise()*.1*Math.exp(-t*20))*Math.min(1,t*65)*Math.exp(-t*6)),.25);
 }
 function silence(){for(const v of voices){v.volume.gain.value=0;try{v.source.stop();}catch{}}voices.clear();}
 const safe=fn=>(...args)=>{try{fn(...args);}catch{silence();}};
 window.DiceDuelAudio={unlock:safe(init),roll:safe(roll),land:safe(land),finish:safe(finish),silence,get active(){return voices.size;}};
 window.addEventListener('xan-preferences',e=>{if(e.detail.muted)silence();});document.addEventListener('visibilitychange',()=>{if(document.hidden)silence();});window.addEventListener('pagehide',silence);
})();
