import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const audio = await readFile(new URL('../assets/roulette/audio-manager.js', import.meta.url), 'utf8');
const injector = await readFile(new URL('./inject-lamp-assets.mjs', import.meta.url), 'utf8');

for (const required of [
  "else if(!countdownFinished){status='GET READY';sub='';controlNote='Game starts after countdown';}",
  "if(sub)sub.textContent=localPlayerWasHit?'':'The shot was fired…';",
  "sub=meWon?`You won ${money(game.payout||0)}.`:'';",
  "${meWon?`The pot is yours — ${money(game.payout||0)}.`:escapeHtml(rouletteStableMessage(game))}",
  "if(game?.mode==='roulette')",
  'globalThis.RouletteAudio?.countdownCue?.(label);',
  "const fundamental=label==='3'?146.83:label==='2'?130.81:label==='1'?116.54:82.41;",
  '<style id="rr-v149-ui-audio-cleanup">',
  '<style id="rr-v150-red-countdown-smoke">',
  '[data-roulette-game] .rr-scene-countdown{transform:translateY(clamp(42px,7.5vh,62px))!important}',
  'color:#b50f18!important',
  '@keyframes rrDreadCountdown',
  '/assets/roulette/audio-manager.js?v=4&ambience=2'
]) {
  if (!html.includes(required)) throw new Error(`Roulette presentation validation is missing ${required}`);
}

if (!injector.includes('/assets/roulette/audio-manager.js?v=4&ambience=2&countdown=2')) {
  throw new Error('The Roulette ambience/countdown cache key is not preserved by the asset injector.');
}

for (const forbidden of [
  '<div class="rr-neon">ONE ROUND · ONE LIFE</div>',
  "sub='The opening spin begins after the 3-2-1 countdown.'",
  "localPlayerWasHit?rouletteStableMessage(game):'The shot was fired…'",
  "sub=meWon?`You won ${money(game.payout||0)}.`:rouletteStableMessage(game);",
  "const fundamental=label==='3'?92.50:label==='2'?82.41:label==='1'?73.42:55;"
]) {
  if (html.includes(forbidden)) throw new Error(`Removed Roulette presentation content remains: ${forbidden}`);
}

for (const required of [
  'room: 0.085',
  'hum: 0.032',
  'heartbeat: 0.040',
  'rumble: 0.022',
  'function preferAmbientAudioSession()',
  "global.navigator.audioSession.type = 'ambient';",
  "roomWanted = ['waiting', 'open', 'ready', 'countdown', 'playing', 'complete'].includes(status);",
  'preferAmbientAudioSession();\n    if (unlocked) return;',
  'function countdownCue(label)'
]) {
  if (!audio.includes(required)) throw new Error(`Roulette ambience validation is missing ${required}`);
}

console.log('Roulette presentation validation passed: center slogan removed, top instructions/taunts removed, end-screen taunt preserved, countdown repositioned, red and audible, ambience raised, and ambient mixing requested when supported.');
