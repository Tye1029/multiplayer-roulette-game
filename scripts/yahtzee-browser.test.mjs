import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {PGlite} from '@electric-sql/pglite';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.YAHTZEE_PLAYWRIGHT_MODULE||'playwright');
const {createStore}=require('../netlify/functions/yahtzee/database');
const {createHandler}=require('../netlify/functions/yahtzee-action');
const output=process.env.YAHTZEE_SCREENSHOTS||path.join(os.tmpdir(),'codex-yahtzee-qa');await fs.mkdir(output,{recursive:true});
let server,pg,origin=process.env.YAHTZEE_ORIGIN;
if(!origin){
  pg=new PGlite();let tail=Promise.resolve();
  const pool={query:(s,a)=>pg.query(s,a),connect:async()=>{let release;const prior=tail;tail=new Promise(r=>release=r);await prior;return{query:(s,a)=>pg.query(s,a),release};}};
  const handler=createHandler(createStore(pool)),root=path.resolve('dist');
  const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
  server=http.createServer(async(req,res)=>{
    try{
      if(req.url.startsWith('/.netlify/functions/yahtzee-action')){let body='';for await(const c of req)body+=c;const r=await handler(new Request('http://local'+req.url,{method:req.method,body}));res.writeHead(r.status,Object.fromEntries(r.headers));res.end(await r.text());return;}
      let name=new URL(req.url,'http://local').pathname;if(name.endsWith('/'))name+='index.html';const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep))throw 0;
      res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(await fs.readFile(file));
    }catch{res.writeHead(404);res.end('Not found');}
  });await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;
}
const browser=await chromium.launch({headless:true,executablePath:process.env.YAHTZEE_BROWSER||undefined});
const errors=[];
try{
  const desktop=await browser.newContext({viewport:{width:1440,height:1100}}),mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const a=await desktop.newPage(),b=await mobile.newPage();
  for(const p of [a,b]){p.on('pageerror',e=>errors.push(e.message));await p.goto(origin+'/games/multiplayer/yahtzee/');await p.locator('#create').waitFor();}
  await a.screenshot({path:path.join(output,'desktop-lobby.png'),fullPage:true});await b.screenshot({path:path.join(output,'mobile-lobby.png'),fullPage:true});
  await a.locator('#name').fill('Juniper');await a.locator('#create').click();await a.locator('#waiting').waitFor({state:'visible'});
  const code=await a.locator('#copy-code').textContent();assert.match(code,/^[A-F0-9]{8}$/);
  await b.goto(origin+'/games/multiplayer/yahtzee/?room='+code);await b.locator('#name').fill('Clementine');await b.locator('#join').click();await b.locator('#waiting').waitFor({state:'visible'});
  await a.waitForFunction(()=>!document.querySelector('#start').disabled);await a.locator('#start').click();await a.locator('#score-panel').waitFor({state:'visible'});
  await a.locator('#sound').click();
  // Lose a successful response; the retry must not spend another roll.
  const loseResponse=async route=>{const data=route.request().postDataJSON();if(data.action==='roll'){await route.fetch();await route.abort();await a.unroute('**/yahtzee-action',loseResponse);}else await route.continue();};
  await a.route('**/yahtzee-action',loseResponse);
  for(let turn=0;turn<26;turn++){
    const p=turn%2?b:a;
    await p.waitForFunction(()=>!document.querySelector('#roll').disabled);await p.locator('#roll').click();
    if(turn===0){await a.locator('#retry').waitFor({state:'visible'});await a.locator('#retry').click();}
    await p.waitForFunction(()=>!document.querySelector('.die').disabled);
    if(turn===0){
      const held=await a.locator('.die').first().getAttribute('aria-label');await a.locator('.die').first().click();await a.waitForFunction(()=>document.querySelector('.die').getAttribute('aria-pressed')==='true'&&!document.querySelector('#roll').disabled);
      await a.locator('#roll').click();await a.waitForFunction(()=>!document.querySelector('.die').disabled);
      assert.equal((await a.locator('.die').first().getAttribute('aria-label')).split(',')[0],held.split(',')[0]);
      await a.screenshot({path:path.join(output,'desktop-game.png'),fullPage:true});
      await b.screenshot({path:path.join(output,'mobile-game.png'),fullPage:true});
      await a.reload();await a.locator('#score-panel').waitFor({state:'visible'});assert.equal(await a.locator('.die').first().getAttribute('aria-pressed'),'true');
      await a.locator('#roll').click();await a.waitForFunction(()=>document.querySelector('#roll').textContent.includes('Choose a score'));
      assert.equal(await a.locator('#roll').isDisabled(),true);
    }
    await p.locator('.score-row.available').first().click();await p.locator('#bank').click();
    await p.waitForFunction(()=>document.querySelector('#score-confirm').hidden);
  }
  for(const p of [a,b])await p.locator('#result-dialog').waitFor({state:'visible'});
  assert.equal(await a.locator('#standings').textContent(),await b.locator('#standings').textContent());
  await a.screenshot({path:path.join(output,'desktop-result.png'),fullPage:true});
  await b.screenshot({path:path.join(output,'mobile-result.png'),fullPage:true});
  await a.locator('#rematch').click();await a.waitForFunction(()=>document.querySelector('#rematch').disabled);await b.locator('#rematch').click();
  for(const p of [a,b])await p.locator('#result-dialog').waitFor({state:'hidden'});
  await b.waitForFunction(()=>!document.querySelector('#roll').disabled);await b.locator('#roll').click();
  await b.waitForFunction(()=>!document.querySelector('.die').disabled);
  await b.emulateMedia({reducedMotion:'reduce'});assert.equal(await b.locator('.cube').first().evaluate(e=>getComputedStyle(e).transitionDuration),'1e-05s');
  for(const width of [320,390,760,1440]){await a.setViewportSize({width,height:900});assert.equal(await a.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`No overflow at ${width}px`);}
  await b.locator('#leave').click();await b.locator('#confirm-leave').click();await b.locator('#lobby').waitFor({state:'visible'});await a.getByText('This table has closed.',{exact:true}).waitFor();
  assert.deepEqual(errors,[]);console.log('PASS: two clients, invite, live dice, holds, 3-roll cap, reload recovery, full 26-turn match, results, consensual rematch, leaving, reduced motion and 320–1440px layouts. Screenshots: '+output);
}finally{await browser.close();if(server)await new Promise(r=>server.close(r));if(pg)await pg.close();}
