import { readFile, writeFile } from 'node:fs/promises';

const indexUrl = new URL('../index.html', import.meta.url);
const completedModesPattern = /if\s*\(\s*!\s*\(\s*\[\s*["']draw["']\s*,\s*["']fishing["']\s*,\s*["']roulette["']\s*\]\.includes\(game\.mode\)\s*&&\s*game\.status\s*===\s*["']complete["']\s*\)\s*\)\s*\{/;
const completedModesWithSafeCracker = '          if (!(["draw", "fishing", "roulette", "safecracker"].includes(game.mode) && game.status === "complete")) {';

let html = await readFile(indexUrl, 'utf8');

if (!html.includes(completedModesWithSafeCracker)) {
  if (!completedModesPattern.test(html)) {
    throw new Error('Safe Cracker preflight could not find the completed-game persistence mode list.');
  }
  html = html.replace(completedModesPattern, completedModesWithSafeCracker);
  await writeFile(indexUrl, html);
  console.log('Normalized completed-game persistence for Safe Cracker after the shared Roulette injector.');
} else {
  console.log('Safe Cracker completed-game persistence preflight already applied.');
}
