'use strict';
// Receives authoritative completed game snapshots only. Never accept a score from a request body.
const {getDatabase}=require('@netlify/database');
const MODES=['roulette','roulette-four','mountainrace','safecracker','fishing','yahtzee','bluff','rps','draw','minigolf'];
const AMOUNTS=[5000,15000,40000,140000,300000,20000,80000,400000];
const unique={
 minigolf:[['A Little Finesse','Finish 25 holes under par.','birdies',25],['Hippo Whisperer','Take the hippo shortcut 250 times.','portals',250],['Ace of the Greens','Make 100 holes in one.','aces',100]],
 draw:[["Sharp Eye","Earn 1,000 target points.","targets",1000],["Frontier Guardian","Earn 10,000 target points.","targets",10000],["Saloon Legend","Earn 50,000 target points.","targets",50000]],
 roulette:[['Unflinching','Survive five shots in a row without spinning.','streak',5],['Steady Hand','Survive 500 shots.','shots',500],['Legend of the Saloon','Survive 2,500 shots.','shots',2500]],
 'roulette-four':[['Fearless','Survive five consecutive shots without spinning.','streak',5],['Table Veteran','Survive 500 shots.','shots',500],['Lasting Nerve','Survive 2,500 shots.','shots',2500]],
 mountainrace:[['Summit Pace','Finish in under 40 seconds.','fast',40000],['Alpine Express','Finish in under 30 seconds.','fast',30000],['Peak Performance','Finish in under 24 seconds.','fast',24000]],
 safecracker:[['Quick Hands','Open the vault in under 60 seconds.','fast',60000],['Silent Entry','Open the vault in under 45 seconds.','fast',45000],['Master Thief','Open the vault in under 35 seconds.','fast',35000]],
 fishing:[['Tall Tale','Land a fish at least 90 cm long.','size',90],['Rare Company','Catch 25 rare or mythical fish.','rare',25],['Deepwater Legend','Catch 50 mythical fish.','mythical',50]],
 yahtzee:[['Full Scorecard','Score at least 250 points.','score',250],['High Roller','Score at least 325 points.','score',325],['Five of a Kind','Score 100 Yahtzees.','yahtzees',100]],
 bluff:[['Poker Face','Sneak 25 bluffs past an opponent.','bluffs',25],['Lie Detector','Catch 100 bluffs.','catches',100],['The Long Con','Sneak 1,000 bluffs past an opponent.','bluffs',1000]],
 rps:[['Clean Sweep','Win 25 matches without losing a round.','sweeps',25],['Rock Solid','Win 300 rounds with rock.','rock',300],['Balanced Fighter','Win 300 rounds with each hand.','balanced',300]]
};
function catalog(mode){return [...[1,10,50,250,1000].map((n,i)=>({id:'wins-'+n,title:['First Victory','Finding Your Form','Regular Winner','Arena Veteran','A Thousand Victories'][i],description:`Win ${n} competitive ${n===1?'game':'games'}.`+(i>=3?` Play on at least ${i===3?30:90} different days.`:''),metric:'wins',target:n,minDays:i===3?30:i===4?90:0})),...(unique[mode]||[]).map(([title,description,metric,target],i)=>({id:'special-'+i,title,description:description+` Complete at least ${[20,100,500][i]} competitive games across ${[5,30,90][i]} different days.`,metric,target,minGames:[20,100,500][i],minDays:[5,30,90][i]}))].map((a,i)=>({...a,reward:AMOUNTS[i]}));}
const epoch=v=>typeof v==='number'?v:Date.parse(v||'')||0;
function outcomes(mode,s){
 if(!MODES.includes(mode)||!s||!(s.phase==='complete'||s.status==='complete'))return [];
 const ps=s.players?.map(p=>mode==='yahtzee'?{...p,yahtzeeBonus:p.bonus,...require('../../../assets/yahtzee/rules').totals(p)}:p)||[s.creator,s.joiner].filter(Boolean);
 if(ps.length<2||s.npcTest||s.testPlayerMode||s.rouletteState?.timeoutExecution||ps.some(p=>p.bot||p.isNpc||p.isRemoteBot||p.isTestPlayer||!/^\d+$/.test(String(p.tornId||p.id||p.userId))))return [];
 if(s.cancelled||s.forfeited||(mode==='minigolf'&&s.timedOut)||s.lastAction?.action==='timeout'||s.result?.cancelled||s.finance?.aborted)return [];
 const id=s.finance?.id||`${s.id||s.gameId}:${s.match||s.game||1}`;
 return ps.map((p,i)=>{
  const uid=String(p.tornId||p.id||p.userId),account=String(p.userId||p.id),winner=mode==='roulette-four'?!p.eliminated:mode==='yahtzee'?(!s.forfeitWinner&&p.total===Math.max(...ps.map(q=>q.total||0))&&ps.filter(q=>q.total===p.total).length===1):s.winnerUserId?String(s.winnerUserId)===account:s.result?.winnerRole?s.result.winnerRole===(i===0?'creator':'joiner'):s.winner===i;
  let payout=Number(s.payouts?.[uid]||s.finance?.payouts?.[uid]||(winner?(s.finance?.payout||s.payout):0)||0);
  const values={day:new Date(epoch(s.completedAt||s.finishedAt)||Date.now()).toISOString().slice(0,10),wins:winner?1:0,games:1,earnings:Math.max(0,payout-Number(s.wager||0))};
  if(mode==='roulette'){values.shots=Number(s.rouletteState?.safeShots?.[account]||0);values.streak=Number(s.rouletteState?.maxNoSpinStreak?.[account]||0);}
  if(mode==='roulette-four'){values.shots=p.shots||0;values.streak=p.maxNoSpinStreak||0;}
  if(mode==='mountainrace'){const m=s.mountainraceState,player=m?.players?.[account];if(player?.finishedAt)values.fast=Math.max(1,epoch(player.finishedAt)-Number(m.startAtMs||epoch(m.startAt)));}
  if(mode==='safecracker'){const player=s.safecrackerState?.players?.[account];if(player?.completedAt)values.fast=Math.max(1,epoch(player.completedAt)-epoch(s.startAt));}
  if(mode==='fishing'){const c=s.fishingState?.catches?.[account]||(i===0?s.fishingState?.creatorCatch:s.fishingState?.joinerCatch);if(c){values.size=Number(c.size||0);values.rarity=['common','uncommon','rare','mythical'].indexOf(c.rarity);values.fish=c.name;values.rare=values.rarity>=2?1:0;values.mythical=values.rarity===3?1:0;}}
  if(mode==='yahtzee'){values.score=p.total||0;values.yahtzees=(p.card?.yahtzee===50?1:0)+Math.floor((p.yahtzeeBonus||0)/100);}
  if(mode==='draw')values.targets=Math.max(0,Number(s.drawState?.scores?.[account]||s.result?.scores?.[account]||0));
  if(mode==='bluff'){values.bluffs=s.stats?.[i]?.bluffs||0;values.catches=s.stats?.[i]?.catches||0;}
  if(mode==='minigolf'){for(const k of ['aces','birdies','portals'])values[k]=s.stats?.[i]?.[k]||0;}
  if(mode==='rps'){values.sweeps=winner&&s.scores?.[1-i]===0?1:0;for(const [j,h] of ['rock','paper','scissors'].entries())values[h]=(s.history||[]).filter(r=>r.winner===i&&r.picks[i]===h).length;}
  // Forfeits and abandoned games cannot farm achievement wins.
  if(/left|forfeit|missed|timeout|expired/i.test(s.reason||s.result?.text||''))return null;
  return {event:`${mode}:${id}:${uid}`,mode,id:uid,name:p.name,avatar:p.avatar||p.avatarUrl||'',values};
 }).filter(Boolean);
}
function accumulate(prior,v){const n={...prior};n.days=[...new Set([...(prior.days||[]),...(v.day?[v.day]:[])])].sort();n.activeDays=n.days.length;for(const k of ['wins','games','earnings','targets','shots','rare','mythical','yahtzees','bluffs','catches','sweeps','rock','paper','scissors','aces','birdies','portals'])n[k]=Number(n[k]||0)+Number(v[k]||0);for(const k of ['streak','score'])n[k]=Math.max(n[k]||0,v[k]||0);if(v.fast)n.fast=Math.min(n.fast||Infinity,v.fast);if(v.size&&(v.size>(n.size||0)||(v.size===n.size&&v.rarity>(n.rarity||0))))Object.assign(n,{size:v.size,rarity:v.rarity,fish:v.fish});n.balanced=Math.min(n.rock||0,n.paper||0,n.scissors||0);return n;}
function qualifies(a,stats){return (stats.activeDays||0)>=(a.minDays||0)&&(stats.games||0)>=(a.minGames||0)&&(a.metric==='fast'?stats.fast>0&&stats.fast<a.target:(stats[a.metric]||0)>=a.target);}
function createStore(injected,injectedWallet){let pool=injected,schema;const db=()=>pool||(pool=getDatabase({connectionString:process.env.NETLIFY_DB_URL}).pool);const wallet=()=>injectedWallet||require('../rps/wallet');
 async function ready(){schema ||= db().query(`DO $progress$ BEGIN PERFORM pg_advisory_xact_lock(hashtext('xan-progress-v1'));
 CREATE TABLE IF NOT EXISTS xan_progress_events(id TEXT PRIMARY KEY,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
 CREATE TABLE IF NOT EXISTS xan_progress(owner TEXT NOT NULL,mode TEXT NOT NULL,name TEXT NOT NULL,avatar TEXT NOT NULL DEFAULT '',stats JSONB NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(owner,mode));
 CREATE TABLE IF NOT EXISTS xan_achievements(owner TEXT NOT NULL,mode TEXT NOT NULL,id TEXT NOT NULL,amount BIGINT NOT NULL,paid BOOLEAN NOT NULL DEFAULT FALSE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(owner,mode,id));
 CREATE TABLE IF NOT EXISTS xan_player_preferences(owner TEXT PRIMARY KEY,settings JSONB NOT NULL DEFAULT '{}');
 END $progress$;`).catch(e=>{schema=null;throw e;});return schema;}
 async function observe(mode,state){const rows=outcomes(mode,state);if(!rows.length)return;await ready();const c=await db().connect();try{await c.query('BEGIN');for(const row of rows){const inserted=await c.query('INSERT INTO xan_progress_events(id) VALUES($1) ON CONFLICT DO NOTHING RETURNING id',[row.event]);if(!inserted.rows.length)continue;
 await c.query('INSERT INTO xan_progress(owner,mode,name,avatar,stats) VALUES($1,$2,$3,$4,\'{}\') ON CONFLICT DO NOTHING',[row.id,mode,row.name,row.avatar]);const old=(await c.query('SELECT stats FROM xan_progress WHERE owner=$1 AND mode=$2 FOR UPDATE',[row.id,mode])).rows[0].stats;const stats=accumulate(old,row.values);await c.query('UPDATE xan_progress SET stats=$3::jsonb,name=$4,avatar=$5,updated_at=NOW() WHERE owner=$1 AND mode=$2',[row.id,mode,JSON.stringify(stats),row.name,row.avatar]);
 for(const a of catalog(mode).filter(a=>qualifies(a,stats)))await c.query('INSERT INTO xan_achievements(owner,mode,id,amount) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[row.id,mode,a.id,a.reward]);
 }await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
 async function profile(player){await ready();const earned=(await db().query('SELECT * FROM xan_achievements WHERE owner=$1',[player.id])).rows;
 for(const a of earned.filter(a=>!a.paid)){const account=await wallet().account(player),id='achievement:'+player.id+':'+a.mode+':'+a.id;await wallet().award(account,{id,delta:Number(a.amount),reason:catalog(a.mode).find(x=>x.id===a.id).title});await db().query('UPDATE xan_achievements SET paid=TRUE WHERE owner=$1 AND mode=$2 AND id=$3',[player.id,a.mode,a.id]);a.paid=true;}
 const rows=(await db().query('SELECT mode,stats FROM xan_progress WHERE owner=$1',[player.id])).rows,stats=Object.fromEntries(rows.map(r=>[r.mode,r.stats]));const rr=[stats.roulette||{},stats['roulette-four']||{}];const wins=rr.reduce((n,r)=>n+Number(r.wins||0),0),streak=Math.max(...rr.map(r=>r.streak||0));
 if(!injected){const notices=earned.filter(a=>a.paid).map(a=>({id:`achievement:${player.id}:${a.mode}:${a.id}`,payload:{mode:a.mode,message:catalog(a.mode).find(c=>c.id===a.id).title+' · +'+Number(a.amount).toLocaleString()+' Chips',href:a.mode==='minigolf'?'/games/multiplayer/mini-golf/':['bluff','yahtzee','rps','roulette-four'].includes(a.mode)?'/games/multiplayer/'+a.mode+'/':'/?game='+a.mode}}));for(const [i,target] of [1,5,20,50,100,250].entries())if(wins>=target)notices.push({id:`gun:${player.id}:${i+1}`,payload:{message:'New gun unlocked · '+target+' Roulette wins',href:'/?game=roulette'}});if(streak>=5)notices.push({id:`gun:${player.id}:7`,payload:{message:'Redshift Ranger unlocked · five safe shots without spinning',href:'/?game=roulette'}});await require('./store').announceMany(player.id,notices);}
 const settings=(await db().query('SELECT settings FROM xan_player_preferences WHERE owner=$1',[player.id])).rows[0]?.settings||{};
 return {stats,roulette:{wins,streak,unlocked:[true,...[1,5,20,50,100,250].map(n=>wins>=n),streak>=5]},settings,achievements:Object.fromEntries(MODES.map(mode=>[mode,catalog(mode).map(a=>{const row=earned.find(r=>r.mode===mode&&r.id===a.id&&r.paid);return {id:a.id,reward:a.reward,unlocked:!!row,...(row?{title:a.title,description:a.description,at:row.created_at}:{})};})]))};}
 async function preferences(player,settings){await ready();const safe={};if(typeof settings.character==='string'&&['maximus','voss','lyra','bryn','kael','ren','sora','nyx'].includes(settings.character))safe.character=settings.character;if(typeof settings.gun==='string'){const p=await profile(player),guns=['classic','silver','copper','jade','violet','cyber','royal','laser'];const i=guns.indexOf(settings.gun);if(i>=0&&p.roulette.unlocked[i])safe.gun=settings.gun;else throw Object.assign(Error('That gun is still locked.'),{status:409});}
 if(settings.golfBall!==undefined){const p=await profile(player),earned=p.achievements.minigolf.filter(a=>a.unlocked).map(a=>a.id);if(!require('../../../shared/games/mini-golf-cosmetics').available(settings.golfBall,earned))throw Object.assign(Error('That golf ball is still locked.'),{status:409});safe.golfBall=settings.golfBall;}
 await db().query("INSERT INTO xan_player_preferences(owner,settings) VALUES($1,$2::jsonb) ON CONFLICT(owner) DO UPDATE SET settings=xan_player_preferences.settings||$2::jsonb",[player.id,JSON.stringify(safe)]);return safe;}
 async function leaderboard(mode){await ready();if(!MODES.includes(mode))return {game:[],overall:[]};const column=mode==='fishing'?'size':mode==='yahtzee'?'score':['safecracker','mountainrace'].includes(mode)?'fast':'wins';const asc=column==='fast';const game=(await db().query(`SELECT owner,name,avatar,stats FROM xan_progress WHERE mode=$1 AND owner<>'4300885' AND COALESCE((stats->>$2)::numeric,0)>0 ORDER BY (stats->>$2)::numeric ${asc?'ASC':'DESC'},COALESCE((stats->>'rarity')::int,0) DESC,owner LIMIT 25`,[mode,column])).rows;const overall=(await db().query("SELECT owner,(array_agg(name ORDER BY updated_at DESC))[1] AS name,SUM(COALESCE((stats->>'earnings')::numeric,0)) AS amount FROM xan_progress WHERE owner<>'4300885' GROUP BY owner HAVING SUM(COALESCE((stats->>'earnings')::numeric,0))>0 ORDER BY amount DESC,owner LIMIT 25")).rows;return {game,overall,metric:column};}
 return {ready,observe,profile,preferences,leaderboard};
}
module.exports={...createStore(),createStore,catalog,accumulate,qualifies,outcomes,MODES};
