import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../assets/safe-cracker/safe-cracker.js',import.meta.url),'utf8');
const section=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const game=(revision,status='playing',stage=2)=>({gameId:'g',mode:'safecracker',revision,status,isCreator:true,creator:{userId:'me'},joiner:{userId:'bot'},
  winnerUserId:status==='complete'?'me':null,safecrackerState:{revision,me:{stage,lastResult:{guess:5,stage:2,tier:'green',at:new Date(1000+revision).toISOString()}},opponent:{stage:0}}});
const runtime={game:game(4),dragging:true,pointerId:1,selected:9,rotation:-324,stageKey:'g:2',pendingDragGame:null,busy:true,queuedGuess:{digit:9},requestToken:{}};
const views=[],handlers={};let pointerReleased=0,paintCancelled=0,settleCancelled=0;
const dial={classList:{remove(){}},releasePointerCapture(){pointerReleased++;},addEventListener:(type,fn)=>{handlers[type]=fn;}};
const mount={querySelector:selector=>selector==='[data-sc-dial]'?dial:selector==='[data-sc-result-sequence]'?{}:null,querySelectorAll:()=>[]};
const context=vm.createContext({runtime,Number,String,Date,Math,STATE_EVENT:'safecracker:state',STAGES:3,
  document:{querySelector:selector=>selector==='[data-safe-cracker-mount]'?mount:selector==='[data-sc-dial]'?dial:null},
  window:{addEventListener:(_,fn)=>{context.onState=fn;}},
  modulo:(n,m)=>((n%m)+m)%m,nearestRotationForDigit:digit=>-digit*36,
  cancelDialPaint:()=>paintCancelled++,cancelDialSettle:()=>settleCancelled++,
  visibleDialRotation:()=>runtime.rotation,animateDialSettle(){},
  safeCrackerResetLocalCooldown(){},updateClock(){},startTicker(){},
  stateFor:g=>g.safecrackerState,myState:g=>g.safecrackerState.me,opponentState:g=>g.safecrackerState.opponent,
  stageKey:g=>g.gameId+':'+g.safecrackerState.me.stage,safeCrackerCanSubmit:g=>g.status==='playing',safeCrackerCooldownActive:()=>false,
  tierLabel:t=>t,safeCrackerMonotonicCountdownLabel:()=>'',
  safeCrackerUpdateMountedBoard:g=>{views.push({status:g.status,digit:runtime.selected,tier:runtime.feedbackResult?.tier});return true;},
  revealPreparedVault(){},mountCountdownPortal(){},bindResultControls(){},mountSafeCrackerResultPortal(){},updateTimerOnly(){}
});
context.safeCrackerStartFrameProbe=()=>{};context.safeCrackerStopFrameProbe=()=>{};
vm.runInContext(section('function submittedFeedbackKey(result)', '// SAFE_CRACKER_FEEDBACK_LATCH_END'),context);
vm.runInContext(section('function safeCrackerSetMarkup(element, markup)', '// SAFE_CRACKER_PRESENTATION_ORDER_V23_END'),context);
vm.runInContext(section('function render(game)', '// SAFE_CRACKER_DIAL_PHYSICS_V2_START'),context);
vm.runInContext(section('function bindControls(mount, game)', 'function bindResultControls(mount)'),context);
context.bindControls(mount,runtime.game);
vm.runInContext(section('window.addEventListener(STATE_EVENT, event =>', "document.addEventListener('visibilitychange'"),context);

context.onState({detail:{game:game(5)}});
assert.equal(runtime.pendingDragGame.revision,5);
assert.equal(views.length,0,'Playing polls are deferred during a drag');
// This is the reported race: a final action response arrives while an earlier
// playing snapshot is waiting for pointer release.
context.render(game(6,'complete',3));
assert.equal(runtime.dragging,false);
assert.equal(runtime.pendingDragGame,null,'Winning response must discard pre-win deferred snapshots');
assert.equal(runtime.busy,false);assert.equal(runtime.queuedGuess,null);assert.equal(runtime.requestToken,null,'Completion must finish pending check presentation without waiting for its late response');
assert.equal(pointerReleased,1);assert.equal(paintCancelled,1);assert.equal(settleCancelled,1);
assert.deepEqual(views,[{status:'complete',digit:5,tier:'green'}],'Final confirmation must show the checked digit, not the next selected number');
handlers.pointerup({pointerId:1,preventDefault(){}});
context.render(game(5));context.onState({detail:{game:game(5)}});
assert.equal(runtime.game.status,'complete');assert.equal(views.length,1,'Late release, action, and poll views must not rewind completion');
runtime.game=game(10);runtime.dragging=true;runtime.pointerId=2;
context.onState({detail:{game:game(11,'complete',3)}});
assert.equal(runtime.dragging,false,'A completion poll must interrupt a drag as well as an action response');
assert.equal(views.at(-1).status,'complete');
const element={dataset:{}};let writes=0;
Object.defineProperty(element,'innerHTML',{set(){writes++;}});
context.safeCrackerSetMarkup(element,'unchanged');context.safeCrackerSetMarkup(element,'unchanged');
assert.equal(writes,1,'Identical polling updates must retain their painted progress elements');
console.log('Safe finish continuity passed: delayed action during drag, stale release/poll rejection, final digit/green feedback, completion polling, and stable progress markup.');
