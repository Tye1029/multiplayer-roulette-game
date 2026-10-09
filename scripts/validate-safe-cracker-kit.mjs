import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import rules from '../netlify/functions/safe-cracker/heist.js';
import catalog from '../assets/safe-cracker/heist-catalog.js';
const {heads,colors,palettes,wireGeometry}=catalog;
assert.equal(Object.keys(heads).length,24);
assert.equal(new Set(Object.values(heads).map(h=>h[1])).size,24,'All heads need distinct artwork');
let seed=4281;const random=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
const seen=new Set(),sets=new Set(),layouts=new Set(),orders=new Set();
for(let round=0;round<120;round++){
  let h=rules.create(random);
  assert.equal(h.kit.length,6);assert.equal(new Set(h.kit).size,6);
  h.kit.forEach(type=>seen.add(type));sets.add([...h.kit].sort().join(','));
  assert.equal(h.screws.length,8);
  assert.ok(h.screws.every(s=>h.kit.includes(s.type)),'Every screw must have a matching driver');
  assert.ok(h.kit.every(type=>h.screws.some(s=>s.type===type)),'No useless drivers in the kit');
  assert.throws(()=>rules.apply(h,'screw:0:'+rules.shapes.find(type=>!h.kit.includes(type))),/not in your kit/);
  assert.throws(()=>rules.apply(h,'screw:0:unknown'),/Choose a screw/);
  assert.deepEqual([...h.wireLayout.order].sort(),[...h.order].sort());
  layouts.add(h.wireLayout.variant);orders.add(h.order.join(','));
  let previous=-Infinity;
  for(let i=0;i<10;i++){
    const r=wireGeometry(h.wireLayout,i,10);
    assert.ok(r.y-previous>=25,'Every center cut zone needs its own nonoverlapping hit area');previous=r.y;
    assert.ok(r.left>=29 && r.left<=291 && r.right>=29 && r.right<=291);
    assert.ok(r.before.endsWith(`L290 ${r.y}`) && r.after.startsWith(`M310 ${r.y} L340 ${r.y}`),'Clear central cutting span must remain free of crossings');
  }
  const publicState=rules.publicView(h,true), opponent=rules.publicView(h,false);
  assert.deepEqual(publicState.kit,h.kit);assert.deepEqual(publicState.wireLayout,h.wireLayout);
  assert.equal(opponent.kit,undefined);assert.equal(opponent.wireLayout,undefined);assert.equal(opponent.notePlan,undefined);
  const originalLayout=JSON.stringify(h.wireLayout);
  while(h.phase<2)h=rules.apply(h,rules.botCommand(h));
  assert.equal(h.mistakes,0);assert.equal(JSON.stringify(h.wireLayout),originalLayout,'Cuts and polling cannot reshuffle wires');
}
assert.equal(seen.size,24);assert.ok(sets.size>100);assert.equal(layouts.size,5);assert.equal(orders.size,120);
for(const preset of Object.values(palettes)){
  assert.equal(preset.values.length,Object.keys(colors).length);
  assert.equal(new Set(preset.values).size,preset.values.length);
  assert.ok(preset.values.every(color=>/^#[0-9a-f]{6}$/i.test(color)));
}
const client=await readFile(new URL('../assets/safe-cracker/heist.js',import.meta.url),'utf8');
assert.ok(client.includes("localStorage.setItem('safecracker-color-assist-v1',colorMode)"));
assert.ok(client.includes('style="color:${colors[item.ink]}'),'Assistance must not change the randomized note ink');
assert.ok(client.includes("if(samples?.dataset.mode === colorMode)return;"),'Polling must not rebuild the palette menu');
assert.ok(client.includes('${color.toUpperCase()}</text>'),'Wire names must remain visible in every palette');
console.log('Safe kit validated: 24 distinct heads, 6 matched tools/8 screws, unavailable-tool rejection, private kit/layout, five separated routing families, randomized notes, stable layouts, and color palette identity.');
