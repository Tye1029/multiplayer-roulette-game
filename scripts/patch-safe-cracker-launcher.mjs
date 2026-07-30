import { readFile, writeFile } from 'node:fs/promises';

const indexUrl = new URL('../index.html', import.meta.url);

function replaceRequired(source, search, replacement, label) {
  if (source.includes(replacement)) return source;
  if (!source.includes(search)) throw new Error(`Safe Cracker launcher patch could not find ${label}.`);
  return source.replace(search, replacement);
}

let html = await readFile(indexUrl, 'utf8');

html = replaceRequired(
  html,
  'choose one of the three multiplayer games.',
  'choose one of the four multiplayer games.',
  'multiplayer test instructions'
);

html = replaceRequired(
  html,
  '.sth-games{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}',
  '.sth-games{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}',
  'multiplayer launcher grid'
);

html = replaceRequired(
  html,
  '.sth-game[data-mode="roulette"]{background:#9d2739}.sth-game[data-mode="draw"]{background:#355f9d}.sth-game[data-mode="fishing"]{background:#24736b}',
  '.sth-game[data-mode="roulette"]{background:#9d2739}.sth-game[data-mode="draw"]{background:#355f9d}.sth-game[data-mode="fishing"]{background:#24736b}.sth-game[data-mode="safecracker"]{background:linear-gradient(145deg,#8b6525,#564016)}',
  'Safe Cracker launcher color'
);

html = replaceRequired(
  html,
  '      <button class="sth-game" data-mode="roulette" disabled>Russian Roulette</button>\n      <button class="sth-game" data-mode="draw" disabled>Draw</button>\n      <button class="sth-game" data-mode="fishing" disabled>Fishing</button>',
  '      <button class="sth-game" data-mode="roulette" disabled>Russian Roulette</button>\n      <button class="sth-game" data-mode="draw" disabled>Draw</button>\n      <button class="sth-game" data-mode="fishing" disabled>Fishing</button>\n      <button class="sth-game" data-mode="safecracker" disabled>Safe Cracker</button>',
  'Safe Cracker launcher button'
);

html = replaceRequired(
  html,
  "if(!['roulette','draw','fishing'].includes(o.value))o.remove()",
  "if(!['roulette','draw','fishing','safecracker'].includes(o.value))o.remove()",
  'multiplayer launcher mode whitelist'
);

html = replaceRequired(
  html,
  '.rnb-games{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:8px}',
  '.rnb-games{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-top:8px}',
  'Remote Bot game grid'
);

html = replaceRequired(
  html,
  '.rnb-games [data-rnb-game="roulette"]{background:#9d2739}.rnb-games [data-rnb-game="draw"]{background:#355f9d}.rnb-games [data-rnb-game="fishing"]{background:#24736b}',
  '.rnb-games [data-rnb-game="roulette"]{background:#9d2739}.rnb-games [data-rnb-game="draw"]{background:#355f9d}.rnb-games [data-rnb-game="fishing"]{background:#24736b}.rnb-games [data-rnb-game="safecracker"]{background:#7b5b20}',
  'Safe Cracker Remote Bot color'
);

html = replaceRequired(
  html,
  '<div class="rnb-games"><button data-rnb-game="roulette">Roulette</button><button data-rnb-game="draw">Draw</button><button data-rnb-game="fishing">Fishing</button></div>',
  '<div class="rnb-games"><button data-rnb-game="roulette">Roulette</button><button data-rnb-game="draw">Draw</button><button data-rnb-game="fishing">Fishing</button><button data-rnb-game="safecracker">Safe Cracker</button></div>',
  'Safe Cracker Remote Bot selector'
);

html = replaceRequired(
  html,
  'st=g?.rouletteState||g?.drawState||g?.fishingState||{}',
  'st=g?.rouletteState||g?.drawState||g?.fishingState||g?.safecrackerState||{}',
  'Remote Bot live Safe Cracker state'
);

await writeFile(indexUrl, html);
console.log('Injected Safe Cracker into the mobile test launcher and Remote Network Bot controls.');
