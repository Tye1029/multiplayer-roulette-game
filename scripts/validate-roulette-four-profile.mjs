import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { handler } = require('../netlify/functions/roulette-four-profile.js');
const savedFetch = globalThis.fetch;
let calls = 0;
try {
  globalThis.fetch = async url => {
    calls++; assert.equal(new URL(url).origin, 'https://api.torn.com');
    return { ok: true, json: async () => ({ player_id: 123, name: 'Tester', gender: 'Female', profile_image: 'https://example.com/profile.png', unrelated_private_field: 'excluded' }) };
  };
  assert.equal((await handler({ httpMethod: 'GET' })).statusCode, 405);
  assert.equal((await handler({ httpMethod: 'POST', body: '{' })).statusCode, 400);
  assert.equal((await handler({ httpMethod: 'POST', body: JSON.stringify({ visitorKey: 'bad' }) })).statusCode, 400);
  assert.equal((await handler({ httpMethod: 'POST', body: ' '.repeat(1025) })).statusCode, 413);
  assert.equal(calls, 0);
  const event = { httpMethod: 'POST', body: JSON.stringify({ visitorKey: 'TESTPROFILEKEY00' }) };
  const response = await handler(event);
  assert.equal(response.statusCode, 200); assert.equal(response.headers['Cache-Control'], 'no-store');
  assert.deepEqual(JSON.parse(response.body).profile, { id: '123', name: 'Tester', gender: 'female', avatar: 'https://example.com/profile.png' });
  assert(!response.body.includes('TESTPROFILEKEY00')); assert(!response.body.includes('excluded'));
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ player_id: 1, name: 'Guest', gender: 'Unknown', profile_image: 'javascript:alert(1)' }) });
  assert.equal(JSON.parse((await handler(event)).body).profile.avatar, null);
  globalThis.fetch = async () => { throw Error('TESTPROFILEKEY00 sensitive upstream detail'); };
  const error = await handler(event); assert.equal(error.statusCode, 502); assert(!error.body.includes('TESTPROFILEKEY00'));
} finally { globalThis.fetch = savedFetch; }
console.log('Four-player profile validated: read-only lookup, fixed upstream, field allowlist, safe image URL, key exclusion and guest fallback.');
