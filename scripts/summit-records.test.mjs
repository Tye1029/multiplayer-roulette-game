import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {PGlite} from '@electric-sql/pglite';
const require=createRequire(import.meta.url),{createRecorder,finishEntries}=require('../netlify/functions/mountain-race/records');
const pg=new PGlite();let tail=Promise.resolve();
const pool={query:(s,a)=>pg.query(s,a),connect:async()=>{let release;const prior=tail;tail=new Promise(r=>release=r);await prior;return{query:(s,a)=>pg.query(s,a),release};}};
const record=createRecorder(pool),start=Date.now();
const game=id=>({gameId:id,creator:{userId:'human'},joiner:{userId:'remote-bot-1',isNpc:true}});
const state=ms=>({startAt:new Date(start).toISOString(),endAt:new Date(start+30000).toISOString(),sequence:Array(30).fill('up'),players:{human:{promptIndex:30,finishedAt:new Date(start+ms).toISOString()}}});
try {
 const first=await record(game('one'),state(15000));assert.deepEqual(first.human,{elapsedMs:15000,previousBestMs:null,bestMs:15000});
 const [a,b]=await Promise.all([record(game('two'),state(14000)),record(game('three'),state(17000))]);assert.equal(a.human.bestMs,14000);assert.equal(b.human.bestMs,14000);assert.equal(b.human.previousBestMs,14000);
 const retry=await record(game('two'),state(14000));assert.equal(retry.human.previousBestMs,15000);assert.equal((await pg.query('SELECT * FROM summit_finishes')).rows.length,3);
 const dnf=state(12000);dnf.players.human.finishedAt=null;dnf.players.human.promptIndex=12;assert.deepEqual((await record(game('dnf'),dnf)).human,{elapsedMs:null,bestMs:14000});
 assert.equal((await pg.query('SELECT * FROM summit_finishes')).rows.length,3);
 assert.equal(finishEntries(game('invalid'),state(31000))[0].elapsedMs,null);
 const two=game('both');two.joiner={userId:'second'};const finished=state(10000);finished.players.second={promptIndex:30,finishedAt:new Date(start+11000).toISOString()};const both=await record(two,finished);assert.equal(both.human.bestMs,10000);assert.equal(both.second.bestMs,11000);
 const {createMountainRaceIntegration}=require('../netlify/functions/mountain-race/integration');
 let saved;const integration=createMountainRaceIntegration({cleanUserId:v=>String(v||''),mpCleanId:v=>String(v||''),int:(v,d=0)=>Math.max(0,Math.floor(Number(v)||d)),getRaw:async()=>saved,getRawStrong:async()=>saved,saveGame:async g=>(saved=structuredClone(g)),publicGame:g=>g,getUserRecord:async()=>({}),recordRace:record,completeResolved:async g=>(saved={...g,status:'complete'})});
 saved={...game('integrated'),mode:'mountainrace',status:'playing'};saved.mountainraceState=integration.initialState(saved,start);saved.mountainraceState.players.human={...saved.mountainraceState.players.human,promptIndex:30,finishedAt:new Date(start+9000).toISOString()};saved.mountainraceState.winnerId='human';saved.mountainraceState.completedAt=new Date(start+9000).toISOString();
 const completed=await integration.advance(saved);assert.equal(completed.status,'complete');const visible=integration.publicState(completed,'human');assert.equal(visible.me.performance.bestMs,9000);assert.equal(visible.me.performance.previousBestMs,10000);assert.equal(visible.opponent.performance,null);
 console.log('Summit records passed: authoritative timestamps, both players, personal bests, slower runs, DNF, bot exclusion, concurrent writes and idempotent retries.');
} finally {await pg.close();}
