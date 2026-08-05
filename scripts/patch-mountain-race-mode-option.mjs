import './patch-mountain-race-remote-bot-attach.mjs';
import './patch-mountain-race-bot-pacing-and-network-log.mjs';
import { readFile, writeFile } from 'node:fs/promises';

const indexUrl = new URL('../index.html', import.meta.url);
const start = '<!-- MOUNTAIN_RACE_MODE_OPTION_START -->';
const end = '<!-- MOUNTAIN_RACE_MODE_OPTION_END -->';
const remoteBotMarker = '<!-- MOUNTAIN_RACE_REMOTE_BOT_ATTACH_V2 -->';
const startStabilityMarker = '<!-- MOUNTAIN_RACE_START_STABILITY_V1 -->';
const networkBotLogMarker = '<!-- MOUNTAIN_RACE_NETWORK_BOT_LOG_V2 -->';
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
for (const marker of [remoteBotMarker, startStabilityMarker, networkBotLogMarker]) {
  if (!html.includes(marker)) html = `${html}\n${marker}`;
}
const htmlAnchor = html.includes('</body>') ? '</body>' : html.includes('</html>') ? '</html>' : '';
html = htmlAnchor ? html.replace(htmlAnchor, `${block}\n${htmlAnchor}`) : `${html}\n${block}\n`;
if (!html.includes(remoteBotMarker)) throw new Error('Summit Sprint mode option patch lost the Remote Bot deployment marker.');
if (!html.includes(startStabilityMarker)) throw new Error('Summit Sprint mode option patch lost the start-stability deployment marker.');
if (!html.includes(networkBotLogMarker)) throw new Error('Summit Sprint mode option patch lost the Network Bot Log deployment marker.');
await writeFile(indexUrl, html);
console.log('Ensured Summit Sprint is selectable while preserving the Remote Bot, start-stability, and Network Bot Log deployment markers.');
