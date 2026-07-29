const SETTINGS_MARKER = '<!-- rr-edge-scene-settings-v2 -->';

export default async function injectRouletteSettings(request, context) {
  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('text/html')) return response;

  let html = await response.text();
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('cache-control', 'no-store, no-cache, must-revalidate');

  if (html.includes(SETTINGS_MARKER)) {
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }

  const tags = [SETTINGS_MARKER];
  if (!html.includes('/assets/roulette/atmosphere-settings.css')) {
    tags.push('<link id="rrEdgeAtmosphereSettingsStyles" rel="stylesheet" href="/assets/roulette/atmosphere-settings.css?v=6">');
  }

  const builtSettingsPresent = html.includes('/assets/roulette/atmosphere-settings.js');
  if (!builtSettingsPresent) {
    if (!html.includes('/assets/roulette/lamp-config.js')) {
      tags.push('<script src="/assets/roulette/lamp-config.js?v=19"></script>');
    }
    if (!html.includes('/assets/roulette/lamp.js')) {
      tags.push('<script src="/assets/roulette/lamp.js?v=20&edge-settings=2"></script>');
    }
    if (!html.includes('/assets/roulette/lamp-bootstrap.js')) {
      tags.push('<script src="/assets/roulette/lamp-bootstrap.js?v=19&edge-settings=2"></script>');
    }
    tags.push('<script src="/assets/roulette/atmosphere-edge-fallback.js?v=2"></script>');
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
