import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../assets/fishing/fishing-controller.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../assets/fishing/fishing.css',import.meta.url),'utf8');
const window={};
vm.runInNewContext(source,{window,document:{hidden:false}});
const controller=Object.create(window.FishingSceneController.prototype);
const style={setProperty(name,value){this[name]=value;}};
const classes=new Set();
const hook={style,classList:{toggle(name,on){on?classes.add(name):classes.delete(name);}}};
let anchor={left:320,top:180},path='';
controller.water={getBoundingClientRect:()=>({left:20,top:80,width:1000,height:430})};
controller.scene={querySelector:selector=>selector.includes('rod-tip')?{getBoundingClientRect:()=>anchor}:{setAttribute:(_,value)=>{path=value;}}};
controller.geometry={};controller.hook=()=>hook;controller.reducedMotion=false;
const rig={side:'left',x:.42,y:.665,caught:false,phaseOffset:0};
for(const time of [0,900,1900,4200]){
  anchor={left:320+time/100,top:180+time/200};
  controller.updateRig(rig,time);
  assert.equal(controller.geometry.left.rodTip.x,anchor.left-20);
  assert.equal(controller.geometry.left.rodTip.y,anchor.top-80);
  assert(path.startsWith(`M${(anchor.left-20).toFixed(1)} ${(anchor.top-80).toFixed(1)}`),'Line must follow the transformed guide ring');
  const bob=Number(style.transform.match(/,([-\d.]+)px/)[1]);
  assert(Math.abs(controller.geometry.left.lineEnd.y-(.665*430+bob-8))<.12,'Line must meet bobber top');
  assert(classes.has('is-floating'));
  assert(Math.abs(parseFloat(style['--surface-offset'])+bob)<.02,'Surface ring must stay on the water while bobber dips');
}
rig.caught=true;controller.updateRig(rig,5000);
assert(!classes.has('is-floating'),'Raised fish must not be clipped as if underwater');

// The real draw routine must apply its dock-exclusion clip BEFORE any paint,
// balance canvas state, and use continuous time rather than a reset interval.
const calls=[];
controller.canvas={width:1000,height:545};controller.canvasDpr=1;
controller.ctx=new Proxy({createLinearGradient:()=>({addColorStop(){}})},{get(target,key){return key in target?target[key]:(...args)=>calls.push([key,...args]);}});
controller.drawWater(5499);
assert(calls.findIndex(c=>c[0]==='clip')<calls.findIndex(c=>c[0]==='fillRect'));
assert.equal(calls.filter(c=>c[0]==='save').length,1);
assert.equal(calls.filter(c=>c[0]==='restore').length,1);
const firstWave=calls.find(c=>c[0]==='moveTo'&&c[1]===-12)?.[2];calls.length=0;
controller.drawWater(5501);
const nextWave=calls.find(c=>c[0]==='moveTo'&&c[1]===-12)?.[2];
assert(Math.abs(firstWave-nextWave)<.1,'Water must not jump at the former 5.5-second reset');
assert(!css.includes('@keyframes fishingWaterDrift'),'Superseded reset animation must be removed');
assert.match(css,/\.fishing-water::before,\s*\.fishing-water::after,\s*\.fishing-water-glint\s*\{[^}]*display: none !important/s);
assert(css.includes('@keyframes fishingBiteSplash'));

// Deterministic decorative path: fade at both ends, swim both directions,
// disappear between passes, and never render in reduced-motion mode.
controller.ambientEpoch=0;controller.phase='waiting';
controller.ambientFish=[{startedAt:2000,nextAt:50000,duration:8500,fromX:.29,toX:.71,y:.88,size:.03,direction:1,bend:0}];
calls.length=0;controller.drawFishShadows(1000,1000,545);
assert.equal(calls.length,0,'Fish should only appear occasionally');
controller.drawFishShadows(6250,1000,545);
assert(calls.some(c=>c[0]==='ellipse'),'Shadow body must be drawn');
assert(calls.some(c=>c[0]==='translate'&&c[1]===500),'Fish should pass through the central lake');
const forward=calls.find(c=>c[0]==='translate');calls.length=0;
controller.drawFishShadows(7250,1000,545);
assert(calls.find(c=>c[0]==='translate')[1]>forward[1],'Fish should swim along a smooth path');
calls.length=0;controller.drawFishShadows(16000,1000,545);
assert.equal(calls.length,0,'Rest period must be clear water');
controller.reducedMotion=true;controller.drawFishShadows(6250,1000,545);
assert.equal(calls.length,0,'Reduced motion must disable ambient swimmers');
controller.reducedMotion=false;controller.phase='complete';controller.drawFishShadows(6250,1000,545);
assert.equal(calls.length,0,'Completed rounds should not run decorative swimmers');
const shadowSource=source.slice(source.indexOf('    drawFishShadows('),source.indexOf('    frame('));
assert(!/setRipple|syncCatch|FISHING_CATALOG|random/.test(shadowSource),'Ambient shadows must never affect fish identities or bites');
for(let i=0;i<30;i++){
  const fish={pass:0};controller.nextShadowPass(fish,1000);
  assert(fish.nextAt-fish.startedAt-fish.duration>=28000,'Swimmers need at least 28 seconds of clear water');
  assert(fish.y-.009>=.831,'Decorations must stay away from the .665-height bite/bobber zone');
  assert(fish.y+.009<=.924,'Swimmers must stay inside foreground water');
  assert(fish.fromX>=.29&&fish.toX<=.71,'Swimmers must not cross the dock artwork');
}
for(const point of [[.1,.8],[.5,.98],[.4,.54]]){
  assert.deepEqual(JSON.parse(JSON.stringify(controller.armPoint(...point,1))),{x:point[0],y:point[1]},'Feet and lower body must be unchanged');
}
const hand=controller.armPoint(.35,.39,1);
assert(hand.x<.35&&hand.y<.39,'Arms need actual local lift, not just body rotation');
assert.deepEqual(JSON.parse(JSON.stringify(controller.armPoint(.35,.39,0))),{x:.35,y:.39},'Reel must return to the original pose');
assert(source.includes('this.frameWaterRect=this.water?.getBoundingClientRect()'),'Water geometry must be read once for both rigs');
assert(source.includes('this.frameTips=tips'),'Rod measurements must be batched before hook writes');
assert(source.includes('now-this.lastWaterFrame>=1000/30'),'Water must be time-based and capped at 30 paints per second');
console.log('Fishing surface passed: transformed rod anchors, bobber-top connection, submersion, dock clipping, continuous waves and splash animation.');
