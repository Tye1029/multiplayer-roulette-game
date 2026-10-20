import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const blobs = require('@netlify/blobs');
const previousContext = process.env.NETLIFY_BLOBS_CONTEXT;
const previousGlobal = globalThis.netlifyBlobsContext;
const context = {siteID:'test-site', token:'test-only-token', edgeURL:'https://cached.invalid', uncachedEdgeURL:'https://origin.invalid'};
const requests = [];
let saved, etag = 0;
const fetch = async (url, options) => {
  requests.push({url, ...options});
  if (options.method === 'get') {
    assert.equal(new URL(url).origin, context.uncachedEdgeURL, 'Authoritative reads must bypass the cached endpoint');
    return saved ? new Response(JSON.stringify(saved), {headers:{etag:`"${etag}"`}}) : new Response(null,{status:404});
  }
  assert.equal(options.method, 'put');
  const headers = new Headers(options.headers);
  if (headers.get('if-none-match') === '*' ? !!saved : headers.get('if-match') !== `"${etag}"`) return new Response(null,{status:412});
  saved = JSON.parse(options.body); etag++;
  return new Response(null,{status:200,headers:{etag:`"${etag}"`}});
};
const getStore = input => blobs.getStore(typeof input === 'string' ? {name:input,fetch} : {...input,fetch});
try {
  delete globalThis.netlifyBlobsContext;
  // Reproduce the reported failure with the installed SDK's real Lambda adapter.
  blobs.connectLambda({blobs:Buffer.from(JSON.stringify({url:context.edgeURL,token:context.token})).toString('base64'),headers:{'x-nf-site-id':context.siteID}});
  await assert.rejects(getStore('torn-xan-users').getWithMetadata('game',{type:'json',consistency:'strong'}), /uncachedEdgeURL/);
  assert.equal(requests.length,0, 'The old configuration fails before a storage request');
  blobs.setEnvironmentContext(context);

  // Production Roulette create/save boundary, using the real SDK over fake HTTP.
  const data = await readFile(new URL('../netlify/functions/_data.js',import.meta.url),'utf8');
  const save = data.slice(data.indexOf('async function duelSaveGame('),data.indexOf('async function duelInvalidateLegacyGame('));
  const env = vm.createContext({duelSanitizeGame:x=>x,DUEL_SCHEMA_VERSION:1,int:(n,d)=>Number(n??d),nowIso:()=>new Date().toISOString(),getUsersStore:()=>getStore('torn-xan-users'),duelGameKey:String,duelIsActiveStatus:()=>false,duelClearPointers:async()=>{}});
  vm.runInContext(save,env);
  const created = await env.duelSaveGame({gameId:'test-game',mode:'roulette',status:'waiting',revision:0});
  assert.equal(created.revision,1);
  assert.equal(new Headers(requests.at(-1).headers).get('if-none-match'),'*');
  const competitors = await Promise.allSettled([env.duelSaveGame({...created,winnerUserId:'a'}),env.duelSaveGame({...created,winnerUserId:'b'})]);
  assert.equal(competitors.filter(x=>x.status==='fulfilled').length,1, 'Only one competing turn result may commit');
  assert.equal(saved.revision,2);

  const source = await readFile(new URL('../netlify/functions/duel-action.js',import.meta.url),'utf8');
  const endpoint = vm.createContext({exports:{},Buffer,Response,URL,console,process:{env:{}},require:name=>name==='@netlify/blobs'?{getStore}:name==='./_data'?{initBlobs(){throw new Error('Native context must not be replaced with legacy context');}}:require(name)});
  vm.runInContext(source,endpoint);
  assert.equal(endpoint.exports.handler,undefined,'A legacy handler export would select the wrong Netlify runtime');
  const invoke = (method,body) => endpoint.exports.default(new Request('https://test.invalid/.netlify/functions/duel-action',{method,...(body===undefined?{}:{body})}));
  const readiness = await invoke('HEAD');
  assert.equal(readiness.status,204); assert.equal(readiness.headers.get('X-Duel-Storage'),'strong-v1');
  assert.equal(await readiness.text(),'');
  assert.equal((await endpoint.exports.default(new Request('https://test.invalid/.netlify/functions/duel-action?health=storage'))).status,204);
  assert.equal((await invoke('OPTIONS')).status,204);
  assert.equal((await invoke('GET')).status,405);
  assert.equal((await invoke('POST','{')).status,400);
  assert.match((await (await invoke('POST','{}')).json()).error,/API key/);
  assert.equal(saved.revision,2,'Readiness and unauthenticated requests cannot mutate games');
  blobs.setEnvironmentContext({...context,uncachedEdgeURL:undefined});
  assert.equal((await invoke('HEAD')).status,503,'Readiness must report a broken strong-read configuration');
} finally {
  if (previousContext === undefined) delete process.env.NETLIFY_BLOBS_CONTEXT;
  else process.env.NETLIFY_BLOBS_CONTEXT = previousContext;
  if (previousGlobal === undefined) delete globalThis.netlifyBlobsContext;
  else globalThis.netlifyBlobsContext = previousGlobal;
}
console.log('Native duel storage passed: reproduced legacy failure, preserved native strong reads, first creation, conditional concurrent saves, auth/method handling and read-only readiness.');
