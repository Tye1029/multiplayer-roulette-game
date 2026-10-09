import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../assets/safe-cracker/heist.js',import.meta.url),'utf8');
let phase=2, mounted=true, accepts=0, callbacks=[], cleared=[];
const classes=new Set();
const board={isConnected:true,dataset:{shKey:'round:1'},classList:{add:n=>classes.add(n)},querySelectorAll:()=>[],insertAdjacentHTML:()=>{}};
const context=vm.createContext({game:{gameId:'round'},api:null,transition:null,selected:'',lastEffect:'',
  root:()=>mounted?board:null,heist:()=>({phase}),queue:{length:0,receive:()=>{}},stopDrag:()=>{},
  matchMedia:()=>({matches:false}),clearTimeout:id=>cleared.push(id),setTimeout:fn=>{callbacks.push(fn);return callbacks.length;}
});
vm.runInContext(source.slice(source.indexOf('  function renderTools('),source.indexOf('  function decorateDial(')),context);
const game={gameId:'round',status:'playing',safecrackerState:{version:2}}, helpers={accept:()=>accepts++};
assert.equal(context.renderTools(game,{},helpers),true);
assert.ok(classes.has('sh-turn-to-front'));
assert.equal(callbacks.length,1);
assert.equal(context.renderTools(game,{},helpers),true);
assert.equal(callbacks.length,1,'Polling must not restart the turn');
callbacks[0]();assert.equal(accepts,1);
assert.equal(context.renderTools(game,{},helpers),false,'Front mounts after the turn');
// An interrupted transition must not resurrect a disconnected board.
context.transition=null;context.renderTools(game,{},helpers);mounted=false;board.isConnected=false;
callbacks[1]();assert.equal(accepts,1);
context.renderTools({...game,gameId:'rematch'}, {}, helpers);
assert.equal(context.transition,null);assert.ok(cleared.length);
// The report compares real stage timings and escapes player-controlled names.
vm.runInContext('const esc = value => String(value ?? "").replace(/[&<>"\']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\\\"":"&quot;","\'":"&#39;"}[c]));',context);
vm.runInContext(source.slice(source.indexOf('  function resultReport('),source.indexOf("  document.addEventListener('visibilitychange'")),context);
const stages=[{label:'Panel',milliseconds:12300,complete:true,started:true,mistakes:1},{label:'Wires',milliseconds:4200,complete:false,started:true,mistakes:2},{label:'Dial',milliseconds:null,complete:false,started:false,mistakes:0}];
const html=context.resultReport({isCreator:true,creator:{userId:'me',name:'<script>'},joiner:{userId:'them',name:'Rival'},winnerUserId:'them',safecrackerState:{report:{me:stages,opponent:stages}}});
assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('12.3s'));assert.ok(html.includes('Unfinished'));assert.ok(html.includes('Not reached'));assert.ok(html.includes('3 wrong moves'));assert.equal((html.match(/sh-report-stage/g)||[]).length,6);
assert.equal(context.resultReport({safecrackerState:{}}),'','Legacy rounds retain their existing result view');
console.log('Heist presentation validated: one-shot back/front handoff, interrupted/rematch cleanup, real report fields, legacy fallback and escaped names.');
