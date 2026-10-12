// Local-only multiplayer QA: real game stores against ephemeral PostgreSQL,
// synthetic Torn identities, and an in-memory Chip ledger. No external accounts.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {PGlite} from '@electric-sql/pglite';
const require=createRequire(import.meta.url);
export async function startPublicPolishServer(root=path.resolve('dist'),port=0){
 root=path.resolve(root);
 const pg=new PGlite();let tail=Promise.resolve();
 const pool={query:(s,a)=>pg.query(s,a),connect:async()=>{let release;const prior=tail;tail=new Promise(r=>release=r);await prior;return {query:(s,a)=>pg.query(s,a),release};}};
 const balances=new Map(),ledger=new Map();
 const wallet={account:async p=>p.id,balance:async p=>balances.get(p.id)??500000,rate:async()=>3.3,apply:async(id,e)=>{if(ledger.has(e.id))return balances.get(id);const n=(balances.get(id)??500000)+e.delta;if(n<0)throw Object.assign(Error('Not enough Chips'),{status:409});balances.set(id,n);ledger.set(e.id,e);return n;}};wallet.award=wallet.apply;
 const rps=require('../netlify/functions/rps/database').createStore(pool,wallet),four=require('../netlify/functions/roulette-four/database').createStore(pool,wallet),bluff=require('../netlify/functions/bluff/database').createStore(pool,wallet),dice=require('../netlify/functions/yahtzee/database').createStore(pool,undefined,Date.now,wallet),progress=require('../netlify/functions/site-hub/progression').createStore(pool,wallet);
 const player=key=>({player_id:String(key).slice(-1),name:'Player '+String(key).slice(-1),profile_image:'/assets/roulette-four/images/amber.svg'});
 const golf=require('../netlify/functions/mini-golf/database').createStore(pool,wallet);
 const login=require('../netlify/functions/rps-action').createHandler(rps,async url=>({ok:true,json:async()=>player(new URL(url).searchParams.get('key'))}));
 const handlers={
  'roulette-four-action':require('../netlify/functions/roulette-four-action').createHandler(four,rps),
  'bluff-action':require('../netlify/functions/bluff-action').createHandler(bluff,rps),
  'mini-golf-action':require('../netlify/functions/mini-golf-action').createHandler(golf,rps),
  'yahtzee-action':require('../netlify/functions/yahtzee-action').createHandler(dice,rps),
  'site-hub':require('../netlify/functions/site-hub').createHandler({rps,four,bluff,minigolf:golf,yahtzee:dice,wallet,progression:progress,store:require('../netlify/functions/site-hub/store').createStore(pool),data:{duelListGames:async()=>({games:[]})}})
 };
 const mime={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav'};
 const server=http.createServer(async(req,res)=>{try{
  const pathname=new URL(req.url,'http://local').pathname;
  if(pathname.startsWith('/.netlify/functions/')){let raw='';for await(const b of req)raw+=b;const name=pathname.split('/').at(-1);let response;
   if(name==='rps-action'){const r=await login({httpMethod:req.method,body:raw});response=new Response(r.body,{status:r.statusCode,headers:r.headers});}
   else if(handlers[name])response=await handlers[name](new Request('http://local'+req.url,{method:req.method,headers:req.headers,body:raw||undefined}));
   else{const body=JSON.parse(raw||'{}'),p=player(body.visitorKey||'1');response=new Response(JSON.stringify({ok:true,games:[],serverBalance:500000,user:{id:p.player_id,name:p.name},siteUserId:p.player_id,addedTickets:0}),{headers:{'Content-Type':'application/json'}});}
   res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());return;
  }
  const file=path.resolve(root,'.'+decodeURIComponent(pathname)+(pathname.endsWith('/')?'index.html':''));if(!file.startsWith(root+path.sep))throw Error('Path');const bytes=await fs.readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(bytes);
 }catch(e){res.writeHead(404);res.end('Not found');}});
 await new Promise(r=>server.listen(port,'127.0.0.1',r));return {origin:'http://127.0.0.1:'+server.address().port,pg,pool,rps,four,bluff,golf,dice,progress,wallet,balances,ledger,close:async()=>{await new Promise(r=>server.close(r));await pg.close();}};
}
if(process.argv.includes('--serve')){const s=await startPublicPolishServer(process.argv[3]||path.resolve('dist'),26752);console.log(s.origin);}
