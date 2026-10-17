'use strict';
const {getDatabase}=require('@netlify/database');
let pool;
// Legacy Blobs lobbies have separate room and wallet writes. Serialize their
// create/join/cancel boundary across function workers; turn input is unaffected.
async function withLifecycleLock(work){
 pool ||= getDatabase({connectionString:process.env.NETLIFY_DB_URL}).pool;
 const client=await pool.connect();
 try{await client.query("SELECT pg_advisory_lock(hashtext('xan-legacy-room-lifecycle-v1'))");return await work();}
 finally{try{await client.query("SELECT pg_advisory_unlock(hashtext('xan-legacy-room-lifecycle-v1'))");}finally{client.release();}}
}
module.exports={withLifecycleLock};
