import { readFile, writeFile } from 'node:fs/promises';

const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const marker = '// SAFE_CRACKER_UPLOADED_SOUNDSCAPE_CHUNKS_V2';

let client = await readFile(clientUrl, 'utf8');
if (!client.includes('// SAFE_CRACKER_UPLOADED_SOUNDSCAPE_V1_START')) {
  throw new Error('Chunked Safe Cracker soundscape requires the uploaded soundscape runtime.');
}

if (!client.includes(marker)) {
  const singleIntro = "    intro: '/assets/safe-cracker/audio-data-v2/intro-sequence.b64',";
  const chunkedIntro = [
    `    ${marker}`,
    '    intro: Object.freeze([',
    "      '/assets/safe-cracker/audio-data-v2/intro-sequence-1.b64',",
    "      '/assets/safe-cracker/audio-data-v2/intro-sequence-2.b64',",
    "      '/assets/safe-cracker/audio-data-v2/intro-sequence-3.b64',",
    "      '/assets/safe-cracker/audio-data-v2/intro-sequence-4.b64'",
    '    ]),'
  ].join('\n');
  const singleFinal = "    finalOpen: '/assets/safe-cracker/audio-data-v2/final-vault-open.b64',";
  const chunkedFinal = [
    '    finalOpen: Object.freeze([',
    "      '/assets/safe-cracker/audio-data-v2/final-vault-open-1.b64',",
    "      '/assets/safe-cracker/audio-data-v2/final-vault-open-2.b64',",
    "      '/assets/safe-cracker/audio-data-v2/final-vault-open-3.b64'",
    '    ]),'
  ].join('\n');
  if (!client.includes(singleIntro)) {
    throw new Error('Chunked Safe Cracker soundscape could not find the original intro asset.');
  }
  if (!client.includes(singleFinal)) {
    throw new Error('Chunked Safe Cracker soundscape could not find the original final-opening asset.');
  }
  client = client.replace(singleIntro, chunkedIntro);
  client = client.replace(singleFinal, chunkedFinal);
}

for (let index = 1; index <= 4; index += 1) {
  if (!client.includes(`intro-sequence-${index}.b64`)) {
    throw new Error(`Chunked Safe Cracker intro asset ${index} is missing from the runtime.`);
  }
}
for (let index = 1; index <= 3; index += 1) {
  if (!client.includes(`final-vault-open-${index}.b64`)) {
    throw new Error(`Chunked Safe Cracker final-opening asset ${index} is missing from the runtime.`);
  }
}
if (client.includes("intro: '/assets/safe-cracker/audio-data-v2/intro-sequence.b64'")) {
  throw new Error('The superseded single-file intro asset is still active.');
}
if (client.includes("finalOpen: '/assets/safe-cracker/audio-data-v2/final-vault-open.b64'")) {
  throw new Error('The superseded single-file final-opening asset is still active.');
}
await writeFile(clientUrl, client);

let html = await readFile(indexUrl, 'utf8');
html = html.replace(/\/assets\/safe-cracker\/safe-cracker\.js\?[^"'\s]*/g, value => {
  const clean = value.replace(/&soundscape=\d+/g, '');
  return `${clean}&soundscape=3`;
});
await writeFile(indexUrl, html);

console.log('Applied uploaded Safe Cracker soundscape chunks v3: the complete intro and final vault-opening blends are delivered in exact segments and reassembled before decoding.');
