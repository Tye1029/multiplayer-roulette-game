'use strict';
const {getDatabase}=require('@netlify/database');
const {createHash}=require('node:crypto');
const model=require('./model');
const finance=require('../shared/table-finance');
const rules=require('../../../assets/yahtzee/rules');
const hash=s=>createHash('sha256').update(s).digest('hex');
function createStore(injected,roll,clock=Date.now,injectedWallet){
  const wallet=injectedWallet||require('../rps/wallet');
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
    await ready();if(b.action!=='create')await recover(code);const c=await db().connect();
    let released=false,committed=false;
    try{
      await c.query('BEGIN');
      if(b.action==='create'){
        const owner=hash(ip);await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',['yahtzee-create:'+owner]);
        const existing=(await c.query('SELECT state FROM yahtzee_rooms WHERE id=$1',[code])).rows[0]?.state;
        if(!existing){
          const count=(await c.query("SELECT COUNT(*)::int AS n FROM yahtzee_rooms WHERE owner_key=$1 AND created_at>NOW()-INTERVAL '1 hour'",[owner])).rows[0].n;
          if(count>=10)model.fail('Too many new rooms. Reuse a room or try later.',429);
          await c.query("DELETE FROM yahtzee_rooms WHERE created_at<NOW()-INTERVAL '2 days' AND COALESCE(state->'finance'->>'status','free') IN ('free','settled')");
          const s=model.fresh(code,{...model.player(id,identity.name),...(identity.avatar?{avatar:identity.avatar}:{})},now);
          s.private=b.private===true;
          if(b.bot===true&&b.wager)finance.fail('Bot practice uses 0 Chips.');
          await finance.prepare(s,'yahtzee',s.players,b.wager||0,wallet);
          if(b.bot===true)model.act(s,id,{action:'bot'},roll,now);
          await c.query('INSERT INTO yahtzee_rooms(id,owner_key,state) VALUES($1,$2,$3::jsonb)',[code,owner,JSON.stringify(s)]);
        }else if(existing.players[0]?.id!==id)model.fail('Please try creating another room.');
      }
      const s=(await c.query('SELECT state FROM yahtzee_rooms WHERE id=$1 FOR UPDATE',[code])).rows[0]?.state;
      if(!s||s.expiresAt<now)model.fail('This room has expired or does not exist.',404);
      if(s.version!==2)model.fail('This room uses the old rules. Create a new game.',410);
      if(!['join','create'].includes(b.action)&&!s.players.some(p=>p.id===id&&!p.bot))model.fail('Join this room first.',403);
      const before=JSON.stringify(s),requestKey=id+':'+b.requestId,previousGame=s.game;
      if(s.finance?.pending.length&&b.action!=='create')finance.fail('Funding is still being confirmed. Retry shortly.');
      model.advance(s,now,roll);
      if(!s.requests.includes(requestKey)&&!['get','create'].includes(b.action)){
        if(b.action==='join'){
          if(!s.players.some(p=>p.id===id)){
            if(s.phase!=='waiting'||s.players.length>=2)model.fail('This room has started or is full.');
            await finance.join(s,identity,b.wager,wallet);s.players.push({...model.player(id,identity.name),...(identity.avatar?{avatar:identity.avatar}:{})});
          }
        }else {
          if(b.action==='bot'&&s.wager)finance.fail('Bot practice uses 0 Chips. Create a free practice game.');
          if(b.action==='rematch')finance.consent(s,b);
          if(b.action==='leave'&&['playing','between','countdown'].includes(s.phase))s.forfeitWinner=s.players.find(p=>p.id!==id)?.id;
          model.act(s,id,b,roll,now);
          if(b.action==='leave'&&s.wager&&s.forfeitWinner){s.phase='complete';s.finishedAt=now;s.reason='Opponent left the game.';}
          if(s.game!==previousGame&&s.wager){await finance.prepare(s,'yahtzee',s.players,s.wager,wallet,true);s.phase='funding';delete s.forfeitWinner;}
        }
        s.requests.push(requestKey);s.requests=s.requests.slice(-512);
      }
      if(JSON.stringify(s)!==before){s.revision++;await c.query('UPDATE yahtzee_rooms SET state=$2::jsonb WHERE id=$1',[code,JSON.stringify(s)]);}
      await c.query('COMMIT');committed=true;c.release();released=true;const settled=await recover(code);if(b.action==='create'&&settled.finance?.aborted)finance.fail(settled.reason||'Unable to reserve Chips.');if(b.action==='join'&&!settled.players.some(p=>p.id===id))finance.fail(settled.reason||'Unable to reserve Chips.');return model.publicState(settled,id,clock());
    }catch(e){if(!committed)await c.query('ROLLBACK');throw e;}finally{if(!released)c.release();}
  }
  async function lobby(identity){
    if(!identity||!/^\d+$/.test(String(identity.id)))model.fail('Connect your API key on the main site.',401);
    await sweep();await ready();
    const rows=(await db().query("SELECT id, state->'players'->0->>'id' AS owner, state->'players'->0->>'name' AS creator, state->>'expiresAt' AS expires, state->>'wager' AS wager FROM yahtzee_rooms WHERE state->>'version'='2' AND state->>'phase'='waiting' AND jsonb_array_length(state->'players')=1 AND COALESCE(state->>'private','false')<>'true' AND COALESCE(state->'finance'->>'status','free')<>'funding' AND (state->>'expiresAt')::bigint>$1 ORDER BY created_at DESC LIMIT 50",[clock()])).rows;
    return rows.map(r=>({id:r.id,mode:'yahtzee',name:'Yahtzee',creator:r.creator,mine:r.owner===String(identity.id),wager:Number(r.wager)||0,count:1,capacity:2,expiresAt:Number(r.expires)}));
  }
  function outcome(s){
    const done=['complete','closed'].includes(s.phase),scores=s.players.map(p=>rules.totals(p).total);
    return {done,winner:s.forfeitWinner || (s.phase==='complete'&&s.players.length===2&&scores[0]!==scores[1]?s.players[scores[0]>scores[1]?0:1].id:null)};
  }
  async function recover(code){
    await ready();const c=await db().connect();
    try{await c.query('BEGIN');const s=(await c.query('SELECT state FROM yahtzee_rooms WHERE id=$1 FOR UPDATE',[code])).rows[0]?.state;
      if(!s)model.fail('This room has expired or does not exist.',404);
      const before=JSON.stringify(s);
      model.advance(s,clock(),roll);
      if(s.expiresAt<clock()&&s.phase==='waiting')s.phase='closed';
      await finance.recover(s,wallet,outcome);
      if(s.phase==='funding'&&s.finance.status==='reserved'){s.phase='countdown';s.startAt=clock()+model.COUNTDOWN_MS;s.deadline=s.startAt+model.ROUND_MS;s.botAt=s.startAt+1300;}
      if(JSON.stringify(s)!==before){s.revision++;await c.query('UPDATE yahtzee_rooms SET state=$2::jsonb WHERE id=$1',[code,JSON.stringify(s)]);}
      await c.query('COMMIT');return s;
    }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
  }
  async function quote(code){await ready();const s=(await db().query('SELECT state FROM yahtzee_rooms WHERE id=$1',[code])).rows[0]?.state;if(!s||s.phase!=='waiting'||s.players.length!==1||s.expiresAt<=clock())model.fail('This table is no longer open.');return {id:s.id,name:s.players[0].name,wager:s.wager||0,houseCutPercent:s.finance?.rate||0};}
  async function sweep(){await ready();const rows=(await db().query("SELECT state FROM yahtzee_rooms WHERE COALESCE(state->'finance'->>'status','free') NOT IN ('free','settled') AND (state->'finance'->>'status'='funding' OR state->>'phase' IN ('complete','closed') OR (state->>'expiresAt')::bigint<=$1 OR (state->>'deadline')::bigint BETWEEN 1 AND $1 OR (state->>'nextAt')::bigint BETWEEN 1 AND $1) ORDER BY created_at LIMIT 40", [clock()])).rows;for(const {state:s} of rows)try{await run({action:'get',room:s.id},s.players[0]);}catch{await recover(s.id).catch(()=>{});}}
  return {run,lobby,recover,quote,sweep};
}
module.exports={createStore};
