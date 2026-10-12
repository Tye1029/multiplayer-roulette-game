'use strict';
const {getDatabase}=require('@netlify/database');
const crypto=require('node:crypto');
const model=require('../../../shared/games/mini-golf-model');
const finance=require('../shared/table-finance');
function createStore(injectedPool,injectedWallet){
  const wallet=injectedWallet||require('../rps/wallet');let pool=injectedPool,schema;
  const db=()=>pool||(pool=getDatabase({connectionString:process.env.NETLIFY_DB_URL}).pool);
  async function ready(){schema||=db().query(`DO $golf$ BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('pocket-putt-v1'));
    CREATE TABLE IF NOT EXISTS mini_golf_matches(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,request_id TEXT NOT NULL,state JSONB NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(owner_id,request_id));
    CREATE INDEX IF NOT EXISTS mini_golf_recent ON mini_golf_matches(updated_at DESC);
    END $golf$;`).catch(e=>{schema=null;throw e;});return schema;}
  async function tx(fn){await ready();const c=await db().connect();try{await c.query('BEGIN');const result=await fn(c);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
  const save=(c,s)=>c.query('UPDATE mini_golf_matches SET state=$2::jsonb,updated_at=NOW() WHERE id=$1',[s.id,JSON.stringify(s)]);
  async function recover(id){
    const result=await tx(async c=>{const s=(await c.query('SELECT state FROM mini_golf_matches WHERE id=$1 FOR UPDATE',[id])).rows[0]?.state;if(!s)model.fail('Game not found.',404);const before=JSON.stringify(s);
      model.advance(s);
      await finance.recover(s,wallet,v=>({done:v.phase==='complete',winner:Number.isInteger(v.winner)?v.players[v.winner]?.id:null}));
      if(s.phase==='funding'&&s.finance?.status==='reserved')model.start(s,Date.now());
      if(JSON.stringify(s)!==before){s.revision++;await save(c,s);}return s;});
    if(!injectedPool&&result.phase==='complete'&&!result.cancelled)try{await require('../site-hub/progression').observe('minigolf',result);}catch(e){console.error('Golf progress pending',e.name);}return result;
  }
  async function create(player,b){
    const amount=finance.wager(b.wager??0);
    if(!/^[a-f0-9-]{24,40}$/i.test(b.requestId||''))model.fail('Missing request ID.',400);
    if(b.bot&&amount)model.fail('Bot practice uses 0 Chips.',400);
    const result=await tx(async c=>{await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',['golf-create:'+player.id]);const previous=(await c.query('SELECT state FROM mini_golf_matches WHERE owner_id=$1 AND request_id=$2',[player.id,b.requestId])).rows[0];if(previous)return previous.state;
      const count=(await c.query("SELECT id FROM mini_golf_matches WHERE owner_id=$1 AND updated_at>NOW()-INTERVAL '15 minutes' AND state->>'phase'<>'complete'",[player.id])).rows.length;if(count>=5)model.fail('Finish or cancel an existing game before opening another.');
      const s=model.create(crypto.randomBytes(6).toString('hex').toUpperCase(),player,b.course);s.private=b.private===true;
      await finance.prepare(s,'minigolf',s.players,amount,wallet);
      if(b.bot)model.join(s,{id:'bot:putter',name:'Pip the Putter',bot:true});
      await c.query('INSERT INTO mini_golf_matches(id,owner_id,request_id,state) VALUES($1,$2,$3,$4::jsonb)',[s.id,player.id,b.requestId,JSON.stringify(s)]);return s;});
    const settled=await recover(result.id);if(settled.finance?.aborted)model.fail(settled.reason||'Unable to reserve Chips.');return settled;
  }
  async function action(id,player,b){
    await recover(id);
    const result=await tx(async c=>{const s=(await c.query('SELECT state FROM mini_golf_matches WHERE id=$1 FOR UPDATE',[id])).rows[0]?.state;if(!s)model.fail('Game not found.',404);
      if(b.action==='join'&&!s.players.some(p=>p.id===String(player.id))){model.join(s,player);await finance.join(s,player,b.wager,wallet);}
      if(!s.players.some(p=>p.id===String(player.id)))model.fail('This game belongs to its players.',403);
      if(s.finance?.pending.length&&b.action!=='join')model.fail('Confirming stakes. Please retry shortly.');
      const before=JSON.stringify(s);model.bot(s);const match=s.match,snapshot=structuredClone(s);let error;
      try{
        if(b.action==='add-bot'&&s.wager)model.fail('Bots play free games. Create a game with a 0 Chip wager.');
        if(b.action==='rematch')finance.consent(s,b);
        if(!['get','join'].includes(b.action))model.act(s,player.id,b);
        if(match!==s.match&&s.wager){await finance.prepare(s,'minigolf',s.players,s.wager,wallet,true);s.phase='funding';}
      }catch(e){if(!e.status)throw e;for(const k of Object.keys(s))delete s[k];Object.assign(s,snapshot);error={message:e.message,status:e.status};}
      if(JSON.stringify(s)!==before||b.action==='join')await save(c,s);return {error};});
    const settled=await recover(id);if(result.error)model.fail(result.error.message,result.error.status);if(b.action==='join'&&!settled.players.some(p=>p.id===String(player.id)))model.fail(settled.reason||'Unable to reserve Chips.');return settled;
  }
  async function quote(id){await ready();const s=(await db().query('SELECT state FROM mini_golf_matches WHERE id=$1',[id])).rows[0]?.state;if(!s||s.phase!=='waiting'||s.players.length!==1||s.deadline<=Date.now())model.fail('This game is no longer open.');return {id:s.id,name:s.players[0].name,wager:s.wager||0,course:s.course};}
  async function sweep(){await ready();const rows=(await db().query("SELECT id FROM mini_golf_matches WHERE COALESCE(state->'finance'->>'status','free') NOT IN ('free','settled') AND (state->'finance'->>'status'='funding' OR state->>'phase'='complete' OR (state->>'deadline')::bigint<=$1) ORDER BY updated_at LIMIT 40",[Date.now()])).rows;for(const r of rows)try{await recover(r.id);}catch{}}
  async function lobby(player){await sweep();await ready();const rows=(await db().query("SELECT state FROM mini_golf_matches WHERE state->>'phase'='waiting' AND jsonb_array_length(state->'players')=1 AND (state->>'deadline')::bigint>$1 ORDER BY updated_at DESC LIMIT 100",[Date.now()])).rows;return rows.filter(({state:s})=>!s.private&&!s.finance?.pending.length).map(({state:s})=>({id:s.id,mode:'minigolf',name:'Pocket Putt',creator:s.players[0].name,mine:s.players[0].id===String(player.id),wager:s.wager||0,count:1,capacity:2,expiresAt:s.deadline}));}
  async function readyOpponents(player){await ready();const rows=(await db().query("SELECT state FROM mini_golf_matches WHERE owner_id=$1 AND updated_at>NOW()-INTERVAL '1 day'",[player.id])).rows;return rows.filter(({state:s})=>s.players[1]&&!s.players[1].bot&&s.ready?.includes(s.players[1].id)).map(({state:s})=>({id:s.id,mode:'minigolf',name:s.players[1].name,joiner:s.players[1].id,href:'/games/multiplayer/mini-golf/?room='+s.id}));}
  return {ready,create,action,recover,quote,lobby,readyOpponents,sweep};
}
module.exports={...createStore(),createStore};
