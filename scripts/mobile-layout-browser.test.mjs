// Phone layout regression: real shared pages and game clients against isolated QA stores.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {startPublicPolishServer} from './public-polish-test-server.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.RPS_PLAYWRIGHT_MODULE||'playwright');
const server=await startPublicPolishServer(),browser=await chromium.launch({headless:true,executablePath:process.env.RPS_BROWSER||undefined});
const output=process.env.MOBILE_SCREENSHOTS||path.join(os.tmpdir(),'xan-mobile-layout'),audit=process.argv.includes('--audit'),findings=[],errors=[];
await fs.mkdir(output,{recursive:true});
const routes={home:'/',roulette:'/?game=roulette','roulette-four':'/games/multiplayer/roulette-four/',fishing:'/?game=fishing',safecracker:'/?game=safecracker',mountainrace:'/?game=mountainrace',rps:'/games/multiplayer/rps/',bluff:'/games/multiplayer/bluff/',yahtzee:'/games/multiplayer/yahtzee/'};
async function inspect(p,label){
 await p.evaluate(()=>scrollTo(0,0));
 const metrics=await p.evaluate(()=>{
  const visible=e=>e.checkVisibility()&&(!e.closest('details:not([open])')||!!e.closest('summary'));
  const controls=[...document.querySelectorAll('button,input,select,summary,a')].filter(visible);
  const bounds=e=>{const r=e.getBoundingClientRect();return {name:(e.getAttribute('aria-label')||e.textContent||e.id).trim().slice(0,55),x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)};};
  const clipped=controls.filter(e=>{const r=e.getBoundingClientRect();if(r.width<1||r.height<1)return false;return r.left< -1||r.right>innerWidth+1;}).map(bounds);
  return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,clipped,small:controls.filter(e=>{const r=e.getBoundingClientRect();return e.tagName!=='A'&&(r.width<40||r.height<40)&&!e.disabled;}).map(bounds)};
 });
 findings.push({label,...metrics});await p.screenshot({path:path.join(output,label+'.png'),fullPage:true});
 if(!audit){assert.ok(metrics.scrollWidth<=metrics.width+1,label+' horizontal overflow');assert.deepEqual(metrics.clipped,[],label+' off-screen controls');}
}
async function menu(p,name){await p.getByRole('button',{name:'Open menu',exact:true}).click();await p.getByRole('button',{name,exact:true}).click();}
try{
 for(const [viewportIndex,viewport] of [{width:320,height:740},{width:390,height:844},{width:430,height:932},{width:568,height:320},{width:844,height:390},{width:1280,height:900}].filter(v=>!process.env.MOBILE_WIDTHS||process.env.MOBILE_WIDTHS.split(',').includes(String(v.width))).entries()){
  // Isolate each viewport's practice tables without bypassing room limits.
  const viewerId=String(viewportIndex+1),rivalId='9';
  const context=await browser.newContext({viewport,isMobile:viewport.width<1000,hasTouch:viewport.width<1000});
  await context.addInitScript(({id,theme})=>{localStorage.setItem('xan-theme',theme);localStorage.setItem('tornVisitorApiKey','TESTPUBLICKEY00'+id);localStorage.setItem('tornKeyConfirmed','true');localStorage.setItem('xan-muted','1');},{id:viewerId,theme:process.env.MOBILE_THEME||'dark'});
  const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
  for(const [mode,url] of Object.entries(routes)){
   await p.goto(server.origin+url);await p.locator(mode==='home'?'.hub-tile':'.xg-heading h1').first().waitFor();await p.locator('#hub-wallet').waitFor();
   await inspect(p,mode+'-menu-'+viewport.width);
   if(mode!=='home'){
    await p.getByRole('button',{name:'How to play',exact:true}).click();await inspect(p,mode+'-rules-'+viewport.width);await p.getByRole('button',{name:'Got it',exact:true}).click();
    await p.waitForFunction(()=>!!window.XanProgress?.profile?.achievements);await p.getByRole('button',{name:'Achievements',exact:true}).click();await p.locator('.xg-achievements[open]').waitFor();await inspect(p,mode+'-achievements-'+viewport.width);await p.locator('.xg-achievements').getByRole('button',{name:'Close',exact:true}).click();
   }
   if(mode==='home'){
    await menu(p,'Stats & achievements');await p.locator('#hub-stats-game').waitFor();await inspect(p,'stats-'+viewport.width);await p.locator('.xan-account-close').click();await p.locator('#hub-wallet').click();await inspect(p,'wallet-'+viewport.width);await p.getByRole('button',{name:'Close',exact:true}).click();
   }
   if(['roulette','fishing','safecracker','mountainrace'].includes(mode)){
    const now=Date.now(),who={userId:viewerId,name:'Player '+viewerId},other={userId:rivalId,name:'Player With A Long Name'},g={gameId:'mobile-'+mode,mode,status:'playing',creator:who,joiner:other,isCreator:true,isPlayer:true,creatorReady:true,joinerReady:true,ready:{[viewerId]:true,[rivalId]:true},startAt:new Date(now-15000).toISOString(),serverNow:new Date(now).toISOString(),revision:1,wager:1000,pot:2000};
    if(mode==='roulette')g.rouletteState={phase:'aim',turnId:viewerId,canShoot:true,canSpin:true,canPass:false,revision:1,spinsUsed:{},turnDeadline:new Date(now+60000).toISOString()};
    if(mode==='fishing')g.fishingState={roundId:'mobile-fish',startAt:g.startAt,endAt:new Date(now+45000).toISOString(),serverNow:g.serverNow,secondsLeft:45,events:[],creatorCatch:null,joinerCatch:null};
    if(mode==='safecracker'){const h=require('../netlify/functions/safe-cracker/heist'),me=h.publicView(h.create(),true),rival=h.publicView(h.create(),false);g.safecrackerState={version:2,roundId:'mobile-safe',revision:1,startAt:g.startAt,endAt:new Date(now+120000).toISOString(),secondsLeft:120,stagesTotal:3,canSubmit:false,me:{stage:0,attempts:[],heist:me},opponent:{stage:0,heist:rival}};}
    if(mode==='mountainrace'){const m=require('../netlify/functions/mountain-race/state-model'),state=m.createMountainRaceState({playerIds:[viewerId,rivalId],countdownMs:0}),pub=m.publicMountainRaceState(state,viewerId);g.mountainraceState={...pub,me:{...pub.players[viewerId],name:who.name},opponent:{...pub.players[rivalId],name:other.name},inputPrompts:state.sequence.slice(0,4),canSubmit:true};}
    await p.route('**/.netlify/functions/duel-action',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,game:g,serverBalance:500000})}));
    await p.evaluate(g=>{duelCurrentGameId=g.gameId;duelLastActiveGame=g;if(g.mode==='roulette')rouletteOpeningCompletedGames.add(g.gameId);duelRenderActive(g,true);window.dispatchEvent(new Event('xan-navigation'));},g);await p.waitForTimeout(600);await inspect(p,mode+'-active-'+viewport.width);
    if(mode==='safecracker'){
     await p.locator('.sh-color-menu summary').click();await inspect(p,'safe-tools-'+viewport.width);await p.locator('.sh-color-menu summary').click();
     const bounds=await p.locator('.sh-screw').evaluateAll(es=>es.map(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})));
     assert.ok(bounds.every(b=>b.w>=44&&b.h>=44),'Screws remain usable touch targets');
    }
    if(['mountainrace','safecracker','fishing'].includes(mode)){
     g.status='complete';g.winnerUserId=viewerId;g.payout=1934;g.revision=2;g.completedAt=new Date().toISOString();
     if(mode==='mountainrace'){g.mountainraceState.viewerWon=true;g.mountainraceState.me.finishedAt=new Date().toISOString();g.mountainraceState.me.promptIndex=g.mountainraceState.totalHolds||30;}
     if(mode==='safecracker'){g.safecrackerState.me.stage=3;g.safecrackerState.me.heist.phase=2;}
     await p.evaluate(g=>{duelLastActiveGame=g;duelRenderActive(g,true);},g);
     const result=p.locator(mode==='mountainrace'?'.mr-overlay.complete':mode==='safecracker'?'body>.sc-result-overlay':'#fishingResultPortal');
     await result.waitFor({timeout:20000});await p.waitForTimeout(1800);await result.locator(mode==='mountainrace'?'[data-mr-new-game]':mode==='safecracker'?'[data-sc-new-game]':'#duelNewGameBtn').click({trial:true});await inspect(p,mode+'-result-'+viewport.width);
    }
    await p.unrouteAll({behavior:'wait'});
   }
   if(['bluff','yahtzee','rps','roulette-four'].includes(mode)){
    await menu(p,'Add bot');
    if(['bluff','roulette-four'].includes(mode))await p.locator('.xg-ready:enabled').click();
    await p.waitForTimeout(mode==='roulette-four'?5500:mode==='yahtzee'?4200:700);
    await inspect(p,mode+'-active-'+viewport.width);
    if(mode==='bluff'){
     await p.locator('#all').click();assert.equal(await p.locator('.hand .card[aria-pressed=true]').count(),10);
     if(viewport.width<=760&&viewport.height>500)assert.equal(await p.locator('#lock').evaluate(e=>e.getBoundingClientRect().top>=document.querySelector('.hand').getBoundingClientRect().bottom),true,'Lock follows cards on portrait phones');
     await p.locator('#lock').click();await p.locator('[data-choice=believe]').click();await p.locator('#game[data-phase=reveal]').waitFor();await inspect(p,'bluff-reveal-'+viewport.width);
    }
    if(mode==='yahtzee'){
     await p.locator('#roll:enabled').click();await p.locator('#dice button:enabled').first().click();await p.locator('#dice button[aria-pressed=true]').waitFor();assert.equal(await p.locator('#dice button[aria-pressed=true]').count(),1);
     const sizes=await p.locator('.yd-score-row button').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().height));if(viewport.width<1000)assert.ok(sizes.every(h=>h>=44),'Score categories remain usable touch targets');
     await p.locator('#dice-color').click();await inspect(p,'dice-colors-'+viewport.width);await p.locator('#color-done').click();
    }
   }
  }
  await p.goto(server.origin+'/admin.html');await p.locator('#password').waitFor();await inspect(p,'admin-'+viewport.width);
  await context.close();console.log('Passed layouts at '+viewport.width+'x'+viewport.height);
 }
 await fs.writeFile(path.join(output,'findings.json'),JSON.stringify({errors,findings},null,2));
 assert.deepEqual(errors,[]);console.log('Mobile layout audit: '+findings.length+' screens; '+output);
 console.log(JSON.stringify(findings.filter(f=>f.scrollWidth>f.width+1||f.clipped.length).map(f=>({label:f.label,width:f.width,scrollWidth:f.scrollWidth,clipped:f.clipped})),null,2));
}catch(e){for(const c of browser.contexts())for(const p of c.pages()){console.error(await p.locator('body').innerText().catch(()=>''));await p.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});}throw e;}finally{await fs.writeFile(path.join(output,'findings.json'),JSON.stringify({errors,findings},null,2));await browser.close();await server.close();}
