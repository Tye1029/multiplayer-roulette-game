/* BACK_ALLEY_DERBY_V2_RACE_DAY. Recorded race ambience: see audio/CREDITS.txt. */
(() => {
 'use strict';
 let ctx,master,unlocked=false,loading,clock=0,lastStep=0,crowd=null;
 const buffers={},voices=new Set(),played={go:0,cheer:0,paws:0};
 const enabled=()=>unlocked&&!document.hidden&&!window.XanPreferences?.muted;
 function tone(freq,time=.2,level=.02,delay=0,type='sine',end=freq){
  if(!enabled()||!ctx||voices.size>=24)return;
  const at=ctx.currentTime+delay,o=ctx.createOscillator(),g=ctx.createGain();voices.add(o);
  o.type=type;o.frequency.setValueAtTime(freq,at);o.frequency.exponentialRampToValueAtTime(Math.max(20,end),at+time);
  g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(level,at+.012);g.gain.exponentialRampToValueAtTime(.0001,at+time);
  o.connect(g);g.connect(master);o.onended=()=>{voices.delete(o);o.disconnect();g.disconnect();};o.start(at);o.stop(at+time+.02);
 }
 function sample(name,level,{rate=1,delay=0,pan=0,loop=false}={}){
  if(!enabled()||!ctx||!buffers[name]||voices.size>=24)return null;
  const source=ctx.createBufferSource(),gain=ctx.createGain(),panner=ctx.createStereoPanner(),filter=ctx.createBiquadFilter();voices.add(source);
  source.buffer=buffers[name];source.playbackRate.value=rate;source.loop=loop;gain.gain.value=loop?0:level;panner.pan.value=pan;
  filter.type='lowpass';filter.frequency.value=name.startsWith('step-')?2700:9000;
  source.connect(filter);filter.connect(gain);gain.connect(panner);panner.connect(master);
  source.onended=()=>{voices.delete(source);source.disconnect();filter.disconnect();gain.disconnect();panner.disconnect();};
  source.start(ctx.currentTime+delay);return {source,gain};
 }
 async function unlock(){try{
  ctx||=new (window.AudioContext||window.webkitAudioContext)();if(!master){master=ctx.createGain();master.gain.value=.65;master.connect(ctx.destination);}
  unlocked=true;if(enabled())await ctx.resume();
  loading||=Promise.all(['step-1','step-2','step-3','starter','crowd','cheer'].map(async name=>{try{const r=await fetch('/assets/back-alley-derby/audio/'+name+'.ogg');if(r.ok)buffers[name]=await ctx.decodeAudioData(await r.arrayBuffer());}catch{}}));
 }catch{}}
 function race(active,progress=0){
  if(!active||!enabled()){
   if(crowd){const old=crowd;crowd=null;old.gain.gain.setTargetAtTime(0,ctx.currentTime,.08);old.source.stop(ctx.currentTime+.3);}return;
  }
  crowd||=sample('crowd',0,{loop:true});
  if(crowd)crowd.gain.gain.setTargetAtTime(.075+Math.min(1,Math.max(0,progress))*.035,ctx.currentTime,.3);
 }
 function tick(ms,racing,progress=0){
  race(racing,progress);if(!enabled())return;
  if(racing&&ms-lastStep>140){lastStep=ms;const i=Math.floor(ms/140);sample('step-'+(i%3+1),.075,{rate:1.75+(i%5)*.1,pan:Math.sin(i*1.7)*.45});sample('step-'+((i+1)%3+1),.045,{rate:2.1,delay:.055,pan:-Math.sin(i*1.7)*.45});played.paws++;}
  if(ms-clock>390){clock=ms;const beat=Math.floor(ms/390),notes=[110,0,164.81,0,130.81,0,146.83,0,110,0,164.81,196,130.81,0,146.83,0],n=notes[beat%notes.length];if(n)tone(n,.28,racing?.011:.009,0,'triangle');if(beat%4===2)tone(n?2*n:329.63,.4,.005);}
 }
 function cue(name){
  if(!enabled())return;
  if(name==='select')tone(420,.08,.018);
  if(name==='count')tone(330,.14,.035);
  if(name==='go'){played.go++;if(!sample('starter',.42))tone(160,.12,.07,0,'triangle',55);}
  if(name==='win'||name==='loss'){race(false);if(sample('cheer',.14))played.cheer++;}
  if(name==='win')[261.63,329.63,392,523.25,659.25].forEach((n,i)=>tone(n,.7,.035,i*.11,'triangle'));
  if(name==='loss')[220,196,164.81].forEach((n,i)=>tone(n,.45,.02,i*.13,'triangle'));
 }
 function silence(){crowd=null;for(const v of voices){try{v.stop();}catch{}}voices.clear();}
 document.addEventListener('visibilitychange',()=>{if(document.hidden){silence();ctx?.suspend().catch(()=>{});}else if(enabled())ctx?.resume().catch(()=>{});});
 window.addEventListener('xan-preferences',()=>{if(!enabled())silence();});window.addEventListener('pagehide',()=>{silence();ctx?.suspend().catch(()=>{});});
 window.DerbyAudio={unlock,tick,cue,race,silence,get active(){return voices.size;},get diagnostics(){return {loaded:Object.keys(buffers).length,crowd:Boolean(crowd),played:{...played}};}};
})();
