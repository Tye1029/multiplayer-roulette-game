import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {startTestServer} from './yahtzee-test-server.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.YAHTZEE_PLAYWRIGHT_MODULE||'playwright');
const output=process.env.YAHTZEE_SCREENSHOTS||path.join(os.tmpdir(),'codex-yahtzee-v2-qa');await fs.mkdir(output,{recursive:true});
const fixture=await startTestServer(),origin=fixture.origin;
const browser=await chromium.launch({headless:true,executablePath:process.env.YAHTZEE_BROWSER||undefined}),errors=[];
try{
  const ca=await browser.newContext({viewport:{width:1440,height:1000}}),cb=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  for(const [ctx,key] of [[ca,'TESTPUBLICKEY1'],[cb,'TESTPUBLICKEY2']])await ctx.addInitScript(key=>{localStorage.setItem('tornVisitorApiKey',key);localStorage.setItem('tornKeyConfirmed','true');localStorage.setItem('xan-muted','1');},key);
  const a=await ca.newPage(),b=await cb.newPage();
  for(const p of [a,b]){p.on('pageerror',e=>errors.push(e.message));await p.goto(origin+'/games/multiplayer/yahtzee/');await p.waitForFunction(()=>!document.querySelector('#create').disabled);}
  assert.equal(await a.locator('html').getAttribute('data-theme'),'dark');assert.equal(await a.locator('.xan-brand').innerText(),'XAN DUELS');assert.equal(await a.locator('#name').count(),0);
  assert.equal(await a.locator('#show-scores,.yd-live,#opponent-total').count(),0);assert.equal(await a.getByRole('heading',{name:'Open Games',exact:true}).isVisible(),true);
  await a.locator('#hub-menu').click();await a.locator('#hub-dark').uncheck();assert.equal(await a.locator('html').getAttribute('data-theme'),'light');await a.locator('#hub-dark').check();await a.locator('#hub-sound').check();await a.locator('#hub-sound').uncheck();await a.locator('#hub-menu').click();
  assert.equal(await a.locator('#me-name').textContent(),'Juniper (you)');await a.screenshot({path:path.join(output,'desktop-lobby.png'),fullPage:true});await b.screenshot({path:path.join(output,'mobile-lobby.png'),fullPage:true});
  await a.locator('#xg-wager').fill('0');await a.locator('.xg-primary').click();await a.locator('.xg-waiting').waitFor({state:'visible'});const code=await a.locator('#copy-code').textContent();
  const opponentColor=await a.locator('#opponent-dice .yd-face').first().evaluate(e=>getComputedStyle(e).backgroundImage);
  await a.locator('#dice-color').click();await a.getByRole('button',{name:'Violet dice',exact:true}).click();await a.locator('#color-done').click();
  assert.equal(await a.locator('#dice').getAttribute('data-color'),'violet');assert.equal(await a.locator('#opponent-dice .yd-face').first().evaluate(e=>getComputedStyle(e).backgroundImage),opponentColor);
  await a.reload();await a.waitForFunction(()=>!document.querySelector('#create').disabled);assert.equal(await a.locator('#dice').getAttribute('data-color'),'violet');assert.equal(await b.locator('#dice').getAttribute('data-color'),'ivory');

  await b.reload();await b.locator('.hub-row').filter({hasText:'Yahtzee'}).getByRole('button',{name:'Join',exact:true}).click();await b.locator('.xg-join button').click();await b.getByRole('button',{name:'Join · 0 Chips',exact:true}).click();for(const p of [a,b])await p.locator('.xg-ready:enabled').click();
  await a.locator('#countdown').waitFor({state:'visible'});assert.equal(await a.locator('#roll').isDisabled(),true);assert.equal(await a.locator('#my-rolls').textContent(),'0 / 3 rolls');await b.locator('#countdown').waitFor({state:'visible'});
  for(const p of [a,b])await p.waitForFunction(()=>!document.querySelector('#roll').disabled);
  // Independent simultaneous rolls must not conflict. Lose one successful response.
  const lose=async route=>{if(route.request().postDataJSON().action==='roll'){await route.fetch();await route.abort();await a.unroute('**/yahtzee-action',lose);}else await route.continue();};
  await a.route('**/yahtzee-action',lose);await Promise.all([a.locator('#roll').click(),b.locator('#roll').click()]);
  await a.locator('#retry').waitFor({state:'visible'});await a.locator('#retry').click();
  for(const p of [a,b])await p.waitForFunction(()=>!document.querySelector('#dice button').disabled);
  assert.equal(await a.locator('#my-rolls').textContent(),'1 / 3 rolls');
  await a.waitForFunction(()=>document.querySelector('#opponent-rolls').textContent==='1 / 3 rolls');
  const held=(await a.locator('#dice button').first().getAttribute('aria-label')).split(': ')[1];
  await a.locator('#dice button').first().click();await a.waitForFunction(()=>!document.querySelector('#roll').disabled);
  await a.locator('#roll').click();await a.waitForFunction(()=>!document.querySelector('#dice button').disabled);
  assert.equal((await a.locator('#dice button').first().getAttribute('aria-label')).split(': ')[1],held+', held');
  await a.screenshot({path:path.join(output,'desktop-game.png'),fullPage:true});await b.screenshot({path:path.join(output,'mobile-game.png'),fullPage:true});
  assert.equal(await a.locator('.yd-score-row button[data-category=yahtzee]').textContent(),await a.locator('#dice button').evaluateAll(es=>new Set(es.map(e=>e.dataset.value)).size===1)?'50':'');
  await a.reload();await a.waitForFunction(()=>!document.querySelector('#roll').disabled);assert.equal(await a.locator('#dice button').first().getAttribute('aria-pressed'),'true');
  await a.locator('#roll').click();await a.waitForFunction(()=>document.querySelector('#my-rolls').textContent==='3 / 3 rolls');assert.equal(await a.locator('#roll').isDisabled(),true);
  async function bank(p){await p.waitForFunction(()=>[...document.querySelectorAll('.yd-score-row button')].some(e=>!e.disabled));const choice=p.locator('.yd-score-row button:enabled').first();await choice.click();if(await p.locator('#zero-dialog').isVisible())await p.locator('#confirm-zero').click();await p.waitForFunction(()=>document.querySelector('#me-status').textContent==='Score locked');}
  // This selected card must stay locked while the opponent can still reroll.
  await bank(a);assert.equal(await a.locator('#roll').isDisabled(),true);assert.equal(await b.locator('#roll').isDisabled(),false);await bank(b);
  for(let round=2;round<=13;round++){
    for(const p of [a,b])await p.waitForFunction(n=>document.querySelector('#round').textContent==='ROUND '+n+' / 13'&&!document.querySelector('#roll').disabled,round);
    await Promise.all([a.locator('#roll').click(),b.locator('#roll').click()]);
    await Promise.all([bank(a),bank(b)]);
  }
  for(const p of [a,b])await p.locator('#result-dialog').waitFor({state:'visible'});
  assert.equal(await a.locator('#result-title').textContent(),'The final count');assert.equal(await a.locator('#result-actions').isVisible(),false);
  await a.waitForFunction(()=>document.querySelectorAll('.yd-tally-row.is-counted').length>=6);await a.screenshot({path:path.join(output,'final-tally-desktop.png'),fullPage:true});await b.screenshot({path:path.join(output,'final-tally-mobile.png'),fullPage:true});
  for(const p of [a,b]){await p.locator('#result-actions').waitFor({state:'visible'});assert.equal(await p.locator('.yd-tally-row.is-counted').count(),15);const sums=await p.locator('.yd-tally-row').evaluateAll(es=>[0,1].map(n=>es.reduce((sum,e)=>sum+Number(e.children[n+1].textContent),0)));assert.deepEqual(await p.locator('.yd-tally-player strong').allTextContents(),sums.map(String));}
  assert.equal(await a.locator('#standings').textContent(),await b.locator('#standings').textContent());
  await b.screenshot({path:path.join(output,'mobile-result.png'),fullPage:true});
  await Promise.all([a.locator('#rematch').click(),b.locator('#rematch').click()]);
  for(const p of [a,b])await p.locator('#result-dialog').waitFor({state:'hidden'});
  // The server expires both turns while clients were inactive. No browser clock owns it.
  await fixture.expire(code);await a.waitForFunction(()=>document.querySelector('#me-status').textContent==='Score locked');
  assert.equal(await a.locator('.yd-score-row button.filled').count(),1);
  await b.evaluate(()=>document.getElementById('leave').click());await b.locator('#confirm-leave').click();await b.locator('.xg-menu').waitFor({state:'visible'});
  await a.locator('.xg-menu').waitFor({state:'visible'});await a.locator('.xg-menu').waitFor({state:'visible'});
  await a.locator('#hub-menu').click();await a.locator('#hub-add-bot').click();await a.waitForFunction(()=>document.querySelector('#opponent-name').textContent==='House Bot');
  await a.waitForFunction(()=>document.querySelector('#opponent-rolls').textContent!=='0 / 3 rolls');
  await a.screenshot({path:path.join(output,'desktop-bot.png'),fullPage:true});
  fixture.advance(32*1000*13);await a.locator('#result-dialog').waitFor({state:'visible'});
  await a.locator('#skip-tally').click();await a.locator('#result-actions').waitFor({state:'visible'});assert.match(await a.locator('#standings').textContent(),/House Bot/);
  await a.locator('#rematch').click();await a.locator('#result-dialog').waitFor({state:'hidden'});
  await b.emulateMedia({reducedMotion:'reduce'});assert.equal(await b.locator('.cube').first().evaluate(e=>getComputedStyle(e).transitionDuration),'1e-05s');
  for(const width of [320,390,760,1440]){await a.setViewportSize({width,height:900});const layout=await a.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,elements:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth).map(e=>e.id||e.className).slice(0,20)}));assert.equal(layout.overflow,false,'No overflow at '+width+': '+JSON.stringify(layout.elements));}
  const guest=await browser.newPage();await guest.goto(origin+'/games/multiplayer/yahtzee/');await guest.locator('.xg-primary').click();await guest.locator('.xg-status').filter({hasText:/Connect|API key/}).waitFor();assert.equal(await guest.locator('#create').isDisabled(),true);await guest.close();
  assert.deepEqual(errors,[]);console.log('PASS: shared dark theme/settings, API identity, simultaneous human rounds, both live dice/cards, retry, holds, third-roll cap, zero previews, reload, 13 rounds, rematch, server timeout, full bot match, auth gate and mobile layouts. '+output);
}finally{await browser.close();await fixture.close();}
