import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { rouletteTestRuntime } from './roulette-test-runtime.mjs';

// Render the production scene against isolated production rules. The optional
// ?base=https://preview.example/ mode uses deployed markup, styles and media;
// fixture actions always remain on this local, account-free server.
const fixture = await rouletteTestRuntime();
fixture.reset();
let assetBase = '';
const deployedPages = new Map();
const productionDecorIds = ['rr-backroom-safe-decor-v48', 'rr-premium-cinematic-runtime'];

function scriptWithId(source, id) {
  return [...source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .find(match => new RegExp('\\bid=["\\\']' + id + '["\\\']').test(match[1]))?.[0] || '';
}

async function sceneSource(base) {
  if (!base) return {
    html: await readFile(new URL('../index.html', import.meta.url), 'utf8'),
    presentation: await readFile(new URL('../games/multiplayer/roulette/presentation.js', import.meta.url), 'utf8'),
    deployed: false
  };
  if (deployedPages.has(base)) return deployedPages.get(base);
  const response = await fetch(base);
  if (!response.ok) throw new Error('Preview page returned ' + response.status);
  const html = await response.text();
  const start = html.indexOf('function rouletteResetVisualRuntime(');
  const end = html.indexOf('function duelModeArt(', start);
  if (start < 0 || end < 0) throw new Error('Deployed Roulette presentation was not found');
  // This contiguous block is copied verbatim from the shipped page, including
  // any new presentation helpers that were added between the game fragments.
  const presentation = html.slice(start, end);
  new vm.Script(presentation, { filename: 'deployed-roulette-presentation.js' });
  const source = { html, presentation, deployed: true };
  deployedPages.set(base, source);
  return source;
}

const globals = String.raw`
const duelActive=document.getElementById('fixture');
let duelCurrentGameId='roulette-fixture',duelLastActiveGame=null,duelLastRenderKey='';
let rouletteLatestGame=null,rouletteActionPending=false,rouletteInputLockUntil=0;
const rouletteVisualRuntime={gameId:'',queue:Promise.resolve(),processed:new Set(),busy:false};
const rouletteOpeningCompletedGames=new Set(),rouletteAcceptedSnapshotByGame=new Map(),rouletteStickySpinUsedByGame=new Map();
const rouletteClientCountdown={gameId:'',startedAt:0,done:false,timer:null,lastLabel:''};
const rouletteCompletionHold={pending:new Set(),released:new Set()};
const DUEL_STATUS_RANK={waiting:0,ready:1,countdown:2,playing:3,complete:4};
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>String(value),getAudioContext=()=>null,sfxGain=null;
const duelBindResultButtons=()=>{},duelStartNewGame=()=>location.reload();
function duelPlayCountdownSound(_game,label){window.RouletteAudio?.countdownCue?.(label);}
const fixtureMediaEvents=[];
const fixtureNativePlay=HTMLMediaElement.prototype.play;
HTMLMediaElement.prototype.play=function(...args){
  const source=String(this.src||'').split('/').pop();
  fixtureMediaEvents.push({at:performance.now(),source,phase:'requested'});
  this.addEventListener('playing',()=>fixtureMediaEvents.push({at:performance.now(),source,phase:'playing'}),{once:true});
  return fixtureNativePlay.apply(this,args);
};
const fixtureUrl=path=>location.origin+path;
function duelSetStatus(message){document.getElementById('fixtureStatus').textContent=message;}
function duelRenderActive(game){
  duelCurrentGameId=game.gameId;
  duelLastActiveGame=game;
  if(rouletteHoldLiveResult(game))return;
  if(!roulettePatchMountedRuntime(game)){duelActive.innerHTML=rouletteHtml(game);rouletteBind();}
  rouletteHandleEffects(game);
}
async function duelRequest(_action,data){
  const response=await fetch(fixtureUrl('/fixture/action'),{method:'POST',body:JSON.stringify(data)});
  const result=await response.json();if(!response.ok)throw new Error(result.error);return result;
}
async function duelRefresh(){const result=await fetch(fixtureUrl('/fixture/state')).then(r=>r.json());duelRenderActive(result.game);}
`;

const instrumentation = String.raw`
const proof={gameId:'',assetBase:document.body.dataset.assetBase,events:[],transforms:[],clippedFrames:0,lampOverlaps:0,
  lightSamples:[],lightVariables:[],seatSamples:[],seatAnimations:[],seatRemounts:[],fallStats:{},wrongSideFallFrames:0,errors:[],polls:0};
const nodeIds=new WeakMap();let nextNodeId=1;const nodeId=node=>{if(!node)return null;if(!nodeIds.has(node))nodeIds.set(node,nextNodeId++);return nodeIds.get(node);};
const seatNodes=new Map();
const motionRuns=new Map();let priorFrame=0;
function sampleMotion(now){
  const root=duelActive.querySelector('[data-roulette-game]'),facing=root?.querySelector('[data-roulette-facing]');
  for(const animation of facing?.getAnimations()||[]){
    if(animation.playState!=='running')continue;
    const id=nodeId(animation),timing=animation.effect.getTiming();
    const run=motionRuns.get(id)||{id,gameId:root.dataset.gameId,opening:root.dataset.rouletteOpening==='1',duration:timing.duration,startTime:animation.startTime,frames:0,slowFrames:0,maxGap:0,angles:[]};
    if(animation.startTime!==null)run.startTime=animation.startTime;
    run.frames++;if(priorFrame){const gap=now-priorFrame;run.maxGap=Math.max(run.maxGap,gap);if(gap>50)run.slowFrames++;}
    const matrix=new DOMMatrixReadOnly(getComputedStyle(facing).transform);
    const angle=Math.atan2(matrix.b,matrix.a)*180/Math.PI;
    if(run.angles.length<420)run.angles.push({t:Math.round(Number(animation.currentTime)||0),angle});
    motionRuns.set(id,run);
  }
  const partRuns=proof.partRuns||(proof.partRuns=[]);
  for(const part of root?.querySelectorAll('.rr-hammer-photo,.rr-drum-roll,.rr-shot-flash')||[]){for(const animation of part.getAnimations()){if(animation.playState==='running'&&!partRuns.some(r=>r.id===nodeId(animation)))partRuns.push({id:nodeId(animation),part:part.className,finish:root.querySelector('.rr-revolver')?.dataset.finish,duration:animation.effect.getTiming().duration,frames:animation.effect.getKeyframes().map(f=>({offset:f.offset,transform:f.transform,opacity:f.opacity}))});}}
  const roomLight=root?.querySelector('.rr-muzzle-room-light');
  if(roomLight&&Number(roomLight.style.opacity)>0){const room=root.getBoundingClientRect(),tip=root.querySelector('.rr-muzzle-point').getBoundingClientRect();const x=parseFloat(roomLight.style.getPropertyValue('--rr-shot-x')),y=parseFloat(roomLight.style.getPropertyValue('--rr-shot-y'));const shots=proof.shotLights||(proof.shotLights=[]);shots.push({finish:root.querySelector('.rr-revolver')?.dataset.finish,opacity:Number(roomLight.style.opacity),distance:Math.hypot(x-(tip.left-room.left),y-(tip.top-room.top))});}
  priorFrame=now;requestAnimationFrame(sampleMotion);
}
requestAnimationFrame(sampleMotion);
window.addEventListener('roulette-facing-diagnostic',event=>{proof.events.push(event.detail);});
window.addEventListener('error',event=>proof.errors.push(event.message));
window.addEventListener('unhandledrejection',event=>proof.errors.push(String(event.reason?.message||event.reason)));
function rect(node){if(!node)return null;const b=node.getBoundingClientRect();return {left:b.left,top:b.top,right:b.right,bottom:b.bottom,width:b.width,height:b.height};}
function sample(){
  const root=duelActive.querySelector('[data-roulette-game]');if(!root)return;
  proof.gameId=root.dataset.gameId;proof.sceneVersion=root.dataset.rouletteScene||root.dataset.sceneVersion||'';
  proof.motionRuns=[...motionRuns.values()].map(run=>({...run,angles:run.angles}));
  proof.mediaEvents=fixtureMediaEvents;
  const motion=root.querySelector('[data-roulette-motion]');
  proof.mediaReady=motion?.classList.contains('rr-media-ready');
  proof.visibleBeforeDecode=Boolean(motion&&Number(getComputedStyle(motion).opacity)>0&&[...motion.querySelectorAll('img')].some(image=>!image.complete||!image.naturalWidth));
  const facing=root.querySelector('[data-roulette-facing]'),tableNode=root.querySelector('.rr-table');
  const table=rect(tableNode),gun=rect(facing);proof.sceneBounds=rect(root);proof.tableBounds=table;proof.gunBounds=gun;
  if(facing){const matrix=getComputedStyle(facing).transform;if(!proof.transforms.includes(matrix))proof.transforms.push(matrix);}
  if(gun&&table&&(gun.top<table.top-1||gun.bottom>table.bottom+1||gun.left<table.left-1||gun.right>table.right+1))proof.clippedFrames++;
  const lampNode=root.querySelector('#rrLampPng,.rr-pendant img,.rr-lamp-art');const lamp=rect(lampNode);
  proof.lampBounds=lamp;if(lamp&&table&&lamp.bottom>table.top)proof.lampOverlaps++;
  const style=getComputedStyle(root),variables={};
  for(const name of root.style){if(name.startsWith('--rr-')&&/light|lamp|gun/.test(name))variables[name]=style.getPropertyValue(name).trim();}
  for(const name of ['--rr-light-x','--rr-light-y','--rr-light-table-x','--rr-light-table-y','--rr-lamp-angle','--rr-source-x','--rr-source-y']){
    const value=style.getPropertyValue(name).trim();if(value)variables[name]=value;
  }
  const swing=root.querySelector('.rr126-swing,.rr-pendant,.rr-lamp-swing');
  const light=root.querySelector('.rr130-table-illumination,.rr-table-light-pool');
  const gunLight=root.querySelector('.rr-gun-light-field');
  const lightSample={at:Math.round(performance.now()),gameId:root.dataset.gameId,variables,
    angle:Number(root.dataset.lampAngle),x:Number(root.dataset.lightX),y:Number(root.dataset.lightY),
    bulbX:Number(root.dataset.bulbX),bulbY:Number(root.dataset.bulbY),
    swing:swing?getComputedStyle(swing).transform:null,
    light:light?getComputedStyle(light).backgroundImage:null,lightPosition:light?getComputedStyle(light).backgroundPosition:null,
    surfaceMask:light?getComputedStyle(light).maskImage:null,gunLightTransform:gunLight?getComputedStyle(gunLight).transform:null,
    gunProbes:['a','b','c'].map(key=>rect(root.querySelector('.rr-light-probe-'+key)))};
  proof.lightSamples.push(lightSample);if(proof.lightSamples.length>180)proof.lightSamples.shift();
  proof.lightVariables=[...new Set([...proof.lightVariables,...Object.keys(variables)])];
  const loser=String(rouletteLatestGame?.rouletteState?.loserId||duelLastActiveGame?.loserUserId||'');
  const seats=[...root.querySelectorAll('[data-roulette-seat],.rr-seat')];
  proof.seatCount=seats.length;proof.expectedLoser=loser;
  for(const seat of seats){
    const playerId=String(seat.dataset.seatPlayer||seat.dataset.playerId||seat.dataset.rouletteSeat||seat.dataset.userId||'');
    const side=seat.dataset.seatSide||seat.dataset.side||(/left/.test(seat.className)?'left':'right');
    const id=nodeId(seat),key=root.dataset.gameId+':'+side,previous=seatNodes.get(key);
    if(previous&&previous!==id)proof.seatRemounts.push({at:Math.round(performance.now()),side,previous,current:id});
    seatNodes.set(key,id);
    const figure=seat.querySelector('[data-roulette-figure],.rr-seated-body,.rr-seat-person,.rr-seat-body,.rr-seated-person,.rr-seated-player,.rr-person')||seat;
    const animations=seat.getAnimations({subtree:true}).map(animation=>({id:nodeId(animation),name:animation.animationName||animation.id||'',
      time:Math.round(Number(animation.currentTime)||0),state:animation.playState,target:animation.effect?.target?.className||''}));
    const falling=/fall|hit/.test(seat.className+' '+figure.className+' '+String(seat.dataset.state||''));
    if(falling&&loser&&playerId&&playerId!==loser)proof.wrongSideFallFrames++;
    const activeFall=seat.classList.contains('rr-seat-falling'),fallen=seat.classList.contains('rr-seat-fallen');
    if(activeFall||proof.fallStats[key]){
      const chair=seat.querySelector('.rr-seat-chair'),now=Math.round(performance.now()),bodyRect=rect(figure),chairRect=rect(chair);
      const stats=proof.fallStats[key]||(proof.fallStats[key]={gameId:root.dataset.gameId,side,playerId,expectedLoser:loser,
        startedAt:now,endedAt:null,resultSeenAt:null,fallFrames:0,loserOnly:playerId===loser,fallen:false,
        seatNode:id,bodyNode:nodeId(figure),chairNode:nodeId(chair),identityChanges:0,chairBaseline:chairRect,chairMovement:0,
        minTime:null,maxTime:null,transforms:[],positions:[],animationIds:[],minLeft:bodyRect.left,maxRight:bodyRect.right,
        minTop:bodyRect.top,maxBottom:bodyRect.bottom,minOpacity:1,bodyOffScene:false});
      stats.loserOnly=stats.loserOnly&&playerId===loser;stats.fallen=fallen;
      if(stats.seatNode!==id||stats.bodyNode!==nodeId(figure)||stats.chairNode!==nodeId(chair))stats.identityChanges++;
      if(fallen&&!stats.endedAt)stats.endedAt=now;
      if(root.querySelector('.rr-final')&&!stats.resultSeenAt)stats.resultSeenAt=now;
      if(activeFall){
        stats.fallFrames++;
        const transform=getComputedStyle(figure).transform,position=bodyRect.left.toFixed(2)+','+bodyRect.top.toFixed(2);
        if(!stats.transforms.includes(transform))stats.transforms.push(transform);
        if(!stats.positions.includes(position))stats.positions.push(position);
        stats.minLeft=Math.min(stats.minLeft,bodyRect.left);stats.maxRight=Math.max(stats.maxRight,bodyRect.right);
        stats.minTop=Math.min(stats.minTop,bodyRect.top);stats.maxBottom=Math.max(stats.maxBottom,bodyRect.bottom);
        stats.minOpacity=Math.min(stats.minOpacity,Number(getComputedStyle(figure).opacity));
        const scene=proof.sceneBounds;
        stats.bodyOffScene=stats.bodyOffScene||bodyRect.right<=scene.left||bodyRect.left>=scene.right||bodyRect.bottom<=scene.top||bodyRect.top>=scene.bottom;
        if(chairRect&&stats.chairBaseline)for(const edge of ['left','top','right','bottom'])stats.chairMovement=Math.max(stats.chairMovement,Math.abs(chairRect[edge]-stats.chairBaseline[edge]));
        for(const animation of animations){
          if(!stats.animationIds.includes(animation.id))stats.animationIds.push(animation.id);
          stats.minTime=stats.minTime===null?animation.time:Math.min(stats.minTime,animation.time);
          stats.maxTime=stats.maxTime===null?animation.time:Math.max(stats.maxTime,animation.time);
        }
      }
      stats.uniqueTransforms=stats.transforms.length;stats.uniquePositions=stats.positions.length;
      stats.resultsAfterFall=Boolean(stats.endedAt&&stats.resultSeenAt&&stats.resultSeenAt>=stats.endedAt);
    }
    if(falling||animations.length){
      proof.seatSamples.push({at:Math.round(performance.now()),gameId:root.dataset.gameId,side,playerId,node:id,figure:nodeId(figure),falling,
        transform:getComputedStyle(figure).transform,opacity:getComputedStyle(figure).opacity,animations});
      if(proof.seatSamples.length>160)proof.seatSamples.shift();
      for(const animation of animations)if(!proof.seatAnimations.some(a=>a.id===animation.id))proof.seatAnimations.push({...animation,side,playerId,gameId:root.dataset.gameId});
    }
  }
  document.getElementById('rotationProof').textContent=JSON.stringify(proof);
}
async function fixtureRequest(path){const response=await fetch(fixtureUrl(path),{method:'POST'});const result=await response.json();if(!response.ok)throw new Error(result.error);return result;}
async function reset(){duelSetStatus('');await fixtureRequest('/fixture/reset');duelLastActiveGame=null;rouletteLatestGame=null;rouletteOpeningCompletedGames.clear();duelActive.innerHTML='';await duelRefresh();}
document.getElementById('newFixture').onclick=reset;
document.getElementById('botMove').onclick=async()=>{try{const result=await fixtureRequest('/fixture/bot');duelRenderActive(result.game);}catch(error){duelSetStatus(error.message);}};
async function liveRound(loser){
  const tools=[...document.querySelectorAll('.fixture-tools button')];tools.forEach(button=>button.disabled=true);
  try{
    const prepared=await fixtureRequest('/fixture/prepare?loser='+loser);duelRenderActive(prepared.game);
    // Opening and turn effects settle before the authoritative final shot is
    // requested, so the losing seat is observed throughout the actual live hold.
    await rouletteWait(100);await rouletteVisualRuntime.queue;
    let remaining=150;
    while(remaining--&&(!rouletteOpeningCompletedGames.has(prepared.game.gameId)||window.RouletteTurnLock?.lock?.firing||window.RouletteTurnLock?.lock?.animatingFacing))await rouletteWait(100);
    await rouletteWait(300);
    const result=await fixtureRequest('/fixture/live');duelRenderActive(result.game);
  }catch(error){duelSetStatus(error.message);}finally{tools.forEach(button=>button.disabled=false);}
}
document.getElementById('leftLive').onclick=()=>liveRound('alice');
document.getElementById('rightLive').onclick=()=>liveRound('bob');
document.getElementById('opponentFirst').onclick=async()=>{duelSetStatus('');await fixtureRequest('/fixture/reset?first=bob');duelLastActiveGame=null;rouletteLatestGame=null;rouletteOpeningCompletedGames.clear();duelActive.innerHTML='';await duelRefresh();};
document.getElementById('previewMechanism').onclick=()=>{document.getElementById('previewMechanism').disabled=true;return rouletteQueueVisual(async()=>{const root=duelActive.querySelector('[data-roulette-game]');await RouletteArsenal.spin(root);await rouletteShotSequence(rouletteLatestGame,{lastOutcome:'live',lastShotNumber:Math.random()},rouletteLatestGame.gameId);}).finally(()=>document.getElementById('previewMechanism').disabled=false);};
document.getElementById('expireTurn').onclick=async()=>{const result=await fixtureRequest('/fixture/expire');duelRenderActive(result.game);};
duelRefresh();setInterval(()=>{proof.polls++;duelRefresh();},600);setInterval(sample,80);
`;

async function pageFor(base) {
  const source = await sceneSource(base);
  const styles = [...source.html.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)].map(match => match[0]).join('\n');
  const sceneLinks = [...source.html.matchAll(/<link\b[^>]*>/gi)].map(match => match[0])
    .filter(tag => /rel=["']stylesheet["']/.test(tag) && /\/assets\/roulette\//.test(tag)).join('\n');
  const runtimeTags = [...source.html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/gi)]
    .filter(match => /\/assets\/roulette\/(?:arsenal|turn-clock|motion-profile|audio-manager|spin-audio-policy|opening-spin-sync|audio-bindings|turn-animation|turn-fire|turn-facing-guard|lamp-config|lamp|lamp-bootstrap|scene)\.js(?:\?|$)/.test(match[1]))
    .map(match => match[0].replace(/\sdefer\b/gi, '')).join('\n');
  const localGlobals = source.deployed ? '' : "const rouletteAcceptedRevisionByGame=new Map(),rouletteDebugLines=[],rouletteHitMessages=['You lost this round.'];";
  const decor = productionDecorIds.map(id => scriptWithId(source.html, id)).join('\n');
  const missingDecor = productionDecorIds.filter(id => !scriptWithId(source.html, id));
  if (missingDecor.length) console.log('Scene omits retired production decor runtime: ' + missingDecor.join(', '));
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${base ? '<base href="' + base + '">' : ''}${styles}${sceneLinks}
<style>body{margin:0;padding:8px;background:#080808}#fixture{max-width:1040px;margin:auto}.fixture-tools{position:relative;color:white;text-align:center;font:12px Arial,sans-serif}.fixture-tools button{padding:8px;margin:4px}.fixture-tools button:disabled{cursor:default;opacity:.5}</style>
</head><body data-asset-base="${base || 'local'}"><div class="fixture-tools"><b>Local test · no account or wager · ${base ? 'deployed scene' : 'workspace scene'}</b><div id="fixtureStatus"></div><button id="newFixture">New test round</button><button id="opponentFirst">Opponent first</button><button id="expireTurn">Expire turn in 2 seconds</button><button id="previewMechanism">Preview gun mechanisms</button><button id="botMove">Bot takes shot and passes</button><button id="leftLive">Live round at left seat</button><button id="rightLive">Live round at right seat</button></div><main class="page"><section id="duelScreen" class="duel-screen panel"><div class="duel-grid"><div class="duel-card duel-live-card"><div id="fixture"></div></div><aside class="duel-side-stack">Fixture side panel</aside></div></section></main><output id="rotationProof" hidden></output>
<script>${globals}\n${localGlobals}\n${source.presentation}</script>${decor}${runtimeTags}<script>${instrumentation}</script></body></html>`;
}

async function prepareLive(loser) {
  if (!['alice', 'bob'].includes(loser)) throw new Error('Choose a fixture player');
  if (fixture.get().status !== 'playing') throw new Error('Start a new test round first');
  let state = fixture.get().rouletteState;
  if (state.turnId !== loser) {
    if (state.phase !== 'press_luck') {
      if (state.remaining <= 1) throw new Error('Current player has the live chamber; start a new test round');
      await fixture.act('roulette:shoot', state.turnId);
    }
    await fixture.act('roulette:pass', fixture.get().rouletteState.turnId);
  }
  // Reach the sixth chamber through normal server actions. Neither scene code
  // nor production rules are modified to force an outcome.
  while (fixture.get().status === 'playing' && fixture.get().rouletteState.remaining > 1)
    await fixture.act('roulette:shoot', loser);
}

createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    const path = url.pathname;
    if (path.startsWith('/fixture/')) {
      if (path === '/fixture/reset') {fixture.reset();if(url.searchParams.get('first')==='bob'){fixture.get().rouletteState.turnId='bob';fixture.get().rouletteState.openingSpinWinnerId='bob';}}
      if (path === '/fixture/expire') {fixture.get().rouletteState.turnDeadline=new Date(Date.now()+2500).toISOString();}
      if (path === '/fixture/action') {
        let body = ''; for await (const part of request) body += part;
        const input = JSON.parse(body);await fixture.act(input.choice, 'alice', input);
      }
      if (path === '/fixture/bot') {
        await fixture.act('roulette:shoot', 'bob');
        if (fixture.get().status === 'playing') await fixture.act('roulette:pass', 'bob');
      }
      if (path === '/fixture/prepare') await prepareLive(url.searchParams.get('loser'));
      if (path === '/fixture/live') await fixture.act('roulette:shoot', fixture.get().rouletteState.turnId);
      response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify({ game: fixture.public() }));return;
    }
    if (path === '/') {
      const requestedBase = url.searchParams.get('base');
      assetBase = '';
      if (requestedBase) {
        const parsed = new URL(requestedBase);
        if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Preview base must use HTTP or HTTPS');
        parsed.search = '';parsed.hash = '';assetBase = parsed.href.endsWith('/') ? parsed.href : parsed.href + '/';
      }
      const page = await pageFor(assetBase);
      response.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });response.end(page);return;
    }
    if (!path.startsWith('/assets/') || path.includes('..')) throw new Error('Not found');
    if (assetBase) {
      const deployed = await fetch(new URL(path + url.search, assetBase));
      response.writeHead(deployed.status, { 'Content-Type': deployed.headers.get('content-type') || 'application/octet-stream' });
      response.end(Buffer.from(await deployed.arrayBuffer()));return;
    }
    const file = await readFile(new URL(`..${path}`, import.meta.url));
    const type = path.endsWith('.png') ? 'image/png' : path.endsWith('.webp') ? 'image/webp' : path.endsWith('.mp3') ? 'audio/mpeg' : path.endsWith('.svg') ? 'image/svg+xml' : path.endsWith('.css') ? 'text/css' : path.endsWith('.wav') ? 'audio/wav' : 'text/javascript';
    response.writeHead(200, { 'Content-Type': type });response.end(file);
  } catch (error) {
    response.writeHead(400, { 'Content-Type': 'application/json' });response.end(JSON.stringify({ error: String(error.message) }));
  }
}).listen(8788, '127.0.0.1', () => console.log('Roulette fixture: http://127.0.0.1:8788/ (optional ?base=Netlify-preview-URL)'));
