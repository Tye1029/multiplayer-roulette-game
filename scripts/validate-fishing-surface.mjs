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
console.log('Fishing surface passed: transformed rod anchors, bobber-top connection, submersion, dock clipping, continuous waves and splash animation.');
