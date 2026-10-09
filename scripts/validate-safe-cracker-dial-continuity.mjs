import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url), 'utf8');
const section = (a, b) => source.slice(source.indexOf(a), source.indexOf(b, source.indexOf(a)));
const frames = new Map(), animations = [], handlers = {};
let id = 0, rectReads = 0, angle = 0, detents = 0;
const runtime = { rotation:0, selected:0, lastDetent:0, game:{gameId:'g',status:'playing'}, dialPaintFrame:0 };
const classes = { add(){}, remove(){}, toggle(){} };
const face = {style:{},classList:classes,animate(keys){
  animations.push(keys);
  return {cancel(){},addEventListener(){}};
}};
const current = {textContent:'0'};
const attributes = new Map([['aria-valuenow','0']]);
const dial = {
  classList:classes, addEventListener:(type, fn)=>{handlers[type]=fn;},setPointerCapture(){},
  getBoundingClientRect(){rectReads++;return {left:0,top:0,width:200,height:200};},
  getAttribute:key=>attributes.get(key),setAttribute:(key,value)=>attributes.set(key,value)
};
const elements = {'[data-sc-dial-face]':face,'[data-sc-current]':current,'[data-sc-dial]':dial};
const context = vm.createContext({runtime,Math,Date,Number,String,DETENT_DEGREES:36,
  document:{querySelector:s=>elements[s],querySelectorAll:()=>[]},
  window:{matchMedia:()=>({matches:false}),
    getComputedStyle:()=>({transform:`matrix(${Math.cos(angle*Math.PI/180)},${Math.sin(angle*Math.PI/180)},0,1,0,0)`}),
    requestAnimationFrame:fn=>{frames.set(++id,fn);return id;},cancelAnimationFrame:key=>frames.delete(key)},
  playDetent:()=>{detents++;},resumeAudio(){},render(){},safeCrackerRequestGuess(){}
});
vm.runInContext(section('function modulo(value, size)', 'function stateFor(game'), context);
vm.runInContext(section('function visibleDialRotation()', 'function bindResultControls(mount)'), context);
context.bindControls({querySelector:s=>s==='[data-sc-dial]'?dial:null,querySelectorAll:()=>[]},runtime.game);
const point = degrees=>({pointerId:1,clientX:100+100*Math.cos(degrees*Math.PI/180),clientY:100+100*Math.sin(degrees*Math.PI/180),preventDefault(){}});
handlers.pointerdown(point(0));
for (const degrees of [10,20,30,40,50,60,70,80,90]) handlers.pointermove(point(degrees));
assert.equal(rectReads,1,'Drag must not read layout after every transform write');
assert.equal(frames.size,1,'Multiple pointer events must share one paint frame');
assert.equal(Math.round(runtime.rotation),90,'Input accumulates immediately, before paint');
assert.equal(runtime.selected,7,'The submitted digit must follow the latest input, before paint');
assert.equal(detents,3,'Audio retains each crossed number');
const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn());
assert.match(face.style.transform,/rotate\(90deg\)/,'Frame paints the latest angle');
handlers.pointermove(point(95));
assert.equal(frames.size,1);
handlers.pointerup(point(95));
assert.equal(frames.size,0,'Release cancels pending drag paint before settling');
assert.equal(runtime.dialDragRect,null);
assert.equal(runtime.dragging,false);

// Restart a turn before its preceding animation reached its target.
runtime.rotation=72;angle=40;
context.setSelected(7);
assert.equal(animations.at(-1)[0].transform,'rotate(40deg)','Fast turns must begin at the visible angle');
runtime.rotation=396;angle=10;
assert.equal(context.visibleDialRotation(),370,'Painted rotation retains the turn count across wraparound');
context.window.matchMedia=()=>({matches:true});
const count=animations.length;context.setSelected(8);
assert.equal(animations.length,count,'Reduced motion keeps direct input without settle animations');
console.log('Safe dial continuity passed: one paint per frame, cached drag geometry, immediate selected digit, release cancellation, interrupted turns, wraparound, and reduced motion.');
