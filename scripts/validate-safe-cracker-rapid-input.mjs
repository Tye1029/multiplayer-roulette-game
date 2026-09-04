import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url), 'utf8');
function section(start, end) {
  const from = source.indexOf(start), to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `Missing ${start}`);
  return source.slice(from, to);
}
const game = (stage = 0, status = 'playing', gameId = 'test') => ({gameId,status,safecrackerState:{canSubmit:true,cooldownMs:0,me:{stage},opponent:{stage:0}}});
const runtime = {game:game(),selected:2,busy:false,queuedGuess:null};
let resolveRequest, rejectRequest;
const requests = [];
const context = vm.createContext({
  runtime, STAGES:3, console, setTimeout:()=>0,
  stateFor:g=>g?.safecrackerState || {}, myState:g=>g?.safecrackerState?.me || {}, opponentState:g=>g?.safecrackerState?.opponent || {},
  safeCrackerLocalCooldownReleased:()=>false, safeCrackerCooldownActive:()=>false,
  safeCrackerUpdateConfirmControl:()=>{}, safeCrackerArmLocalCooldown:()=>{},
  adoptSubmittedFeedback:()=>false, playFeedback:()=>{}, render:g=>{runtime.game=g;},
  document:{querySelector:()=>null},
  window:{__safeCrackerBridge:{submit:payload=>{requests.push(payload);return new Promise((resolve,reject)=>{resolveRequest=resolve;rejectRequest=reject;});}}}
});
vm.runInContext(section('function safeCrackerCanSubmit(game', 'function safeCrackerUpdateConfirmControl()'),context);
vm.runInContext(section('function safeCrackerRequestGuess()', 'function updateTimerOnly()'),context);

const first = context.submitGuess(runtime.game);
assert.equal(requests[0].choice,'safecracker:guess:2');
context.safeCrackerRequestGuess();
assert.equal(runtime.queuedGuess,null,'Double-check of the in-flight digit must not duplicate the request');
runtime.selected=4;
context.safeCrackerRequestGuess();
runtime.selected=7;
assert.equal(requests.length,1,'Only one network request may be in flight');
resolveRequest({game:game()});
await first;
assert.equal(requests[1].choice,'safecracker:guess:4','Queued check must use the clicked digit, not later dial movement');
assert.notEqual(requests[0].actionId,requests[1].actionId);
resolveRequest({game:game()});
await new Promise(setImmediate);
runtime.queuedGuess={gameId:'test',stage:0,digit:8};
runtime.game=game(1);
context.safeCrackerFlushQueuedGuess();
assert.equal(runtime.queuedGuess,null,'An old-tumbler check must be discarded');
runtime.queuedGuess={gameId:'test',stage:1,digit:8};
runtime.game=game(1,'complete');
context.safeCrackerFlushQueuedGuess();
assert.equal(runtime.queuedGuess,null,'Completion must discard queued input');

runtime.game=game();runtime.busy=false;
const failed=context.submitGuess(runtime.game);
runtime.selected=8;context.safeCrackerRequestGuess();
rejectRequest(new Error('network unavailable'));
await failed;
assert.equal(runtime.busy,false);assert.equal(runtime.queuedGuess,null,'A failed request must not trigger an automatic next guess');
const obsolete=context.submitGuess(runtime.game);
runtime.game=game(0,'playing','new-match');runtime.requestToken=null;runtime.busy=false;
resolveRequest({game:game(3,'complete')});
await obsolete;
assert.equal(runtime.game.gameId,'new-match','Late responses must not restore an old match');

// Invoke real pointer handlers while a request is outstanding.
const handlers={};
const dial={addEventListener:(type,fn)=>{handlers[type]=fn;},setPointerCapture:()=>{},classList:{add:()=>{},remove:()=>{}}};
context.resumeAudio=()=>{};context.cancelDialSettle=()=>{};context.pointerAngle=()=>0;
context.circularDeltaDegrees=n=>n;context.selectedFromRotation=()=>5;context.playDetent=()=>{};context.applyDialVisual=()=>{};
context.window.__safeCrackerDialInteractionStarts=0;
vm.runInContext(section('function bindControls(mount, game)', 'function bindResultControls(mount)'),context);
context.bindControls({querySelector:selector=>selector==='[data-sc-dial]'?dial:null,querySelectorAll:()=>[]},runtime.game);
runtime.busy=true;runtime.rotation=0;
handlers.pointerdown({pointerId:1,preventDefault:()=>{}});
assert.equal(runtime.dragging,true,'An in-flight check must not block dragging');
handlers.pointermove({pointerId:1,preventDefault:()=>{}});
assert.equal(runtime.selected,5);
runtime.game=game(3,'complete');runtime.dragging=false;
handlers.pointerdown({pointerId:2,preventDefault:()=>{}});
assert.equal(runtime.dragging,false,'Completed games must still reject input');

// The completion update must retain the physical safe rather than rebuild it.
const classList={add:()=>{},remove:()=>{},toggle:()=>{}};
const board={dataset:{scGameId:'test',scStatus:'playing'},matches:()=>true,classList,querySelector:()=>null,querySelectorAll:()=>[]};
context.document.querySelector=selector=>selector==='[data-safe-cracker-mount]'?{firstElementChild:board}:null;
context.tierLabel=t=>t;
vm.runInContext(section('function safeCrackerUpdateMountedBoard(game)', '// SAFE_CRACKER_RENDER_STABILITY_V1_END'),context);
assert.equal(context.safeCrackerUpdateMountedBoard(game(3,'complete')),true);
assert.equal(board.dataset.scStatus,'complete');
assert.equal(context.safeCrackerUpdateMountedBoard(game(3,'complete')),true,'Result polling must retain the same door');
assert.equal(context.safeCrackerUpdateMountedBoard(game(0,'ready','new-match')),false,'New matches must get a fresh board');

const shellSource = await readFile(new URL('../index.html', import.meta.url),'utf8');
const patchStart = shellSource.indexOf('const mountedSafeBoard =');
const patchEnd = shellSource.indexOf("if(game?.mode==='roulette'&&roulettePatchMountedRuntime",patchStart);
const emitted=[];
const shellContext=vm.createContext({
  duelActive:{querySelector:()=>board},duelGenericMountedGameMatches:g=>g.gameId==='test',
  duelSetSharedCountdown:()=>{},duelSetPollRate:()=>{},window:{dispatchEvent:event=>emitted.push(event)},
  CustomEvent:class { constructor(type,init){this.type=type;this.detail=init.detail;} }
});
vm.runInContext(`function patch(game){const nextKey='test';let duelLastActiveGame,duelLastRenderKey;${shellSource.slice(patchStart,patchEnd)}}`,shellContext);
for(const status of ['playing','complete'])shellContext.patch({...game(0,status),mode:'safecracker'});
assert.equal(emitted.length,2,'The shared shell must deliver snapshots without replacing the Safe Cracker mount');
shellContext.patch({...game(),mode:'roulette'});
shellContext.patch({...game(0,'playing','other'),mode:'safecracker'});
assert.equal(emitted.length,2,'Mount retention must be limited to this Safe Cracker match');
assert.ok(shellSource.lastIndexOf('!safeCrackerAcceptSnapshot(game)',patchStart)>shellSource.indexOf('function duelRenderActive('),'Snapshot validation must precede shell retention');

// Cancellation events can run after a newer animation has already started.
const callbacks=[];
const face={style:{},classList,animate:()=>{const listeners={};const animation={addEventListener:(type,fn)=>{listeners[type]=fn;},cancel:()=>callbacks.push(listeners.cancel)};return animation;}};
context.document.querySelector=()=>face;
context.window.matchMedia=()=>({matches:false});
vm.runInContext(section('function cancelDialSettle()', '// SAFE_CRACKER_DIAL_PHYSICS_V2_END'),context);
context.animateDialSettle(0,36);
context.animateDialSettle(36,72);
callbacks.forEach(fn=>fn());
assert.equal(face.style.transform,'rotate(72deg)','Stale cancellation must not snap the dial backwards');
console.log('Safe Cracker rapid-input checks passed: live drag during requests, one frozen queued digit, duplicate/stage/end/error guards, stale-response isolation, retained completion door, and settle cancellation.');
