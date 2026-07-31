import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const rootUrl = new URL('../', import.meta.url);
const chunkDirectoryUrl = new URL('assets/safe-cracker/png-ui-v5-data/', rootUrl);
const outputDirectoryUrl = new URL('assets/safe-cracker/png-ui/', rootUrl);
const expectedChunks = Object.freeze([
  ['chunk-00.txt', 6000, 'e3033e7b8cc9eb7bf0ee15c98d692703bc828609b54d12d256c9f9c690c31bc4'],
  ['chunk-01.txt', 6000, '1f02f9f153eb960c07440fc18baf6dbb0e7c5f04f03f9394760d8956df0a26f3'],
  ['chunk-02.txt', 6000, '538bd5361762d7d9632e1fbe75f17c6d0d5df5c0c5a78b0d9ea7bcb2a60ffba9'],
  ['chunk-03.txt', 6000, '123178df6a315ac0b3cb709bda24c9ebb95c13c49f043cff9bf17e8dce1e4a03'],
  ['chunk-04.txt', 5404, 'f476eb8227da275013e5bd3af52c95e984bbec14a9f4450189c1860590cee6f8']
]);
const expectedFiles = Object.freeze({
  'safe-body.png': {
    bytes: 14233,
    sha256: 'e22b685648785a0e829235a37774802b9ed4f48bcabead86abc726748ac71eba'
  },
  'dial-face.png': {
    bytes: 7772,
    sha256: 'c23d03bd2bba8c9d0ca1b6e7091fd3c29ef887296d6147226da33081140aca33'
  }
});
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function fail(message) {
  throw new Error(`Safe Cracker PNG asset reconstruction failed: ${message}`);
}
function digest(data) {
  return createHash('sha256').update(data).digest('hex');
}

const encodedChunks = [];
for (const [name, expectedLength, expectedDigest] of expectedChunks) {
  const text = (await readFile(new URL(name, chunkDirectoryUrl), 'utf8')).replace(/\s+/g, '');
  if (text.length !== expectedLength) fail(`${name} has ${text.length} characters; expected ${expectedLength}`);
  if (digest(text) !== expectedDigest) fail(`${name} checksum does not match the verified source bundle`);
  encodedChunks.push(text);
}

const bundle = Buffer.from(encodedChunks.join(''), 'base64');
const magic = Buffer.from('SCPNG5\n', 'ascii');
let offset = 0;
if (!bundle.subarray(0, magic.length).equals(magic)) fail('bundle header is invalid');
offset += magic.length;
if (offset + 2 > bundle.length) fail('bundle file count is missing');
const fileCount = bundle.readUInt16BE(offset);
offset += 2;
if (fileCount !== Object.keys(expectedFiles).length) fail(`expected 2 files, found ${fileCount}`);

const decoded = new Map();
for (let index = 0; index < fileCount; index += 1) {
  if (offset + 2 > bundle.length) fail(`entry ${index + 1} name length is missing`);
  const nameLength = bundle.readUInt16BE(offset);
  offset += 2;
  if (!nameLength || offset + nameLength + 4 > bundle.length) fail(`entry ${index + 1} name is invalid`);
  const name = bundle.subarray(offset, offset + nameLength).toString('utf8');
  offset += nameLength;
  const dataLength = bundle.readUInt32BE(offset);
  offset += 4;
  const expectation = expectedFiles[name];
  if (!expectation) fail(`unexpected file ${name}`);
  if (decoded.has(name)) fail(`duplicate file ${name}`);
  if (dataLength !== expectation.bytes || offset + dataLength > bundle.length) fail(`${name} length is invalid`);
  const data = Buffer.from(bundle.subarray(offset, offset + dataLength));
  offset += dataLength;
  if (!data.subarray(0, pngSignature.length).equals(pngSignature)) fail(`${name} has an invalid PNG signature`);
  if (digest(data) !== expectation.sha256) fail(`${name} checksum does not match the supplied artwork`);
  decoded.set(name, data);
}
if (offset !== bundle.length) fail(`${bundle.length - offset} trailing bytes remain`);
for (const name of Object.keys(expectedFiles)) if (!decoded.has(name)) fail(`${name} is missing`);

await mkdir(outputDirectoryUrl, { recursive: true });
for (const [name, data] of decoded) await writeFile(new URL(name, outputDirectoryUrl), data);

console.log('Reconstructed verified Safe Cracker PNG layers from the compact SCPNG5 bundle.');
