import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import catalog from '../shared/games/fishing-catalog.js';

assert.deepEqual(catalog.tiers.map(t=>t.id),['common','uncommon','rare','mythical']);
assert.deepEqual(catalog.tiers.map(t=>t.chance),[.70,.24,.05,.01]);
assert.equal(catalog.entries.length,62);
assert.equal(new Set(catalog.entries.map(f=>f.name)).size,62,'Every design has a distinct name');
assert.deepEqual(catalog.entries.filter(f=>f.rarity==='mythical').map(f=>f.name),['Nemo','Aurora Koi','Celestial Anglerfish']);
const reclassified={Oscar:'uncommon','Blue Tang':'uncommon','Zebra Pleco':'rare',Moonfish:'rare',Lionfish:'rare',Pufferfish:'common','Koi Carp':'uncommon','Neon Tetra':'uncommon'};
for(const [name,rarity] of Object.entries(reclassified)){
  assert.equal(catalog.resolve(name).rarity,rarity,`${name} must use the requested rarity`);
  const legacyCatch={name,variant:'standard',rarity:rarity==='uncommon'?'common':'uncommon'};
  assert.equal(catalog.identity(legacyCatch).rarity,rarity,'Saved catches resolve to the current category');
  assert.equal(catalog.resolve(name).special,rarity==='rare','New Rare fish need the same ripple signal as other Rare fish');
  const record=catalog.records({species:{fish:{...legacyCatch,bestVariant:'standard',bestSize:42,count:2}}}).get(name);
  assert.equal(record.count,2);assert.equal(record.bestSize,42,'Reclassification preserves discoveries and records');
}
assert.deepEqual(catalog.tiers.map(t=>catalog.entries.filter(f=>f.rarity===t.id).length),[32,18,9,3]);
for(const fish of catalog.entries){
  const pin=catalog.hookAnchors[fish.name];
  assert(pin && pin.length===2, `${fish.name} needs its own image attachment`);
  assert(pin[0]>=.25 && pin[0]<=.75 && pin[1]>=0 && pin[1]<.68);
  assert(catalog.hookStyle(fish).includes('--fish-pin-y:calc(var(--fish-width)'));
  assert(fs.existsSync(new URL('..'+fish.asset,import.meta.url)),fish.asset);
  assert.deepEqual(catalog.identity(fish),catalog.identity(fish.name));
  if(fish.special)assert(!catalog.entries.some(f=>!f.special&&f.name===fish.name));
}
assert.equal(catalog.resolve({name:'Largemouth Bass',bestVariant:'golden'}).name,'Gilded Sovereign');
assert.equal(catalog.resolve({name:'Crystal Largemouth Bass',variant:'crystal'}).name,'Prismfin Monarch');
assert.equal(catalog.resolve('Silver Minnow').rarity,'common');
assert.match(catalog.resolve('Silver Minnow').asset,/fish\/silver-minnow-v2.png$/);
for(const variant of ['golden','silver','crystal','albino','midnight','emerald']){
  assert.equal(catalog.resolve({variant}).rarity,'rare','No legacy special variant becomes Mythical');
}
// Exhaust every probability bucket at both ends of the length range. No tier
// can be excluded by size or accidentally applied as a conditional 1% roll.
for(const size of [12,28,48,70,100]){
  const counts={common:0,uncommon:0,rare:0,mythical:0};
  for(let i=0;i<10000;i++){
    let call=0;const fish=catalog.pick(size,()=>call++===0?(i+.5)/10000:.5);
    counts[fish.rarity]++;
  }
  assert.deepEqual(counts,{common:7000,uncommon:2400,rare:500,mythical:100});
}
let seed=71303;
const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const named={Nemo:0,'Aurora Koi':0,'Celestial Anglerfish':0};
for(let i=0;i<300000;i++){const fish=catalog.pick(12+random()*88,random);if(fish.rarity==='mythical')named[fish.name]++;}
for(const count of Object.values(named))assert(count>800&&count<1200,'Mythical shares must be evenly distributed');
const legacy={species:{bass:{name:'Largemouth Bass',bestVariant:'golden',bestSize:68,count:1,rareCount:1},nemo:{name:'Nemo',bestVariant:'nemo',bestSize:20,count:1}}};
const original=JSON.stringify(legacy),mapped=catalog.records(legacy);
assert(mapped.has('Gilded Sovereign')&&mapped.has('Nemo'));
assert.equal(mapped.get('Gilded Sovereign').bestSize,68);
assert.equal(JSON.stringify(legacy),original,'Rendering old records must not rewrite saved history');
const mixed=catalog.records({species:{bass:{name:'Largemouth Bass',bestVariant:'golden',bestSize:68,count:3,rareCount:1}}});
assert.equal(mixed.get('Largemouth Bass').count,2,'Normal discoveries survive the legacy combined record');
assert.equal(mixed.get('Largemouth Bass').bestSize,0,'Do not invent a normal record from a rare fish measurement');
assert.equal(mixed.get('Gilded Sovereign').count,1);
// Verify production generation delegates to this exact tested distribution.
const source=fs.readFileSync(new URL('../netlify/functions/_data.js',import.meta.url),'utf8');
const start=source.indexOf('function fishingFishIdentity(size){'),end=source.indexOf('function fishingInitialState(',start);
const context=vm.createContext({fishingCatalog:catalog});
vm.runInContext(source.slice(start,end),context);
const generatedRarity=vm.runInContext('fishingFishIdentity(50).rarity',context);
assert(catalog.tiers.some(t=>t.id===generatedRarity));
assert(source.includes('special:identity.special'));
function serverFunction(name){
  const a=source.indexOf('function '+name+'('),b=source.indexOf('\n}',a);
  assert(a>=0&&b>a,name);return source.slice(a,b+2);
}
const roundContext=vm.createContext({
  fishingCatalog:catalog,Math,Date,crypto:{randomBytes:()=>({toString:()=> 'test-random'})},
  nowIso:()=>new Date().toISOString(),int:(v,f=0)=>Number.isFinite(Number(v))?Math.trunc(Number(v)):f,
  cleanUserId:value=>String(value||'')
});
vm.runInContext(['fishingRand','fishingFishIdentity','fishingInitialState','fishingNormalizeClaims','fishingPublicState'].map(serverFunction).join('\n'),roundContext);
vm.runInContext("var state=fishingInitialState({},Date.now());var game={mode:'fishing',status:'playing',creator:{userId:'one'},joiner:{userId:'two'},fishingState:state};",roundContext);
const state=vm.runInContext('state',roundContext);
assert(state.events.length>=7&&state.events.length<=9);
assert(state.events.every(e=>catalog.tiers.some(t=>t.id===e.rarity)));
assert(state.events.every(e=>e.special===(e.rarity==='rare'||e.rarity==='mythical')));
assert.equal(new Set(state.events.map(e=>e.size)).size,state.events.length);
const privateView=vm.runInContext("fishingPublicState(game,'one')",roundContext);
assert(privateView.events.every(e=>e.size===undefined&&e.name===undefined&&e.rarity===undefined),'Future fish identities and lengths must remain private');
vm.runInContext("state.catches={one:{eventId:state.events[0].id,at:state.events[0].at},two:{eventId:state.events[1].id,at:state.events[1].at}};game=fishingNormalizeClaims(game);",roundContext);
const normalized=vm.runInContext('game.fishingState',roundContext);
assert.equal(normalized.catches.one.size,state.events[0].size,'Rarity cannot alter the winning length');
assert.equal(normalized.catches.two.size,state.events[1].size);
assert.equal(normalized.catches.one.name,catalog.resolve(state.events[0]).name);
console.log('Fishing catalog validated: 62 unique designs, four ordered tiers, exact 70/24/5/1 odds at every size, three equally likely Mythicals, and legacy record compatibility.');
