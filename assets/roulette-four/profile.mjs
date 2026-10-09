export async function loadProfile() {
  let key, id;
  try { key = localStorage.getItem('tornVisitorApiKey'); id = localStorage.getItem('tornKeyConfirmedUserId'); } catch {}
  if (!key) return { status: 'guest', message: 'Connect your Torn API key in the lobby to use your name and profile picture automatically.' };
  const cacheKey = 'rouletteFourProfileV1';
  try {
    const cached = JSON.parse(sessionStorage.getItem(cacheKey));
    if (id && cached?.profile?.id === id && Date.now() - cached.at < 600000) return { status: 'connected', profile: cached.profile };
  } catch {}
  try {
    const response = await fetch('/.netlify/functions/roulette-four-profile', { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visitorKey: key }), signal: AbortSignal.timeout(10000) });
    const data = await response.json();
    if (!response.ok || !data.ok) return { status: 'unavailable', message: data.error || 'Profile unavailable. Guest play is still available.' };
    try { sessionStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), profile: data.profile })); } catch {}
    return { status: 'connected', profile: data.profile };
  } catch { return { status: 'unavailable', message: 'Profile unavailable. Guest play is still available.' }; }
}
