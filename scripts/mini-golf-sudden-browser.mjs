import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),M=require('../shared/games/mini-golf-model'),P=require('../shared/games/mini-golf-physics');

// Isolated SQL fixture for the regulation tie; every sudden-death shot uses the
// real browser controls, HTTP handler, row lock, physics and wallet settlement.
export async function testSudden({server,player,fit,putt}){
  const a=await player('3',1280),b=await player('4',390,844),pa={id:'3',name:'Player 3'},pb={id:'4',name:'Player 4'};
  assert.equal(await a.locator('.hub-all').evaluate(e=>Math.round(e.getBoundingClientRect().height)),42,'All games matches the neighboring buttons');
  assert.equal(await b.locator('.hub-all').isVisible(),false,'Phone navigation stays compact');
  let s=await server.golf.create(pa,{course:'clover',wager:1000,private:true,requestId:crypto.randomUUID()});
  await server.golf.action(s.id,pb,{action:'join',wager:1000});await server.golf.action(s.id,pa,{action:'ready'});s=await server.golf.action(s.id,pb,{action:'ready'});
  await Promise.all([a,b].map(p=>p.goto(server.origin+'/games/multiplayer/mini-golf/?room='+s.id)));
  await Promise.all([a,b].map(p=>p.locator('#golf-table[data-phase=playing]').waitFor()));
  s.hole=2;s.scores=[[3,3],[3,3]];s.balls.forEach(ball=>Object.assign(ball,{holed:true,strokes:2}));s.lastShot=null;M.advance(s,Date.now());
  await server.pg.query('UPDATE mini_golf_matches SET state=$2::jsonb WHERE id=$1',[s.id,JSON.stringify(s)]);
  await Promise.all([a,b].map(p=>p.locator('#golf-next:enabled').waitFor()));
  await a.locator('#golf-next').click();await b.locator('#golf-next').click();
  await Promise.all([a,b].map(p=>p.locator('#golf-sudden:visible').waitFor()));
  assert.match(await b.locator('#golf-sudden').innerText(),/SUDDEN DEATH.*First player to score wins/s);
  assert.equal(await b.locator('#golf-board').getAttribute('data-playable'),'false');
  await Promise.all([fit(a,'sudden-countdown-desktop'),fit(b,'sudden-countdown-phone')]);
  await Promise.all([a,b].map(p=>p.locator('#golf-board[data-playable=true]').waitFor()));
  assert.equal((await server.golf.recover(s.id)).finance.status,'reserved','Regulation tie keeps the pot reserved');
  // Hold one player's aim across the opponent's shot/poll; neither should block.
  await b.locator('#golf-board').scrollIntoViewIfNeeded();const box=await b.locator('#golf-board').boundingBox(),k=box.width/720,x=box.x+360*k,y=box.y+575*k;
  await b.mouse.move(x,y);await b.mouse.down();await b.mouse.move(x-34*k,y,{steps:4});
  s=await server.golf.recover(s.id);await putt(a,{...s,turn:0},{angle:0,power:.4});
  await b.waitForFunction(()=>!!window.XanSiteAdapter.view().shots[0]);assert.ok(parseInt(await b.locator('#golf-board').getAttribute('data-aim-power'))>0,'Opponent shot does not erase aim');await b.mouse.up();
  await Promise.all([a,b].map(p=>p.waitForFunction(()=>window.XanSiteAdapter.view().shots.every(Boolean))));
  let seen=await Promise.all([a,b].map(p=>p.evaluate(()=>window.XanSiteAdapter.view().shots)));assert.deepEqual(seen[0].map(shot=>[shot.id,shot.frames]),seen[1].map(shot=>[shot.id,shot.frames]));
  await fit(b,'sudden-concurrent-phone');
  await Promise.all([a,b].map(p=>p.waitForFunction(()=>window.XanSiteAdapter.view().shots.every(shot=>shot.resolved))));
  await b.reload();await b.locator('#golf-board[data-playable=true]').waitFor();assert.match(await b.locator('#golf-hole-count').innerText(),/HOLE 4/);
  await b.evaluate(()=>{window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});
  // Finish naturally from the real miss position; the second player remains
  // able to putt throughout. Verify winner, one payout, and a funded rematch.
  for(let n=0;n<12;n++){
    s=await server.golf.recover(s.id);if(s.phase==='complete')break;
    if(s.shots[0]&&!s.shots[0].resolved){await a.waitForTimeout(200);n--;continue;}
    await a.waitForFunction(rev=>window.XanSiteAdapter.view().revision>=rev&&!window.XanSiteAdapter.diagnostics().busy,s.revision);
    await putt(a,{...s,turn:0},P.botShot(M.holeFor(s),s.balls[0].position,Date.now()));
    await a.waitForFunction(old=>window.XanSiteAdapter.view().shots[0]?.id!==old,s.shots[0]?.id);
    await a.waitForFunction(()=>{const v=window.XanSiteAdapter.view();return v.phase==='complete'||v.shots[0]?.resolved;});
  }
  s=await server.golf.recover(s.id);assert.equal(s.phase,'complete');assert.equal(s.winner,0);assert.equal(s.finance.status,'settled');assert.deepEqual(s.scores,[[3,3,2],[3,3,2]]);
  await Promise.all([a,b].map(p=>p.locator('#golf-table[data-phase=complete]').waitFor()));
  assert.match(await a.locator('#golf-result').innerText(),/You take the round.*First ball in the cup/s);assert.match(await b.locator('#golf-result').innerText(),/Opponent takes the round/);await fit(b,'sudden-result-phone');
  const balances=await Promise.all([pa,pb].map(p=>server.wallet.balance(p)));assert.equal(balances[1],499000);assert.ok(balances[0]>=500934);
  await server.golf.recover(s.id);assert.deepEqual(await Promise.all([pa,pb].map(p=>server.wallet.balance(p))),balances,'No duplicate payout');
  await a.locator('#golf-next').click();await b.locator('#golf-next').click();await Promise.all([a,b].map(p=>p.locator('#golf-table[data-phase=playing]').waitFor()));
  s=await server.golf.recover(s.id);assert.equal(s.match,2);assert.equal(s.suddenDeath,false);assert.equal(s.hole,0);assert.deepEqual(s.shots,[]);assert.deepEqual(s.scores,[[],[]]);
  assert.deepEqual(await Promise.all([pa,pb].map(p=>server.wallet.balance(p))),balances.map(n=>n-1000));
  await a.close();await b.close();
}
