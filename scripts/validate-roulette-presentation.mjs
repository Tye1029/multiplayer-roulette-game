import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const audio = await readFile(new URL('../assets/roulette/audio-manager.js', import.meta.url), 'utf8');

for (const required of [
  "else if(!countdownFinished){status='GET READY';sub='';controlNote='Game starts after countdown';}",
  "if(sub)sub.textContent=localPlayerWasHit?'':'The shot was fired…';",
  "sub=meWon?`You won ${money(game.payout||0)}.`:'';",
  "${meWon?`The pot is yours — ${money(game.payout||0)}.`:escapeHtml(rouletteStableMessage(game))}",
  "if(game?.mode==='roulette')",
  "const fundamental=label==='3'?92.50:label==='2'?82.41:label==='1'?73.42:55;",
  '<style id="rr-v149-ui-audio-cleanup">',
  '[data-roulette-game] .rr-scene-countdown{transform:translateY(clamp(42px,7.5vh,62px))!important}',
  '@keyframes rrDreadCountdown'
]) {
  if (!html.includes(required)) throw new Error(`Roulette presentation validation is missing ${required}`);
}

for (const forbidden of [
  '<div class="rr-neon">ONE ROUND · ONE LIFE</div>',
  "sub='The opening spin begins after the 3-2-1 countdown.'",
  "localPlayerWasHit?rouletteStableMessage(game):'The shot was fired…'",
  "sub=meWon?`You won ${money(game.payout||0)}.`:rouletteStableMessage(game);"
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
  'preferAmbientAudioSession();\n    if (unlocked) return;'
]) {
  if (!audio.includes(required)) throw new Error(`Roulette ambience validation is missing ${required}`);
}

console.log('Roulette presentation validation passed: center slogan removed, top instructions/taunts removed, end-screen taunt preserved, countdown repositioned and darkened, ambience raised, and ambient mixing requested when supported.');
