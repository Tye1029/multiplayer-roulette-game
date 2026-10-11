'use strict';
const {getDatabase}=require('@netlify/database');
const crypto=require('node:crypto');
function createStore(injected) {
  let pool=injected, schema;
  const db=()=>pool||(pool=getDatabase({connectionString:process.env.NETLIFY_DB_URL}).pool);
  async function ready(){
    schema ||= db().query(`DO $hub$ BEGIN
      PERFORM pg_advisory_xact_lock(hashtext('xan-site-hub-v1'));
      CREATE TABLE IF NOT EXISTS site_reports(id TEXT PRIMARY KEY, sender JSONB, message TEXT NOT NULL, debug JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
      CREATE INDEX IF NOT EXISTS site_reports_date ON site_reports(created_at DESC);
      CREATE TABLE IF NOT EXISTS site_report_limits(id TEXT PRIMARY KEY, bucket BIGINT NOT NULL, count INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS site_notifications(id TEXT PRIMARY KEY, owner TEXT NOT NULL, payload JSONB NOT NULL, seen BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
      CREATE INDEX IF NOT EXISTS site_notifications_owner ON site_notifications(owner,created_at DESC);
    END $hub$;`).catch(e=>{schema=null;throw e;});
    return schema;
  }
  async function report(sender, message, debug, fingerprint){
    await ready();
    const bucket=Math.floor(Date.now()/3600000);
    const key=crypto.createHash('sha256').update(sender?.id||fingerprint||'guest').digest('hex');
    const limit=await db().query(`INSERT INTO site_report_limits VALUES($1,$2,1) ON CONFLICT(id) DO UPDATE SET bucket=$2,count=CASE WHEN site_report_limits.bucket=$2 THEN site_report_limits.count+1 ELSE 1 END RETURNING count`,[key,bucket]);
    if(limit.rows[0].count>12){const e=new Error('Please wait before sending another report.');e.status=429;throw e;}
    const id=crypto.randomUUID();
    await db().query('INSERT INTO site_reports(id,sender,message,debug) VALUES($1,$2::jsonb,$3,$4::jsonb)',[id,JSON.stringify(sender),message,JSON.stringify(debug)]);
    return id;
  }
  async function notify(owner, game, focus){
    await ready();
    const payload={gameId:game.id,mode:game.mode,name:game.name,href:game.href};
    await db().query(`INSERT INTO site_notifications(id,owner,payload,seen) VALUES($1,$2,$3::jsonb,$4) ON CONFLICT(id) DO NOTHING`,['joined:'+game.id+':'+game.joiner,owner,JSON.stringify(payload),focus===game.id]);
  }
  async function notifications(owner){await ready();return (await db().query('SELECT id,payload,seen,created_at FROM site_notifications WHERE owner=$1 AND created_at>NOW()-INTERVAL \'7 days\' ORDER BY created_at DESC LIMIT 50',[owner])).rows;}
  async function read(owner, ids){await ready();await db().query('UPDATE site_notifications SET seen=TRUE WHERE owner=$1 AND id=ANY($2::text[])',[owner,ids.slice(0,50)]);}
  async function reports(before){await ready();return (await db().query('SELECT * FROM site_reports WHERE created_at<$1 ORDER BY created_at DESC LIMIT 50',[before||new Date(Date.now()+1000).toISOString()])).rows;}
  return {ready,report,notify,notifications,read,reports};
}
module.exports={...createStore(),createStore};
