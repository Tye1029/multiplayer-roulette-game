const SETTINGS_MARKER = '<!-- rr-edge-scene-settings-v1 -->';

export default async function injectRouletteSettings(request, context) {
  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('text/html')) return response;

  let html = await response.text();
  if (html.includes(SETTINGS_MARKER)) return response;

  const assets = `${SETTINGS_MARKER}
<link id="rrEdgeAtmosphereSettingsStyles" rel="stylesheet" href="/assets/roulette/atmosphere-settings.css?v=5">
<script src="/assets/roulette/lamp-config.js?v=19"></script>
<script src="/assets/roulette/lamp.js?v=20&edge-settings=1"></script>
<script src="/assets/roulette/lamp-bootstrap.js?v=19&edge-settings=1"></script>
<script src="/assets/roulette/atmosphere-settings.js?v=5"></script>`;

  if (html.includes('</body>')) html = html.replace('</body>', `${assets}\n</body>`);
  else html += assets;

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('cache-control', 'no-store, no-cache, must-revalidate');

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
