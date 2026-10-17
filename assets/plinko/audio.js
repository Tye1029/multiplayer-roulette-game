/* PLINKO_V1: short marble impacts, a mechanical gate and pocket/coin resonance. */
(() => {
 'use strict';let context;const voices=new Set(),cache=new Map();const noise=()=>Math.random()*2-1;
 function init(){if(document.hidden||window.XanPreferences?.muted)return false;context||=new AudioContext();context.resume().catch(()=>{});return true;}
 function sample(name,duration,fn){if(cache.has(name))return cache.get(name);const b=context.createBuffer(1,Math.ceil(context.sampleRate*duration),context.sampleRate),v=b.getChannelData(0);for(let i=0;i<v.length;i++)v[i]=fn(i/context.sampleRate);cache.set(name,b);return b;}
 function play(buffer,volume=.15,rate=1,delay=0){const s=context.createBufferSource(),g=context.createGain();s.buffer=buffer;s.playbackRate.value=rate;const at=context.currentTime+delay;g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(volume,at+.002);s.connect(g).connect(context.destination);const v={s,g};voices.add(v);s.onended=()=>{voices.delete(v);s.disconnect();g.disconnect();};s.start(at);}
 function drop(){if(!init())return;play(sample('gate',.3,t=>noise()*.42*Math.exp(-t*26)+Math.sin(2*Math.PI*132*t)*.34*Math.exp(-t*35)),.23);play(sample('roll',.46,t=>noise()*.13*Math.exp(-t*8)*(1+.7*Math.sin(2*Math.PI*47*t))),.17,1,.05);}
 function bounce(row){if(!init())return;play(sample('peg',.24,t=>noise()*.5*Math.exp(-t*260)+Math.sin(2*Math.PI*1560*t)*.3*Math.exp(-t*44)+Math.sin(2*Math.PI*3675*t)*.13*Math.exp(-t*65)+Math.sin(2*Math.PI*330*t)*.2*Math.exp(-t*60)),.14,1+row*.012);}
 function land(win){if(!init())return;play(sample('pocket',.4,t=>noise()*.35*Math.exp(-t*70)+Math.sin(2*Math.PI*218*t)*.48*Math.exp(-t*23)),.23);if(win){const b=sample('coin',1.1,t=>[1,2.71,4.13].reduce((s,n,i)=>s+Math.sin(2*Math.PI*735*n*t)*Math.exp(-t*(6+i*3))/(3+i*4),0));[1,1.25,1.5].forEach((rate,i)=>play(b,.13,rate,.1+i*.09));}else play(sample('settle',.3,t=>Math.sin(2*Math.PI*(126*t-26*t*t))*.34*Math.exp(-t*17)+noise()*.12*Math.exp(-t*25)),.13,1,.11);}
 function silence(){for(const v of voices){v.g.gain.value=0;try{v.s.stop();}catch{}}voices.clear();}
 const safe=fn=>(...args)=>{try{fn(...args);}catch{silence();}};window.PlinkoAudio={unlock:safe(init),drop:safe(drop),bounce:safe(bounce),land:safe(land),silence,get active(){return voices.size;}};
 window.addEventListener('xan-preferences',e=>{if(e.detail.muted)silence();});document.addEventListener('visibilitychange',()=>{if(document.hidden)silence();});window.addEventListener('pagehide',silence);
})();
