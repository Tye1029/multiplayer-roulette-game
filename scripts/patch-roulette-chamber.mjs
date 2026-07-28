import { readFile, writeFile } from 'node:fs/promises';

const dataUrl = new URL('../netlify/functions/_data.js', import.meta.url);
let source = await readFile(dataUrl, 'utf8');

function replaceOnce(label, before, after) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Roulette chamber patch could not find ${label}.`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Roulette chamber patch found more than one ${label}.`);
  }
  source = source.slice(0, first) + after + source.slice(first + before.length);
}

if (!source.includes('function rouletteNewChamberCycle()')) {
  replaceOnce(
    'the chamber helpers and initial state',
    `function rouletteChamberPosition(value){
  const n=Math.trunc(Number(value));
  return Number.isFinite(n)?Math.min(6,Math.max(1,n)):6;
}
function rouletteInitialState(game,startMs=Date.now()){
  const ids=roulettePlayerIds(game); const first=ids[Math.floor(Math.random()*Math.max(1,ids.length))]||ids[0]||"";
  const bulletPosition=1+Math.floor(Math.random()*6);
  return {phase:"turn",turnId:first,openingSpinWinnerId:first,revolverModel:ROULETTE_REVOLVER_MODEL,remaining:bulletPosition,bulletPosition,shotsFired:0,blankStreak:0,spinUsed:Object.fromEntries(ids.map(id=>[id,false])),lastAction:"opening_spin",lastActorId:"",lastOutcome:"first_player",lastShotNumber:0,winnerId:"",loserId:"",startedAt:new Date(startMs).toISOString(),revision:1};
}`,
    `function rouletteChamberPosition(value){
  const n=Math.trunc(Number(value));
  return Number.isFinite(n)?Math.min(6,Math.max(1,n)):6;
}
function rouletteNewChamberCycle(){
  const bulletPosition=crypto.randomInt(1,7);
  return {bulletPosition,remaining:bulletPosition,chamberCycleId:crypto.randomBytes(8).toString("hex")};
}
function rouletteRemaining(state={}){
  return rouletteChamberPosition(state.remaining??state.bulletPosition??6);
}
function rouletteInitialState(game,startMs=Date.now()){
  const ids=roulettePlayerIds(game); const first=ids[Math.floor(Math.random()*Math.max(1,ids.length))]||ids[0]||"";
  const chamber=rouletteNewChamberCycle();
  return {phase:"turn",turnId:first,openingSpinWinnerId:first,revolverModel:ROULETTE_REVOLVER_MODEL,...chamber,shotsFired:0,blankStreak:0,spinUsed:Object.fromEntries(ids.map(id=>[id,false])),lastAction:"opening_spin",lastActorId:"",lastOutcome:"first_player",lastShotNumber:0,winnerId:"",loserId:"",startedAt:new Date(startMs).toISOString(),revision:1};
}`
  );

  replaceOnce(
    'the hidden public chamber fields',
    'const {bulletPosition:_hidden,remaining:_hiddenRemaining,blankRoundsRemaining:_hiddenBlanks,processedActionIds:_hiddenActionIds,...safe}=st;',
    'const {bulletPosition:_hidden,remaining:_hiddenRemaining,chamberCycleId:_hiddenCycle,blankRoundsRemaining:_hiddenBlanks,processedActionIds:_hiddenActionIds,...safe}=st;'
  );

  replaceOnce(
    'the NPC Spin reroll',
    `    const bulletPosition=1+Math.floor(Math.random()*6);
    s={...s,revolverModel:ROULETTE_REVOLVER_MODEL,bulletPosition,remaining:bulletPosition,blankStreak:0,spinUsed:{...(s.spinUsed||{}),[npcId]:true},lastAction:"spin",lastActorId:npcId,lastOutcome:"spun",revision:Number(s.revision||0)+1};`,
    `    const chamber=rouletteNewChamberCycle();
    s={...s,revolverModel:ROULETTE_REVOLVER_MODEL,...chamber,blankStreak:0,spinUsed:{...(s.spinUsed||{}),[npcId]:true},lastAction:"spin",lastActorId:npcId,lastOutcome:"spun",revision:Number(s.revision||0)+1};`
  );

  replaceOnce(
    'the NPC remaining lookup',
    '\n  const remaining=rouletteChamberPosition(s.bulletPosition||s.remaining||6);',
    '\n  const remaining=rouletteRemaining(s);'
  );

  replaceOnce(
    'the NPC live-round test',
    '\n  const live=rouletteChamberPosition(s.bulletPosition||s.remaining||6)===1;',
    '\n  const live=remaining===1;'
  );

  replaceOnce(
    'the NPC blank countdown',
    `  const nextBulletPosition=rouletteChamberPosition(remaining-1);
  s={...s,revolverModel:ROULETTE_REVOLVER_MODEL,phase:"press_luck",remaining:nextBulletPosition,bulletPosition:nextBulletPosition,shotsFired:Number(s.shotsFired||0)+1,blankStreak:Number(s.blankStreak||0)+1,lastAction:"shoot",lastActorId:npcId,lastOutcome:"blank",lastShotNumber:Number(s.shotsFired||0)+1,revision:Number(s.revision||0)+1};`,
    `  const nextRemaining=rouletteChamberPosition(remaining-1);
  s={...s,revolverModel:ROULETTE_REVOLVER_MODEL,phase:"press_luck",remaining:nextRemaining,shotsFired:Number(s.shotsFired||0)+1,blankStreak:Number(s.blankStreak||0)+1,lastAction:"shoot",lastActorId:npcId,lastOutcome:"blank",lastShotNumber:Number(s.shotsFired||0)+1,revision:Number(s.revision||0)+1};`
  );

  replaceOnce(
    'the player Spin reroll',
    `    const bulletPosition=1+Math.floor(Math.random()*6);
    s={...s,revolverModel:ROULETTE_REVOLVER_MODEL,bulletPosition,remaining:bulletPosition,blankStreak:0,spinUsed:{...(s.spinUsed||{}),[id]:true},lastAction:"spin",lastActorId:id,lastOutcome:"spun",revision:Number(s.revision||0)+1};`,
    `    const chamber=rouletteNewChamberCycle();
    s={...s,revolverModel:ROULETTE_REVOLVER_MODEL,...chamber,blankStreak:0,spinUsed:{...(s.spinUsed||{}),[id]:true},lastAction:"spin",lastActorId:id,lastOutcome:"spun",revision:Number(s.revision||0)+1};`
  );

  replaceOnce(
    'the player live-round test',
    '\n    const live=rouletteChamberPosition(s.bulletPosition||s.remaining||6)===1;',
    '\n    const remaining=rouletteRemaining(s);\n    const live=remaining===1;'
  );

  replaceOnce(
    'the player blank countdown',
    `    const nextBulletPosition=rouletteChamberPosition(rouletteChamberPosition(s.bulletPosition||s.remaining||6)-1);
    s={...s,revolverModel:ROULETTE_REVOLVER_MODEL,phase:"press_luck",remaining:nextBulletPosition,bulletPosition:nextBulletPosition,shotsFired:Number(s.shotsFired||0)+1,blankStreak:Number(s.blankStreak||0)+1,lastAction:"shoot",lastActorId:id,lastOutcome:"blank",lastShotNumber:Number(s.shotsFired||0)+1,revision:Number(s.revision||0)+1};`,
    `    const nextRemaining=rouletteChamberPosition(remaining-1);
    s={...s,revolverModel:ROULETTE_REVOLVER_MODEL,phase:"press_luck",remaining:nextRemaining,shotsFired:Number(s.shotsFired||0)+1,blankStreak:Number(s.blankStreak||0)+1,lastAction:"shoot",lastActorId:id,lastOutcome:"blank",lastShotNumber:Number(s.shotsFired||0)+1,revision:Number(s.revision||0)+1};`
  );
}

for (const required of [
  'function rouletteNewChamberCycle()',
  'const bulletPosition=crypto.randomInt(1,7);',
  'function rouletteRemaining(state={})',
  'const chamber=rouletteNewChamberCycle();',
  'const remaining=rouletteRemaining(s);',
  'const nextRemaining=rouletteChamberPosition(remaining-1);'
]) {
  if (!source.includes(required)) throw new Error(`Patched Roulette source is missing ${required}`);
}

for (const forbidden of [
  '1+Math.floor(Math.random()*6)',
  'bulletPosition:nextBulletPosition',
  'remaining:nextBulletPosition',
  'rouletteChamberPosition(s.bulletPosition||s.remaining||6)'
]) {
  if (source.includes(forbidden)) throw new Error(`Legacy Roulette chamber mutation remains: ${forbidden}`);
}

await writeFile(dataUrl, source);
console.log('Patched Roulette: one stored random 1–6 chamber position, separate countdown, Spin-only rerolls.');
