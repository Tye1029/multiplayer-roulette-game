import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import {startPublicPolishServer} from './public-polish-test-server.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.RPS_PLAYWRIGHT_MODULE||'playwright');
const server=await startPublicPolishServer(),browser=await chromium.launch({headless:true,executablePath:process.env.RPS_BROWSER||undefined});
const errors=[],out=path.join(os.tmpdir(),'bluff-v4-qa');await fs.mkdir(out,{recursive:true});
const deferred=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve:()=>resolve()};};
async function player(id,width=1280){
 const context=await browser.newContext({viewport:{width,height:900},permissions:['clipboard-read','clipboard-write']});
 await context.addInitScript(id=>{localStorage.setItem('tornVisitorApiKey','TESTPUBLICKEY00'+id);localStorage.setItem('tornKeyConfirmed','true');localStorage.setItem('xan-muted','1');},id);
 const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(server.origin+'/games/multiplayer/bluff/');await p.locator('.xg-primary').waitFor();return p;
}
async function menu(p,name){await p.getByRole('button',{name:'Open menu',exact:true}).click();await p.getByRole('button',{name,exact:true}).click();}
async function debug(p,mode){
 await menu(p,'Stats & achievements');await p.locator('#hub-stats-game').selectOption(mode);assert.equal(await p.locator('#hub-diagnostics').count(),0);await p.locator('.xan-stat-grid').waitFor();await p.locator('.xan-account-close').click();
}

try{
 const bot=await player(1);await bot.getByRole('button',{name:'Create Game',exact:true}).click();await bot.locator('.xg-cancel:visible').waitFor();const oldRoom=new URL(bot.url()).searchParams.get('room');
 // Delay an already-read poll until after replacement, reproducing the navigation race.
 const read=deferred(),release=deferred();let held=false;
 await bot.route('**/.netlify/functions/bluff-action',async route=>{const b=route.request().postDataJSON();if(!held&&b.action==='get'&&b.gameId===oldRoom){held=true;const response=await route.fetch();read.resolve();await release.promise;await route.fulfill({response});}else if(b.action==='create'&&b.bot){await new Promise(r=>setTimeout(r,500));await route.continue();}else await route.continue();});
 await read.promise;
 await bot.evaluate(()=>{window.paintCheck={running:true,blank:0,menu:0};function sample(){if(!paintCheck.running)return;if(document.querySelector('#game').hidden)paintCheck.blank++;if(!document.querySelector('.xg-menu').hidden)paintCheck.menu++;requestAnimationFrame(sample);}sample();});
 await menu(bot,'Add bot');await bot.locator('.bluff-connection:visible').waitFor();await bot.locator('.xg-ready:enabled').waitFor();const newRoom=new URL(bot.url()).searchParams.get('room');assert.notEqual(newRoom,oldRoom);release.resolve();await bot.waitForTimeout(1200);
 assert.equal(new URL(bot.url()).searchParams.get('room'),newRoom);assert.equal(await bot.locator('#game').isVisible(),true);
 assert.deepEqual(await bot.evaluate(()=>{paintCheck.running=false;return {blank:paintCheck.blank,menu:paintCheck.menu};}),{blank:0,menu:0});
 assert.equal((await server.bluff.recover(oldRoom)).cancelled,true);assert.equal(await server.wallet.balance({id:'1'}),500000,'Stake was refunded exactly once before free practice');await debug(bot,'bluff');await bot.context().close();

 const a=await player(3),b=await player(4,390);await a.locator('#xg-wager').fill('10000');await a.getByRole('button',{name:'Create Game',exact:true}).click();await a.locator('.xg-cancel:visible').waitFor();const room=new URL(a.url()).searchParams.get('room');
 await b.locator('#xg-code').fill(room);await b.locator('.xg-join button').click();await b.getByRole('button',{name:'Join · 10,000 Chips',exact:true}).click();await a.locator('.xg-ready:enabled').waitFor();await a.locator('.xg-ready').click();await b.locator('.xg-ready:enabled').click();await a.locator('#game[data-phase=select]').waitFor();await b.locator('#game[data-phase=select]').waitFor();
 await a.evaluate(()=>{window.stableTable=document.querySelector('#game>.table');window.stableCard=document.querySelector('[data-card]');});
 await a.locator('[data-card]').nth(0).click();await a.evaluate(()=>window.stableBack=document.querySelectorAll('.card-pile')[1].firstElementChild);await a.locator('[data-card]').nth(1).click();assert.equal(await a.evaluate(()=>stableBack===document.querySelectorAll('.card-pile')[1].firstElementChild),true,'Selecting another card must not remount existing backs');
 await b.locator('[data-card]').first().click();await b.locator('#lock').click();await a.waitForTimeout(1100);assert.equal(await a.evaluate(()=>stableCard===document.querySelector('[data-card]')&&stableTable===document.querySelector('#game>.table')),true,'Opponent polling preserves the hand and felt');
 assert.equal(await a.locator('.count-pill b').innerText(),'10');await a.locator('#lock').click();await a.locator('[data-choice=believe]').click();assert.equal(await a.locator('.reveal-decision').count(),0,'Choices stay private until both lock');await b.locator('[data-choice=call]').click();await a.locator('#game[data-phase=reveal]').waitFor();await b.locator('#game[data-phase=reveal]').waitFor();
 await a.getByText('Player 4 called your bluff',{exact:true}).waitFor();await b.getByText('Player 3 believed you',{exact:true}).waitFor();assert.equal(await a.evaluate(()=>stableTable===document.querySelector('#game>.table')),true);
 const state=await server.bluff.recover(room);assert.equal(state.deadline-state.reveal.at,11000);assert.equal(Number(await a.locator('.count-pill b').innerText()),state.hands[1].length);
 await a.evaluate(()=>{window.revealNodes=[...document.querySelectorAll('.reveal-pile .card')];window.revealTimes=revealNodes.map(e=>e.getAnimations()[0]?.startTime);});
 const visibility=await a.locator('.reveal-pile .card').evaluateAll(es=>es.every(e=>getComputedStyle(e).opacity==='1'&&getComputedStyle(e).transform==='none'));assert.equal(visibility,true,'Card faces never turn edge-on or become transparent');
 await a.screenshot({path:path.join(out,'reveal-desktop.png'),fullPage:true});await b.screenshot({path:path.join(out,'reveal-mobile.png'),fullPage:true});assert.equal(await b.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await a.waitForTimeout(1500);assert.equal(await a.evaluate(()=>revealNodes.every((e,i)=>e===document.querySelectorAll('.reveal-pile .card')[i]&&(!e.getAnimations().length||e.getAnimations()[0].startTime===revealTimes[i]))),true,'Reveal polling cannot restart animation');
 await a.locator('#game[data-phase=select]').waitFor({timeout:15000});assert.equal(await a.locator('.round-badge').innerText(),'ROUND 02');assert.ok(Number(await a.locator('#seconds').innerText())>=28,'Each new hand still gets its full play clock');
 await a.evaluate(()=>window.stillY=scrollY);await a.locator('[data-card]').first().click();await b.locator('[data-card]').first().click();await a.locator('#lock').click();await b.locator('#lock').click();await a.locator('[data-choice=believe]').click();await b.locator('[data-choice=believe]').click();await a.getByText('Player 4 believed you',{exact:true}).waitFor();assert.equal(await a.evaluate(()=>scrollY===stillY),true,'Reveals do not jerk the camera');
 await a.locator('#game[data-phase=select]').waitFor({timeout:15000});await a.locator('#all').click();await b.locator('#all').click();await a.locator('#lock').click();await b.locator('#lock').click();await a.locator('[data-choice=believe]').click();await b.locator('[data-choice=believe]').click();
 await a.locator('#game[data-phase=complete]').waitFor({timeout:15000});await b.locator('#game[data-phase=complete]').waitFor();await a.locator('[data-action=rematch]').click();await a.locator('.xg-person.accepted').waitFor();assert.equal(await a.locator('.xg-person.accepted').count(),1);await b.locator('[data-action=rematch]').click();await a.locator('#game[data-phase=select]').waitFor();assert.equal(await a.locator('[data-card]').count(),10);assert.equal(await a.locator('.round-badge').innerText(),'ROUND 01');
 await a.context().close();await b.context().close();
 const shared=await player(2,390);
 for(const [mode,url] of [['bluff','/games/multiplayer/bluff/'],['yahtzee','/games/multiplayer/yahtzee/'],['rps','/games/multiplayer/rps/'],['roulette-four','/games/multiplayer/roulette-four/'],['roulette','/?game=roulette'],['fishing','/?game=fishing'],['safecracker','/?game=safecracker'],['mountainrace','/?game=mountainrace']]){await shared.goto(server.origin+url);await shared.locator('.xg-heading h1').filter({hasText:/\S/}).waitFor();await debug(shared,mode);}
 await shared.context().close();assert.deepEqual(errors,[]);console.log('PASS Bluff browser: delayed poll/bot replacement, refund, stable card nodes, private decisions, clear reveals, 11-second pause, full new clock, stationary camera, completed match and mutual rematch, desktop/mobile and shared debug across all 8 games. Screenshots: '+out);
}finally{for(const c of browser.contexts())for(const p of c.pages())await p.unrouteAll({behavior:'ignoreErrors'});await browser.close();await server.close();}
