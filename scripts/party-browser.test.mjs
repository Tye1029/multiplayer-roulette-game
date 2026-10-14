import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {startPartyServer} from './party-test-server.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.RPS_PLAYWRIGHT_MODULE||'playwright');
const server=await startPartyServer(),browser=await chromium.launch({headless:true,executablePath:process.env.RPS_BROWSER||undefined}),out=path.join(os.tmpdir(),'boardwalk-party-qa'),errors=[];
await fs.mkdir(out,{recursive:true});
async function page(width){const ctx=await browser.newContext({viewport:{width,height:width<600?844:1000},hasTouch:width<600});await ctx.addInitScript(()=>localStorage.setItem('boardwalk-sound','off'));const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.stack));await p.goto(server.origin+'/party.html');await p.getByRole('button',{name:'Start a party',exact:false}).waitFor();return p;}
async function fit(p,name){await p.screenshot({path:path.join(out,name+'.png'),fullPage:true});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,name+' horizontal overflow');const bad=await p.locator('button:visible,input:visible').evaluateAll(es=>es.filter(e=>{const r=e.getBoundingClientRect();return r.left< -1||r.right>innerWidth+1;}).map(e=>e.textContent));assert.deepEqual(bad,[],name+' clipped controls');}
async function wait(p,selector){await p.locator(selector).waitFor({timeout:12000});}
try{
  for(const width of [320,390,768,1440]){const p=await page(width);await fit(p,'home-'+width);await p.getByRole('button',{name:'Settings',exact:true}).click();await fit(p,'settings-'+width);await p.getByRole('button',{name:'Close dialog'}).click();await p.context().close();}
  const pages=[await page(1440),await page(390),await page(320),await page(768)];
  await pages[0].getByRole('button',{name:'Start a party',exact:false}).click();await pages[0].locator('#nickname').fill('River');await pages[0].getByRole('button',{name:'Let’s play',exact:false}).click();await wait(pages[0],'#share-code');const code=new URL(pages[0].url()).searchParams.get('room');
  for(let i=1;i<4;i++){const p=pages[i];await p.goto(server.origin+'/party.html?room='+code);await wait(p,'#join-form');await p.getByRole('button',{name:'Join the party',exact:true}).click();await p.locator('#nickname').fill(['River','Juniper','Pip','Sky'][i]);await p.locator(`[data-character-choice="${['raccoon','fox','frog','robot'][i]}"]`).click();await p.getByRole('button',{name:'Let’s play',exact:false}).click();await wait(p,'#share-code');}
  await pages[0].getByRole('heading',{name:'4/4 in the party'}).waitFor();await fit(pages[0],'lobby-desktop');await fit(pages[1],'lobby-mobile');
  for(const p of pages)await p.locator('[data-action=ready]').click();await pages[0].locator('[data-action=start]:enabled').click();await wait(pages[0],'[data-route=scenic]');await fit(pages[0],'board-desktop');await fit(pages[1],'board-mobile');
  const read=async()=>(await server.pg.query('SELECT state FROM party_rooms WHERE id=$1',[code])).rows[0].state;
  const expire=async()=>{const s=await read();s.deadline=Date.now()-1;if(s.phase==='playing')s.game.end=Date.now()-1;await server.pg.query('UPDATE party_rooms SET state=$2::jsonb WHERE id=$1',[code,JSON.stringify(s)]);};
  let seen=new Set(),guard=0;
  while(guard++<40){let s=await read();if(s.phase==='complete')break;
    if(s.phase==='board'){
      const p=pages[s.turn];await wait(p,'[data-route=scenic]');if(s.round===1&&s.turn===0){await p.locator('[data-item=boost]').click();await p.locator('[data-route=scenic]').waitFor();}
      await p.locator('[data-route=scenic]').click();await p.waitForTimeout(200);
    }else if(s.phase==='board-end'||s.phase==='intro'||s.phase==='round-end'){await expire();await pages[0].waitForTimeout(1600);}
    else if(s.phase==='playing'){
      const game=s.game.id;await pages[0].locator('.controls').waitFor();
      if(game==='climb'){for(const p of pages){await wait(p,'#next-arrows');for(let j=0;j<3;j++){const arrow=(await p.locator('#next-arrows').innerText()).trim()[0],dir={'↑':'up','↓':'down','←':'left','→':'right'}[arrow];await p.locator(`[data-direction=${dir}]`).click();await p.waitForTimeout(230);}}}
      if(game==='putt'){for(const p of pages){await wait(p,'#aim');await p.locator('#aim').fill('-62');await p.locator('#power').fill('57');await p.locator('[data-putt]').click();}await pages[0].waitForTimeout(600);}
      if(game==='fish'){for(let n=0;n<2;n++){for(const p of pages){await wait(p,'#reel');await p.locator('#reel:enabled').click();}await pages[0].waitForTimeout(1400);}}
      if(game==='memory'){await pages[0].waitForTimeout(2500);for(let i=0;i<4;i++){const p=pages[i];for(let j=0;j<2;j++){s=await read();const v=s.game.progress[i];await p.locator(`[data-pad="${v.pattern[v.cursor]}"]:enabled`).click();await p.waitForTimeout(230);}}}
      seen.add(game);await fit(pages[0],game+'-desktop');await fit(pages[1],game+'-mobile');
      // Actual tap targets and game canvas must be visible together on phones.
      await pages[1].evaluate(()=>scrollTo(0,0));const rect=await pages[1].locator('.controls').boundingBox();assert.ok(rect.y+rect.height<=844,game+' controls fit with the scene');
      await pages[2].setViewportSize({width:844,height:390});await fit(pages[2],game+'-landscape');await pages[2].setViewportSize({width:320,height:844});
      if(seen.size===1){const before=await pages[1].context().cookies();await pages[1].reload();await wait(pages[1],'#share-code');const after=await pages[1].context().cookies();assert.equal(before.find(c=>c.name==='boardwalk_session').value,after.find(c=>c.name==='boardwalk_session').value);}
      await expire();await pages[0].waitForTimeout(1600);
    }else throw Error(s.phase);
  }
  const final=await read();assert.equal(final.phase,'complete');assert.equal(seen.size,4);assert.ok(final.winner);await wait(pages[0],'[data-action=rematch]');await wait(pages[1],'[data-action=rematch]');await fit(pages[0],'result-desktop');await fit(pages[1],'result-mobile');
  await pages[1].getByRole('button',{name:'Visit the wardrobe'}).click();await fit(pages[1],'wardrobe-mobile');assert.equal(await pages[1].locator('button[data-skin=sunset]').isDisabled(),true);await pages[1].getByRole('button',{name:'Close dialog'}).click();
  for(const p of pages)await p.locator('[data-action=rematch]').click();await wait(pages[0],'[data-route=scenic]');assert.equal((await read()).match,2);
  const duo=[await page(1280),await page(390)];
  await duo[0].locator('[data-create=duel]').click();await duo[0].locator('#nickname').fill('Duel QA');await duo[0].getByRole('button',{name:'Let’s play',exact:false}).click();await wait(duo[0],'#share-code');const duelCode=new URL(duo[0].url()).searchParams.get('room');
  await duo[1].goto(server.origin+'/party.html?room='+duelCode);await wait(duo[1],'#join-form');await duo[1].getByRole('button',{name:'Join the party',exact:true}).click();await duo[1].locator('#nickname').fill('Rival QA');await duo[1].getByRole('button',{name:'Let’s play',exact:false}).click();await wait(duo[1],'#share-code');
  for(const p of duo)await p.locator('[data-action=ready]').click();await duo[0].locator('[data-action=start]:enabled').click();
  let duelGuard=0;
  while(duelGuard++<18){const d=(await server.pg.query('SELECT state FROM party_rooms WHERE id=$1',[duelCode])).rows[0].state;if(d.phase==='complete')break;
    if(d.phase==='playing'){
      const p=duo[0];await p.locator('.controls').waitFor();
      if(d.game.id==='climb'){await wait(p,'#next-arrows');for(let i=0;i<2;i++){const arrow=(await p.locator('#next-arrows').innerText()).trim()[0];await p.locator(`[data-direction="${{'↑':'up','↓':'down','←':'left','→':'right'}[arrow]}"]`).click();await p.waitForTimeout(200);}}
      if(d.game.id==='putt'){await wait(p,'[data-putt]');await p.locator('[data-putt]').click();}
      if(d.game.id==='fish'){await wait(p,'#reel');await p.locator('#reel').click();}
      if(d.game.id==='memory'){await p.waitForTimeout(2500);for(const value of d.game.progress[0].pattern){await p.locator(`[data-pad="${value}"]:enabled`).click();await p.waitForTimeout(200);}}
    }
    const d2=(await server.pg.query('SELECT state FROM party_rooms WHERE id=$1',[duelCode])).rows[0].state;d2.deadline=Date.now()-1;if(d2.phase==='playing')d2.game.end=Date.now()-1;await server.pg.query('UPDATE party_rooms SET state=$2::jsonb WHERE id=$1',[duelCode,JSON.stringify(d2)]);await duo[0].waitForTimeout(1600);
  }
  const duelFinal=(await server.pg.query('SELECT state FROM party_rooms WHERE id=$1',[duelCode])).rows[0].state;assert.equal(duelFinal.phase,'complete');assert.ok(duelFinal.winner);await wait(duo[1],'[data-action=rematch]');await fit(duo[1],'duel-result-mobile');
  const delayed=await page(390);await delayed.locator('[data-create=duel]').click();await delayed.locator('#nickname').fill('Slow Network');await delayed.getByRole('button',{name:'Let’s play',exact:false}).click();await wait(delayed,'#share-code');
  await delayed.route('**/.netlify/functions/party-action',async route=>{if(route.request().postDataJSON().action==='add-bot')await new Promise(resolve=>setTimeout(resolve,1800));await route.continue();});
  await delayed.locator('[data-action=add-bot]').click();assert.equal(await delayed.locator('[data-action=ready]').isDisabled(),true,'lobby controls show the pending request');
  await delayed.locator('[data-action=ready]').click();await delayed.getByRole('button',{name:'Ready ✓ · undo',exact:true}).waitFor();await delayed.locator('[data-action=start]:enabled').waitFor();
  const delayedCode=new URL(delayed.url()).searchParams.get('room'),delayedRoom=(await server.pg.query('SELECT state FROM party_rooms WHERE id=$1',[delayedCode])).rows[0].state;assert.equal(delayedRoom.players.length,2);assert.deepEqual(delayedRoom.ready,[delayedRoom.host]);await delayed.context().close();
  assert.deepEqual(errors,[]);console.log('PASS: four-player party, all four interactive minigames, 1v1 duel, reconnect, rewards, rematch, delayed-network controls, desktop/phone/landscape layouts. Screenshots: '+out);
}finally{await browser.close();await server.close();}
