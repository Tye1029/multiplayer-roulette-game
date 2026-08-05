import { readFile, writeFile } from 'node:fs/promises';

// Remote Bot attachment and Network Bot pacing are executed explicitly and
// sequentially by the package build before this file. Do not side-effect import
// file-writing patch modules here: sibling top-level-await imports can overlap
// reads and writes to index.html and make the generated page nondeterministic.
const indexUrl = new URL('../index.html', import.meta.url);
const start = '<!-- MOUNTAIN_RACE_MODE_OPTION_START -->';
const end = '<!-- MOUNTAIN_RACE_MODE_OPTION_END -->';
const remoteBotMarker = '<!-- MOUNTAIN_RACE_REMOTE_BOT_ATTACH_V2 -->';
const startStabilityMarker = '<!-- MOUNTAIN_RACE_START_STABILITY_V1 -->';
const networkBotLogMarker = '<!-- MOUNTAIN_RACE_NETWORK_BOT_LOG_V2 -->';
const networkBotLogLoopGuard = "      if (text === 'Network Bot Log' && element.dataset.networkBotLog === 'true') continue;";
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

// The Network Bot Log observer watches child-list mutations. Reassigning the
// same text on every observer callback creates a self-triggering mutation loop
// that can pin the browser main thread and make the entire site appear unable
// to load. Once an element is already normalized, leave it untouched.
if (!html.includes(networkBotLogLoopGuard)) {
  html = html.replace(
    "      if (!explicitLog && !pairedTab) continue;\n      element.textContent = 'Network Bot Log';",
    `      if (!explicitLog && !pairedTab) continue;\n${networkBotLogLoopGuard}\n      element.textContent = 'Network Bot Log';`
  );
}

for (const marker of [remoteBotMarker, startStabilityMarker, networkBotLogMarker]) {
  if (!html.includes(marker)) html = `${html}\n${marker}`;
}
const htmlAnchor = html.includes('</body>') ? '</body>' : html.includes('</html>') ? '</html>' : '';
html = htmlAnchor ? html.replace(htmlAnchor, `${block}\n${htmlAnchor}`) : `${html}\n${block}\n`;
if (!html.includes(remoteBotMarker)) throw new Error('Summit Sprint mode option patch lost the Remote Bot deployment marker.');
if (!html.includes(startStabilityMarker)) throw new Error('Summit Sprint mode option patch lost the start-stability deployment marker.');
if (!html.includes(networkBotLogMarker)) throw new Error('Summit Sprint mode option patch lost the Network Bot Log deployment marker.');
if (!html.includes(networkBotLogLoopGuard)) throw new Error('Summit Sprint mode option patch could not install the Network Bot Log mutation-loop guard.');
await writeFile(indexUrl, html);
console.log('Ensured Summit Sprint is selectable with deterministic sequential patch ownership, preserved deployment markers, and prevented the Network Bot Log observer from freezing the page.');
