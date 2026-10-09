import assert from 'node:assert/strict';
import input from '../assets/safe-cracker/heist-input.js';
import rules from '../netlify/functions/safe-cracker/heist.js';
const snapshot = (h, revision = 1, gameId = 'round') => ({gameId,status:'playing',safecrackerState:{revision,me:{heist:rules.publicView(h,true)}}});
const tick = () => new Promise(resolve => setImmediate(resolve));
// Compare local presentation against the authoritative reducer through all stages.
for (let run=0; run<30; run++) {
  let h=rules.create(), projected=rules.publicView(h,true), n=0;
  while(h.phase<2 && !h.failed) {
    let cmd=rules.botCommand(h);
    if(h.phase===0 && n%4===0) {const i=h.screws.findIndex(s=>!s.removed);cmd=`screw:${i}:${rules.shapes.find(t=>t!==h.screws[i].type)}`;}
    if(h.phase===1 && !h.cardOpen && n%3===0) cmd='cut:'+h.order.find(c=>!h.cut.includes(c)&&c!==rules.nextWire(h));
    if(cmd==='cut:undefined') cmd=rules.botCommand(h);
    const id='action-'+(++n);
    projected=input.project(projected,cmd,id);
    h=rules.apply(h,cmd);h.lastAction.actionId=id;
    const expected=rules.publicView(h,true);delete expected.lastAction.at;
    assert.deepEqual(projected,expected);
    assert.ok(n<80);
  }
}
let h=rules.create(), calls=[], changes=0, errors=[], active=true;
const queue=input.createQueue({
  submit:item=>new Promise((resolve,reject)=>calls.push({item,resolve,reject})),
  onChange:()=>changes++,onError:e=>errors.push(e),isActive:()=>active
});
queue.receive(snapshot(h));
queue.enqueue('screw:0:'+h.screws[0].type,'first');
queue.enqueue('screw:1:'+h.screws[1].type,'second');
assert.equal(queue.view().removed,2,'Two drops must paint before any server reply');
assert.equal(calls.length,1,'Writes must remain serialized');
assert.equal(changes,2);
// Background polling must not undo local work or double-apply an acknowledged turn.
queue.receive(snapshot(h));assert.equal(queue.view().removed,2);
h=rules.apply(h,calls[0].item.command);h.lastAction.actionId='first';
queue.receive(snapshot(h,2));assert.equal(queue.view().removed,2);assert.equal(queue.length,1);
calls[0].resolve({game:snapshot(h,2)});await tick();assert.equal(calls.length,2);
h=rules.apply(h,calls[1].item.command);h.lastAction.actionId='second';
calls[1].resolve({game:snapshot(h,3)});await tick();assert.equal(queue.length,0);assert.equal(queue.view().removed,2);
queue.receive(snapshot(rules.create(),1));assert.equal(queue.view().removed,2,'Older snapshots cannot rewind confirmed work');
queue.enqueue('screw:2:'+h.screws[2].type,'retry');
calls[2].reject(Error('lost response'));await tick();
assert.equal(calls[3].item.actionId,'retry','Retry must retain its idempotency key');
calls[3].reject(Error('offline'));await tick();assert.equal(queue.length,0);assert.equal(queue.view().removed,2);assert.equal(errors.length,1);
// A late response after a rematch cannot update the new puzzle.
queue.enqueue('screw:2:'+h.screws[2].type,'old');
const fresh=rules.create();queue.receive(snapshot(fresh,1,'rematch'));
calls[4].resolve({game:snapshot(h,4)});await tick();assert.equal(queue.view().removed,0);
// Quitting must discard the queue without rendering/reopening the old game.
queue.enqueue('screw:0:'+fresh.screws[0].type,'quit');
queue.enqueue('screw:1:'+fresh.screws[1].type,'never-send');
const before=changes;active=false;calls[5].reject(Error('closed'));await tick();
assert.equal(calls.length,6);assert.equal(changes,before);
// Card pickup/put-down and cuts all react immediately, but stay ordered on the wire.
let wire=rules.create();while(wire.phase===0)wire=rules.apply(wire,rules.botCommand(wire));
const waiting=[];const wires=input.createQueue({submit:item=>new Promise(resolve=>waiting.push({item,resolve})),onChange:()=>{},onError:e=>{throw e;}});
wires.receive(snapshot(wire));
wires.enqueue('card:open','open');assert.equal(wires.view().instructions.length,10);
assert.equal(wires.enqueue('cut:'+wire.order[0],'blocked'),false);
wires.enqueue('card:close','close');assert.equal(wires.view().cardOpen,false);
wires.enqueue('cut:'+wire.order[0],'cut');assert.equal(wires.view().cutCount,1);
assert.equal(waiting.length,1);
for(let i=0;i<3;i++) {wire=rules.apply(wire,waiting[i].item.command);wire.lastAction.actionId=waiting[i].item.actionId;waiting[i].resolve({game:snapshot(wire,i+2)});await tick();}
assert.deepEqual(waiting.map(x=>x.item.actionId),['open','close','cut']);assert.equal(wires.length,0);
console.log('Immediate tool feedback validated: delayed replies, ordered card/cuts, poll reconciliation, stale snapshots, idempotent retry, rollback, rematch and quit isolation.');
