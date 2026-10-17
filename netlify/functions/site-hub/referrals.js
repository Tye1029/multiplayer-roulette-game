'use strict';
const crypto=require('node:crypto');
const {getDatabase}=require('@netlify/database');
const REWARD=500000,WINDOW_MS=24*60*60*1000;
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
function createStore(injectedPool,injectedWallet,readRecord,now=Date.now){
 let pool=injectedPool,schema;
 const db=()=>pool||(pool=getDatabase({connectionString:process.env.NETLIFY_DB_URL}).pool);
 const wallet=injectedWallet||require('../rps/wallet');
 const record=readRecord||require('../_data').getUserRecord;
 async function ready(){schema||=db().query(`DO $referrals$ BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('xan-referrals-v1'));
  CREATE TABLE IF NOT EXISTS xan_referral_accounts(owner TEXT PRIMARY KEY,account TEXT NOT NULL,code TEXT UNIQUE NOT NULL,expires_at BIGINT NOT NULL);
  CREATE TABLE IF NOT EXISTS xan_referral_claims(referred TEXT PRIMARY KEY,referrer TEXT NOT NULL,account TEXT NOT NULL,paid BOOLEAN NOT NULL DEFAULT FALSE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),CHECK(referred<>referrer));
  CREATE INDEX IF NOT EXISTS xan_referral_owner ON xan_referral_claims(referrer);
 END $referrals$;`).catch(e=>{schema=null;throw e;});return schema;}
 async function ensure(player){
  if(!/^[1-9]\d*$/.test(String(player?.id)))fail('Connect your Torn API key first.',401);
  await ready();const account=await wallet.account(player),r=await record(account);
  if(!r?.userId)fail('Connect your account on the home page first.');
  // Eligibility comes from the original server-owned signup timestamp. A new
  // API key, browser or visitor ID cannot reset it or create another identity.
  const joined=Date.parse(r.firstConnectedAt||''),expires=Number.isFinite(joined)&&joined<=now()?joined+WINDOW_MS:0;
  for(let attempt=0;attempt<4;attempt++){
   await db().query('INSERT INTO xan_referral_accounts(owner,account,code,expires_at) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[String(player.id),account,'XD'+crypto.randomBytes(5).toString('hex').toUpperCase(),expires]);
   const row=(await db().query('SELECT * FROM xan_referral_accounts WHERE owner=$1',[String(player.id)])).rows[0];if(row)return row;
  }throw Error('Unable to allocate referral code.');
 }
 async function recover(owner){
  const rows=(await db().query('SELECT * FROM xan_referral_claims WHERE (referrer=$1 OR referred=$1) AND paid=FALSE',[String(owner)])).rows;
  for(const r of rows){await wallet.apply(r.account,{id:`referral:${r.referrer}:${r.referred}`,delta:REWARD,reason:'Verified new-player referral'});await db().query('UPDATE xan_referral_claims SET paid=TRUE WHERE referred=$1',[r.referred]);}
 }
 async function profile(player){
  const own=await ensure(player);await recover(player.id);
  const claimed=(await db().query('SELECT referred FROM xan_referral_claims WHERE referred=$1',[String(player.id)])).rows.length>0;
  const count=Number((await db().query('SELECT COUNT(*)::int AS count FROM xan_referral_claims WHERE referrer=$1 AND paid=TRUE',[String(player.id)])).rows[0].count);
  return {code:own.code,count,earned:count*REWARD,reward:REWARD,claimed,canClaim:!claimed&&Number(own.expires_at)>=now()};
 }
 async function claim(player,input){
  if(typeof input!=='string'||!/^XD[A-F0-9]{10}$/i.test(input.trim()))fail('Enter a valid referral code.',400);
  const code=input.trim().toUpperCase(),own=await ensure(player),c=await db().connect();
  try{
   await c.query('BEGIN');
   // Serialize graph changes so simultaneous A→B / B→A claims cannot both
   // pass the cycle check. Wallet recovery remains outside this transaction.
   await c.query("SELECT pg_advisory_xact_lock(hashtext('xan-referral-claims-v1'))");
   await c.query('SELECT owner FROM xan_referral_accounts WHERE owner=$1 FOR UPDATE',[String(player.id)]);
   const sponsor=(await c.query('SELECT owner,account,expires_at FROM xan_referral_accounts WHERE code=$1',[code])).rows[0];if(!sponsor)fail('Referral code not found.',400);
   if(sponsor.owner===String(player.id)||sponsor.account===own.account)fail('You cannot refer yourself.');
   const prior=(await c.query('SELECT referrer FROM xan_referral_claims WHERE referred=$1',[String(player.id)])).rows[0];
   if(prior&&prior.referrer!==sponsor.owner)fail('A referral has already been applied to this account.');
   if(!prior){
    if(Number(own.expires_at)<now())fail('Referral codes must be added within 24 hours of your first signup.');
    // Both expiry timestamps use the same fixed window from original signup.
    if(Number(sponsor.expires_at)>Number(own.expires_at))fail('Your referrer must have joined before you.');
    const cycle=await c.query('WITH RECURSIVE chain(owner) AS (SELECT $1::text UNION SELECT r.referrer FROM xan_referral_claims r JOIN chain c ON r.referred=c.owner) SELECT owner FROM chain WHERE owner=$2',[sponsor.owner,String(player.id)]);
    if(cycle.rows.length)fail('Referral loops are not eligible for rewards.');
    await c.query('INSERT INTO xan_referral_claims(referred,referrer,account) VALUES($1,$2,$3)',[String(player.id),sponsor.owner,sponsor.account]);
   }
   await c.query('COMMIT');
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
  return profile(player);
 }
 return {ready,profile,claim,recover};
}
module.exports={...createStore(),createStore,REWARD};
