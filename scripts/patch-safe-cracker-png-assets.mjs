import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';

const rootUrl = new URL('../', import.meta.url);
const chunkDirectoryUrl = new URL('assets/safe-cracker/png-ui-tiny-data/', rootUrl);
const outputDirectoryUrl = new URL('assets/safe-cracker/png-ui/', rootUrl);
const expectedNames = Object.freeze([
  'safe-body.png',
  'dial-face.png',
  'dial-rim-pointer.png',
  'dial-hub.png',
  'button-minus.png',
  'button-plus.png',
  'button-check-frame.png'
]);
const expectedSet = new Set(expectedNames);
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function fail(message) {
  throw new Error(`Safe Cracker PNG asset reconstruction failed: ${message}`);
}

const chunkNames = (await readdir(chunkDirectoryUrl))
  .filter(name => /^bundle-\d+\.txt$/i.test(name))
  .sort((left, right) => left.localeCompare(right, 'en', { numeric: true }));
if (!chunkNames.length) fail('no Base64 bundle chunks were found');

const rawEncoded = (await Promise.all(
  chunkNames.map(name => readFile(new URL(name, chunkDirectoryUrl), 'utf8'))
)).join('').replace(/\s+/g, '');
if (!rawEncoded.length) fail('the Base64 bundle is empty');
const encoded = rawEncoded + '='.repeat((4 - (rawEncoded.length % 4)) % 4);

const bundle = Buffer.from(encoded, 'base64');
let offset = 0;
const magic = Buffer.from('SCPNG1\n', 'ascii');
if (bundle.length < magic.length + 2 || !bundle.subarray(0, magic.length).equals(magic)) {
  fail('the bundle magic header is invalid');
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
console.log(`Reconstructed Safe Cracker hybrid PNG assets: ${summary}.`);
