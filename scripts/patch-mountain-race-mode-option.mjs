import { readFile, writeFile } from 'node:fs/promises';

const indexUrl = new URL('../index.html', import.meta.url);
const start = '<!-- MOUNTAIN_RACE_MODE_OPTION_START -->';
const end = '<!-- MOUNTAIN_RACE_MODE_OPTION_END -->';
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pattern = new RegExp(`${escape(start)}[\\s\\S]*?${escape(end)}\\s*`, 'm');

const block = `${start}
<script id="mountainRaceModeOptionBootstrap">
(() => {
  const ensureMountainRaceMode = () => {
    const select = document.getElementById('duelModeSelect') || [...document.querySelectorAll('select')].find(candidate => [...candidate.options].some(option => option.value === 'safecracker'));
    if (!select || [...select.options].some(option => option.value === 'mountainrace')) return;
    const option = document.createElement('option');
    option.value = 'mountainrace';
    option.textContent = 'Summit Sprint';
    select.append(option);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureMountainRaceMode, { once: true });
  else ensureMountainRaceMode();
})();
</script>
${end}`;

let html = await readFile(indexUrl, 'utf8');
html = html.replace(pattern, '');
if (!html.includes('</body>')) throw new Error('Summit Sprint mode option patch could not find </body>.');
html = html.replace('</body>', `${block}\n</body>`);
await writeFile(indexUrl, html);
console.log('Ensured Summit Sprint is a selectable value in the shared multiplayer game creator.');
