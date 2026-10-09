import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const client=fs.readFileSync('assets/safe-cracker/safe-cracker.js','utf8');
const html=fs.readFileSync('shared/site/index.template.html','utf8');
const data=fs.readFileSync('netlify/functions/_data.js','utf8');
const section=(s,a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));
const pictures=[];let unlock;
class Picture {constructor(){pictures.push(this);}decode(){return new Promise(resolve=>{unlock=resolve;});}}
const preflight=vm.createContext({window:{},Image:Picture,runtime:{game:{gameId:'current'}},Promise});
vm.runInContext(section(client,'  // SAFE_CRACKER_VISUAL_PREFLIGHT_V1_START','  // SAFE_CRACKER_VISUAL_PREFLIGHT_V1_END'),preflight);
const p=preflight.safeCrackerWarmVisuals();assert.equal(p,preflight.safeCrackerWarmVisuals());assert.equal(pictures.length,3);
const classes=new Set();let busy='';
const board={dataset:{scGameId:'current'},classList:{toggle:(name,on)=>on?classes.add(name):classes.delete(name)},setAttribute:(_,value)=>{busy=value}};
const mount={isConnected:true,querySelector:()=>board};
preflight.revealPreparedVault(mount,{gameId:'current'});assert.ok(classes.has('sc-art-loading'));assert.equal(busy,'true');
// Download is insufficient: each image must also be decoded before reveal.
const gates=[];for(const picture of pictures){picture.decode=()=>new Promise(resolve=>gates.push(resolve));picture.onload();}
assert.ok(classes.has('sc-art-loading'));for(const resolve of gates)resolve();await p;await Promise.resolve();
assert.equal(classes.has('sc-art-loading'),false);assert.equal(busy,'false');
assert.equal(await preflight.safeCrackerWarmVisuals(),true);assert.equal(pictures.length,3);
const failedPictures=[];class Failure{constructor(){failedPictures.push(this);}}
const failure=vm.createContext({window:{},Image:Failure});vm.runInContext(section(client,'  // SAFE_CRACKER_VISUAL_PREFLIGHT_V1_START','  // SAFE_CRACKER_VISUAL_PREFLIGHT_V1_END'),failure);
const bad=failure.safeCrackerWarmVisuals();failedPictures[0].onerror();assert.equal(await bad,false);
failure.safeCrackerWarmVisuals();assert.equal(failedPictures.length,6,'A failed preparation must be retryable');
// Authoritative interval remains enforced right up to the new boundary.
let now=1499;class Clock extends Date {static now(){return now;}}
const state={processedActionIds:[],players:{me:{code:'123',stage:0,nextGuessAt:new Date(1500).toISOString()}}};
const authority=vm.createContext({Date:Clock,cleanUserId:String,mpCleanId:String,int:(v,d)=>Number(v??d),safeCrackerEnsureState:()=>state,SAFE_CRACKER_STAGES:3,
 safeCrackerCircularDistance:()=>{throw new Error('accepted at boundary');}});
vm.runInContext(section(data,'async function safeCrackerApplyGuess(', 'async function safeCrackerAdvanceAndSave('),authority);
const game={gameId:'g',mode:'safecracker',status:'playing'};
assert.equal(await authority.safeCrackerApplyGuess(game,'me',2,'unique'),game);
now=1500;await assert.rejects(()=>authority.safeCrackerApplyGuess(game,'me',2,'unique'),/accepted at boundary/);
assert.match(data,/const SAFE_CRACKER_VERIFY_MS = 500;/);
// Expired bot offers never schedule another background request; new human offers can.
const timers=[];const botGame={gameId:'g',mode:'safecracker',status:'complete',remoteNetworkTest:true,creator:{userId:'me'},joiner:{userId:'bot',isRemoteBot:true},rematch:{expiresAt:new Date(Date.now()-1).toISOString(),requestedBy:{bot:true}}};
const bot=vm.createContext({Date,duelCurrentGameId:'g',rnbRematchRuntime:{},rnbClearRematchTimer:()=>{},rnbHash:()=>0,line:()=>{},botLogs:[],render:()=>{},
 setTimeout:fn=>{timers.push(fn);return 1},rnbFetchAuthoritativeGame:async()=>botGame,duelRequest:async()=>{throw new Error('The rematch request expired.')}});
vm.runInContext(section(html,' function rnbScheduleRematch(', ' setInterval(()=>{'),bot);
bot.rnbScheduleRematch(botGame);assert.equal(timers.length,0);
botGame.rematch={expiresAt:new Date(Date.now()+10000).toISOString(),requestedBy:{me:true}};
bot.rnbScheduleRematch(botGame);assert.equal(timers.length,1);await timers[0]();bot.rnbScheduleRematch(botGame);assert.equal(timers.length,1);
console.log('Safe startup/feedback passed: decoded-art reveal, deduplication/retry, authoritative cooldown boundary, and expired bot offers.');
