import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {PGlite} from '@electric-sql/pglite';
const require=createRequire(import.meta.url);
export async function startTestServer(){
  const pg=new PGlite();let tail=Promise.resolve(),timeOffset=0,balance=100000;
  const pool={query:(s,a)=>pg.query(s,a),connect:async()=>{let release;const prior=tail;tail=new Promise(r=>release=r);await prior;return{query:(s,a)=>pg.query(s,a),release};}};
  const auth=require('../netlify/functions/rps/database').createStore(pool);
  const login=require('../netlify/functions/rps-action').createHandler(auth,async url=>({ok:true,json:async()=>({player_id:new URL(url).searchParams.get('key').endsWith('2')?202:101,name:new URL(url).searchParams.get('key').endsWith('2')?'Clementine':'Juniper'})}));
  const receipts=new Set(),wallet={account:async p=>p.id,balance:async()=>balance,rate:async()=>3.3,apply:async(id,e)=>{if(!receipts.has(e.id)){if(balance+e.delta<0)throw Error('Insufficient balance');receipts.add(e.id);}}};
  const database=require('../netlify/functions/yahtzee/database').createStore(pool,undefined,()=>Date.now()+timeOffset,wallet);
  const handler=require('../netlify/functions/yahtzee-action').createHandler(database,auth);
  const hub=require('../netlify/functions/site-hub').createHandler({diceduel:require('../netlify/functions/dice-duel-multiplayer/database').createStore(pool),minigolf:require('../netlify/functions/mini-golf/database').createStore(pool),rps:auth,yahtzee:database,bluff:require('../netlify/functions/bluff/database').createStore(pool),wallet:{account:async p=>p.id,balance:async()=>balance,rate:async()=>3.3},data:{duelListGames:async()=>({games:[]})},four:{lobby:async()=>({games:[],joined:[]})},store:{notifications:async()=>[],notify:async()=>{}}});
  const root=path.resolve('dist'),mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
  const server=http.createServer(async(req,res)=>{
    try{
      let raw='';if(req.method==='POST')for await(const chunk of req)raw+=chunk;
      if(req.url.startsWith('/.netlify/functions/')){
        let response;
        if(req.url.endsWith('yahtzee-action'))response=await handler(new Request('http://local'+req.url,{method:req.method,body:raw}));
        else if(req.url.endsWith('rps-action')){const r=await login({httpMethod:req.method,body:raw});response=new Response(r.body,{status:r.statusCode,headers:r.headers});}
        else if(req.url.endsWith('site-hub'))response=await hub(new Request('http://local'+req.url,{method:req.method,body:raw}));
        else throw Error('Unknown endpoint');
        res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());return;
      }
      let name=new URL(req.url,'http://local').pathname;if(name.endsWith('/'))name+='index.html';
      const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep))throw Error('Outside root');
      const content=await fs.readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(content);
    }catch{res.writeHead(404);res.end('Not found');}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  return {origin:'http://127.0.0.1:'+server.address().port,setBalance:value=>{balance=value;},advance:ms=>{timeOffset+=ms;},expire:async id=>{const s=(await pg.query('SELECT state FROM yahtzee_rooms WHERE id=$1',[id])).rows[0].state;timeOffset=s.deadline-Date.now()+1;},close:async()=>{await new Promise(r=>server.close(r));await pg.close();}};
}
