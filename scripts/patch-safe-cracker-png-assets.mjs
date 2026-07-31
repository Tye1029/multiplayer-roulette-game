import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';

const rootUrl = new URL('../', import.meta.url);
const chunkDirectoryUrl = new URL('assets/safe-cracker/png-ui-v2-data/', rootUrl);
const outputDirectoryUrl = new URL('assets/safe-cracker/png-ui/', rootUrl);
const expectedNames = Object.freeze([
  'safe-body.png',
  'dial-face.png'
]);
const expectedSet = new Set(expectedNames);
const expectedChunks = Object.freeze({
  'bundle-00.txt': { length: 12000, sha256: '30a7572cb77cbcf3aa9d2ca9ab3f2e1e2dcdc1731514474bbf15086a4ab1d2b6' },
  'bundle-01.txt': { length: 12000, sha256: '79835c7b9f100e1f6b3357f4d2cdbc5f510c3d3189cece1afa40f4e8b5fca7d7' },
  'bundle-02.txt': { length: 12000, sha256: '80635fd195ab19a11ff050e61cca0d697c709d7babcaf1c6d3a38b5b9aaa2f25' },
  'bundle-03.txt': { length: 12000, sha256: 'e24d5a648b6155631e5cd552041ba1ef4aedade54508b01e588227ef9a49bb4e' },
  'bundle-04.txt': { length: 12000, sha256: 'df4c92c5d71e3b9e36970f7dad4fe07c51a6bfeddd03682087d40762ab7ae6b0' },
  'bundle-05.txt': { length: 12000, sha256: '18607f28d7531e87a4aaf07666577cdb9fc240a667ade6d4a6c4fe477857c182' },
  'bundle-06.txt': { length: 2660, sha256: '863a7b927ad219812043f8a18f3451a6a1d496d6e2f33e03665024dea2429fb2' }
});
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function fail(message) {
  throw new Error(`Safe Cracker PNG asset reconstruction failed: ${message}`);
}

const chunkNames = (await readdir(chunkDirectoryUrl))
  .filter(name => /^bundle-\d+\.txt$/i.test(name))
  .sort((left, right) => left.localeCompare(right, 'en', { numeric: true }));
const expectedChunkNames = Object.keys(expectedChunks);
if (chunkNames.join('\n') !== expectedChunkNames.join('\n')) {
  fail(`expected chunks ${expectedChunkNames.join(', ')}, found ${chunkNames.join(', ') || 'none'}`);
}

const normalizedChunks = [];
for (const name of chunkNames) {
  const raw = (await readFile(new URL(name, chunkDirectoryUrl), 'utf8')).replace(/\s+/g, '');
  const expectation = expectedChunks[name];
  if (raw.length < expectation.length) {
    fail(`${name} has ${raw.length.toLocaleString('en-US')} characters; expected at least ${expectation.length.toLocaleString('en-US')}`);
  }
  const normalized = raw.slice(0, expectation.length);
  const digest = createHash('sha256').update(normalized, 'utf8').digest('hex');
  if (digest !== expectation.sha256) {
    fail(`${name} prefix SHA-256 is ${digest}; expected ${expectation.sha256}`);
  }
  if (raw.length > expectation.length) {
    console.log(`Ignoring ${raw.length - expectation.length} duplicate trailing characters in ${name}.`);
  }
  normalizedChunks.push(normalized);
}

const rawEncoded = normalizedChunks.join('');
if (!rawEncoded.length) fail('the Base64 bundle is empty');
const encoded = rawEncoded + '='.repeat((4 - (rawEncoded.length % 4)) % 4);

const bundle = Buffer.from(encoded, 'base64');
let offset = 0;
const magic = Buffer.from('SCPNG2\n', 'ascii');
if (bundle.length < magic.length + 2 || !bundle.subarray(0, magic.length).equals(magic)) {
  fail('the supplied-reference bundle magic header is invalid');
}
offset += magic.length;
const fileCount = bundle.readUInt16BE(offset);
offset += 2;
if (fileCount !== expectedNames.length) fail(`expected ${expectedNames.length} files, found ${fileCount}`);

const entries = new Map();
for (let index = 0; index < fileCount; index += 1) {
  if (offset + 2 > bundle.length) fail(`entry ${index + 1} is missing its name length`);
  const nameLength = bundle.readUInt16BE(offset);
  offset += 2;
  if (!nameLength || offset + nameLength + 4 > bundle.length) fail(`entry ${index + 1} has an invalid name`);
  const name = bundle.subarray(offset, offset + nameLength).toString('utf8');
  offset += nameLength;
  const dataLength = bundle.readUInt32BE(offset);
  offset += 4;
  if (!expectedSet.has(name)) fail(`unexpected file ${name}`);
  if (entries.has(name)) fail(`duplicate file ${name}`);
  if (!dataLength || offset + dataLength > bundle.length) {
    fail(`file ${name} is truncated (${Math.max(0, bundle.length - offset).toLocaleString('en-US')} of ${dataLength.toLocaleString('en-US')} bytes available)`);
  }
  const data = bundle.subarray(offset, offset + dataLength);
  offset += dataLength;
  if (data.length < pngSignature.length || !data.subarray(0, pngSignature.length).equals(pngSignature)) {
    fail(`${name} is not a PNG payload`);
  }
  entries.set(name, Buffer.from(data));
}
if (offset !== bundle.length) fail(`${bundle.length - offset} trailing bytes remain after parsing`);
for (const name of expectedNames) if (!entries.has(name)) fail(`required file ${name} is missing`);

await mkdir(outputDirectoryUrl, { recursive: true });
for (const name of expectedNames) await writeFile(new URL(name, outputDirectoryUrl), entries.get(name));

const summary = expectedNames.map(name => `${name} (${entries.get(name).length.toLocaleString('en-US')} bytes)`).join(', ');
console.log(`Reconstructed the supplied Safe Cracker reference as two live-site PNG layers: ${summary}.`);
