import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const support=await readFile(new URL('../assets/roulette/decor/oval-table-support-v3.webp',import.meta.url));
assert.equal(support.toString('ascii',8,12),'WEBP');
assert.equal(support.toString('ascii',12,16),'VP8X');
assert(support[20]&16,'Furniture sprite must retain transparency');
assert.equal(support.readUIntLE(24,3)+1,900);
assert.equal(support.readUIntLE(27,3)+1,471);
assert(support.length<80000,'Furniture must remain lightweight for phones');

// A polling update replaces the root during a shot. The retained muzzle and
// flash must follow the replacement room until the complete envelope ends.
const source=await readFile(new URL('../assets/roulette/turn-fire.js',import.meta.url),'utf8');
for(const laser of [true,false]){
  const frames=[],samples=[];let now=0,replaced=false;
  const light={style:{setProperty(name,value){this[name]=value;}}};
  const activeRoot={isConnected:true,getBoundingClientRect:()=>({left:100,top:50}),querySelector:selector=>({'.rr-muzzle-room-light':light,'.rr-muzzle-point':muzzle}[selector]||null)};
  const muzzle={closest:()=>activeRoot,getBoundingClientRect:()=>({left:420+now/100,top:310})};
  const recoil={style:{},getAnimations:()=>[],closest:()=>activeRoot};
  const root={isConnected:true,classList:{add(){},remove(){}},querySelector:()=>null,querySelectorAll:()=>[]};
  const layers={root,recoil},lock={angle:176,turnId:'bob'};
  const env={window:{RouletteTurnLock:{lock,enforceLockedFacing:()=>layers,ensureLayers:()=>layers,applyFacing(){}},RouletteArsenal:{current:()=>({laser}),laserFeedback:async root=>{assert.equal(root,activeRoot,'Feedback must find the retained gun after polling replaces the original root');}}},
    rouletteShotSequence:null,rouletteShotIndexSound(){},rouletteGunshotSound(){},rouletteBlankSound(){},rouletteWait:async()=>{},rouletteAnimate:async()=>{},navigator:{},performance:{now:()=>0},requestAnimationFrame:fn=>frames.push(fn),duelActive:{querySelector:()=>root},CSS:{escape:x=>x}};
  vm.runInNewContext(source,env);
  await env.rouletteShotSequence({}, {lastOutcome:'live'},'test');
  while(frames.length){now+=16;if(now>=64&&!replaced){root.isConnected=false;replaced=true;}frames.shift()(now);samples.push({now,opacity:Number(light.style.opacity)});}
  assert(samples.some(s=>s.now>100&&s.opacity>.03),'Polling must not cut off the shot light');
  assert.equal(light.style.opacity,'0','Flash must clear itself');
  assert.equal(parseFloat(light.style['--rr-shot-x']),320+(now-16)/100,'Flash must follow the recoiling muzzle');
  if(laser){assert(samples[0].opacity>.75);assert(samples.at(-1).now>=360);}
  else assert(samples.at(-1).now<220,'Original revolver retains its short warm flash');
}
console.log('Roulette energy passed: muzzle tracking and complete red/warm envelopes survive room replacement.');
