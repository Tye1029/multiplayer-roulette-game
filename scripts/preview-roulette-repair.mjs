import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { rouletteTestRuntime } from './roulette-test-runtime.mjs';

const fixture = await rouletteTestRuntime();
fixture.reset();
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const presentation = await readFile(new URL('../games/multiplayer/roulette/presentation.js', import.meta.url), 'utf8');
const styles = [...html.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/g)].map(m => m[0]).join('\n');
const globals = `
const duelActive=document.getElementById('fixture');
let duelCurrentGameId='roulette-fixture',duelLastActiveGame=null,duelLastRenderKey='';
let rouletteLatestGame=null,rouletteActionPending=false,rouletteInputLockUntil=0;
const rouletteVisualRuntime={gameId:'',queue:Promise.resolve(),processed:new Set(),busy:false};
const rouletteOpeningCompletedGames=new Set(),rouletteAcceptedSnapshotByGame=new Map(),rouletteStickySpinUsedByGame=new Map();
const rouletteAcceptedRevisionByGame=new Map();
const rouletteClientCountdown={gameId:'',startedAt:0,done:false,timer:null,lastLabel:''};
const rouletteCompletionHold={pending:new Set(),released:new Set()},rouletteDebugLines=[],rouletteHitMessages=['You lost this round.'];
const DUEL_STATUS_RANK={waiting:0,ready:1,countdown:2,playing:3,complete:4};
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>String(value),getAudioContext=()=>null,sfxGain=null;
const duelBindResultButtons=()=>{},duelStartNewGame=()=>location.reload();
function duelSetStatus(message){document.getElementById('fixtureStatus').textContent=message;}
function duelRenderActive(game){
  duelCurrentGameId=game.gameId;
  duelLastActiveGame=game;
  if(rouletteHoldLiveResult(game))return;
  if(!roulettePatchMountedRuntime(game)){duelActive.innerHTML=rouletteHtml(game);rouletteBind();}
  rouletteHandleEffects(game);
}
async function duelRequest(_action,data){
  const response=await fetch('/fixture/action',{method:'POST',body:JSON.stringify(data)});
  const result=await response.json();if(!response.ok)throw new Error(result.error);return result;
}
async function duelRefresh(){const result=await fetch('/fixture/state').then(r=>r.json());duelRenderActive(result.game);}
`;
const page = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${styles}
<link rel="stylesheet" href="/assets/roulette/lamp.css?v=18&scene=2">
<link rel="stylesheet" href="/assets/roulette/scene.css?v=roulette-repair-1">
<style>body{margin:0;padding:8px;background:#080808}#fixture{max-width:760px;margin:auto}.fixture-tools{position:relative;color:white;text-align:center}.fixture-tools button{padding:8px;margin:4px}</style>
</head><body><div class="fixture-tools"><b>Local test · no account or wager</b><div id="fixtureStatus"></div><button id="newFixture">New test round</button><button id="botMove">Bot takes shot and passes</button></div><div id="fixture"></div><output id="rotationProof" hidden></output>
<script>${globals}\n${presentation}</script>
<script src="/assets/roulette/turn-animation.js?v=5"></script><script src="/assets/roulette/turn-fire.js?v=2"></script>
<script src="/assets/roulette/turn-facing-guard.js?repair=1"></script>
<script src="/assets/roulette/lamp-config.js?scene=2"></script><script src="/assets/roulette/lamp.js?scene=2"></script><script src="/assets/roulette/lamp-bootstrap.js?scene=2"></script>
<script>
async function reset(){await fetch('/fixture/reset',{method:'POST'});duelLastActiveGame=null;rouletteLatestGame=null;rouletteOpeningCompletedGames.clear();duelActive.innerHTML='';await duelRefresh();}
document.getElementById('newFixture').onclick=reset;
document.getElementById('botMove').onclick=async()=>{const result=await fetch('/fixture/bot',{method:'POST'}).then(r=>r.json());duelRenderActive(result.game);};
duelRefresh();
setInterval(()=>duelRefresh(),600);
const proof={events:[],transforms:[],clippedFrames:0,lampOverlaps:0};
window.addEventListener('roulette-facing-diagnostic',e=>{proof.events.push(e.detail);});
setInterval(()=>{
  const root=duelActive.querySelector('[data-roulette-game]'),facing=root?.querySelector('[data-roulette-facing]');
  if(!facing)return;
  const matrix=getComputedStyle(facing).transform;
  if(!proof.transforms.includes(matrix))proof.transforms.push(matrix);
  const gun=facing.getBoundingClientRect(),table=root.querySelector('.rr-table').getBoundingClientRect();
  if(gun.top<table.top||gun.bottom>table.bottom||gun.left<table.left||gun.right>table.right)proof.clippedFrames++;
  const lamp=root.querySelector('#rrLampPng')?.getBoundingClientRect();
  if(lamp?.bottom>table.top)proof.lampOverlaps++;
  document.getElementById('rotationProof').textContent=JSON.stringify(proof);
},80);
</script></body></html>`;

createServer(async (request, response) => {
  try {
    const path = new URL(request.url, 'http://localhost').pathname;
    if (path.startsWith('/fixture/')) {
      if (path === '/fixture/reset') fixture.reset();
      if (path === '/fixture/action') {
        let body = ''; for await (const part of request) body += part;
        const input = JSON.parse(body);
        await fixture.act(input.choice, 'alice', input);
      }
      if (path === '/fixture/bot') {
        await fixture.act('roulette:shoot', 'bob');
        if (fixture.get().status === 'playing') await fixture.act('roulette:pass', 'bob');
      }
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ game: fixture.public() })); return;
    }
    if (path === '/') { response.writeHead(200, { 'Content-Type': 'text/html' }); response.end(page); return; }
    if (!path.startsWith('/assets/') || path.includes('..')) throw new Error('Not found');
    const file = await readFile(new URL(`..${path}`, import.meta.url));
    const type = path.endsWith('.png') ? 'image/png' : path.endsWith('.css') ? 'text/css' : 'text/javascript';
    response.writeHead(200, { 'Content-Type': type }); response.end(file);
  } catch (error) {
    response.writeHead(400, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: String(error.message) }));
  }
}).listen(8788, '127.0.0.1', () => console.log('Roulette fixture: http://127.0.0.1:8788/'));
