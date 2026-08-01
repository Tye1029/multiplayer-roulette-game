import { readdir, readFile } from 'node:fs/promises';

const scriptsDir = new URL('./', import.meta.url);
const names = (await readdir(scriptsDir)).filter(name => name.endsWith('.mjs'));
const files = [
  ['assets/safe-cracker/safe-cracker.css', new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url)],
  ...names.map(name => [`scripts/${name}`, new URL(name, scriptsDir)])
];

const selectorPattern = /[^\n{}]*\.sc-dial(?:-wrap|-face|-hub)?::(?:before|after)[^\n{]*\{/g;
for (const [label, url] of files) {
  const source = await readFile(url, 'utf8');
  const matches = [...source.matchAll(selectorPattern)];
  if (!matches.length) continue;
  console.log(`\n===== ${label} =====`);
  for (const match of matches) {
    const start = Math.max(0, match.index - 120);
    const end = Math.min(source.length, match.index + 700);
    console.log(source.slice(start, end));
  }
}
