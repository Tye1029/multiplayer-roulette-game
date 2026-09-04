// Runtime regressions + an offline browser fixture using the real fishing
// functions and the site's complete stylesheet cascade. No accounts or wagers.
// node scripts/validate-fishing-ui.mjs [--serve]
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import http from 'node:http';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/\r\n/g,'\n');
function between(start,end){const a=html.indexOf(start),b=html.indexOf(end,a);assert(a>=0&&b>a,`Missing source section: ${start}`);return html.slice(a,b);}
function fn(name){const a=html.indexOf(`    function ${name}(`);assert(a>=0,`Missing function ${name}`);const b=html.indexOf('\n    }',a);assert(b>a);return html.slice(a,b+6);}
const declarations=between('    let duelFishingTimer =','    let duelDrawLocalTimer =');
const projection=between('    const fishingV3 =','    function fishingCountdownLabel(');
const art=between('    const FISHING_SPECIES=','    function duelFishingEnsureController(');
const log=between('    function duelFishingPreviewVariant(','    function duelFishingResultOverlay(');
const clocks=fn('duelCountdownNow')+'\n'+fn('duelSharedCountdownLabel');
const stubs=`
let duelCountdownClock={gameId:'',startMs:0,offsetMs:0,acceptedAt:0};
const getAudioContext=()=>null;
const duelFishingClearAudioTimeouts=()=>{},duelFishingStopOcean=()=>{},duelFishingRippleRumble=()=>{};
const duelFishingStartOcean=()=>{},duelFishingPlayTick=()=>{},duelFishingPlayTimeout=()=>{},duelFishingHandleAudio=()=>{};
const duelFishingPlaySplash=()=>{},duelFishingPlayFlop=()=>{},duelFishingScheduleAudio=()=>{};
const duelFishingHideResultPortal=()=>{},duelFishingStopCompletionTicker=()=>{};
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>value+' Test Tickets';
`;
let now=Date.parse('2026-09-04T12:00:00Z');
const epoch=now;
const context=vm.createContext({console,Date:class extends Date{static now(){return now;}},performance:{now:()=>now-epoch},navigator:{},setInterval:()=>1,clearInterval:()=>{},setTimeout:()=>1});
vm.runInContext(declarations+stubs+art+projection+clocks+log,context);
const run=code=>vm.runInContext(code,context);
run(`var sample={gameId:'clock-test',mode:'fishing',status:'countdown',serverNow:new Date(Date.now()).toISOString(),startAt:new Date(Date.now()+3000).toISOString(),isCreator:true,fishingState:{roundId:'round-1'}}`);
assert.equal(run('duelSharedCountdownLabel(sample)'),'3');
const labels=[];
for(let i=0;i<60;i++){now+=50;labels.push(run('duelSharedCountdownLabel(sample)'));}
assert(labels.includes('2')&&labels.includes('1'));
assert.equal(labels.at(-1),'GO!','Countdown must finish without new network packets');
run(`sample.serverNow=new Date(Date.now()-2000).toISOString()`);
assert.equal(run('duelSharedCountdownLabel(sample)'),'GO!','A delayed packet cannot rewind the countdown');
run(`sample={...sample,status:'playing',serverNow:sample.startAt};fishingV3Hydrate(sample)`);
assert.equal(run('fishingV3Remaining()'),60000,'Scheduled start bridges missing fish state');
now+=5500;run('fishingV3Hydrate(sample)');
assert.equal(run('fishingV3Remaining()'),54500,'Reusing a snapshot must not reset the timer');
run(`sample.fishingState={...sample.fishingState,serverEpochMs:Date.now(),endEpochMs:Date.now()+52000,events:[{id:'bite',atMs:Date.now()+1000,endAtMs:Date.now()+5000}]};fishingV3Hydrate(sample)`);
assert.equal(run('fishingV3Remaining()'),52000,'A fresher server deadline can shorten the clock');
now+=1500;run('fishingV3Hydrate(sample)');
assert.equal(run('fishingV3Active().id'),'bite');
assert.equal(run('fishingV3Remaining()'),50500);
now+=60000;run('fishingV3Hydrate(sample)');
assert.equal(run('fishingV3Remaining()'),0,'Expired timer must not restart');
run(`sample={...sample,gameId:'late-join',fishingState:{roundId:'late',serverEpochMs:Date.now(),endEpochMs:Date.now()-10}};fishingV3Hydrate(sample)`);
assert.equal(run('fishingV3Remaining()'),0,'Joining after deadline must show zero');
run(`sample={...sample,gameId:'remaining-only',fishingState:{roundId:'fallback',remainingMs:17200}};delete sample.startAt;delete sample.serverNow;fishingV3Hydrate(sample)`);
assert.equal(run('fishingV3Remaining()'),17200);
for(const variant of ['golden','silver','crystal','albino','midnight','emerald','aurora','celestial','nemo'])assert.match(run(`duelFishingRareBadge('${variant}')`),/>Rare</);
assert.equal(run('duelFishingRareBadge()'),'');
assert.match(run(`duelFishingLogbookHtml({species:{nemo:{name:'Nemo',bestVariant:'nemo',bestSize:35,count:1,rareCount:1}}})`),/Nemo<span class="fishing-log-rare-badge" aria-label="Rare fish"><svg/);
const sortedBook=run(`duelFishingLogbookHtml({species:{catfish:{name:'Mekong Giant Catfish',bestVariant:'emerald',bestSize:93.3,count:1,rareCount:1},smelt:{name:'Smelt',bestVariant:'standard',bestSize:16.6,count:1},minnow:{name:'Silver Minnow',bestVariant:'standard',bestSize:18,count:1}}})`);
const rareRows=[...sortedBook.matchAll(/data-fish-rarity="(rare|regular)"/g)].map(m=>m[1]);
assert.equal(rareRows.length,56);
assert.deepEqual(rareRows.slice(-4),['rare','rare','rare','rare'],'Named rares and caught rare variants belong at the bottom');
assert(rareRows.slice(0,-4).every(value=>value==='regular'));
assert.equal((sortedBook.match(/class="fishing-log-section"/g)||[]).length,1);
assert.match(sortedBook,/fish\/silver-minnow-v2.png/,'Silver Minnow is a species, not a silver variant of a missing Minnow');
assert.equal(run(`duelFishingBaseName('Golden Silver Minnow')`),'Silver Minnow');
run(`var rematchFixture={gameId:'rematch',mode:'fishing',status:'complete',remoteNetworkTest:true,creator:{userId:'human'},joiner:{userId:'bot',isRemoteBot:true}}`);
assert.equal(run('duelFishingCanAcceptRematch(rematchFixture)'),false,'No unsolicited bot-first rematches');
run(`rematchFixture.rematch={requestedBy:{human:new Date().toISOString()},expiresAt:new Date(Date.now()+10000).toISOString()}`);
assert.equal(run('duelFishingCanAcceptRematch(rematchFixture)'),true,'An active human offer can be accepted');
assert.equal(run('duelFishingCanAcceptRematch(rematchFixture,Date.now()+11000)'),false,'Expired offers cannot be retried');
assert.equal(run('duelFishingCanAcceptRematch(null)'),false,'Missing fresh state cannot authorize a rematch');
run(`rematchFixture.rematch.requestedBy.bot='accepted'`);
assert.equal(run('duelFishingCanAcceptRematch(rematchFixture)'),false,'Accepted offers must not be sent twice');
vm.runInContext(`
let scheduledRematches=[],sentRematches=[],freshRematch=null;
const rnbRematchRuntime={gameId:'',handledKey:'',timer:0,requesting:false};
const rnbClearRematchTimer=()=>{rnbRematchRuntime.timer=0;scheduledRematches=[];};
const rnbHash=()=>0,botLogs=[],line=()=>{},render=()=>{},rnbAdoptGame=()=>{};
const rnbFetchAuthoritativeGame=async()=>freshRematch;
const duelRequest=async(action,args)=>{sentRematches.push(args);return {};};
`,context);
context.setTimeout=callback=>{run('scheduledRematches').push(callback);return 1;};
vm.runInContext(between(' function rnbScheduleRematch(game){',' setInterval(()=>{'),context);
run(`rematchFixture.rematch={};rnbScheduleRematch(rematchFixture)`);
assert.equal(run('scheduledRematches.length'),0,'Scheduler must not schedule bot-first Fishing requests');
run(`rematchFixture.rematch={requestedBy:{human:'offer-1'},expiresAt:new Date(Date.now()+10000).toISOString()};rnbScheduleRematch(rematchFixture)`);
assert.equal(run('scheduledRematches.length'),1);
run(`freshRematch={...rematchFixture,rematch:{...rematchFixture.rematch,expiresAt:new Date(Date.now()-1).toISOString()}}`);
await run('scheduledRematches.shift()()');
assert.equal(run('sentRematches.length'),0,'Freshly expired offer must never submit a bot action');
run(`rnbScheduleRematch(rematchFixture);freshRematch=null`);
await run('scheduledRematches.shift()()');
assert.equal(run('sentRematches.length'),0,'Failed refresh must not fall back to a stale Fishing offer');
run(`rnbScheduleRematch(rematchFixture);freshRematch=rematchFixture`);
await run('scheduledRematches.shift()()');
assert.equal(run('sentRematches[0].choice'),'remote-bot-rematch');
run('rnbScheduleRematch(rematchFixture)');
assert.equal(run('scheduledRematches.length'),0,'The same accepted offer cannot be scheduled twice');
console.log('Fishing UI runtime tests passed: countdown, round time, stale snapshots, event windows, star stamps, rare-last ordering, Silver Minnow art, and guarded bot rematch acceptance.');

if(process.argv.includes('--serve')){
  const styles=[...html.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>|<link\b[^>]*rel="stylesheet"[^>]*>/g)].map(m=>m[0]).join('\n');
  const renderer=between('    duelFishingHtml=function(game){','    const fishingV3NavIds=');
  const fixture=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">${styles}<script src="/assets/fishing/fishing-controller.js"></script><style>body{margin:0;padding:12px;background:#08121c}#fixture{width:min(100%,1100px);margin:auto}.fixture-tools{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}.fixture-tools button{font:14px system-ui;padding:8px}.fixture-book{margin:12px auto;max-width:800px}.fixture-label{color:#d7e8f0;font:14px system-ui}#duelActive{width:100%}</style></head><body class="duel-mode"><main id="fixture"><p class="fixture-label">Offline UI check — real game renderer, simulated server state, no account or wager</p><div class="fixture-tools"><button id="restart">Restart countdown</button><button id="pause">Pause test updates</button><button id="book">Show rare logbook</button></div><div id="duelActive"></div><div class="fixture-book" id="log"></div></main><script>
${declarations}${stubs}${art}${projection}${clocks}${log}
${fn('duelFishingPlayerChip')}${fn('duelBindFishing')}${fn('duelFishingResultOverlay')}${renderer}
const duelFishingCompletionElapsed=()=>10000;
// Fixture-only identity; never reads or writes a real account's browser storage.
const localStorage={getItem:()=> 'fixture-user'};
const duelActive=document.getElementById('duelActive');
const startSiteAudio=()=>{},duelFishingEnsureController=()=>{},duelSetStatus=()=>{};
let duelCurrentGameId='offline-check',game,paused=false,phaseTimer,pollTimer;
const duelPatchSharedCountdown=()=>{};
async function duelRequest(action,details){
 const event=game.fishingState.events.find(e=>e.id===String(details.choice).slice(5));
 const caught={eventId:event.id,name:'Emerald Mekong Giant Catfish',baseName:'Mekong Giant Catfish',variant:'emerald',rarity:'uncommon',size:93.3};
 game.fishingState.creatorCatch=caught;game.fishingState.myCatch=caught;event.claimedBy='fixture';
 return {game};
}
function start(){
 clearInterval(phaseTimer);clearInterval(pollTimer);duelActive.querySelector('[data-fishing-game]')?._fishingController?.destroy();fishingV3Reset();
 const start=Date.now()+3000;
 game={gameId:'offline-'+start,mode:'fishing',status:'countdown',isCreator:true,isPlayer:true,serverNow:new Date().toISOString(),startAt:new Date(start).toISOString(),creator:{name:'Angler One'},joiner:{name:'Angler Two'},fishingState:{roundId:'round-'+start,startAt:new Date(start).toISOString(),endAt:new Date(start+60000).toISOString(),serverEpochMs:Date.now(),events:Array.from({length:8},(_,i)=>({id:'bite-'+i,atMs:start+1200+i*7000,endAtMs:start+7200+i*7000,ripple:158,special:i%2===0}))}};
 duelCurrentGameId=game.gameId;duelActive.innerHTML='<div class="duel-arena fishing-clean">'+duelFishingHtml(game)+'</div>';duelBindFishing(duelActive);
 let portal=document.getElementById('duelCountdownPortal');if(!portal){portal=document.createElement('div');portal.id='duelCountdownPortal';portal.dataset.duelMode='fishing';portal.innerHTML='<div class="duel-countdown-frame"><span class="duel-countdown-label">LINES IN</span><div class="duel-countdown-number">3</div></div>';document.body.append(portal);}portal.classList.add('show');
 phaseTimer=setInterval(()=>{const label=duelSharedCountdownLabel(game);portal.querySelector('.duel-countdown-number').textContent=label;if(label==='GO!'){clearInterval(phaseTimer);setTimeout(()=>portal.classList.remove('show'),250);game={...game,status:'playing',serverNow:new Date().toISOString(),fishingState:{...game.fishingState,serverEpochMs:Date.now()}};duelFishingPatchDom(game);}},50);
 pollTimer=setInterval(()=>{if(paused||game.status!=='playing')return;game={...game,serverNow:new Date().toISOString(),fishingState:{...game.fishingState,serverEpochMs:Date.now()}};duelFishingPatchDom(game);},650);
}
document.getElementById('restart').onclick=start;
document.getElementById('pause').onclick=event=>{paused=!paused;event.target.textContent=paused?'Resume test updates':'Pause test updates';};
document.getElementById('book').onclick=()=>{
 clearInterval(phaseTimer);clearInterval(pollTimer);fishingV3Stop();
 document.getElementById('duelCountdownPortal')?.classList.remove('show');
 const logbook={totalCaught:4,rareCaught:3,species:{nemo:{name:'Nemo',bestVariant:'nemo',bestSize:64.2,count:1,rareCount:1},koi:{name:'Aurora Koi',bestVariant:'aurora',bestSize:48,count:1,rareCount:1},catfish:{name:'Mekong Giant Catfish',bestVariant:'emerald',bestSize:93.3,count:1,rareCount:1},smelt:{name:'Smelt',bestVariant:'standard',bestSize:16.6,count:1}}};
 const result={...game,status:'complete',winnerUserId:'fixture-user',fishingState:{...game.fishingState,creatorCatch:{eventId:'caught-1',name:'Emerald Mekong Giant Catfish',variant:'emerald',rarity:'uncommon',size:93.3},joinerCatch:{eventId:'caught-2',name:'Smelt',variant:'standard',rarity:'regular',size:16.6}},result:{creator:{logbook}}};
 let portal=document.getElementById('fishingResultPortal');if(!portal){portal=document.createElement('div');portal.id='fishingResultPortal';document.body.append(portal);}
 portal.innerHTML=duelFishingResultOverlay(result);document.body.classList.add('fishing-result-open');duelBindFishingLogbookPreview(portal);
 for(const button of portal.querySelectorAll('.fishing-result-actions button'))button.onclick=()=>{portal.remove();document.body.classList.remove('fishing-result-open');start();};
};
start();</script></body></html>`;
  const mime={'.css':'text/css','.js':'text/javascript','.png':'image/png','.html':'text/html','.svg':'image/svg+xml','.mp3':'audio/mpeg','.woff2':'font/woff2'};
  http.createServer((req,res)=>{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/__fishing-ui-check'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(fixture);}
    const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
    if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
    fs.readFile(file,(error,bytes)=>{res.writeHead(error?404:200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(error?'Not found':bytes);});
  }).listen(4173,'127.0.0.1',()=>console.log('Fishing UI check: http://127.0.0.1:4173/__fishing-ui-check'));
}
