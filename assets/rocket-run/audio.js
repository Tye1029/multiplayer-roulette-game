/* ROCKET_RUN_V1: original layered ignition, air/engine texture and landing cues. */
(() => {
 'use strict';let context,engineVoice;const voices=new Set(),buffers=new Map();
 function init(){if(document.hidden||window.XanPreferences?.muted)return false;context||=new AudioContext();context.resume().catch(()=>{});return true;}
 function buffer(name,duration,fn){if(buffers.has(name))return buffers.get(name);const b=context.createBuffer(1,Math.ceil(context.sampleRate*duration),context.sampleRate),a=b.getChannelData(0);for(let i=0;i<a.length;i++)a[i]=fn(i/context.sampleRate);buffers.set(name,b);return b;}
 function play(b,volume,loop=false,rate=1){const s=context.createBufferSource(),g=context.createGain();s.buffer=b;s.loop=loop;s.playbackRate.value=rate;g.gain.value=volume;s.connect(g).connect(context.destination);const v={s,g};voices.add(v);s.onended=()=>{voices.delete(v);s.disconnect();g.disconnect();};s.start();return v;}
 const noise=()=>Math.random()*2-1;
 function tick(){if(!init())return;play(buffer('relay',.22,t=>noise()*.28*Math.exp(-t*160)+Math.sin(2*Math.PI*420*t)*.23*Math.exp(-t*32)),.17);}
 function ignite(){if(!init())return;play(buffer('ignition',1.5,t=>(noise()*.32+Math.sin(2*Math.PI*(65*t-8*t*t))*.32)*Math.min(1,t*20)*Math.exp(-t*2.5)),.22);}
 function engine(level){if(!init()){silence();return;}if(!engineVoice){
  // Integer-cycle low frequencies and a crossfaded noise seam keep the loop smooth.
  const b=buffer('engine',2,t=>(noise()*.12+Math.sin(2*Math.PI*48*t)*.22+Math.sin(2*Math.PI*73*t)*.1)*(1+.12*Math.sin(2*Math.PI*4*t)));
  const a=b.getChannelData(0),fade=Math.floor(context.sampleRate*.06);for(let i=0;i<fade;i++){const blend=i/fade;a[i]=a[a.length-fade+i]*(1-blend)+a[i]*blend;}
  engineVoice=play(b,.065,true);
 }engineVoice.s.playbackRate.setTargetAtTime(1+Math.min(.6,level*.025),context.currentTime,.4);}
 function stopEngine(){if(engineVoice){engineVoice.g.gain.setTargetAtTime(0,context.currentTime,.07);try{engineVoice.s.stop(context.currentTime+.3);}catch{}engineVoice=null;}}
 function finish(win){stopEngine();if(!init())return;
  if(win){play(buffer('airlock',.6,t=>noise()*.27*Math.exp(-t*12)+Math.sin(2*Math.PI*180*t)*.3*Math.exp(-t*17)),.17);play(buffer('landing',1.9,t=>[440,550,660,880].reduce((n,f,i)=>{const x=t-i*.08;return n+(x<0?0:Math.sin(2*Math.PI*f*x)*Math.exp(-x*3.8)*Math.min(1,x*40)*.16);},0)),.23);}
  else play(buffer('breakup',1.65,t=>(noise()*.47+Math.sin(2*Math.PI*(70*t-13*t*t))*.3)*Math.min(1,t*90)*Math.exp(-t*3.8)+noise()*.12*Math.exp(-Math.abs(t-.21)*28)),.29);
 }
 function silence(){for(const v of voices){v.g.gain.value=0;try{v.s.stop();}catch{}}voices.clear();engineVoice=null;}
 const safe=fn=>(...a)=>{try{fn(...a);}catch{silence();}};window.RocketRunAudio={unlock:safe(init),tick:safe(tick),ignite:safe(ignite),engine:safe(engine),stopEngine:safe(stopEngine),finish:safe(finish),silence,get active(){return voices.size;}};
 window.addEventListener('xan-preferences',e=>{if(e.detail.muted)silence();});document.addEventListener('visibilitychange',()=>{if(document.hidden)silence();});window.addEventListener('pagehide',silence);
})();
