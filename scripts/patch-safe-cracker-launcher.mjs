import { readFile, writeFile } from 'node:fs/promises';

const indexUrl = new URL('../index.html', import.meta.url);
const compactDockStart = '<!-- SAFE_CRACKER_COMPACT_DOCK_START -->';
const compactDockEnd = '<!-- SAFE_CRACKER_COMPACT_DOCK_END -->';

function replaceRequired(source, search, replacement, label) {
  if (source.includes(replacement)) return source;
  if (!source.includes(search)) throw new Error(`Safe Cracker launcher patch could not find ${label}.`);
  return source.replace(search, replacement);
}

function upsertBefore(source, start, end, block, anchor, label) {
  const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`${escape(start)}[\\s\\S]*?${escape(end)}\\s*`, 'm');
  const clean = source.replace(pattern, '');
  if (!clean.includes(anchor)) throw new Error(`Safe Cracker launcher patch could not find ${label}.`);
  return clean.replace(anchor, `${block}\n${anchor}`);
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

html = replaceRequired(
  html,
  '<section class="rnb-panel" id="rnbControlPanel" data-collapsed="0">',
  '<section class="rnb-panel" id="rnbControlPanel" data-collapsed="1">',
  'collapsed Remote Bot dock default'
);

html = replaceRequired(
  html,
  "if(t){const p=$(t.dataset.rnbToggle),closed=p.dataset.collapsed==='1';p.dataset.collapsed=closed?'0':'1';t.lastElementChild.textContent=closed?'▼':'▲';return}",
  "if(t){const p=$(t.dataset.rnbToggle),closed=p.dataset.collapsed==='1';if(closed)document.querySelectorAll('#rnbDock .rnb-panel').forEach(panel=>{panel.dataset.collapsed='1'});p.dataset.collapsed=closed?'0':'1';t.lastElementChild.textContent=closed?'▼':'▲';return}",
  'single-open compact debug dock behavior'
);

const compactDockBlock = `${compactDockStart}
<style id="safe-cracker-compact-debug-dock">
#rnbDock{left:max(6px,env(safe-area-inset-left))!important;right:auto!important;bottom:max(8px,env(safe-area-inset-bottom))!important;width:54px!important;max-width:calc(100vw - 12px);display:flex!important;flex-direction:column;align-items:flex-start;gap:7px;filter:drop-shadow(0 10px 22px rgba(0,0,0,.58))!important}
#rnbDock .rnb-panel{width:54px;height:54px;margin:0!important;border-radius:13px;overflow:hidden;pointer-events:auto;transition:width .18s ease,height .18s ease,max-height .18s ease}
#rnbDock .rnb-head{width:54px;height:54px;min-height:54px;padding:0!important;justify-content:center!important;border-radius:12px;text-align:center!important}
#rnbDock .rnb-head>span:first-child{display:flex;align-items:center;justify-content:center;font-size:0;line-height:1}
#rnbDock .rnb-head>span:last-child,#rnbDock .rnb-dot{display:none!important}
#rnbDock .rnb-head>span:first-child::after{font:900 10px/1 Arial,sans-serif;letter-spacing:.35px;color:#fff}
#rnbControlPanel .rnb-head>span:first-child::after{content:"BOT"}
#rnbGamePanel .rnb-head>span:first-child::after{content:"GAME"}
#rnbBotPanel .rnb-head>span:first-child::after{content:"LOG"}
#rnbDock .rnb-panel[data-collapsed="0"]{width:min(390px,calc(100vw - 72px));height:auto;max-height:min(70dvh,620px);overflow:auto}
#rnbDock .rnb-panel[data-collapsed="0"] .rnb-head{width:100%;height:44px;min-height:44px;padding:0 12px!important;justify-content:flex-start!important;text-align:left!important}
#rnbDock .rnb-panel[data-collapsed="0"] .rnb-head>span:first-child::after{font-size:12px;letter-spacing:.5px}
#rnbDock .rnb-panel[data-collapsed="0"] .rnb-body{display:block}
@media(max-width:520px){#rnbDock{left:max(5px,env(safe-area-inset-left))!important;right:auto!important;bottom:max(6px,env(safe-area-inset-bottom))!important;width:50px!important}#rnbDock .rnb-panel,#rnbDock .rnb-head{width:50px;height:50px;min-height:50px}#rnbDock .rnb-panel[data-collapsed="0"]{width:calc(100vw - 62px);max-height:68dvh}}
</style>
${compactDockEnd}`;

html = upsertBefore(html, compactDockStart, compactDockEnd, compactDockBlock, '</head>', 'document head for compact debug dock');

await writeFile(indexUrl, html);
console.log('Injected Safe Cracker launcher, Remote Bot controls, and compact left-side debug dock.');
