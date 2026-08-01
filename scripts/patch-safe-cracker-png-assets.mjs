import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const rootUrl = new URL('../', import.meta.url);
const assetDirectoryUrl = new URL('assets/safe-cracker/png-ui/', rootUrl);
const expectedAssets = Object.freeze({
  'safe-body.png': {
    bytes: 38_522,
    width: 432,
    height: 561,
    sha256: '163cea3fc0384f3dc95ffaa4de6b9ade9fd3d4059ec3352ffda2497acb064727'
  },
  'dial-face.png': {
    bytes: 11_851,
    width: 226,
    height: 226,
    sha256: 'd7996b302dc5acf9574b30f1e9245b4813e94774b63850775430cb7f75de1561'
  }
});
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function fail(message) {
  throw new Error(`Safe Cracker PNG asset validation failed: ${message}`);
}
function digest(data) {
  return createHash('sha256').update(data).digest('hex');
}

for (const [name, expected] of Object.entries(expectedAssets)) {
  const data = await readFile(new URL(name, assetDirectoryUrl));
  if (data.length !== expected.bytes) {
    fail(`${name} has ${data.length.toLocaleString('en-US')} bytes; expected ${expected.bytes.toLocaleString('en-US')}`);
  }
  if (data.length < 24 || !data.subarray(0, pngSignature.length).equals(pngSignature)) {
    fail(`${name} has an invalid PNG signature`);
  }
  const width = data.readUInt32BE(16);
  const height = data.readUInt32BE(20);
  if (width !== expected.width || height !== expected.height) {
    fail(`${name} dimensions changed to ${width}x${height}`);
  }
  if (digest(data) !== expected.sha256) {
    fail(`${name} checksum does not match the supplied reference`);
  }
}

console.log('Verified directly committed near-lossless Safe Cracker PNG layers.');
