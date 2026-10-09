import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {rouletteTestRuntime} from './roulette-test-runtime.mjs';
const test=await rouletteTestRuntime();
for(let position=1;position<=6;position++){
  let calls=0;
  test.rules.crypto.randomInt=(min,max)=>{assert.equal(min,1);assert.equal(max,7);calls++;return position;};
  test.reset();assert.equal(test.get().rouletteState.remaining,position);
  await test.act('roulette:spin');
  assert.equal(test.get().rouletteState.remaining,position,'Spin must permit the same position again');
  assert.equal(calls,2,'Only game start and spin reroll');
  for(let n=1;n<=position;n++){
    await test.act('roulette:shoot');
    assert.equal(test.get().status,n===position?'complete':'playing');
  }
  assert.equal(calls,2,'Shooting must not reroll');
}
test.rules.crypto.randomInt=()=>6;
test.reset();const first=test.get().rouletteState.turnDeadline;
await test.act('roulette:shoot');assert.equal(test.get().rouletteState.turnDeadline,first,'Press luck stays in the same turn');
await test.act('roulette:spin');assert.equal(test.get().rouletteState.turnDeadline,first,'Spin cannot extend a turn');
await test.act('roulette:pass');
assert(Math.abs(Date.parse(test.get().rouletteState.turnDeadline)-Date.now()-60000)<100,'Pass starts a fresh 60 seconds');
await assert.rejects(test.act('roulette:execute','alice'),/only available/);
test.get().rouletteState.turnDeadline=new Date(Date.now()-1).toISOString();
assert.equal(test.rules.rouletteCanAct(test.get(),'bob'),false);
assert.equal(test.public().rouletteState.canExecute,true);
assert.equal(test.rules.roulettePublicState(test.get(),'spectator').canExecute,false);
await assert.rejects(test.act('roulette:shoot','bob'),/expired/);
await assert.rejects(test.act('roulette:execute','bob'),/only available/);
await assert.rejects(test.act('roulette:execute','spectator'),/only available/);
await assert.rejects(test.act('roulette:execute','alice',{expectedTurnId:'alice'}),/turn changed/);
await test.act('roulette:execute','alice',{actionId:'timeout-1',expectedTurnId:'bob',expectedRevision:test.get().rouletteState.revision});
assert.equal(test.get().status,'complete');assert.equal(test.get().winnerUserId,'alice');assert.equal(test.get().loserUserId,'bob');
const completed=JSON.stringify(test.get());await test.act('roulette:execute','alice',{actionId:'timeout-1'});assert.equal(JSON.stringify(test.get()),completed);
test.reset();test.get().rouletteState.openingReadyAt=new Date(Date.now()+5000).toISOString();test.get().rouletteState.turnId='bob';
test.get().npcActionAt=new Date(Date.now()-100).toISOString();
const opening=await test.rules.rouletteAdvance(test.get());assert.equal(opening.rouletteState.lastAction,'opening_spin','Opponent must wait for chooser');
await assert.rejects(test.act('roulette:shoot','bob'),/opening spin/);

// Exercise the actual storage boundary with competing writes and one ETag.
const source=await readFile(new URL('../netlify/functions/_data.js',import.meta.url),'utf8');
const save=source.slice(source.indexOf('async function duelSaveGame('),source.indexOf('async function duelInvalidateLegacyGame('));
let stored={gameId:'cas',mode:'roulette',status:'playing',revision:1},etag=1,writes=0;
const store={getWithMetadata:async()=>({data:structuredClone(stored),etag:String(etag)}),set:async(_key,payload,options)=>{
  const next=JSON.parse(payload);
  await Promise.resolve();if(options.onlyIfMatch!==String(etag))return {modified:false};
  stored=next;etag++;writes++;return {modified:true,etag:String(etag)};
}};
const env=vm.createContext({duelSanitizeGame:x=>x,DUEL_SCHEMA_VERSION:1,int:(n,d)=>Number(n??d),nowIso:()=>new Date().toISOString(),getUsersStore:()=>store,duelGameKey:String,duelIsActiveStatus:()=>false,duelClearPointers:async()=>{}});
vm.runInContext(save,env);
const contenders=await Promise.allSettled([env.duelSaveGame({...stored,winnerUserId:'alice'}),env.duelSaveGame({...stored,winnerUserId:'bob'})]);
assert.equal(contenders.filter(x=>x.status==='fulfilled').length,1);assert.equal(writes,1,'Only one competing outcome can commit');
await assert.rejects(env.duelSaveGame({gameId:'cas',mode:'roulette',revision:1}),/state changed/);

const arsenal=await readFile(new URL('../assets/roulette/arsenal.js',import.meta.url),'utf8');
const storage=new Map();const ui={localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}};ui.window=ui;
vm.runInNewContext(arsenal,ui);assert.equal(ui.RouletteArsenal.choices.length,7);
for(const option of ui.RouletteArsenal.choices){storage.set('rouletteGunPreferenceV1',option.id);assert.equal(ui.RouletteArsenal.selected().id,option.id);}
storage.set('rouletteGunPreferenceV1','invalid');assert.equal(ui.RouletteArsenal.selected().id,'classic');
assert(!arsenal.includes('duelRequest('),'Gun selection must never send player preferences to other players');
const rolls=[];ui.matchMedia=()=>({matches:false});ui.rouletteAnimate=async(target,frames,options)=>rolls.push({frames,options});
let clock=0,draws=0,canvas,sounds=0;
ui.requestAnimationFrame=fn=>queueMicrotask(()=>fn(clock+=30));
ui.RouletteAudioBindings={playSpinButtonChamber:async duration=>{assert.equal(duration,1350);sounds++;}};
ui.document={createElement:()=>canvas={style:{},setAttribute(){},isConnected:true,getContext:()=>({drawImage(){draws++;}}),remove(){this.isConnected=false;}}};
for(const choice of ui.RouletteArsenal.choices){
  storage.set('rouletteGunPreferenceV1',choice.id);
  const picture={naturalWidth:1306,naturalHeight:522,decode:async()=>{}};
  const gun={dataset:{finish:choice.id},querySelector:()=>picture,append(){}};
  await ui.RouletteArsenal.spin({querySelector:selector=>selector==='.rr-revolver'?gun:{}});
  if(choice.laser){assert.equal(rolls.at(-1).options.duration,900);continue;}
  assert(!canvas.isConnected,'Cylinder canvas must be removed after returning to its original texture');
  assert(draws>2000,'Cylinder must render continuous intermediate frames');draws=0;
}
assert.equal(sounds,6,'All six mechanical guns retain synchronized cylinder sound');
for(let y=0;y<=1;y+=.01){assert(Math.abs(ui.RouletteArsenal.cylinderRow(y,Math.PI*8)-y)<1e-10);for(const phase of [0,.2,1,3,8])assert(ui.RouletteArsenal.cylinderRow(y,phase)>=0&&ui.RouletteArsenal.cylinderRow(y,phase)<=1);}
assert.equal(new Set(ui.RouletteArsenal.choices.map(c=>ui.RouletteArsenal.asset(c))).size,7,'Each finish needs its own art');
const cues=[],fill={style:{},getAnimations:()=>[]},bar={firstElementChild:fill};ui.RouletteAudio={laserCue:cue=>cues.push(cue)};
await ui.RouletteArsenal.laserFeedback({querySelector:()=>bar},false);assert.equal(fill.style.transform,undefined,'A malfunction must not spend the charge');
await ui.RouletteArsenal.laserFeedback({querySelector:()=>bar},true);assert.equal(fill.style.transform,'scaleX(0)');assert.deepEqual(cues,['error','fire']);
const audio=await readFile(new URL('../assets/roulette/audio-manager.js',import.meta.url),'utf8');
const synth=audio.slice(audio.indexOf('  let countdownSynthContext'),audio.indexOf('  function diagnostics()'));
const tones=[];let clicks=0;
const param={setValueAtTime(){},exponentialRampToValueAtTime(){}};
const node=()=>({connect(){},disconnect(){},start(){},stop(){},gain:param,frequency:param,Q:param});
class Context {state='running';currentTime=0;sampleRate=44100;destination={};createGain(){return node();}createOscillator(){const n=node();n.frequency={...param,setValueAtTime:f=>tones.push(f)};return n;}createBuffer(_channels,n){return {getChannelData:()=>new Float32Array(n)};}createBufferSource(){clicks++;return node();}createBiquadFilter(){return node();}}
const sound=vm.createContext({global:{AudioContext:Context,setTimeout:()=>{}},enabled:true,unlocked:true,master:1,document:{hidden:false}});
vm.runInContext(synth,sound);for(const label of ['3','2','1','GO!'])assert.equal(sound.countdownCue(label),true);
assert.equal(clicks,4);assert(tones.includes(174.61)&&tones.includes(207.65)&&tones.includes(246.94)&&tones.includes(880));
sound.master=0;assert.equal(sound.countdownCue('3'),true);assert.equal(clicks,4,'Muted countdown must not play or fall back to another sound');
sound.master=1;sound.duckForShot=()=>{};
assert.equal(sound.laserCue('fire'),true);assert(tones.includes(1900)&&tones.includes(3200));
assert.equal(sound.laserCue('error'),true);assert(tones.includes(330)&&tones.includes(220));
const audibleTones=tones.length;sound.master=0;assert.equal(sound.laserCue('fire'),false);assert.equal(tones.length,audibleTones,'Laser audio must respect mute');
// Mounting during the post-spin announcement must preserve the chosen angle.
const motion=await readFile(new URL('../assets/roulette/turn-animation.js',import.meta.url),'utf8');
const mount=motion.slice(motion.indexOf('  function mountCurrentScene()'),motion.indexOf('  installStyles();'));
let resets=0;const facing={};const scene={facing,root:{classList:{contains:()=>true}}};
const hold=vm.createContext({rouletteLatestGame:{gameId:'opponent-first',rouletteState:{turnId:'bob'}},lock:{gameId:'opponent-first',opening:true,animatingFacing:facing,pendingTurnId:''},ensureLayers:()=>scene,currentRoot:()=>scene.root,openingIsDone:()=>false,applyFacing:()=>resets++});
vm.runInContext(mount,hold);for(let i=0;i<20;i++)hold.mountCurrentScene();assert.equal(resets,0,'Polls reset the chooser during the announcement');
console.log('Roulette Frontier passed: six chamber paths, same-position respin, deadlines, timeout idempotency, opening delay, CAS, seven unique guns, continuous cylinders and laser charge outcomes.');
