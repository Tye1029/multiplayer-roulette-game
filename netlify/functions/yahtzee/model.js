'use strict';
const {randomInt} = require('node:crypto');
const rules = require('../../../assets/yahtzee/rules');
function fail(message, status = 409) { throw Object.assign(new Error(message), {status}); }
function player(id, name) {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 20) fail('Use a name between 1 and 20 characters.', 400);
  return {id, name: name.trim(), card: {}, bonus: 0};
}
function fresh(id, who, now = Date.now()) {
  return {id, phase:'waiting', players:[who], revision:1, round:1, active:0, dice:[], held:[false,false,false,false,false], rolls:0, requests:[], rematch:[], createdAt:now, expiresAt:now+86400000, game:1, last:null};
}
function resetTurn(s) { s.dice=[]; s.held.fill(false); s.rolls=0; }
function act(s, id, b, roll = () => randomInt(1,7)) {
  const p = s.players.find(p => p.id === id);
  if (!p) fail('Join this room first.',403);
  if (b.action === 'start') {
    if (s.phase !== 'waiting' || s.players[0].id !== id || s.players.length < 2) fail('The host can start when at least two players have joined.');
    s.phase='playing'; return;
  }
  if (b.action === 'leave') {
    if (s.phase === 'waiting') { s.players=s.players.filter(p=>p.id!==id); if (!s.players.length) s.phase='closed'; }
    else if (s.phase === 'playing') { s.phase='closed'; s.last={text:p.name+' ended the game.'}; }
    return;
  }
  if (b.action === 'rematch') {
    if (s.phase !== 'complete') fail('Finish this game first.');
    if (!s.rematch.includes(id)) s.rematch.push(id);
    if (s.rematch.length === s.players.length) {
      s.players.forEach(p=>{p.card={};p.bonus=0;}); s.game++; s.active=(s.game-1)%s.players.length;
      s.round=1; s.phase='playing'; s.rematch=[]; s.last=null; resetTurn(s);
    }
    return;
  }
  if (s.phase !== 'playing' || s.players[s.active].id !== id) fail('Wait for your turn.');
  if (b.action === 'roll') {
    if (s.rolls >= 3) fail('Choose a score to finish this turn.');
    if (s.rolls && s.held.every(Boolean)) fail('Release a die or choose a score.');
    s.dice=Array.from({length:5},(_,i)=>s.held[i]?s.dice[i]:roll()); s.rolls++; return;
  }
  if (b.action === 'hold') {
    if (!s.rolls || s.rolls >= 3 || !Number.isInteger(b.index) || b.index < 0 || b.index > 4 || typeof b.held !== 'boolean') fail('You cannot hold that die now.',400);
    s.held[b.index]=b.held; return;
  }
  if (b.action === 'score') {
    const options=rules.options(s.dice,p.card);
    if (!s.rolls || !Object.hasOwn(options,b.category)) fail('Choose an available category.',400);
    const bonus=rules.score(s.dice,'yahtzee')===50 && p.card.yahtzee===50 ? 100 : 0;
    p.bonus+=bonus; p.card[b.category]=options[b.category];
    s.last={text:p.name+' scored '+options[b.category]+' in '+rules.categories.find(c=>c[0]===b.category)[1]+(bonus?' · +100 bonus!':''),dice:[...s.dice],category:b.category};
    if (s.players.every(p=>Object.keys(p.card).length===13)) s.phase='complete';
    else { s.active=(s.active+1)%s.players.length; s.round=Math.min(...s.players.map(p=>Object.keys(p.card).length))+1; }
    resetTurn(s); return;
  }
  fail('Unknown action.',400);
}
function publicState(s, id) {
  const {requests, ...view}=s;
  return {...view, you:id, players:s.players.map(p=>({...p,yahtzeeBonus:p.bonus,...rules.totals(p)}))};
}
module.exports={fail,player,fresh,act,publicState};
