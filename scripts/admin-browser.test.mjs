import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.RPS_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve('dist'),out=path.join(os.tmpdir(),'admin-balance-qa'),errors=[];await fs.mkdir(out,{recursive:true});
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://local'),file=path.resolve(root,'.'+url.pathname);if(!file.startsWith(root+path.sep))throw Error('Path');res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream'});res.end(await fs.readFile(file));}catch{res.writeHead(404);res.end('Not found');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true,executablePath:process.env.RPS_BROWSER||undefined});
try{
 for(const width of [1360,390]){
  const p=await browser.newPage({viewport:{width,height:width>700?1000:844},hasTouch:width<700});p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
  const owner={userId:'101',name:'Test Admin',currentBalance:500000,financialLedger:[],recentAdjustments:[]},other={userId:'202',name:'Test Player',currentBalance:500000};let users=[owner,other],adjustments=0,ledgerPages=0,delayed;
  await p.route('**/.netlify/functions/**',async route=>{
   const req=route.request(),name=new URL(req.url()).pathname.split('/').at(-1),body=req.postData()?req.postDataJSON():{};
   let data={ok:true},status=200;
   if(name.startsWith('admin-')){
    if(req.headers()['x-admin-password']!=='fixture-admin'){status=401;data={ok:false,error:'Wrong admin password.'};}
    else if(name==='admin-users'&&body.action==='ledger'){
     ledgerPages++;data={ok:true,entries:[{id:'receipt-'+body.userId+'-'+ledgerPages,at:'2026-10-13T18:00:00Z',type:'admin_adjustment',delta:800000,balanceAfter:1300000,reason:'Record for '+body.userId}],next:body.before===undefined?1:null};
     if(delayed){const release=delayed;delayed=null;await release;}
    }else if(name==='admin-users')data={ok:true,users};
    else if(name==='admin-odds')data={ok:true,settings:{gameOdds:{multiplayer:{houseCutPercent:3.3}}}};
    else if(name==='admin-adjust'){
     assert.deepEqual(body,{userId:'101',amount:800000,action:'increase',reason:'UI regression test'});adjustments++;const before=owner.currentBalance;owner.currentBalance+=body.amount;const adjustment={id:'adjust-'+adjustments,at:'2026-10-13T18:00:00Z',...body,delta:body.amount,balanceBefore:before,balanceAfter:owner.currentBalance};owner.recentAdjustments.unshift(adjustment);data={ok:true,user:owner,adjustment};
    }else throw Error('Unexpected admin mutation: '+name);
   }
   await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  });
  await p.goto(origin+'/admin.html');await p.locator('#password').fill('fixture-admin');await p.locator('#loadBtn').click();await p.locator('#loadBtn:enabled').waitFor();assert.match(await p.locator('#status').innerText(),/Loaded 2 user/);assert.equal(await p.locator('#adjustPanel').isVisible(),true);assert.equal(await p.locator('#detailUserSelect').inputValue(),'');assert.match(await p.locator('#userDetailContent').innerText(),/Select a connected user/);assert.equal(await p.locator('#ledger-more').count(),0);
  await p.locator('#adjustUser').selectOption('101');await p.locator('#adjustAmount').fill('800000');await p.locator('#adjustReason').fill('UI regression test');await p.locator('#applyAdjustBtn').click();await p.locator('#applyAdjustBtn:enabled').waitFor();assert.equal(adjustments,1);assert.match(await p.locator('#status').innerText(),/Added 800,000 Chips.*1,300,000 Chips/);assert.equal(await p.locator('#detailUserSelect').inputValue(),'');assert.match(await p.locator('#userRows').innerText(),/1,300,000 Chips/);assert.match(await p.locator('#adjustmentRows').innerText(),/UI regression test/);
  await p.locator('#detailUserSelect').selectOption('101');await p.locator('#ledger-more').click();await p.locator('#ledger-more:enabled').waitFor();assert.match(await p.locator('#full-ledger').innerText(),/Record for 101/);await p.locator('#ledger-more').click();await p.locator('#ledger-more').waitFor({state:'hidden'});assert.equal(await p.locator('#full-ledger .detail-item').count(),2);
  await p.locator('#detailUserSelect').selectOption('101');let release;delayed=new Promise(r=>release=r);await p.locator('#ledger-more').click();await p.locator('#ledger-more:disabled').waitFor();await p.locator('#detailUserSelect').selectOption('202');const response=p.waitForResponse(r=>r.url().endsWith('admin-users')&&r.request().method()==='POST');release();await response;await p.waitForTimeout(50);assert.doesNotMatch(await p.locator('#full-ledger').innerText(),/Record for 101/);
  await p.locator('#detailUserSelect').selectOption('');assert.match(await p.locator('#detailUpdated').innerText(),/2 user/);await p.locator('#loadBtn').click();await p.locator('#loadBtn:enabled').waitFor();assert.match(await p.locator('#status').innerText(),/Loaded 2 user/);
  await p.evaluate(()=>scrollTo({top:0,behavior:'instant'}));assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await p.screenshot({path:path.join(out,'admin-'+width+'.png'),fullPage:true});
  users=[];await p.locator('#loadBtn').click();await p.locator('#loadBtn:enabled').waitFor();assert.match(await p.locator('#status').innerText(),/Loaded 0 user/);assert.match(await p.locator('#detailUpdated').innerText(),/Load admin data first/);
  users=[owner];await p.locator('#loadBtn').click();await p.locator('#loadBtn:enabled').waitFor();assert.equal(await p.locator('#detailUserSelect').inputValue(),'101');assert.equal(await p.locator('#ledger-more').isVisible(),true);
  await p.locator('#password').fill('wrong');await p.locator('#loadBtn').click();await p.locator('#loadBtn:enabled').waitFor();assert.match(await p.locator('#status').innerText(),/Wrong admin password/);assert.equal(adjustments,1);await p.close();
 }
 assert.deepEqual(errors,[]);console.log('Admin browser checks passed: desktop/mobile loading with 0/1/2 users, chip adjustment and refresh, record-book pagination, stale-response isolation and login errors. Synthetic data only. '+out);
}finally{await browser.close();await new Promise(r=>server.close(r));}
