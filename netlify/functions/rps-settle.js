'use strict';
const {sweep}=require('./rps/database');
// Recover committed payment intents and expire abandoned wagered arenas.
// Netlify schedules run on published deploys only. Preview requests recover
// a player's pending settlements through lobby/create/join/get instead.
exports.default=async()=>new Response(JSON.stringify({rps:await sweep(),four:await require('./roulette-four/database').sweep()}),{headers:{'Content-Type':'application/json'}});
exports.config={schedule:'* * * * *'};
