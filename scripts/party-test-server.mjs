// Isolated local QA: the production handler and PostgreSQL queries, no Torn data.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {PGlite} from '@electric-sql/pglite';
const require=createRequire(import.meta.url);
export async function startPartyServer({root=process.cwd(),port=0}={}){
  const pg=new PGlite();let tail=Promise.resolve(),delta=0;
  const pool={query:(sql,params)=>pg.query(sql,params),connect:async()=>{let release;const before=tail;tail=new Promise(r=>release=r);await before;return {query:(sql,params)=>pg.query(sql,params),release};}};
  const store=require('../netlify/functions/party/database').createStore(pool,()=>Date.now()+delta),handler=require('../netlify/functions/party-action').createHandler(store);
  const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml'};
  const server=http.createServer(async(req,res)=>{try{
    const url=new URL(req.url,`http://${req.headers.host}`);
    if(url.pathname==='/.netlify/functions/party-action'){let raw='';for await(const part of req)raw+=part;const result=await handler(new Request(url,{method:req.method,headers:req.headers,body:raw||undefined}));res.writeHead(result.status,Object.fromEntries(result.headers));res.end(await result.text());return;}
    const pathname=url.pathname==='/'?'/party.html':url.pathname;
    const file=path.resolve(root,'.'+decodeURIComponent(pathname));if(!file.startsWith(path.resolve(root)+path.sep))throw Error('Invalid path');const bytes=await fs.readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(bytes);
  }catch(e){res.writeHead(404);res.end('Not found');}});
  await new Promise(r=>server.listen(port,'127.0.0.1',r));
  return {origin:`http://127.0.0.1:${server.address().port}`,pg,pool,store,tick:ms=>delta+=ms,close:async()=>{await new Promise(r=>server.close(r));await pg.close();}};
}
if(process.argv.includes('--serve')){const s=await startPartyServer({port:26759});console.log(s.origin);}
