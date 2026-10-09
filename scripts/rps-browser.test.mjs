import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
const require=createRequire(import.meta.url);
const { chromium }=require(process.env.RPS_PLAYWRIGHT_MODULE || 'playwright');
const { createStore }=require('../netlify/functions/rps/database.js');
const { createHandler }=require('../netlify/functions/rps-action.js');
const root=path.resolve(fileURLToPath(new URL('../dist/',import.meta.url)));
const output=process.env.RPS_SCREENSHOTS || path.join(os.tmpdir(),'codex-rps-qa');
await fs.mkdir(output,{recursive:true});
const pg=new PGlite(); let tail=Promise.resolve();
const pool={query:(s,a)=>pg.query(s,a),connect:async()=>{let release;const prior=tail;tail=new Promise(r=>release=r);await prior;return {query:(s,a)=>pg.query(s,a),release};}};
const db=createStore(pool), handler=createHandler(db,async()=>({ok:true,json:async()=>({player_id:300,name:'Returning Player'})}));
const tokens=await Promise.all([db.session({id:'100',name:'Maximus'}),db.session({id:'200',name:'Paper Caesar'})]);
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.mp3':'audio/mpeg','.txt':'text/plain'};
const server=http.createServer(async(req,res)=>{
  try {
    if(req.url.startsWith('/.netlify/functions/rps-action')) {
      let body='';for await(const c of req)body+=c;
      const result=await handler({httpMethod:req.method,body});res.writeHead(result.statusCode,result.headers);res.end(result.body);return;
    }
    let pathname=new URL(req.url,'http://localhost').pathname;if(pathname.endsWith('/'))pathname+='index.html';
    const file=path.resolve(root,'.'+decodeURIComponent(pathname));if(!file.startsWith(root+path.sep))throw new Error('outside root');
    const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(data);
  }catch {res.writeHead(404);res.end('Not found');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,executablePath:process.env.RPS_BROWSER || undefined});
const errors=[];
try {
  const ca=await browser.newContext({viewport:{width:1440,height:1100}}),cb=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  for(const [context,token] of [[ca,tokens[0]],[cb,tokens[1]]]) await context.addInitScript(t=>{sessionStorage.setItem('rps-token',t);localStorage.setItem('rps-muted','1');},token);
  const a=await ca.newPage(),b=await cb.newPage();
  for(const p of [a,b]) {p.on('pageerror',e=>errors.push(e.message));await p.goto(origin+'/games/multiplayer/rps/');await p.waitForFunction(()=>document.querySelector('#identity').textContent.includes('Verified'));}
  await a.screenshot({path:path.join(output,'desktop-lobby.png'),fullPage:true});
  await b.screenshot({path:path.join(output,'mobile-lobby.png'),fullPage:true});
  for(const p of [a,b]) assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no horizontal overflow');
  await a.locator('[data-character="lyra"]').click(); await b.locator('[data-character="bryn"]').click();
  await a.locator('#create').click();await a.locator('#invite').waitFor({state:'visible'});const code=await a.locator('#arenaCode').inputValue();
  await b.locator('#joinCode').fill(code);await b.locator('#join').click();
  await a.waitForFunction(()=>document.querySelector('#fighterB').src.includes('bryn.png'));
  assert.match(await b.locator('#fighterA').getAttribute('src'),/lyra/);
  async function choose(left,right) {
    await a.locator(`[data-choice="${left}"]`).waitFor({state:'visible'});
    await a.waitForFunction(()=>!document.querySelector('[data-choice="rock"]').disabled);
    await b.waitForFunction(()=>!document.querySelector('[data-choice="rock"]').disabled);
    await a.locator(`[data-choice="${left}"]`).click();
    await a.waitForFunction(()=>document.querySelector('#pickTitle').textContent==='Your hand is locked.');
    assert.equal(await b.locator('#arena').getAttribute('data-shot'),'wide','opponent stays concealed before both picks');
    await b.locator(`[data-choice="${right}"]`).click();
    await a.waitForFunction(()=>document.querySelector('#arena').dataset.shot==='hands');
    await b.waitForFunction(()=>document.querySelector('#arena').dataset.shot==='hands');
  }
  await choose('rock','rock');assert.equal(await a.locator('#scoreA').textContent(),'0');
  await a.screenshot({path:path.join(output,'desktop-tie.png'),fullPage:true});
  await choose('rock','scissors');assert.equal(await a.locator('#scoreA').textContent(),'1');
  await choose('rock','paper');assert.equal(await b.locator('#scoreB').textContent(),'1');
  await a.waitForFunction(()=>document.querySelector('#arena').classList.contains('sudden'));
  await a.screenshot({path:path.join(output,'desktop-sudden-death.png'),fullPage:true});
  await choose('paper','rock');
  await a.locator('#matchActions').waitFor({state:'visible'});await b.locator('#matchActions').waitFor({state:'visible'});
  assert.match(await a.locator('#callout').textContent(),/YOU ARE/);assert.match(await b.locator('#callout').textContent(),/MAXIMUS WINS/);
  await a.waitForFunction(()=>document.querySelector('#archName').textContent==='Paper Caesar');
  await b.waitForFunction(()=>document.querySelector('#archName').textContent==='Maximus');
  assert.match(await a.locator('#archStats').textContent(),/1 — 0/);assert.match(await b.locator('#archStats').textContent(),/0 — 1/);
  await a.screenshot({path:path.join(output,'desktop-victory.png'),fullPage:true});
  await b.screenshot({path:path.join(output,'mobile-result.png'),fullPage:true});
  await a.locator('#rematch').click();await b.locator('#rematch').click();
  await a.waitForFunction(()=>!document.querySelector('[data-choice="rock"]').disabled);
  await b.waitForFunction(()=>!document.querySelector('[data-choice="rock"]').disabled);
  assert.equal(await a.locator('#scoreA').textContent(),'0');assert.equal(await b.locator('#scoreB').textContent(),'0');
  await b.reload();await b.waitForFunction(()=>document.querySelector('#nameA').textContent==='Maximus');
  assert.match(await b.locator('#fighterB').getAttribute('src'),/bryn/);
  await b.locator('#leave').click();await a.waitForFunction(()=>document.querySelector('#callout').textContent.includes('REFUND'));
  await a.locator('#backLobby').click();
  // Challenge delivers to another authenticated browser without sharing a code.
  await a.locator('#challengeRival').click();
  await b.locator('#invitations [data-accept]').waitFor({state:'visible'});
  assert.match(await a.locator('#lobbyStatus').textContent(),/Invitation sent to Paper Caesar/);
  await b.locator('#invitations [data-accept]').click();
  await b.waitForFunction(()=>!document.querySelector('[data-choice="rock"]').disabled);
  await b.locator('#leave').click();await a.waitForFunction(()=>document.querySelector('#callout').textContent.includes('REFUND'));
  await a.locator('#backLobby').click();await a.locator('#challengeRival').click();
  await b.getByRole('button',{name:'Decline',exact:true}).click();
  await a.waitForFunction(()=>document.querySelector('#status').textContent.includes('declined'));
  await a.locator('#backLobby').click();
  // Regression: adding a bot to a waiting human room actually starts that room.
  await a.locator('#create').click();await a.locator('#invite').waitFor({state:'visible'});
  const botCode=await a.locator('#arenaCode').inputValue();
  assert.equal(await a.locator('#remoteBot').isEnabled(),true);
  await a.locator('#remoteBot').click();await a.waitForFunction(()=>!document.querySelector('[data-choice="rock"]').disabled);
  assert.equal(await a.locator('#arenaCode').inputValue(),botCode);
  await a.reload();await a.waitForFunction(()=>!document.querySelector('[data-choice="rock"]').disabled);
  for(let n=0;n<40;n++) {
    if(await a.locator('#matchActions').isVisible())break;
    await a.waitForFunction(()=>!document.querySelector('[data-choice="rock"]').disabled || !document.querySelector('#matchActions').hidden);
    if(await a.locator('#matchActions').isVisible())break;
    await a.locator('[data-choice="rock"]').click();
    await a.waitForFunction(()=>document.querySelector('#arena').dataset.shot==='hands');
    await a.waitForFunction(()=>!document.querySelector('[data-choice="rock"]').disabled || !document.querySelector('#matchActions').hidden);
  }
  assert.equal(await a.locator('#matchActions').isVisible(),true,'network bot completes a match');
  await a.locator('#rematch').click();await a.waitForFunction(()=>!document.querySelector('[data-choice="rock"]').disabled);
  await a.locator('#leave').click();await a.locator('#practice').click();await a.waitForFunction(()=>!document.querySelector('[data-choice="rock"]').disabled);
  await a.locator('#motion').click();assert.equal(await a.locator('body').evaluate(el=>el.classList.contains('calm')),true);
  await a.locator('#sound').click();await a.locator('[data-choice="paper"]').click();await a.waitForFunction(()=>document.querySelector('#arena').dataset.shot==='hands');
  await a.waitForTimeout(500);
  // Media URLs decode correctly; disabled autoplay still leaves controls playable.
  const media=await a.evaluate(async()=>{const a=new Audio('/assets/rps/audio/metal.mp3');await new Promise((resolve,reject)=>{a.onloadedmetadata=resolve;a.onerror=reject;a.load();});return a.duration;});
  assert.ok(media>25 && media<27);
  // Restoring a saved-key session must release busy controls after login finishes.
  const restoreGame=await db.create({id:'300',name:'Returning Player'},true);
  const cc=await browser.newContext({viewport:{width:390,height:844}});
  await cc.addInitScript(id=>{localStorage.setItem('tornVisitorApiKey','testkey123');sessionStorage.setItem('rps-match',id);},restoreGame.id);
  const returning=await cc.newPage();returning.on('pageerror',e=>errors.push(e.message));
  await returning.goto(origin+'/games/multiplayer/rps/');
  await returning.waitForFunction(()=>!document.querySelector('[data-choice="rock"]').disabled);
  await returning.locator('[data-choice="paper"]').click();await returning.waitForFunction(()=>document.querySelector('#arena').dataset.shot==='hands');
  const guest=await browser.newContext({viewport:{width:390,height:844}});
  await guest.addInitScript(()=>{Storage.prototype.getItem=()=>{throw new Error('Storage unavailable');};Storage.prototype.setItem=()=>{throw new Error('Storage unavailable');};});
  const g=await guest.newPage();g.on('pageerror',e=>errors.push(e.message));await g.goto(origin+'/games/multiplayer/rps/');
  await g.locator('#remoteBot').click();assert.match(await g.locator('#lobbyStatus').textContent(),/Connect your Torn/);
  await g.locator('#practice').click();await g.locator('[data-choice="paper"]').click();await g.waitForFunction(()=>document.querySelector('#arena').dataset.shot==='hands');
  for(const p of [a,b,returning,g]) assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({ok:true,checks:'desktop/mobile human duel, tie, best-of-three, sudden death, records, rival invite accept/decline, distinct characters, rematch/reload, waiting-room network bot full match, saved-key restore, unavailable storage, guest practice, audio',screenshots:output}));
} finally {await browser.close();await new Promise(r=>server.close(r));await pg.close();}
