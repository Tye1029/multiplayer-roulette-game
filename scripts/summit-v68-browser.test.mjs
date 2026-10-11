import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.RPS_PLAYWRIGHT_MODULE||'playwright');
const model=require('../netlify/functions/mountain-race/state-model');
const root=path.resolve('dist'),out=path.join(os.tmpdir(),'codex-summit-v68');await fs.mkdir(out,{recursive:true});
const html='<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:20px;background:#111820}*{box-sizing:border-box}@media(max-width:600px){body{padding:0}}</style><link rel="stylesheet" href="/assets/mountain-race/scene-v68.css"><div data-mountain-race-mount></div><script src="/assets/mountain-race/scene-v68.js"></script><script src="/assets/mountain-race/mountain-race-multiplayer.js"></script>';
const server=http.createServer(async(req,res)=>{try{if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end(html);return;}const f=path.resolve(root,'.'+req.url.split('?')[0]);if(!f.startsWith(root+path.sep))throw 0;res.setHeader('Content-Type',({'.js':'application/javascript','.css':'text/css','.png':'image/png'})[path.extname(f)]||'application/octet-stream');res.end(await fs.readFile(f));}catch{res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.RPS_BROWSER||undefined});
let state=model.createMountainRaceState({playerIds:['a','b'],countdownMs:0}),round=1,stamp=Date.now();let releaseDelay=70;const pages=[],errors=[];
function performance(id){const p=state.players[id],elapsedMs=p.finishedAt?Date.parse(p.finishedAt)-Date.parse(state.startAt):null;return {elapsedMs,previousBestMs:elapsedMs===null?11000:elapsedMs+1000,bestMs:elapsedMs===null?11000:elapsedMs};}
function game(id){const pub=model.publicMountainRaceState(state,id),other=id==='a'?'b':'a';return {gameId:'scene-'+round,mode:'mountainrace',wager:1000,payout:state.completedAt?1934:0,status:state.completedAt?'complete':'playing',serverNow:new Date().toISOString(),revision:state.revision,mountainraceState:{...pub,me:{...pub.players[id],name:id==='a'?'Alpine Ace':'Cliff Runner',performance:performance(id)},opponent:{...pub.players[other],name:other==='a'?'Alpine Ace':'Cliff Runner',performance:performance(other)},inputPrompts:state.sequence.slice(pub.players[id].promptIndex),canSubmit:!state.completedAt,viewerWon:state.winnerId===id,tie:false}};}
try{
 for(const [i,id] of ['a','b'].entries()){
  const p=await browser.newPage({viewport:{width:i?390:1100,height:900},hasTouch:Boolean(i),isMobile:Boolean(i)});pages.push(p);p.on('pageerror',e=>errors.push(e.message));await p.exposeFunction('submitToServer',async body=>{await new Promise(r=>setTimeout(r,body.choice?.includes(':release:')?releaseDelay:70));const confirmed=[];let ignoredAction=false;if(body.inputBatch){for(const input of body.inputBatch){state=model.applyMountainRaceInput(state,id,input.control,input.actionId,Date.now());confirmed.push(input.actionId);}}else{const [,phase,distance,token]=body.choice.split(':');const before=state;state=model.applyMountainRaceCharge(state,id,phase,token,body.actionId,{...body,distance:Number(distance)},Date.now());ignoredAction=state===before;}for(let j=0;j<pages.length;j++)if(j!==i)await pages[j].evaluate(g=>window.MountainRaceMultiplayer.adopt(g),game(j?'b':'a'));const response={game:game(id),confirmedActionIds:confirmed,ignoredAction,ignoreReason:ignoredAction?'charge-warming':undefined};await new Promise(r=>setTimeout(r,70));return response;});await p.goto('http://127.0.0.1:'+server.address().port);await p.evaluate(g=>{window.__mountainRaceBridge={submit:async body=>{const d=await window.submitToServer(body);window.MountainRaceMultiplayer.adopt(d.game);window.confirmedRevision=d.game.revision;return d;},refresh:()=>{},rematch:()=>{window.rematchClicked=true;},newGame:()=>{window.newGameClicked=true;}};window.MountainRaceMultiplayer.adopt(g);},game(id));
 }
 await pages[0].screenshot({path:path.join(out,'desktop-start.png')});await pages[1].screenshot({path:path.join(out,'mobile-start.png')});
 async function tap(i,wrong=false){const p=pages[i],id=i?'b':'a',index=state.players[id].promptIndex,expected=state.sequence[index],token=wrong?model.MOUNTAIN_RACE_CONTROLS.find(t=>t!==expected):expected;const revision=state.revision;await p.locator('[data-mr-network-input="'+token+'"]').click();await p.waitForFunction(r=>window.confirmedRevision>r,revision,{timeout:10000});await p.waitForFunction(({id,index,wrong})=>Number(document.querySelector('.m68-key').dataset.mrDisplayedIndex)===(wrong?Math.max(0,index-1):index+1),{id,index,wrong},{timeout:10000}).catch(async e=>{console.error('tap failed',id,index,wrong,JSON.stringify(state.players[id]),await p.locator('.m68-status').innerText());throw e;});}
 for(let j=0;j<5;j++)await tap(0);await tap(0,true);assert.equal(state.players.a.promptIndex,4);assert.equal(state.players.a.rejectedInputs,1);
 for(let j=0;j<12;j++){await tap(0);if(j%2===0)await tap(1);}
 await pages[0].waitForTimeout(600);assert.equal(await pages[0].locator('.m68-climber').evaluateAll(es=>es.every(e=>{const r=e.getBoundingClientRect(),p=e.closest('.m68-lane').getBoundingClientRect();return r.height>100&&r.top>=p.top&&r.bottom<=p.bottom;})),true,'Climbers must remain visible inside both camera views');await pages[0].screenshot({path:path.join(out,'desktop-middle.png')});await pages[1].screenshot({path:path.join(out,'mobile-middle.png')});
 for(const p of pages){assert.equal(await p.locator('.m68-queue span').count(),4);assert.equal(await p.locator('.m68-queue svg').first().isVisible(),true);assert.ok(await p.locator('.m68-queue span').first().innerText());assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.ok(await p.locator('.m68-lane.opponent .m68-hold:not([hidden])').count()>=4);}
 while(!state.completedAt)await tap(0);assert.equal(state.winnerId,'a');await pages[0].waitForTimeout(700);await pages[0].screenshot({path:path.join(out,'desktop-summit.png')});await pages[0].locator('.mr-overlay.complete').waitFor();await pages[1].locator('.mr-overlay.complete').waitFor();assert.match(await pages[0].locator('.mr-overlay h1').innerText(),/YOU WIN!/);assert.match(await pages[1].locator('.mr-overlay h1').innerText(),/YOU LOST/);assert.equal(await pages[0].locator('.m68-confetti:not([hidden])').count(),1);assert.match(await pages[0].locator('.m69-prize').innerText(),/934 Chips/);assert.match(await pages[1].locator('.m69-prize').innerText(),/1,000 Chips/);assert.equal(await pages[0].locator('.m69-times section').count(),2);assert.equal(await pages[0].locator('.m69-times section').nth(1).locator('b').innerText(),'DNF');assert.match(await pages[0].locator('.m70-personal-best').first().innerText(),/NEW PERSONAL BEST/);assert.equal(await pages[0].locator('.m68-summit').first().innerText(),'FINISH');assert.equal(await pages[0].locator('.m68-climber').first().getAttribute('data-pose'),'7');await pages[0].screenshot({path:path.join(out,'desktop-result.png')});await pages[1].screenshot({path:path.join(out,'mobile-result.png')});await pages[0].locator('[data-mr-rematch]').click();assert.equal(await pages[0].evaluate(()=>window.rematchClicked),true);
 // Immediate keyboard taps and selectable queue-card jumps, with jitter on releases.
 round++;state=model.createMountainRaceState({playerIds:['a','b'],countdownMs:0});state.sequence.fill('up');for(let i=0;i<pages.length;i++)await pages[i].evaluate(g=>{window.confirmedRevision=0;window.MountainRaceMultiplayer.adopt(g);},game(i?'b':'a'));
 await pages[0].keyboard.down('ArrowUp');
 assert.equal(Number(await pages[0].locator('.m68-key').first().getAttribute('data-mr-displayed-index')),1,'Ordinary arrows respond before keyup or server confirmation');
 await pages[0].keyboard.up('ArrowUp');await pages[0].waitForFunction(()=>window.confirmedRevision>0);
 releaseDelay=600;
 async function jump(i,distance,keyboard=false,followup=false){
  const p=pages[i],id=i?'b':'a',from=state.players[id].promptIndex;
  if(keyboard)await p.keyboard.down(String(distance));
  else{const b=await p.locator('[data-mr-jump="'+distance+'"]').boundingBox();p.touchSession=await p.context().newCDPSession(p);await p.touchSession.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2}]});}
  assert.equal(await p.locator('.m72-move.charging').count(),1,'Charge ring starts before a server acknowledgement');
  await p.waitForFunction(()=>document.querySelector('.m72-move.charging')?.dataset.green==='true',null,{polling:'raf',timeout:5000});
  if(keyboard)await p.keyboard.up(String(distance));else await p.touchSession.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.equal(Number(await p.locator('.m68-key').first().getAttribute('data-mr-displayed-index')),from+distance,'Landing appears before delayed release confirmation');
  if(followup)await p.keyboard.press('ArrowUp');
  await p.waitForFunction(n=>Number(document.querySelector('.m68-key').dataset.mrDisplayedIndex)===n,from+distance+(followup?1:0));
  const end=Date.now()+6000;while(state.players[id].promptIndex!==from+distance+(followup?1:0)&&Date.now()<end)await p.waitForTimeout(30);
  assert.equal(state.players[id].promptIndex,from+distance+(followup?1:0));
  await p.waitForTimeout(180); // Include response delivery before starting the next action.
  await p.screenshot({path:path.join(out,'charged-landing-'+(i?'mobile':'desktop')+'.png')});
 }
 await jump(0,2,true,true);await jump(1,3);await jump(0,4,true);await jump(1,4);
 // A second charge may be timed while the first release is still traveling.
 const queuedFrom=state.players.a.promptIndex;
 for(const distance of [3,2]){
  await pages[0].keyboard.down(String(distance));
  await pages[0].waitForFunction(()=>document.querySelector('.m72-move.charging')?.dataset.green==='true',null,{polling:'raf'});
  await pages[0].keyboard.up(String(distance));
 }
 assert.equal(Number(await pages[0].locator('.m68-key').first().getAttribute('data-mr-displayed-index')),queuedFrom+5);
 const queuedDeadline=Date.now()+6000;while(state.players.a.promptIndex!==queuedFrom+5&&Date.now()<queuedDeadline)await pages[0].waitForTimeout(30);
 assert.equal(state.players.a.promptIndex,queuedFrom+5);await pages[0].waitForTimeout(180);
 // Early release slips once, then both local and authoritative recovery block input.
 releaseDelay=70;
 const p=pages[0],before=state.players.a.promptIndex;await p.keyboard.down('2');await p.keyboard.up('2');
 assert.equal(await p.locator('.m68-key:enabled').count(),0);
 await p.waitForFunction(()=>window.confirmedRevision>=1&&document.querySelector('.m68-status')?.textContent.includes('recovery'));
 await p.waitForTimeout(250);assert.equal(state.players.a.promptIndex,before-1);
 await p.waitForTimeout(550);await tap(0);
 // Releasing a canceled pointer must not award a jump or count a miss.
 const beforeCancel=state.players.b.promptIndex,rejections=state.players.b.rejectedInputs;
 await pages[1].keyboard.down('3');await pages[1].evaluate(()=>window.dispatchEvent(new Event('blur')));await pages[1].keyboard.up('3');await pages[1].waitForTimeout(350);
 assert.equal(state.players.b.promptIndex,beforeCancel);assert.equal(state.players.b.rejectedInputs,rejections);
 round++;state=model.createMountainRaceState({playerIds:['a','b'],countdownMs:0});stamp=Date.now();for(let i=0;i<pages.length;i++)await pages[i].evaluate(g=>{window.confirmedRevision=0;window.MountainRaceMultiplayer.adopt(g);},game(i?'b':'a'));await tap(1);assert.equal(state.players.b.promptIndex,1);assert.deepEqual(errors,[]);console.log('Summit V72 passed: immediate arrows, selectable 2/3/4 ledges, repeated directions, keyboard/touch, 600 ms release jitter, buffered follow-up, cancellation, enforced recovery, desktop/mobile, two synchronized views, real authoritative inputs, wrong-input slip, complete race, correct result labels, confetti, rematch and responsive controls. '+out);
}finally{await browser.close();await new Promise(r=>server.close(r));}
