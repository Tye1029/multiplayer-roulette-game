'use strict';
const {getDatabase}=require('@netlify/database');
const crypto=require('node:crypto');
const M=require('./model');
const C=require('../../../assets/party/catalog');
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
function createStore(injectedPool,clock=Date.now){
  let pool=injectedPool,schema;
  const db=()=>pool||(pool=getDatabase({connectionString:process.env.NETLIFY_DB_URL}).pool);
  async function ready(){schema||=db().query(`DO $party$ BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('boardwalk-party-v1'));
    CREATE TABLE IF NOT EXISTS party_profiles(id TEXT PRIMARY KEY,session_hash TEXT UNIQUE NOT NULL,name TEXT NOT NULL,character TEXT NOT NULL,skin TEXT NOT NULL DEFAULT 'classic',coins INTEGER NOT NULL DEFAULT 0 CHECK(coins>=0),owned JSONB NOT NULL DEFAULT '["classic"]',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS party_rooms(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,request_id TEXT NOT NULL,state JSONB NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(owner_id,request_id));
    CREATE TABLE IF NOT EXISTS party_rewards(player_id TEXT NOT NULL,room_id TEXT NOT NULL,match_no INTEGER NOT NULL,coins INTEGER NOT NULL,won BOOLEAN NOT NULL,opponents JSONB NOT NULL,day TEXT NOT NULL,PRIMARY KEY(player_id,room_id,match_no));
    CREATE TABLE IF NOT EXISTS party_limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires BIGINT NOT NULL);
    CREATE INDEX IF NOT EXISTS party_rewards_day ON party_rewards(player_id,day);
    END $party$;`).catch(e=>{schema=null;throw e;});return schema;}
  async function tx(fn){await ready();const c=await db().connect();try{await c.query('BEGIN');const result=await fn(c);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
  async function limit(key,max,window=60000){await ready();const now=clock(),bucket=Math.floor(now/window);const result=await db().query('INSERT INTO party_limits(key,count,expires) VALUES($1,1,$2) ON CONFLICT(key) DO UPDATE SET count=party_limits.count+1 RETURNING count',[hash(key)+':'+bucket,now+window]);if(result.rows[0].count>max)M.fail('Too many requests. Please try again shortly.',429);if(crypto.randomInt(100)===0)await db().query('DELETE FROM party_limits WHERE expires<$1',[now]);}
  const cleanName=name=>{if(typeof name!=='string')M.fail('Choose a nickname.',400);const n=name.trim().replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g,'');if(n.length<2||n.length>18)M.fail('Use a nickname of 2–18 characters.',400);return n;};
  async function register(b,ip){await limit('register:'+ip,12,3600000);const name=cleanName(b.name);if(!C.characters.some(c=>c.id===b.character))M.fail('Choose a character.',400);const token=crypto.randomBytes(32).toString('hex'),id=crypto.randomUUID();await db().query('INSERT INTO party_profiles(id,session_hash,name,character) VALUES($1,$2,$3,$4)',[id,hash(token),name,b.character]);return {token,profile:await profile(id)};}
  async function authenticate(token){if(!/^[a-f0-9]{64}$/.test(token||''))return null;await ready();return (await db().query('SELECT id,name,character,skin FROM party_profiles WHERE session_hash=$1',[hash(token)])).rows[0]||null;}
  async function profile(id){await ready();const p=(await db().query('SELECT id,name,character,skin,coins,owned FROM party_profiles WHERE id=$1',[id])).rows[0];if(!p)M.fail('Please create a guest profile.',401);const rows=(await db().query('SELECT won,coins,opponents FROM party_rewards WHERE player_id=$1',[id])).rows;
    const rivals=new Map();for(const r of rows)for(const op of r.opponents){const v=rivals.get(op.id)||{name:op.name,played:0,wins:0};v.name=op.name;v.played++;if(r.won)v.wins++;rivals.set(op.id,v);}
    return {...p,stats:{played:rows.length,wins:rows.filter(r=>r.won).length,earned:rows.reduce((n,r)=>n+r.coins,0)},rivals:[...rivals.values()].sort((a,b)=>b.played-a.played).slice(0,8)};
  }
  async function customize(p,b){return tx(async c=>{
    const row=(await c.query('SELECT * FROM party_profiles WHERE id=$1 FOR UPDATE',[p.id])).rows[0];
    if(b.action==='character'){if(!C.characters.some(x=>x.id===b.character))M.fail('Choose a character.',400);await c.query('UPDATE party_profiles SET character=$2 WHERE id=$1',[p.id,b.character]);}
    else{const skin=C.skins.find(x=>x.id===b.skin);if(!skin)M.fail('Unknown outfit.',400);if(!row.owned.includes(skin.id)){if(b.action!=='purchase')M.fail('Unlock that outfit first.');if(row.coins<skin.price)M.fail('Earn more coins to unlock this outfit.');await c.query('UPDATE party_profiles SET coins=coins-$2,owned=$3::jsonb WHERE id=$1',[p.id,skin.price,JSON.stringify([...row.owned,skin.id])]);}await c.query('UPDATE party_profiles SET skin=$2 WHERE id=$1',[p.id,skin.id]);}
    return true;
  });}
  async function reward(c,s){if(s.phase!=='complete')return;const day=new Date(clock()).toISOString().slice(0,10);
    // Stable lock order prevents deadlocks when two rooms finish together.
    for(const p of [...s.players].filter(p=>!p.bot).sort((a,b)=>a.id.localeCompare(b.id))){await c.query('SELECT id FROM party_profiles WHERE id=$1 FOR UPDATE',[p.id]);
      if((await c.query('SELECT coins FROM party_rewards WHERE player_id=$1 AND room_id=$2 AND match_no=$3',[p.id,s.id,s.match])).rows.length)continue;
      const prior=(await c.query('SELECT coins FROM party_rewards WHERE player_id=$1 AND day=$2',[p.id,day])).rows.reduce((n,x)=>n+x.coins,0);
      const coins=Math.min(Math.max(0,200-prior),s.rewards[s.players.findIndex(x=>x.id===p.id)]||0);
      if(p.participation<2)continue;
      await c.query('INSERT INTO party_rewards(player_id,room_id,match_no,coins,won,opponents,day) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7)',[p.id,s.id,s.match,coins,s.winner===p.id,JSON.stringify(s.players.filter(x=>x.id!==p.id&&!x.bot).map(x=>({id:x.id,name:x.name}))),day]);
      await c.query('UPDATE party_profiles SET coins=coins+$2 WHERE id=$1',[p.id,coins]);s.rewards[s.players.findIndex(x=>x.id===p.id)]=coins;
    }
  }
  async function create(p,b){return tx(async c=>{await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',['party-create:'+p.id]);const prior=(await c.query('SELECT state FROM party_rooms WHERE owner_id=$1 AND request_id=$2',[p.id,b.requestId])).rows[0];if(prior)return M.view(prior.state,p.id,clock());
    const active=(await c.query("SELECT id FROM party_rooms WHERE owner_id=$1 AND updated_at>NOW()-INTERVAL '30 minutes' AND state->>'phase' NOT IN ('complete','expired')",[p.id])).rows;if(active.length>=3)M.fail('Finish your existing party before creating another.');
    let id;do{id=Array.from(crypto.randomBytes(6),n=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n%32]).join('');}while((await c.query('SELECT id FROM party_rooms WHERE id=$1',[id])).rows.length);
    const s=M.create(id,p,b.mode,clock(),b.rounds);await c.query('INSERT INTO party_rooms(id,owner_id,request_id,state) VALUES($1,$2,$3,$4::jsonb)',[id,p.id,b.requestId,JSON.stringify(s)]);return M.view(s,p.id,clock());});}
  async function action(p,b){return tx(async c=>{const row=(await c.query('SELECT state FROM party_rooms WHERE id=$1 FOR UPDATE',[b.room])).rows[0];if(!row)M.fail('Room not found. Check the six-letter code.',404);const s=row.state;
    if(b.action==='leave'&&s.receipts.includes(p.id+':'+b.requestId))return null;
    if(b.action==='join')M.join(s,p);if(!s.players.some(x=>x.id===p.id))M.fail('Join this room to see it.',403);
    const previous=JSON.stringify(s);M.advance(s,clock());await reward(c,s);
    const receipt=p.id+':'+b.requestId;
    if(!['get','join'].includes(b.action)&&!s.receipts.includes(receipt)){if(b.match!==s.match)M.fail('That action belongs to an earlier match.');M.act(s,p.id,b,clock());s.receipts.push(receipt);s.receipts=s.receipts.slice(-768);}
    // Join must always persist, including when no clock transition occurred.
    if(previous!==JSON.stringify(s)||b.action==='join'){s.revision++;await c.query('UPDATE party_rooms SET state=$2::jsonb,updated_at=NOW() WHERE id=$1',[s.id,JSON.stringify(s)]);}
    return b.action==='leave'?null:M.view(s,p.id,clock());});}
  return {ready,limit,register,authenticate,profile,customize,create,action};
}
module.exports={...createStore(),createStore};
