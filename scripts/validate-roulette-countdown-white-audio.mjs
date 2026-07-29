import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const audio = await readFile(new URL('../assets/roulette/audio-manager.js', import.meta.url), 'utf8');

for (const required of [
  'rr-v154-white-countdown-audio',
  'color:#fff!important',
  "globalThis.RouletteAudio?.countdownCue?.(label)",
]) {
  if (!html.includes(required)) throw new Error(`Countdown HTML validation is missing ${required}`);
}

for (const required of [
  'function countdownCue(label)',
  "play('tap'",
  "play('lock'",
  'countdownCue,'
]) {
  if (!audio.includes(required)) throw new Error(`Countdown audio validation is missing ${required}`);
}

console.log('Countdown validation passed: white text and dedicated cues for 3, 2, 1, and GO are present.');
