'use strict';
const {getDatabase}=require('@netlify/database');
const {createHash}=require('node:crypto');
const model=require('./model');
const hash=s=>createHash('sha256').update(s).digest('hex');
function createStore(injected,roll,clock=Date.now){
  let pool=injected,schema;
  const db=()=>pool||(pool=getDatabase({connectionString:process.env.NETLIFY_DB_URL}).pool);
  async function ready(){
    schema ||= db().query("DO $yahtzee$ BEGIN PERFORM pg_advisory_xact_lock(hashtext('yahtzee-schema-v1')); CREATE TABLE IF NOT EXISTS yahtzee_rooms(id TEXT PRIMARY KEY, owner_key TEXT NOT NULL, state JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()); END $yahtzee$;").catch(e=>{schema=null;throw e;});await schema;
  }
  async function run(b,identity,ip='local'){
    if(!identity||!/^\d+$/.test(String(identity.id)))model.fail('Connect your API key on the main site.',401);
    const id=String(identity.id),now=clock();
    if(!['create','get','join','start','bot','roll','hold','score','rematch','leave','cancel'].includes(b.action))model.fail('Unknown action.',400);
    if(b.action!=='get'&&!/^[a-zA-Z0-9-]{16,64}$/.test(b.requestId||''))model.fail('Missing request ID.',400);
    const code=b.action==='create'?hash(id+':'+b.requestId).slice(0,8).toUpperCase():String(b.room||'').toUpperCase();
    if(!/^[A-F0-9]{8}$/.test(code))model.fail('Enter the 8-character room code.',400);
    await ready();const c=await db().connect();
    try{
      await c.query('BEGIN');
      if(b.action==='create'){
        const owner=hash(ip);await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',['yahtzee-create:'+owner]);
        const existing=(await c.query('SELECT state FROM yahtzee_rooms WHERE id=$1',[code])).rows[0]?.state;
        if(!existing){
          const count=(await c.query("SELECT COUNT(*)::int AS n FROM yahtzee_rooms WHERE owner_key=$1 AND created_at>NOW()-INTERVAL '1 hour'",[owner])).rows[0].n;
          if(count>=10)model.fail('Too many new rooms. Reuse a room or try later.',429);
          await c.query("DELETE FROM yahtzee_rooms WHERE created_at<NOW()-INTERVAL '2 days'");
          const s=model.fresh(code,model.player(id,identity.name),now);
          if(b.bot===true)model.act(s,id,{action:'bot'},roll,now);
          await c.query('INSERT INTO yahtzee_rooms(id,owner_key,state) VALUES($1,$2,$3::jsonb)',[code,owner,JSON.stringify(s)]);
        }else if(existing.players[0]?.id!==id)model.fail('Please try creating another room.');
      }
      const s=(await c.query('SELECT state FROM yahtzee_rooms WHERE id=$1 FOR UPDATE',[code])).rows[0]?.state;
      if(!s||s.expiresAt<now)model.fail('This room has expired or does not exist.',404);
      if(s.version!==2)model.fail('This room uses the old rules. Create a new game.',410);
      if(!['join','create'].includes(b.action)&&!s.players.some(p=>p.id===id&&!p.bot))model.fail('Join this room first.',403);
      const before=JSON.stringify(s),requestKey=id+':'+b.requestId;
      model.advance(s,now,roll);
      if(!s.requests.includes(requestKey)&&!['get','create'].includes(b.action)){
        if(b.action==='join'){
          if(!s.players.some(p=>p.id===id)){
            if(s.phase!=='waiting'||s.players.length>=2)model.fail('This room has started or is full.');
            s.players.push(model.player(id,identity.name));
          }
        }else model.act(s,id,b,roll,now);
        s.requests.push(requestKey);s.requests=s.requests.slice(-512);
      }
      if(JSON.stringify(s)!==before){s.revision++;await c.query('UPDATE yahtzee_rooms SET state=$2::jsonb WHERE id=$1',[code,JSON.stringify(s)]);}
      await c.query('COMMIT');return model.publicState(s,id,now);
    }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
  }
  async function lobby(identity){
    if(!identity||!/^\d+$/.test(String(identity.id)))model.fail('Connect your API key on the main site.',401);
    await ready();
    const rows=(await db().query("SELECT id, state->'players'->0->>'id' AS owner, state->'players'->0->>'name' AS creator, state->>'expiresAt' AS expires FROM yahtzee_rooms WHERE state->>'version'='2' AND state->>'phase'='waiting' AND jsonb_array_length(state->'players')=1 AND (state->>'expiresAt')::bigint>$1 ORDER BY created_at DESC LIMIT 50",[clock()])).rows;
    return rows.map(r=>({id:r.id,mode:'yahtzee',name:'Yahtzee',creator:r.creator,mine:r.owner===String(identity.id),wager:0,count:1,capacity:2,expiresAt:Number(r.expires)}));
  }
  return {run,lobby};
}
module.exports={createStore};
