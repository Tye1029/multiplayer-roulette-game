import { readFile, writeFile } from 'node:fs/promises';

const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const v21Start = '// SAFE_CRACKER_DIAL_SAMPLE_V21_START';
const v21End = '// SAFE_CRACKER_DIAL_SAMPLE_V21_END';
const v22Start = '// SAFE_CRACKER_DIAL_SAMPLE_V22_START';
const v22End = '// SAFE_CRACKER_DIAL_SAMPLE_V22_END';

let client = await readFile(clientUrl, 'utf8');
const from = client.indexOf(v21Start);
const to = client.indexOf(v21End, from);
if (from < 0 || to < 0) throw new Error('Metallic click v22 requires the generated v21 native dial section.');

const sectionEnd = to + v21End.length;
let section = client.slice(from, sectionEnd);
section = section
  .replaceAll('V21', 'V22')
  .replaceAll('v21', 'v22')
  .replaceAll('?clicks=21', '?clicks=22')
  .replaceAll('BankVault', 'MetallicClick')
  .replaceAll('bank-vault', 'metallic-click');

if (!section.includes(v22Start) || !section.includes(v22End)) {
  throw new Error('Metallic click v22 could not advance the native dial section markers.');
}
if (!section.includes("fetch(url + '?clicks=22'")) {
  throw new Error('Metallic click v22 did not advance the sample cache key.');
}
if (!section.includes('safeCrackerStartSmoothVaultRoomToneV22')) {
  throw new Error('Metallic click v22 must preserve the smooth transient-free room tone.');
}

client = client.slice(0, from) + section + client.slice(sectionEnd);
await writeFile(clientUrl, client);

let html = await readFile(indexUrl, 'utf8');
html = html.replace(/\/assets\/safe-cracker\/safe-cracker\.js\?[^"'\s]*/g, value => {
  const clean = value.replace(/&clicks=\d+/g, '');
  return `${clean}&clicks=22`;
});
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker dial sample v22: the six user-supplied metallic clicks replace the previous dial bank, while the smooth room tone and result cues remain unchanged.');
