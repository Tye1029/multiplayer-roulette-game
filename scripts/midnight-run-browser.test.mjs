import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {startPublicPolishServer} from './public-polish-test-server.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.RPS_PLAYWRIGHT_MODULE||'playwright');
let draw=0,offset=0;
const server=await startPublicPolishServer(path.resolve('dist'),0,{midnightRandom:()=>draw,midnightNow:()=>Date.now()+offset});
const browser=await chromium.launch({headless:true,executablePath:process.env.RPS_BROWSER||undefined}),out=path.join(os.tmpdir(),'midnight-run-qa'),errors=[];
await fs.mkdir(out,{recursive:true});
async function player(id,width=1360,height=1050){
 const ctx=await browser.newContext({viewport:{width,height},hasTouch:width<700});
 await ctx.addInitScript(id=>{localStorage.setItem('xan-muted','1');if(id){localStorage.setItem('tornVisitorApiKey','TESTPUBLICKEY00'+id);localStorage.setItem('tornKeyConfirmed','true');}crypto.getRandomValues=a=>{a.fill(0);return a;};},id);
 const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.stack));await p.goto(server.origin+'/games/single-player/midnight-run/');await p.locator('#mr-menu-stake').waitFor();
 await p.waitForFunction(()=>XanSiteAdapter.diagnostics().artReady);if(id){await p.waitForFunction(()=>XanSiteAdapter.diagnostics().ready);await p.locator('#mr-menu-stake').selectOption('50000');}return p;
}
async function idle(p){await p.waitForFunction(()=>!XanSiteAdapter.diagnostics().busy);}
async function settled(p){await idle(p);await p.waitForFunction(()=>XanSiteAdapter.diagnostics().resultVisible);await idle(p);}
async function fit(p,name){
 await p.evaluate(()=>scrollTo({top:0,behavior:'instant'}));assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,name+' overflow');
 assert.deepEqual(await p.locator('button:visible,select:visible').evaluateAll(es=>es.filter(e=>{const r=e.getBoundingClientRect();return r.left< -1||r.right>innerWidth+1;}).map(e=>e.textContent)),[],name+' clipped controls');
 await p.screenshot({path:path.join(out,name+'.png'),fullPage:true,animations:'disabled'});
}
async function fastForward(p,ms){offset+=ms;await p.waitForTimeout(1100);}
try{
 const a=await player('1');await fit(a,'menu-desktop');assert.equal(await a.locator('#mr-menu-auto,#mr-play-auto,#mr-auto-badge,#mr-connection').count(),0);assert.equal(server.ledger.size,0);await a.locator('#mr-help').click();assert.equal(await a.locator('dialog li').count(),6);await a.locator('dialog button').click();
 assert.deepEqual(await a.locator('#mr-menu-difficulty option').allTextContents(),['Low Risk · 1.13×','Medium Risk · 1.29×','High Risk · 1.50×']);
 assert.doesNotMatch(await a.locator('.mr-setting-note').first().innerText(),/%/);
 await a.locator('#mr-start').click();await idle(a);assert.equal(server.ledger.size,1);assert.equal(await a.locator('#mr-cashout').isEnabled(),false);assert.doesNotMatch(await a.locator('#mr-next-note').innerText(),/%/);await fit(a,'countdown-desktop');
 await a.locator('#mr-cashout:enabled').waitFor();assert.equal(await a.locator('#mr-bank').textContent(),'56,250');assert.equal(await a.locator('#mr-corner').isVisible(),true);assert.equal(await a.locator('#mr-corner #mr-continue').count(),1);assert.equal(await a.locator('#mr-corner #mr-cashout').count(),1);await fit(a,'running-desktop');
 // The display freezes on the click, before a deliberately slow response arrives.
 await a.route('**/.netlify/functions/midnight-run-action',async route=>{const body=route.request().postDataJSON();if(body.action!=='cashout')return route.continue();const response=await route.fetch();await new Promise(r=>setTimeout(r,1300));await route.fulfill({response});});
 await a.locator('#mr-cashout').click();await a.waitForTimeout(200);assert.match(await a.locator('#mr-state').innerText(),/ESCAPE REQUESTED/);assert.equal(await a.locator('#mr-result').isVisible(),false);
 await settled(a);assert.equal(server.ledger.size,2);assert.match(await a.locator('#mr-result').innerText(),/Clean getaway/);assert.equal(await a.locator('#hub-balance').innerText(),'506,250 Chips');await fit(a,'escaped-desktop');await a.unroute('**/.netlify/functions/midnight-run-action');
 // Replay resumes at a safe corner after a long absence, with no automatic continuation.
 await a.locator('#mr-play-stake').selectOption('100000');await a.locator('#mr-play-difficulty').selectOption('medium');await a.locator('#mr-again').click();await idle(a);assert.equal(await a.locator('#mr-menu').isVisible(),false);assert.equal(server.ledger.size,3);
 await a.waitForFunction(()=>XanSiteAdapter.diagnostics().scenery===XanSiteAdapter.current().id);const mediumScenery=await a.evaluate(()=>XanSiteAdapter.diagnostics().scenery);await a.reload();await a.waitForFunction(()=>XanSiteAdapter.diagnostics().ready);assert.match(await a.locator('#mr-start').innerText(),/Resume/);
 await a.locator('#mr-start').click();await idle(a);await fastForward(a,60000);await a.locator('#mr-continue:enabled').waitFor();
 assert.equal(await a.locator('#mr-bank').innerText(),'128,571');assert.equal(await a.locator('#mr-play-difficulty').inputValue(),'medium');assert.equal(await a.locator('#mr-play-difficulty').isDisabled(),true);assert.equal(await a.evaluate(()=>XanSiteAdapter.diagnostics().scenery),mediumScenery);assert.match(await a.locator('#mr-next-note').innerText(),/Medium.*79% clear.*21% caught/);const stopped=await a.locator('#mr-distance').innerText();
 await fastForward(a,60000);assert.equal(await a.locator('#mr-distance').innerText(),stopped);assert.equal(server.ledger.size,3);
 // A committed Continue with a lost response is recovered without starting another block.
 let continueDropped=false;await a.route('**/.netlify/functions/midnight-run-action',async route=>{if(route.request().postDataJSON().action==='continue'&&!continueDropped){continueDropped=true;await route.fetch();await route.abort();}else await route.continue();});
 await a.locator('#mr-continue').click();await a.locator('#mr-retry').waitFor();await fastForward(a,9000);await a.locator('#mr-retry').click();await idle(a);await a.locator('#mr-cashout:enabled').waitFor();
 assert.equal(await a.locator('#mr-bank').innerText(),'162,748');await a.unroute('**/.netlify/functions/midnight-run-action');await fit(a,'second-corner-desktop');
 await a.locator('#mr-cashout').click();await settled(a);assert.equal(server.ledger.size,4);assert.equal([...server.ledger.values()].at(-1).delta,162748);
 draw=99;await a.locator('#mr-again').click();await idle(a);await fastForward(a,9000);await settled(a);assert.match(await a.locator('#mr-result').innerText(),/Busted/);assert.equal([...server.ledger.values()].at(-1).delta,0);await fit(a,'caught-desktop');
 // Insufficient funds cannot create a playable run.
 const beforeFunds=server.ledger.size;await a.locator('#mr-play-stake').selectOption('10000000');await a.locator('#mr-again').click();await idle(a);assert.match(await a.locator('#mr-notice').innerText(),/Not enough/);assert.equal(server.ledger.size,beforeFunds);
 // A committed launch with a lost response is recovered with one debit.
 draw=0;const b=await player('2');let dropped=false;
 await b.route('**/.netlify/functions/midnight-run-action',async route=>{if(route.request().postDataJSON().action==='start'&&!dropped){dropped=true;await route.fetch();await route.abort();}else await route.continue();});
 const beforeLost=server.ledger.size;await b.locator('#mr-start').click();await b.locator('#mr-retry').waitFor();assert.equal(server.ledger.size,beforeLost+1);await b.locator('#mr-retry').click();await idle(b);assert.equal(server.ledger.size,beforeLost+1);assert.equal(await b.locator('#mr-play').isVisible(),true);
 await b.unroute('**/.netlify/functions/midnight-run-action');await fastForward(b,8000);await b.locator('#mr-cashout:enabled').waitFor();
 // A lost settled reply and a second window cannot award twice.
 let cashDropped=false;await b.route('**/.netlify/functions/midnight-run-action',async route=>{if(route.request().postDataJSON().action==='cashout'&&!cashDropped){cashDropped=true;await route.fetch();await route.abort();}else await route.continue();});
 await b.locator('#mr-cashout').click();await b.locator('#mr-retry').waitFor();const afterCredit=server.ledger.size;await b.locator('#mr-retry').click();await settled(b);assert.equal(server.ledger.size,afterCredit);await b.unroute('**/.netlify/functions/midnight-run-action');
 // High Risk paid play shows and credits its own multiplier, with a different city per run.
 const beforeHighCity=await b.evaluate(()=>XanSiteAdapter.diagnostics().scenery);
 await b.locator('#mr-play-difficulty').selectOption('high');await b.locator('#mr-again').click();await idle(b);await fastForward(b,8000);await b.locator('#mr-cashout:enabled').waitFor();
 assert.equal(await b.locator('#mr-bank').innerText(),'75,000');assert.match(await b.locator('#mr-next-note').innerText(),/High Risk.*70% clear.*30% caught/);assert.notEqual(await b.evaluate(()=>XanSiteAdapter.diagnostics().scenery),beforeHighCity);await fit(b,'high-risk-city-desktop');await b.locator('#mr-cashout').click();await settled(b);assert.equal([...server.ledger.values()].at(-1).delta,75000);
 const c=await player('3'),d=await player('3');const beforeTwo=server.ledger.size;
 await Promise.all([c.locator('#mr-start').click(),d.locator('#mr-start').click()]);await Promise.all([idle(c),idle(d)]);assert.equal(server.ledger.size,beforeTwo+1);assert.equal(await c.evaluate(()=>XanSiteAdapter.current().id),await d.evaluate(()=>XanSiteAdapter.current().id));
 await fastForward(c,8000);await Promise.all([c.locator('#mr-cashout:enabled').waitFor(),d.locator('#mr-cashout:enabled').waitFor()]);await Promise.all([c.locator('#mr-cashout').click(),d.locator('#mr-cashout').click()]);await Promise.all([settled(c),settled(d)]);assert.equal(server.ledger.size,beforeTwo+2);
 // A poll captured before Continue must not restore the old corner, even with a later response timestamp.
 const race=await player('4');await race.locator('#mr-start').click();await idle(race);await fastForward(race,8000);await race.locator('#mr-continue:enabled').waitFor();
 let releasePoll,pollCaptured;const captured=new Promise(r=>pollCaptured=r),release=new Promise(r=>releasePoll=r);let held=false;
 await race.route('**/.netlify/functions/midnight-run-action',async route=>{
  if(route.request().postDataJSON().action!=='current'||held)return route.continue();held=true;
  const response=await route.fetch(),body=await response.json();pollCaptured();await release;body.stateAt+=1000;
  await route.fulfill({response,json:body});
 });
 await captured;await race.locator('#mr-continue').click();await idle(race);releasePoll();await race.waitForTimeout(300);
 assert.equal(await race.locator('#mr-cashout').isEnabled(),false);assert.equal(await race.locator('#mr-corner').isVisible(),false);
 await race.unroute('**/.netlify/functions/midnight-run-action');await fastForward(race,5000);await race.locator('#mr-cashout:enabled').waitFor();await race.locator('#mr-cashout').click();await settled(race);
 // A stalled network poll cannot freeze the camera halfway through a funded block.
 const delayed=await player('5');await delayed.locator('#mr-start').click();await idle(delayed);await fastForward(delayed,8000);await delayed.locator('#mr-continue:enabled').waitFor();
 await delayed.route('**/.netlify/functions/midnight-run-action',async route=>{
  if(route.request().postDataJSON().action!=='current')return route.continue();const response=await route.fetch();await new Promise(r=>setTimeout(r,3200));await route.fulfill({response});
 });
 await delayed.locator('#mr-continue').click();await idle(delayed);await delayed.waitForTimeout(2300);
 const cameraBefore=await delayed.evaluate(()=>XanSiteAdapter.diagnostics().visualElapsed);await delayed.waitForTimeout(900);
 const cameraAfter=await delayed.evaluate(()=>XanSiteAdapter.diagnostics().visualElapsed);assert.ok(cameraAfter-cameraBefore>700,'Camera keeps moving when replies are delayed');assert.ok(cameraAfter<=8000);assert.equal(await delayed.locator('#mr-cashout').isEnabled(),false);
 await delayed.unrouteAll({behavior:'wait'});await delayed.locator('#mr-cashout:enabled').waitFor();await delayed.locator('#mr-cashout').click();await settled(delayed);
 // Phone/tablet/landscape, touch practice, keyboard, light mode and reduced motion.
 draw=0;const freeBefore=server.ledger.size,phone=await player('3',390,844);await fit(phone,'menu-phone');await phone.locator('#mr-start').tap();await phone.locator('#mr-cashout:enabled').waitFor();await fit(phone,'corner-phone');const phoneDistance=await phone.locator('#mr-distance').innerText();await phone.waitForTimeout(5000);assert.equal(await phone.locator('#mr-distance').innerText(),phoneDistance);await phone.locator('#mr-continue').tap();await phone.waitForTimeout(300);assert.equal(await phone.locator('#mr-cashout').isEnabled(),false);await phone.locator('#mr-cashout:enabled').waitFor();assert.equal(await phone.locator('#mr-bank').innerText(),'63,920');await phone.locator('#mr-cashout').tap();await settled(phone);assert.match(await phone.locator('#mr-result-note').innerText(),/chips gained/);await fit(phone,'escaped-phone');
 for(const [w,h] of [[320,740],[768,1024],[844,390]]){await phone.setViewportSize({width:w,height:h});await fit(phone,'result-'+w+'x'+h);}
 await phone.evaluate(()=>XanPreferences.theme('light'));await phone.emulateMedia({reducedMotion:'reduce'});await fit(phone,'light-reduced');await phone.setViewportSize({width:390,height:844});
 await phone.locator('#mr-play-difficulty').selectOption('medium');await phone.locator('#mr-again').click();await phone.locator('#mr-cashout:enabled').waitFor();assert.equal(await phone.locator('#mr-bank').innerText(),'64,285');await fit(phone,'medium-city-phone');await phone.locator('#mr-cashout').focus();await phone.keyboard.press('Enter');await settled(phone);assert.equal(server.ledger.size,freeBefore+4);
 await phone.locator('#mr-play-difficulty').selectOption('high');await phone.locator('#mr-again').click();await phone.locator('#mr-cashout:enabled').waitFor();assert.equal(await phone.locator('#mr-bank').innerText(),'75,000');await fit(phone,'high-risk-city-phone');await phone.locator('#mr-cashout').tap();await settled(phone);await phone.evaluate(()=>{XanPreferences.sound(true);MidnightRunAudio.unlock();});await phone.locator('#mr-again').click();await phone.waitForFunction(()=>MidnightRunAudio.loaded);await phone.waitForFunction(()=>MidnightRunAudio.active>0);await phone.locator('#mr-cashout:enabled').waitFor();
 await phone.waitForFunction(()=>MidnightRunAudio.diagnostics.weatherLoaded);assert.equal(await phone.evaluate(()=>MidnightRunAudio.diagnostics.rain),true);const footfalls=await phone.evaluate(()=>MidnightRunAudio.diagnostics.footfalls);await phone.waitForTimeout(800);assert.equal(await phone.evaluate(()=>MidnightRunAudio.diagnostics.footfalls),footfalls);
 await phone.waitForFunction(()=>MidnightRunAudio.diagnostics.thunders>0,{},{timeout:25000});
 await phone.waitForFunction(()=>MidnightRunAudio.diagnostics.barks>0,{},{timeout:25000});assert.ok(await phone.evaluate(()=>MidnightRunAudio.active<10));await phone.evaluate(()=>XanPreferences.sound(false));assert.equal(await phone.evaluate(()=>MidnightRunAudio.active),0);
 await phone.evaluate(()=>{dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});await phone.waitForTimeout(200);assert.equal(await phone.locator('#mr-menu').isVisible(),true);assert.equal(await phone.locator('#mr-play').isVisible(),false);assert.equal(await phone.evaluate(()=>MidnightRunAudio.active),0);
 await a.goto(server.origin+'/');await a.locator('.hub-single-games a[href="/games/single-player/midnight-run/"]').scrollIntoViewIfNeeded();await fit(a,'homepage');await a.locator('.hub-single-games a[href="/games/single-player/midnight-run/"]').click();await a.locator('#mr-menu').waitFor();
 assert.deepEqual(errors,[]);console.log('Midnight Run browser QA passed: desktop/mobile, three difficulties, randomized/resumable city layouts, corner stops, continue, lost continue recovery, capture, replay, reload, lost requests, duplicate windows, funding, practice, keyboard/touch, audio, reduced motion and homepage. '+out);
}catch(e){for(const [i,c] of browser.contexts().entries())for(const p of c.pages())await p.screenshot({path:path.join(out,'failure-'+i+'.png'),fullPage:true});throw e;}
finally{await browser.close();await server.close();}
