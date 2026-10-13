/* MINEFIELD_V1: game-local mechanical, crystal and low-impact effects. */
(() => {
 'use strict';let context;const voices=new Set(),cache=new Map();
 const allowed=()=>!document.hidden&&!window.XanPreferences?.muted;
 function init(){if(!allowed())return false;context ||= new AudioContext();context.resume().catch(()=>{});return true;}
 function make(name,seconds,sample){if(cache.has(name))return cache.get(name);const b=context.createBuffer(1,Math.ceil(context.sampleRate*seconds),context.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=sample(i/context.sampleRate);cache.set(name,b);return b;}
 function play(b,volume=.2,cutoff=6000,delay=0,rate=1){const source=context.createBufferSource(),gain=context.createGain(),filter=context.createBiquadFilter();source.buffer=b;source.playbackRate.value=rate;filter.type='lowpass';filter.frequency.value=cutoff;const at=context.currentTime+delay;gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(volume,at+.004);source.connect(filter).connect(gain).connect(context.destination);const v={source,gain,filter};voices.add(v);source.onended=()=>{voices.delete(v);source.disconnect();gain.disconnect();filter.disconnect();};source.start(at);}
 const noise=()=>Math.random()*2-1;
 function cover(){if(!init())return;play(make('cover',.22,t=>noise()*.42*Math.exp(-t*27)+Math.sin(2*Math.PI*185*t)*.5*Math.exp(-t*35)),.25,2600);}
 function start(){if(!init())return;play(make('start',.65,t=>noise()*.16*Math.sin(Math.PI*Math.min(1,t/.6))+Math.sin(2*Math.PI*93*t)*.22*Math.exp(-t*8)),.19,1900);}
 function safe(count=1){if(!init())return;const b=make('crystal',.95,t=>(Math.sin(2*Math.PI*960*t)*.5*Math.exp(-t*7)+Math.sin(2*Math.PI*2483*t)*.2*Math.exp(-t*11)+noise()*.15*Math.exp(-t*190)));play(b,.17,6800,0,Math.min(1.7,1+count*.025));}
 function mine(){if(!init())return;let low=0;play(make('mine',1.1,t=>{low=low*.88+noise()*.12;return low*Math.exp(-t*5)*1.8+Math.sin(2*Math.PI*(64*t-13*t*t))*.35*Math.exp(-t*6);}),.4,1800);play(make('debris',.65,t=>noise()*Math.exp(-t*9)*(.2+.55*Math.exp(-((t*29)%1)*15))),.13,3000,.11);}
 function cash(){if(!init())return;const b=make('coin',1.2,t=>[1,2.73,4.7].reduce((s,n,i)=>s+Math.sin(2*Math.PI*660*n*t)*Math.exp(-t*(5+i*4))/(3+i*3),0));[1,1.25,1.5,2].forEach((rate,i)=>play(b,.2,7000,i*.09,rate));}
 function silence(){for(const v of voices){v.gain.gain.value=0;try{v.source.stop();}catch{}}voices.clear();}
 const optional=fn=>(...args)=>{try{fn(...args);}catch{silence();}};
 window.MinefieldAudio={cover:optional(cover),start:optional(start),safe:optional(safe),mine:optional(mine),cash:optional(cash),silence,get active(){return voices.size;}};
 window.addEventListener('xan-preferences',e=>{if(e.detail.muted)silence();});document.addEventListener('visibilitychange',()=>{if(document.hidden)silence();});window.addEventListener('pagehide',silence);
})();
