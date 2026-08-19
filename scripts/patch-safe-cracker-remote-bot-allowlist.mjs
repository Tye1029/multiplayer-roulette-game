import { readFile, writeFile } from 'node:fs/promises';

const dataUrl = new URL('../netlify/functions/_data.js', import.meta.url);
const replacement = 'if (!["roulette", "draw", "fishing", "safecracker"].includes(String(game.mode || ""))) throw new Error("Remote Network Bot supports Roulette, Draw, Fishing, and Safe Cracker.");';
const legacyPattern = /if\s*\(\s*!\s*\[\s*["']roulette["']\s*,\s*["']draw["']\s*,\s*["']fishing["']\s*\]\.includes\(String\(game\.mode\s*\|\|\s*["']["']\)\)\s*\)\s*throw new Error\(["']Remote Network Bot supports Roulette, Draw, and Fishing\.["']\);/g;

let data = await readFile(dataUrl, 'utf8');
let replacements = 0;
data = data.replace(legacyPattern, () => {
  replacements += 1;
  return replacement;
});

if (!data.includes(replacement)) {
  throw new Error('Safe Cracker Remote Bot allowlist patch could not find or create the four-game server allowlist.');
}
if (data.includes('Remote Network Bot supports Roulette, Draw, and Fishing.')) {
  throw new Error('A legacy three-game Remote Bot restriction still remains after the Safe Cracker allowlist sweep.');
}

await writeFile(dataUrl, data);
console.log(`Safe Cracker Remote Bot allowlist sweep removed ${replacements} remaining legacy restriction${replacements === 1 ? '' : 's'}.`);
