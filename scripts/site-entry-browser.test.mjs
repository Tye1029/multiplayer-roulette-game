import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
import {startPublicPolishServer} from './public-polish-test-server.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.RPS_PLAYWRIGHT_MODULE||'playwright');
const server=await startPublicPolishServer(path.resolve('dist'));
const browser=await chromium.launch({headless:true,executablePath:process.env.RPS_BROWSER||undefined});
const origin=server.origin,errors=[];
try {
 const context=await browser.newContext();await context.addInitScript(()=>{if(!sessionStorage.getItem('entry-fixture-set')){localStorage.setItem('tornVisitorApiKey','TESTPUBLICKEY001');localStorage.setItem('tornKeyConfirmed','true');localStorage.setItem('xan-muted','1');sessionStorage.setItem('entry-fixture-set','1');}});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));let logins=0;
 page.on('request',r=>{if(r.url().endsWith('/rps-action')&&r.postDataJSON()?.action==='login')logins++;});
 await page.goto(origin+'/games/single-player/rocket-run/');await page.waitForFunction(()=>XanSiteAdapter.diagnostics().ready);assert.equal(logins,1);
 await page.goto(origin+'/games/single-player/plinko/');await page.waitForFunction(()=>XanSiteAdapter.diagnostics().ready);assert.equal(logins,1,'Navigation reuses the verified session');
 // A rejected cache renews once, including simultaneous hub and game requests.
 await page.evaluate(()=>{const s=JSON.parse(sessionStorage.getItem('xan-hub-session'));s.token='0'.repeat(64);sessionStorage.setItem('xan-hub-session',JSON.stringify(s));});
 await page.reload();await page.waitForFunction(()=>XanSiteAdapter.diagnostics().ready);assert.equal(logins,2);
 await page.evaluate(()=>localStorage.setItem('tornVisitorApiKey','TESTPUBLICKEY002'));
 await page.goto(origin+'/games/single-player/rocket-run/');await page.waitForFunction(()=>XanSiteAdapter.diagnostics().ready);assert.equal(logins,3,'Changing profiles cannot reuse another player’s session');
 await page.locator('#hub-menu').click();await page.locator('#hub-remove').click();await page.waitForURL(origin+'/');assert.equal(await page.evaluate(()=>sessionStorage.getItem('xan-hub-session')),null);
 await context.close();
 // Menus remain usable during an arbitrarily slow login.
 for(const [game,practice,settings,paid] of [
  ['rocket-run','#rr-practice','#rr-menu-stake','#rr-start'],
  ['minefield','#mf-practice','#mf-menu-stake','#mf-start'],
  ['plinko','#pl-practice','#pl-menu-stake','#pl-drop']
 ]) {
  const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
  await ctx.addInitScript(()=>{localStorage.setItem('tornVisitorApiKey','TESTPUBLICKEY001');localStorage.setItem('tornKeyConfirmed','true');localStorage.setItem('xan-muted','1');});
  const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));let release;const gate=new Promise(r=>release=r);
  await p.route('**/.netlify/functions/rps-action',async r=>{await gate;await r.continue();});
  try {
   await p.goto(origin+'/games/single-player/'+game+'/');await p.locator(settings).waitFor();
   assert.equal(await p.locator(settings).isEnabled(),true,game+' wager choices stay usable');assert.equal(await p.locator(practice).count(),0,'Practice control was removed');
   assert.equal(await p.locator(paid).evaluate(e=>getComputedStyle(e).cursor),'default');
   assert.equal(await p.locator(paid).isDisabled(),true,'A slow login cannot enable an unfunded wager');
  } finally {release();await p.unrouteAll({behavior:'wait'});await ctx.close();}
 }
 // An account switch while authentication is pending must not send the old
 // account's proposed wager under the replacement account's token.
 const guarded=await browser.newContext();await guarded.addInitScript(()=>{localStorage.setItem('tornVisitorApiKey','TESTPUBLICKEY001');localStorage.setItem('tornKeyConfirmed','true');});
 const gp=await guarded.newPage();gp.on('pageerror',e=>errors.push(e.message));await gp.goto(origin+'/games/single-player/plinko/');await gp.waitForFunction(()=>XanSiteAdapter.diagnostics().ready);
 let releaseLogin,loginStarted=false,gameWrites=0;const loginGate=new Promise(r=>releaseLogin=r);
 await gp.route('**/.netlify/functions/rps-action',async route=>{loginStarted=true;await loginGate;await route.continue();});
 gp.on('request',r=>{if(r.url().endsWith('/plinko-action')&&r.postDataJSON()?.action==='drop')gameWrites++;});
 await gp.evaluate(()=>{localStorage.setItem('tornVisitorApiKey','TESTPUBLICKEY002');window.guardedResult=null;XanHub.gameRequest('plinko-action',{action:'drop',stake:10000,risk:'low',requestId:crypto.randomUUID()}).then(()=>window.guardedResult='unexpected success',e=>window.guardedResult=e.message);});
 for(let n=0;n<50&&!loginStarted;n++)await gp.waitForTimeout(20);assert.equal(loginStarted,true);await gp.evaluate(()=>localStorage.setItem('tornVisitorApiKey','TESTPUBLICKEY003'));releaseLogin();await gp.waitForFunction(()=>window.guardedResult!==null);assert.match(await gp.evaluate(()=>guardedResult),/profile changed|Connect your Torn/);assert.equal(gameWrites,0);await guarded.close();
 assert.equal(server.ledger.size,0,'Browsing during login or switching profiles must not debit any wallet');assert.deepEqual(errors,[]);
 console.log('Site entry passed: session reuse, rejected-token recovery, profile changes, sign-out, responsive settings during slow login, disabled wagers and no practice controls.');
} finally {await browser.close();await server.close();}
