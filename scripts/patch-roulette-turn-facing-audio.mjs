import { readFile, writeFile } from 'node:fs/promises';

const policyUrl = new URL('../assets/roulette/spin-audio-policy.js', import.meta.url);
let policy = await readFile(policyUrl, 'utf8');

function replaceOnce(source, label, before, after) {
  if (source.includes(after)) return source;
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Roulette turn audio patch could not find ${label}.`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Roulette turn audio patch found more than one ${label}.`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

policy = replaceOnce(
  policy,
  'the player-change table movement envelope',
  `      playClip(TABLE_MOVE, {
        group: 'turn-move',
        volume: 0.052,
        rate: 1.06,
        start: 0.14,
        duration: 0.82,
        fadeIn: 0.04,
        fadeOut: 0.22
      });`,
  `      playClip(TABLE_MOVE, {
        group: 'turn-move',
        volume: 0.044,
        rate: 1.08,
        start: 0.22,
        duration: 0.56,
        fadeIn: 0.03,
        fadeOut: 0.30
      });`
);

for (const required of [
  "group: 'turn-move'",
  'volume: 0.044',
  'start: 0.22',
  'duration: 0.56',
  'fadeOut: 0.30'
]) {
  if (!policy.includes(required)) throw new Error(`Final turn movement audio is missing ${required}`);
}

await writeFile(policyUrl, policy);
console.log('Patched Roulette turn movement: the wood slide fades out before its terminal knock.');
