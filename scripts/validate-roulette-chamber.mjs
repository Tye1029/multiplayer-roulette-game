import { readFile } from 'node:fs/promises';

const source = await readFile(
  new URL('../netlify/functions/_data.js', import.meta.url),
  'utf8'
);

for (const required of [
  'function rouletteNewChamberCycle()',
  'const bulletPosition=crypto.randomInt(1,7);',
  'return {bulletPosition,remaining:bulletPosition,chamberCycleId:crypto.randomBytes(8).toString("hex")};',
  'function rouletteRemaining(state={})',
  'return rouletteChamberPosition(state.remaining??state.bulletPosition??6);',
  'const {bulletPosition:_hidden,remaining:_hiddenRemaining,chamberCycleId:_hiddenCycle',
  'if(s.phase!=="turn")throw new Error("You can only spin before your first shot of the turn.");if(s.spinUsed?.[id])throw new Error("You already used your spin.");',
  'const remaining=rouletteRemaining(s);',
  'const live=remaining===1;',
  'const nextRemaining=rouletteChamberPosition(remaining-1);'
]) {
  if (!source.includes(required)) {
    throw new Error(`Authoritative Roulette chamber rule is missing ${required}`);
  }
}

for (const forbidden of [
  '1+Math.floor(Math.random()*6)',
  'bulletPosition:nextBulletPosition',
  'remaining:nextBulletPosition',
  'rouletteChamberPosition(s.bulletPosition||s.remaining||6)'
]) {
  if (source.includes(forbidden)) {
    throw new Error(`Legacy Roulette reroll/countdown behavior remains: ${forbidden}`);
  }
}

const cycleCreations = (source.match(/const chamber=rouletteNewChamberCycle\(\);/g) || []).length;
if (cycleCreations !== 3) {
  throw new Error(`Expected exactly three chamber-cycle creation paths (game start, NPC Spin, player Spin); found ${cycleCreations}.`);
}

const humanShootStart = source.indexOf('}else if(choice==="roulette:shoot"){');
const humanShootEnd = source.indexOf('}else if(choice==="roulette:pass"){', humanShootStart);
if (humanShootStart < 0 || humanShootEnd < 0) throw new Error('Could not isolate the player Shoot path.');
if (source.slice(humanShootStart, humanShootEnd).includes('rouletteNewChamberCycle()')) {
  throw new Error('Pulling the trigger must never create a new chamber cycle.');
}

const npcShootStart = source.indexOf('  const remaining=rouletteRemaining(s);');
const npcShootEnd = source.indexOf('async function rouletteAdvanceAndSave', npcShootStart);
if (npcShootStart < 0 || npcShootEnd < 0) throw new Error('Could not isolate the NPC Shoot path.');
if (source.slice(npcShootStart, npcShootEnd).includes('rouletteNewChamberCycle()')) {
  throw new Error('An NPC trigger pull must never create a new chamber cycle.');
}

function chamberPosition(value) {
  const number = Math.trunc(Number(value));
  return Number.isFinite(number) ? Math.min(6, Math.max(1, number)) : 6;
}

for (let loadedPosition = 1; loadedPosition <= 6; loadedPosition += 1) {
  const state = {
    bulletPosition: loadedPosition,
    remaining: loadedPosition
  };

  for (let shotNumber = 1; shotNumber <= loadedPosition; shotNumber += 1) {
    const live = chamberPosition(state.remaining) === 1;
    const expectedLive = shotNumber === loadedPosition;

    if (live !== expectedLive) {
      throw new Error(
        `Loaded position ${loadedPosition} resolved incorrectly on shot ${shotNumber}.`
      );
    }

    if (live) break;

    state.remaining = chamberPosition(state.remaining - 1);
    if (state.bulletPosition !== loadedPosition) {
      throw new Error('The stored bullet position changed during a blank countdown.');
    }
  }
}

console.log('Roulette chamber validation passed: independent random 1–6 load, immutable loaded position, countdown to 1, and Spin-only rerolls.');
