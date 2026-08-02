import { readFile, writeFile } from 'node:fs/promises';

const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const marker = '// SAFE_CRACKER_UPLOADED_SOUNDSCAPE_CHUNKS_V2';

let client = await readFile(clientUrl, 'utf8');
if (!client.includes('// SAFE_CRACKER_UPLOADED_SOUNDSCAPE_V1_START')) {
  throw new Error('Chunked Safe Cracker soundscape requires the uploaded soundscape runtime.');
}

if (!client.includes(marker)) {
  const singleFinal = "    finalOpen: '/assets/safe-cracker/audio-data-v2/final-vault-open.b64',";
  const chunkedFinal = [
    `    ${marker}`,
    '    finalOpen: Object.freeze([',
    "      '/assets/safe-cracker/audio-data-v2/final-vault-open-1.b64',",
    "      '/assets/safe-cracker/audio-data-v2/final-vault-open-2.b64',",
    "      '/assets/safe-cracker/audio-data-v2/final-vault-open-3.b64'",
    '    ]),'
  ].join('\n');
  if (!client.includes(singleFinal)) {
    throw new Error('Chunked Safe Cracker soundscape could not find the original final-opening asset.');
  }
  client = client.replace(singleFinal, chunkedFinal);
}

for (let index = 1; index <= 3; index += 1) {
  if (!client.includes(`final-vault-open-${index}.b64`)) {
    throw new Error(`Chunked Safe Cracker final-opening asset ${index} is missing from the runtime.`);
  }
}
if (client.includes("finalOpen: '/assets/safe-cracker/audio-data-v2/final-vault-open.b64'")) {
  throw new Error('The superseded single-file final-opening asset is still active.');
}
await writeFile(clientUrl, client);

let html = await readFile(indexUrl, 'utf8');
html = html.replace(/\/assets\/safe-cracker\/safe-cracker\.js\?[^"'\s]*/g, value => {
  const clean = value.replace(/&soundscape=\d+/g, '');
  return `${clean}&soundscape=2`;
});
await writeFile(indexUrl, html);

console.log('Applied uploaded Safe Cracker soundscape chunks v2: the complete final vault-opening blend is delivered in three exact segments and reassembled before decoding.');
