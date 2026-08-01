import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const rootUrl = new URL('../', import.meta.url);
const assetDirectoryUrl = new URL('assets/safe-cracker/png-ui/', rootUrl);
const expectedAssets = Object.freeze({
  'safe-body.png': {
    bytes: 14_233,
    width: 432,
    height: 561,
    sha256: 'e22b685648785a0e829235a37774802b9ed4f48bcabead86abc726748ac71eba'
  },
  'dial-face.png': {
    bytes: 7_772,
    width: 170,
    height: 170,
    sha256: 'c23d03bd2bba8c9d0ca1b6e7091fd3c29ef887296d6147226da33081140aca33'
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

console.log('Verified directly committed Safe Cracker PNG layers.');
