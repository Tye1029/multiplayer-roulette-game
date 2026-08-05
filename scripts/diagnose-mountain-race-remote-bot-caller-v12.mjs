import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
let cursor = 0;
let found = 0;
while (cursor < html.length) {
  const call = html.indexOf('rnbAdoptGame(', cursor);
  if (call < 0) break;
  const before = html.slice(Math.max(0, call - 1200), call);
  if (!/function\s+$/.test(before.slice(-24))) {
    const functionIndex = Math.max(before.lastIndexOf('async function '), before.lastIndexOf('function '));
    const headerStart = functionIndex >= 0 ? Math.max(0, call - 1200 + functionIndex) : Math.max(0, call - 220);
    const headerEnd = html.indexOf('{', headerStart);
    const header = headerEnd >= 0 && headerEnd < call ? html.slice(headerStart, headerEnd + 1).replace(/\s+/g, ' ').slice(0, 500) : html.slice(Math.max(0, call - 220), call + 80).replace(/\s+/g, ' ');
    console.log(`MOUNTAIN_RACE_V12_CALLER_${found + 1}: ${header}`);
    found += 1;
  }
  cursor = call + 13;
}
if (!found) throw new Error('No generated Remote Bot adoption caller was found.');
