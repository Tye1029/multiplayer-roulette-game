import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../assets/fishing/fishing-controller.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../assets/fishing/fishing.css',import.meta.url),'utf8');
const inputStart=html.indexOf('    function duelFishingBeginOptimisticPull(');
const inputEnd=html.indexOf('    function duelFishingClearOptimisticPull(',inputStart);
const input=html.slice(inputStart,inputEnd);
assert(!input.includes('water.classList.add(side==='),'The fisherman must wait for the confirmed fish before reeling');
assert(!input.includes('duelFishingPlayFlop(side)'),'The fish flop must wait for the confirmed catch');
assert(input.includes('requestedAt:performance.now()'),'Catch confirmation timing is not recorded');
assert(html.includes('controller?.log?.("catch-confirmed"'),'Confirmed network latency is missing from debug reports');
assert(css.includes('animation: fishingHookReveal .16s ease-out both'),'Confirmed fish reveal still has an artificial delay');
assert(!html.includes('if(g.status==="countdown")duelFishingPatchDom(g);'),'Countdown is still forcing unnecessary game DOM work every 100ms');
assert(html.includes('game.status === "countdown" ? (game.mode === "fishing" ? 750 : 250)'),'Fishing countdown is still over-polling the server');
assert(html.includes('rouletteLive ? 800 : fishingLive ? 750'),'Live Fishing is still over-polling the server');
assert(html.includes('duelPlayCountdownSoundOnPaint(game,label,portal)'),'Countdown sound is not synchronized to a painted number');
assert(html.includes("if(game.mode==='fishing'&&label==='GO!')"),'Fishing GO cue is not held long enough to be visible');

for(const reducedMotion of [false,true]){
  let now=0,callback,delay;
  const classes=new Set();
  const water={classList:{add:name=>classes.add(name),remove:name=>classes.delete(name)}};
  const window={};
  vm.runInNewContext(source,{window,document:{hidden:false},performance:{now:()=>now},setTimeout:(fn,ms)=>{callback=fn;delay=ms;}});
  const c=Object.create(window.FishingSceneController.prototype);
  c.rigs={left:{side:'left',x:.42,y:.665,baseY:.665,caught:false,catchId:'',anim:null}};
  c.water=water;c.hook=()=>null;c.catchRestY=()=>.48;c.setPhase=phase=>{c.phase=phase;};c.log=()=>{};c.updateDebug=()=>{};c.reducedMotion=reducedMotion;
  c.syncCatch('left','confirmed-fish',true);
  const duration=reducedMotion?80:1150;
  assert.equal(c.rigs.left.anim.duration,duration);
  assert.equal(delay,duration+30);
  assert(classes.has('pull-left'));
  const activeAnimation=c.rigs.left.anim;
  c.syncCatch('left','confirmed-fish',true);
  assert.equal(c.rigs.left.anim,activeAnimation,'A duplicate poll cancelled the active reel');
  now=duration/2;c.updateRig(c.rigs.left,now);
  assert(c.rigs.left.y>.48&&c.rigs.left.y<.665,'Confirmed fish must move with the reel');
  now=duration;c.updateRig(c.rigs.left,now);
  assert.equal(c.rigs.left.y,.48);
  callback();
  assert(!classes.has('pull-left'));
  assert.equal(c.phase,'caught');
}
console.log('Fishing catch synchronization passed: immediate splash feedback, server-confirmed reel, no reveal lag, duplicate-poll continuity, and synchronized countdown cues.');
