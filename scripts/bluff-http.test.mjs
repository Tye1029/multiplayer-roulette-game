// Two distinct authenticated actors exercise the deployed handler over real HTTP.
// Persistence is an in-memory fixture; production PostgreSQL is not replaced.
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const M=require('../shared/games/bluff-model');
const {createHandler}=require('../netlify/functions/bluff-action');
const tables=new Map();
const store={
  async create(p){const s=M.create('ABCDEF123456',p);tables.set(s.id,s);return s;},
  async action(id,p,b){const s=tables.get(id);if(!s)M.fail('Not found',404);if(b.action==='join')M.join(s,p);M.advance(s);if(!['get','join'].includes(b.action))M.act(s,p.id,b);return s;}
};
const handler=createHandler(store,{authenticate:async token=>['alice','bob'].includes(token)?{id:token,name:token}:null});
const server=http.createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;const response=await handler(new Request('http://localhost/bluff',{method:'POST',body}));res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());});
server.listen(0,'127.0.0.1');await once(server,'listening');
try{
  const url=`http://127.0.0.1:${server.address().port}`;
  const send=async(token,action,more={})=>{const r=await fetch(url,{method:'POST',body:JSON.stringify({token,action,gameId:'ABCDEF123456',match:1,round:1,...more})});assert.equal(r.status,200);return(await r.json()).game;};
  await send('alice','create');await send('bob','join');await Promise.all([send('alice','ready'),send('bob','ready')]);
  const [a,b]=await Promise.all([send('alice','get'),send('bob','get')]);
  assert.equal(a.hand.length,10);assert.equal(b.hand.length,10);assert.equal(a.deadline,b.deadline);assert.ok(a.hand.every(c=>!b.hand.some(x=>x.id===c.id)));
  // Both clients commit at once; the second response sees a fully locked decision phase.
  await Promise.all([send('alice','play',{cards:a.hand.map(c=>c.id)}),send('bob','play',{cards:b.hand.map(c=>c.id)})]);
  const fresh=await send('alice','get');assert.equal(fresh.phase,'decide');assert.deepEqual(fresh.playCounts,[10,10]);assert.equal(fresh.reveal,null);
  await send('alice','decide',{choice:'believe'});const hidden=await send('bob','get');assert.equal(hidden.myDecision,null);assert.equal(hidden.reveal,null);
  await send('bob','decide',{choice:'believe'});const [ra,rb]=await Promise.all([send('alice','get'),send('bob','get')]);assert.deepEqual(ra.reveal,rb.reveal);assert.deepEqual(ra.counts,[0,0]);assert.equal(ra.reveal.entries.flatMap(e=>e.cards).length,20);
  // The final reveal is already a draw; leaving cannot change the resolved result.
  await send('alice','leave');const done=await send('bob','get');assert.equal(done.winner,'draw');
  await send('alice','rematch');const rematch=await send('bob','rematch');assert.equal(rematch.match,2);assert.equal(rematch.phase,'select');assert.equal(rematch.hand.length,10);
  console.log('Bluff HTTP: two identities, simultaneous commits, private decisions, synchronized reveals, reconnect reads and mutual rematches passed.');
}finally{await new Promise(resolve=>server.close(resolve));}
