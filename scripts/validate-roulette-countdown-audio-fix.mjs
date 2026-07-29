import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const injector = await readFile(new URL('./inject-lamp-assets.mjs', import.meta.url), 'utf8');

for (const required of [
  'globalThis.RouletteAudio?.unlock?.();',
  'globalThis.RouletteAudio?.countdownCue?.(label);',
  "if(ctx.state==='suspended')",
  '<style id="rr-v152-deep-red-audible-countdown">',
  'color:#65070b!important;',
  '-webkit-text-stroke:1px rgba(142,20,27,.38);'
]) {
  if (!html.includes(required)) throw new Error(`Final countdown fix is missing ${required}`);
}

const cueIndex = html.indexOf('globalThis.RouletteAudio?.countdownCue?.(label);');
const contextIndex = html.indexOf('const ctx=getAudioContext();', cueIndex);
const earlyReturnIndex = html.indexOf('if(!ctx||!sfxGain)return;', cueIndex);
if (cueIndex < 0 || contextIndex < 0 || earlyReturnIndex < 0 || cueIndex > contextIndex || cueIndex > earlyReturnIndex) {
  throw new Error('The roulette countdown cue must run before the Web Audio availability early return.');
}

for (const required of [
  "await import('./patch-roulette-countdown-audio-fix.mjs');",
  '/assets/roulette/audio-manager.js?v=4&ambience=2&countdown=2&audible=3'
]) {
  if (!injector.includes(required)) throw new Error(`Fresh final countdown loading is missing ${required}`);
}

console.log('Final countdown validation passed: the mobile-safe cue runs before Web Audio checks and the text is deep dark red.');
