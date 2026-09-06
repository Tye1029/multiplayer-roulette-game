// The user requested the pre-v17 catch timing, not the early pending lift.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../assets/fishing/fishing-controller.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../assets/fishing/fishing.css',import.meta.url),'utf8');
assert(!source.includes('beginPull(')&&!source.includes('cancelPendingPull('),'The pending lift must remain reverted');
assert(css.includes('animation: fishingHookReveal .44s .24s ease-out both'),'Restore the prior reveal timing');
const inputStart=html.indexOf('    function duelFishingBeginOptimisticPull(');
const inputEnd=html.indexOf('    function duelFishingClearOptimisticPull(',inputStart);
const input=html.slice(inputStart,inputEnd);
assert(input.includes('water.classList.add(side==='),'Keep the original immediate fisherman feedback');
assert(!/\.(beginPull|reel|syncCatch)\(/.test(input),'Do not move the bobber before the confirmed catch');

for(const reducedMotion of [false,true]){
  let now=0,callback,delay;
  const window={};
  vm.runInNewContext(source,{window,performance:{now:()=>now},setTimeout:(fn,ms)=>{callback=fn;delay=ms;}});
  const c=Object.create(window.FishingSceneController.prototype);
  c.rigs={left:{side:'left',x:.42,y:.665,baseY:.665,caught:false,catchId:'',anim:null}};
  c.hook=()=>null;c.catchRestY=()=>.48;c.setPhase=phase=>{c.phase=phase;};c.log=()=>{};c.reducedMotion=reducedMotion;
  const completed=c.reel('left','confirmed-fish');
  const duration=reducedMotion?80:1250;
  assert.equal(c.rigs.left.anim.duration,duration);
  assert.equal(delay,duration+30);
  assert.equal(c.rigs.left.anim.fromY,.665);
  assert.equal(c.rigs.left.catchId,'confirmed-fish');
  now=duration/2;c.updateRig(c.rigs.left,now);
  assert(c.rigs.left.y>.48&&c.rigs.left.y<.665,'Confirmed fish still animates upward');
  now=duration;c.updateRig(c.rigs.left,now);
  assert.equal(c.rigs.left.y,.48);
  callback();await completed;
  assert.equal(c.phase,'caught');
}
console.log('Fishing restored-timing checks passed: original fisherman feedback, confirmed 1250ms reel, 240ms reveal delay, and reduced-motion behavior.');
