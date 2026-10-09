// Read-only Torn profile lookup for the local practice table; no account writes.
exports.handler = async event => {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  const reply = (statusCode, data) => ({ statusCode, headers, body: JSON.stringify(data) });
  if (event.httpMethod !== 'POST') return reply(405, { error: 'Use POST.' });
  if ((event.body || '').length > 1024) return reply(413, { error: 'Request too large.' });
  let key;
  try { key = JSON.parse(event.body || '{}').visitorKey; } catch { return reply(400, { error: 'Invalid request.' }); }
  if (typeof key !== 'string' || !/^[A-Za-z0-9]{8,64}$/.test(key)) return reply(400, { error: 'Connect your Torn API key in the lobby first.' });
  try {
    const response = await fetch(`https://api.torn.com/user/?selections=profile&key=${encodeURIComponent(key)}&comment=xans-four-player-profile`, {
      signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'Xan-Duels-Four-Player/1.0' }
    });
    if (!response.ok) return reply(502, { error: 'Torn profile is temporarily unavailable.' });
    const data = await response.json(), p = data.profile || data;
    if (data.error || !(p.player_id || p.id)) return reply(400, { error: 'Torn could not verify this profile. Check your saved key.' });
    let avatar = null;
    try { const url = new URL(p.profile_image || p.image || ''); if (url.protocol === 'https:') avatar = url.href; } catch {}
    return reply(200, { ok: true, profile: { id: String(p.player_id || p.id), name: String(p.name || 'Player').slice(0, 40),
      gender: /^(male|female|enby)$/i.test(p.gender) ? p.gender.toLowerCase() : 'unknown', avatar } });
  } catch { return reply(502, { error: 'Torn profile is temporarily unavailable. You can still play as a guest.' }); }
};
