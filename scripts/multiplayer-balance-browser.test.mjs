import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
import {startPublicPolishServer} from './public-polish-test-server.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.RPS_PLAYWRIGHT_MODULE||'playwright');
const server=await startPublicPolishServer(path.resolve('dist')),browser=await chromium.launch({headless:true,executablePath:process.env.RPS_BROWSER||undefined});
const errors=[];
try{
 for(const width of [1360,390]){
  const p=await browser.newPage({viewport:{width,height:900}});p.on('pageerror',e=>errors.push(e.message));await p.goto(server.origin+'/games/multiplayer/dice-duel/');await p.waitForFunction(()=>!!window.XanHub?.setBalance);
  assert.deepEqual(await p.evaluate(()=>[XanHub.prize(2000,3.3),XanHub.prize(200,3.3),XanHub.prize(4000,0),XanHub.prize(2000,25)]),[1934,193,4000,1500],'Prizes exclude the configured share and round exactly like settlement');
  // Contract tests use the actual shared header with adversarial game snapshots.
  // Real two-player settlement and both background writers are covered in dice-v2-browser.
  const modes=await p.evaluate(()=>Object.keys(XanHub.games).filter(m=>XanHub.games[m][1]!=='SINGLE PLAYER'));
  for(const mode of modes){
   await p.evaluate(mode=>{
    window.balanceFixture={mode,id:'balance-test-'+mode,phase:'waiting',match:1,finished:false,players:[]};
    document.getElementById('balance-result-fixture')?.remove();const root=document.createElement('section');root.id='balance-result-fixture';root.hidden=true;root.innerHTML='<h2>You win</h2><button>Rematch</button>';document.body.append(root);
    window.XanSiteAdapter={current:()=>balanceFixture,view:()=>balanceFixture,resultRoot:()=>root};XanHub.setBalance(500000);
   },mode);
   assert.equal(await p.locator('#hub-balance').innerText(),'500,000 Chips');
   await p.evaluate(()=>{balanceFixture.phase='playing';XanHub.setBalance(501934);});await p.waitForTimeout(120);assert.equal(await p.locator('#hub-balance').innerText(),'500,000 Chips',mode+' active');
   await p.evaluate(()=>{balanceFixture.phase='complete';balanceFixture.finished=true;});await p.waitForTimeout(120);assert.equal(await p.locator('#hub-balance').innerText(),'500,000 Chips',mode+' result still hidden');
   await p.evaluate(()=>{const r=document.getElementById('balance-result-fixture');r.hidden=false;r.style.visibility='hidden';});await p.waitForTimeout(120);assert.equal(await p.locator('#hub-balance').innerText(),'500,000 Chips',mode+' cinematic reveal pending');
   await p.evaluate(()=>{const r=document.getElementById('balance-result-fixture');r.style.visibility='visible';r.style.opacity='0';});await p.waitForTimeout(120);assert.equal(await p.locator('#hub-balance').innerText(),'500,000 Chips',mode+' transparent result');
   await p.evaluate(()=>document.getElementById('balance-result-fixture').style.opacity='1');await p.waitForFunction(()=>document.getElementById('hub-balance').textContent==='501,934 Chips');
   await p.evaluate(()=>{document.getElementById('balance-result-fixture').hidden=true;XanHub.setBalance(506934);});assert.equal(await p.locator('#hub-balance').innerText(),'506,934 Chips',mode+' seen result remains revealed after closing');
   await p.evaluate(()=>{balanceFixture.match++;balanceFixture.phase='playing';balanceFixture.finished=false;XanHub.setBalance(505934);});await p.waitForTimeout(120);assert.equal(await p.locator('#hub-balance').innerText(),'506,934 Chips',mode+' rematch held again');
   await p.evaluate(()=>{balanceFixture.phase='cancelled';});await p.waitForFunction(()=>document.getElementById('hub-balance').textContent==='505,934 Chips');
  }
  // No stale response can overwrite a newer sample or a different account.
  await p.evaluate(()=>{balanceFixture.id='';window.sampleTime=performance.now();XanHub.setBalance(2000,{at:sampleTime+1});XanHub.setBalance(1000,{at:sampleTime});XanHub.setBalance(999999,{key:'other-account'});});assert.equal(await p.locator('#hub-balance').innerText(),'2,000 Chips');
  await p.evaluate(()=>{balanceFixture.mode='luckydice';balanceFixture.id='solo';balanceFixture.phase='playing';XanHub.setBalance(3000);});assert.equal(await p.locator('#hub-balance').innerText(),'3,000 Chips','Solo keeps its existing balance behavior');
  await p.close();
  // Restored scenes keep gross pots in their snapshots; only visible prize
  // labels are formatted. A new render must not flash the gross amount back.
  const legacy=await browser.newPage({viewport:{width,height:900}});legacy.on('pageerror',e=>errors.push(e.message));await legacy.addInitScript(()=>{localStorage.setItem('tornVisitorApiKey','TESTPUBLICKEY009');localStorage.setItem('tornKeyConfirmed','true');localStorage.setItem('xan-muted','1');});await legacy.goto(server.origin);await legacy.waitForFunction(()=>window.XanHub?.prize(2000)===1934);
  for(const mode of ['roulette','fishing','safecracker','mountainrace']){
   await legacy.evaluate(mode=>{window.prizeFixture={id:'prize-'+mode,mode,phase:'playing',wager:1000,pot:2000,players:[]};window.XanSiteAdapter={current:()=>prizeFixture,view:()=>prizeFixture};document.getElementById('duelActive').innerHTML='<div class="rr-pot"><span>Pot</span><b>2000</b><small>Tickets</small></div><div class="fishing-pot"><small>POT</small><b>2000</b></div><div class="sc-prize"><b>2000</b></div><div class="sh-clock"><small>2000</small></div><div class="m68-stakes">2000</div>';},mode);
   await legacy.waitForFunction(()=>document.querySelector('.sc-prize>b').textContent==='1,934 Chips');assert.equal(await legacy.locator('.rr-pot>b').textContent(),'1,934');assert.equal(await legacy.locator('.fishing-pot>b').textContent(),'1,934 Chips');assert.equal(await legacy.locator('.sh-clock>small').textContent(),'1,934 Chips PRIZE');assert.match(await legacy.locator('.m68-stakes').textContent(),/1,934 Chips prize/);assert.equal(await legacy.evaluate(()=>prizeFixture.pot),2000);
   await legacy.evaluate(()=>document.querySelector('.sc-prize>b').textContent='2000');await legacy.waitForFunction(()=>document.querySelector('.sc-prize>b').textContent==='1,934 Chips');
  }
  await legacy.close();
 }
 assert.deepEqual(errors,[]);console.log('Shared balance display passed for every multiplayer mode at desktop and phone widths: hidden/transparent results, rematches, cancellation, stale responses, profile isolation and solo compatibility.');
}finally{await browser.close();await server.close();}
