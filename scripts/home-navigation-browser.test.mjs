import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {startPublicPolishServer} from './public-polish-test-server.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.RPS_PLAYWRIGHT_MODULE||'playwright');
const server=await startPublicPolishServer(path.resolve('dist')),browser=await chromium.launch({headless:true,executablePath:process.env.RPS_BROWSER||undefined}),errors=[],out=path.join(os.tmpdir(),'home-navigation-qa');await fs.mkdir(out,{recursive:true});
const assertHomeAtFront=async p=>assert.equal(await p.evaluate(()=>Boolean(document.elementFromPoint(innerWidth/2,innerHeight/2)?.closest('#simpleTestHome'))),true,'The home menu must cover the shared game shell');
try{
 for(const width of [1360,390]){
  const ctx=await browser.newContext({viewport:{width,height:width>700?1000:844},hasTouch:width<700});await ctx.addInitScript(()=>{localStorage.setItem('xan-muted','1');localStorage.setItem('tornVisitorApiKey','TESTPUBLICKEY001');localStorage.setItem('tornKeyConfirmed','true');});const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.goto(server.origin+'/games/single-player/rocket-run/');await p.locator('.xan-brand').waitFor();let release;const gate=new Promise(r=>release=r);await p.route('**/assets/site-hub/hub.js*',async route=>{await gate;await route.continue();});
  const navigation=p.waitForURL(server.origin+'/',{waitUntil:'commit'}),clicked=p.locator('.xan-brand').click({noWaitAfter:true});await navigation;await p.locator('#simpleTestHome').waitFor({state:'attached'});
  try{
   const legacy=p.getByText('Rock Paper Scissors · Hand of Doom ⚔',{exact:true});assert.equal(await legacy.isVisible(),false,'Old Hand of Doom launcher must never paint while the home script loads');assert.equal(await p.locator('#simpleTestHome .sth-card').isVisible(),false,'Unbuilt launcher must stay hidden');assert.equal(await p.locator('#xan-home-loading').isVisible(),true);await p.waitForTimeout(300);await p.screenshot({path:path.join(out,'loading-'+width+'.png')});
  }finally{release();}
  await clicked;await p.locator('#simpleTestHome[data-hub-ready=true]').waitFor();assert.equal(await p.locator('#xan-home-loading').count(),0);assert.equal(await p.locator('#simpleTestHome .sth-card').isVisible(),true);await assertHomeAtFront(p);assert.equal(p.url(),server.origin+'/');assert.equal(await p.locator('#simpleTestHome .sth-game[data-mode=rps]').count(),1);assert.equal(await p.getByRole('heading',{name:'Multiplayer',exact:true}).isVisible(),true);assert.equal(await p.getByRole('heading',{name:'Single Player',exact:true}).isVisible(),true);await p.screenshot({path:path.join(out,'home-'+width+'.png')});await p.unroute('**/assets/site-hub/hub.js*');
  // The logo also returns cleanly from an actual RPS menu and from the home page itself.
  await p.locator('#simpleTestHome .sth-game[data-mode=rps]').click();await p.waitForURL('**/games/multiplayer/rps/');await p.locator('.xan-brand').click();await p.locator('#simpleTestHome[data-hub-ready=true]').waitFor();assert.equal(p.url(),server.origin+'/');await p.locator('.xan-brand').click();await p.locator('#simpleTestHome[data-hub-ready=true]').waitFor();await assertHomeAtFront(p);
  // Shared-shell invitations still select the requested game after initialization.
  await p.goto(server.origin+'/?game=fishing');await p.locator('.xg-heading h1').filter({hasText:'Fishing Duel'}).waitFor();assert.equal(await p.locator('#simpleTestHome').isVisible(),false);assert.equal(await p.locator('#xan-home-loading').count(),0);await p.locator('.xan-brand').click();await p.locator('#simpleTestHome[data-hub-ready=true]').waitFor();
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await ctx.close();
 }
 const failed=await browser.newPage();await failed.route('**/assets/site-hub/hub.js*',route=>route.abort());await failed.goto(server.origin+'/');await failed.getByText('Unable to load the game menu. Please refresh to try again.',{exact:true}).waitFor();assert.equal(await failed.locator('#simpleTestHome .sth-card').isVisible(),false);assert.equal(await failed.getByRole('button',{name:'Refresh page',exact:true}).isVisible(),true);await failed.close();
 assert.deepEqual(errors,[]);console.log('Home navigation passed: delayed-script first paint, logo from Rocket Run/RPS/home, shared game links, failure recovery and desktop/mobile layouts. '+out);
}finally{await browser.close();await server.close();}
