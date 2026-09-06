import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const cssUrl = new URL('assets/mountain-race/mountain-race.css', root);
const marker = 'MOUNTAIN_RACE_PERSISTENT_MOUNT_PREFLIGHT';

let css = await readFile(cssUrl, 'utf8');
if (!css.includes(marker)) {
  css += `\n\n/* ${marker} */\n[data-mountain-race-mount][data-mr-visual-stable="14"] {\n  background-color: #020713;\n}\n`;
  await writeFile(cssUrl, css);
}

console.log('Prepared the persistent Summit Sprint visual mount for the V14 rebuild.');
