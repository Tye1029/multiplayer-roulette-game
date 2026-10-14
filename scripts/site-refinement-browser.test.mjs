import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {startPublicPolishServer} from './public-polish-test-server.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.RPS_PLAYWRIGHT_MODULE||'playwright');
const root=process.env.XAN_TEST_DIST||path.resolve('dist'),server=await startPublicPolishServer(root,0,{derbyRandom:()=>0,minefieldRandom:()=>0,luckyDiceRandom:()=>0,midnightRandom:()=>0});
const appOrigin=process.env.XAN_PREVIEW_ORIGIN||server.origin;
const browser=await chromium.launch({headless:true,executablePath:process.env.RPS_BROWSER||undefined});
const out=path.join(os.tmpdir(),'site-refinement-browser'),errors=[];await fs.mkdir(out,{recursive:true});
const games=[['back-alley-derby','bd'],['lucky-scratch','scratch'],['jackpot-junction','jj'],['minefield','mf'],['plinko','pl'],['rocket-run','rr'],['midnight-run','mr'],['lucky-dice','dd']];
async function page(id,width=1440){const c=await browser.newContext({viewport:{width,height:900},hasTouch:width<700,permissions:['clipboard-read','clipboard-write']});await c.addInitScript(({id})=>{localStorage.setItem('xan-theme','light');localStorage.setItem('xan-muted','1');if(id){localStorage.setItem('tornVisitorApiKey','TESTPUBLICKEY00'+id);localStorage.setItem('tornKeyConfirmed','true');}window.autoScrolls=0;const scroll=Element.prototype.scrollIntoView;Element.prototype.scrollIntoView=function(...args){window.autoScrolls++;return scroll.apply(this,args);};},{id});if(appOrigin!==server.origin)await c.route('**/.netlify/functions/**',async route=>{const req=route.request(),r=await fetch(server.origin+new URL(req.url()).pathname,{method:req.method(),headers:{'Content-Type':'application/json'},...(req.method()==='POST'?{body:req.postData()}: {})});await route.fulfill({status:r.status,headers:Object.fromEntries(r.headers),body:Buffer.from(await r.arrayBuffer())});});const p=await c.newPage();p.on('pageerror',e=>errors.push(e.stack));return p;}
async function fit(p,name){assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,name+' overflow');await p.screenshot({path:path.join(out,name+'.png'),fullPage:true,animations:'disabled'});}
async function ready(p,prefix){await p.waitForFunction(()=>window.XanHub&&window.XanSiteAdapter);if(prefix==='scratch')await p.locator('#scratch-buy:enabled').waitFor();else await p.waitForFunction(()=>XanSiteAdapter.diagnostics().ready);}
async function menu(p,id){await p.locator('#hub-menu').click();await p.locator(id).click();}
try{
 for(const width of [1440,390])for(const [game,prefix] of games){
  const id=width===1440?'1':'2';server.balances.set(id,50000000);const p=await page(id,width);await p.goto(appOrigin+'/games/single-player/'+game+'/');await ready(p,prefix);
  assert.equal(await p.locator('button:visible').filter({hasText:/practice|free (roll|run|drop|spin|flight)|sound (on|off)/i}).count(),0,game+' removed controls');
  const smallest=await p.locator('select').first().evaluate(e=>Math.min(...[...e.options].map(o=>Number(o.value)).filter(n=>n>0)));
  if(prefix!=='scratch')assert.equal(smallest,10000,game+' minimum');else assert.match(await p.locator('#scratch-tier option').first().textContent(),/10,000/);
  await fit(p,game+'-menu-'+width);const before=server.ledger.size;
  if(prefix==='scratch'){
   const response=p.waitForResponse(r=>r.url().endsWith('/lucky-scratch-action')&&r.request().postDataJSON().action==='buy');await p.locator('#scratch-buy').click();const data=await (await response).json();assert.deepEqual(data.ticket.spots,Array(9).fill(null));await p.locator('#scratch-play:visible').waitFor();assert.equal(await p.locator('.scratch-spot strong').first().textContent(),'…');await p.locator('#scratch-all').click();await p.locator('#scratch-result:visible').waitFor();
  }else if(prefix==='bd'){await p.locator('#bd-enter').click();await p.locator('#bd-start:enabled').click();await p.locator('#bd-finish:visible').waitFor({timeout:25000});}
  else if(prefix==='jj'){await p.locator('#jj-enter').click();await p.locator('#jj-spin:enabled').click();await p.waitForFunction(()=>!XanSiteAdapter.diagnostics().busy);}
  else if(prefix==='mf'){await p.locator('#mf-start').click();await p.locator('#mf-cashout').waitFor();await p.locator('.mf-tile').nth(3).click();await p.locator('#mf-cashout:enabled').click();await p.waitForFunction(()=>!XanSiteAdapter.diagnostics().busy);}
  else if(prefix==='pl'){await p.locator('#pl-enter').click();await p.locator('#pl-drop:enabled').click();await p.waitForFunction(()=>!XanSiteAdapter.diagnostics().busy);}
  else if(prefix==='dd'){await p.locator('#dd-enter').click();await p.locator('#dd-roll:enabled').click();await p.waitForFunction(()=>!XanSiteAdapter.diagnostics().busy);}
  else if(prefix==='rr'){await p.locator('#rr-menu-auto').selectOption('110');await p.locator('#rr-start:enabled').click();await p.locator('#rr-result:visible').waitFor({timeout:20000});}
  else if(prefix==='mr'){await p.locator('#mr-start:enabled').click();await p.locator('#mr-cashout:enabled').waitFor({timeout:15000});await p.locator('#mr-cashout').click();await p.locator('#mr-result:visible').waitFor();}
  assert.equal(server.ledger.size,before+2,game+' one stake and one settlement');assert.equal(await p.evaluate(()=>autoScrolls),0,game+' does not force scrolling');
  await fit(p,game+'-settled-'+width);const y=await p.evaluate(()=>{window.scrollTo(0,Math.min(100,document.documentElement.scrollHeight-innerHeight));return scrollY;});await p.waitForTimeout(350);assert.equal(await p.evaluate(()=>scrollY),y,game+' result stays still');
  await p.evaluate(()=>XanPreferences.theme('dark'));await fit(p,game+'-dark-'+width);await p.context().close();console.log('Paid flow and themes passed: '+game+' '+width);
 }
 const p=await page('1',390);await p.goto(appOrigin+'/');await p.locator('.hub-single-games').waitFor();const order=await p.locator('#simpleTestHome h2').allTextContents();assert.ok(order.indexOf('Single Player')<order.indexOf('Multiplayer'));
 await menu(p,'#hub-stats');await p.locator('#hub-stats-game').waitFor();for(const mode of ['scratch','junction','minefield','plinko','rocket','midnight','luckydice','derby']){await p.locator('#hub-stats-game').selectOption(mode);assert.match(await p.locator('.xan-stat-grid').innerText(),/Games\s+1/);assert.equal(await p.locator('.xan-trophy-list article').count(),12);assert.equal(await p.locator('.xan-trophy-list .is-earned').count(),0);assert.match(await p.locator('.xan-trophy-list').innerText(),/1,500,000 Chips/);}await fit(p,'stats-mobile');await p.locator('.xan-account-close').click();
 await menu(p,'#hub-referrals');await p.locator('.xan-referral-code').waitFor();const code=await p.locator('.xan-referral-code').textContent();await p.getByRole('button',{name:'Copy code',exact:true}).click();assert.equal(await p.evaluate(()=>navigator.clipboard.readText()),code);await fit(p,'referral-mobile');await p.locator('.xan-account-close').click();
 const other=await page('3');await other.goto(appOrigin+'/');await menu(other,'#hub-referrals');await other.locator('#hub-referral-input').fill(code);const initial=server.balances.get('1');await other.getByRole('button',{name:'Apply referral',exact:true}).click();await other.getByText('Referral applied. Your referrer receives 500,000 Chips.',{exact:true}).waitFor();assert.equal(server.balances.get('1'),initial+500000);
 await p.locator('#hub-wallet').click();for(const [name,value] of [['Copy name','CowBoyCookie'],['Copy message','XanDuel']]){await p.getByRole('button',{name,exact:true}).click();assert.equal(await p.evaluate(()=>navigator.clipboard.readText()),value);}await p.getByRole('button',{name:'Check deposit',exact:true}).click();await p.getByText('No new deposit detected.',{exact:true}).waitFor();assert.equal(await p.getByText('Xans will be sent within 24 Hours',{exact:true}).isVisible(),true);await fit(p,'wallet-mobile');
 assert.equal(await p.locator('#hub-diagnostics').count(),0);await other.context().close();await p.context().close();
 const guest=await page(null);for(const [game] of games){await guest.goto(appOrigin+'/games/single-player/'+game+'/');assert.equal(await guest.locator('button:visible').filter({hasText:/practice|free (roll|run|drop|spin|flight)/i}).count(),0);}
 assert.deepEqual(errors,[]);if(appOrigin!==server.origin)console.log('Deployed preview assets exercised with isolated test wallets: '+appOrigin);console.log('Site refinement passed: all eight paid games, desktop/mobile, dark/light, scroll stability, hidden scratch spots, settings stats, referral credit, clipboard, deposit copy and guest menus. '+out);
}finally{await browser.close();await server.close();}
