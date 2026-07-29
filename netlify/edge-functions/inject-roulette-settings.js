const SMOKE_MARKER = '<!-- rr-edge-permanent-smoke-v2 -->';

export default async function injectRouletteSmoke(request, context) {
  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('text/html')) return response;

  let html = await response.text();
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('cache-control', 'no-store, no-cache, must-revalidate');

  if (html.includes(SMOKE_MARKER)) {
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }

  const tags = [SMOKE_MARKER];
  if (!html.includes('/assets/roulette/smoke.css?v=2')) {
    tags.push('<link id="rrEdgePermanentSmokeStyles" rel="stylesheet" href="/assets/roulette/smoke.css?v=2">');
  }
  if (!html.includes('/assets/roulette/lamp-config.js')) {
    tags.push('<script src="/assets/roulette/lamp-config.js?v=19"></script>');
  }
  if (!html.includes('/assets/roulette/smoke.js?v=2')) {
    tags.push('<script src="/assets/roulette/smoke.js?v=2"></script>');
  }

  const assets = tags.join('\n');
  if (html.includes('</body>')) html = html.replace('</body>', `${assets}\n</body>`);
  else html += assets;

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export const config = {
  path: '/*',
  excludedPath: [
    '/assets/*',
    '/.netlify/*',
    '/netlify/*',
    '/*.css',
    '/*.js',
    '/*.png',
    '/*.jpg',
    '/*.jpeg',
    '/*.webp',
    '/*.gif',
    '/*.mp3',
    '/*.m4a',
    '/*.wav'
  ]
};
