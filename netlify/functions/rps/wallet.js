'use strict';
const { getStore } = require('@netlify/blobs');
const { getRecordBalance, getGameOddsSettings } = require('../_data');

// Use the existing Chips ledger. Conditional writes preserve concurrent changes;
// persistent match intents and stable entry IDs make cross-store retries safe.
function createWallet(injectedStore, odds = getGameOddsSettings) {
  const store = () => injectedStore || getStore('torn-xan-users');
  const valid = id => /^[0-9A-Za-z_-]+$/.test(String(id || ''));
  async function account(player) {
    if (!/^[1-9]\d*$/.test(player.id)) throw new Error('Invalid verified player.');
    const link = await store().get(`torn-link/${player.id}.json`,{type:'json',consistency:'strong'});
    const id = link?.userId || player.id;
    if (!valid(id)) throw new Error('Invalid wallet account.');
    return String(id);
  }
  async function balance(player) {
    const id = await account(player);
    return getRecordBalance(await store().get(`user/${id}.json`,{type:'json',consistency:'strong'}));
  }
  async function apply(accountId, entry) {
    if (!valid(accountId) || !/^(rps|four|bluff|yahtzee):[A-F0-9]{12}:(stake|refund|payout):[1-9]\d*$/.test(entry.id) || !Number.isSafeInteger(entry.delta)) throw new Error('Invalid wallet entry.');
    const key = `user/${accountId}.json`;
    for (let attempt=0;attempt<8;attempt++) {
      const read = await store().getWithMetadata(key,{type:'json',consistency:'strong'});
      const raw = read?.data;
      if (!raw || raw.balanceUnit!=='tickets') {const e=new Error('Open the main site to sync your Chips balance first.');e.status=409;e.code="RPS_FUNDS";throw e;}
      if ((raw.financialLedger||[]).some(e=>e.id===entry.id)) return getRecordBalance(raw);
      const current = getRecordBalance(raw);
      if (entry.delta<0 && current < -entry.delta) {const e=new Error('Not enough Chips for this wager.');e.status=409;e.code="RPS_FUNDS";throw e;}
      const at = new Date().toISOString();
      const record = raw.ledgerStartedAt ? {...raw} : {...raw,ledgerStartedAt:at,balanceBaseline:current,financialLedger:[]};
      record.financialLedger=[...(record.financialLedger||[]),{...entry,at,amount:Math.abs(entry.delta),ticketId:entry.id,type:entry.delta<0?'rps_wager':entry.id.includes(':refund:')?'rps_refund':'rps_payout'}];
      record.currentBalance=current+entry.delta;
      if (entry.delta<0) record.totalWagered=Number(record.totalWagered||0)-entry.delta;
      else if(entry.id.includes(':refund:'))record.totalWagered=Math.max(0,Number(record.totalWagered||0)-entry.delta);
      else record.totalWon=Number(record.totalWon||0)+entry.delta;
      // Leave active tickets and every unrelated record field untouched.
      if(!read.etag)throw new Error('Wallet revision unavailable.');
      const result=await store().setJSON(key,record,{onlyIfMatch:read.etag});
      if(result.modified)return record.currentBalance;
    }
    throw new Error('Wallet busy. Retry this request.');
  }
  async function rate() {const value=Number((await odds()).multiplayer.houseCutPercent);return Number.isFinite(value)?Math.max(0,Math.min(25,value)):3.3;}
  return {account,balance,apply,rate};
}
module.exports={...createWallet(),createWallet};
