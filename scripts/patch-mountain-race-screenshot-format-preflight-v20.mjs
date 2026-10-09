import { readFile, writeFile } from 'node:fs/promises';

const patchUrl = new URL('./patch-mountain-race-screenshot-base-v20.mjs', import.meta.url);
const validatorUrl = new URL('./validate-mountain-race-screenshot-base-v20.mjs', import.meta.url);
const marker = 'MOUNTAIN_RACE_SCREENSHOT_FORMAT_PREFLIGHT_V20';

let [patch, validator] = await Promise.all([
  readFile(patchUrl, 'utf8'),
  readFile(validatorUrl, 'utf8')
]);

if (!patch.includes(marker)) {
  const decodeLine = "const png = Buffer.from(base64, 'base64');";
  if (!patch.includes(decodeLine)) {
    throw new Error('Summit Sprint V20 format preflight could not find screenshot decode line.');
  }
  patch = patch.replace(
    decodeLine,
    `${decodeLine}\n// ${marker}\nconst isPng = png[0] === 0x89 && png[1] === 0x50 && png[2] === 0x4e && png[3] === 0x47\n  && png[4] === 0x0d && png[5] === 0x0a && png[6] === 0x1a && png[7] === 0x0a;\nconst isJpeg = png[0] === 0xff && png[1] === 0xd8 && png[2] === 0xff;`
  );

  const signatureAssertion = /assert\(\s*png\[0\] === 0x89[\s\S]*?'decoded screenshot asset is not a PNG'\s*\);/;
  if (!signatureAssertion.test(patch)) {
    throw new Error('Summit Sprint V20 format preflight could not find PNG-only patch assertion.');
  }
  patch = patch.replace(
    signatureAssertion,
    "assert(isPng || isJpeg, 'decoded screenshot asset is neither PNG nor JPEG');"
  );
  patch = patch.replace('decoded screenshot PNG is unexpectedly small', 'decoded screenshot image is unexpectedly small');
}

if (!validator.includes(marker)) {
  const statLine = 'const imageStat = await stat(imageUrl);';
  if (!validator.includes(statLine)) {
    throw new Error('Summit Sprint V20 format preflight could not find validator image stat line.');
  }
  validator = validator.replace(
    statLine,
    `${statLine}\n// ${marker}\nconst isPng = image[0] === 0x89 && image[1] === 0x50 && image[2] === 0x4e && image[3] === 0x47\n  && image[4] === 0x0d && image[5] === 0x0a && image[6] === 0x1a && image[7] === 0x0a;\nconst isJpeg = image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff;`
  );

  const signatureAssertion = /assert\(\s*image\[0\] === 0x89[\s\S]*?'screenshot asset is not a valid PNG'\s*\);/;
  if (!signatureAssertion.test(validator)) {
    throw new Error('Summit Sprint V20 format preflight could not find PNG-only validator assertion.');
  }
  validator = validator.replace(
    signatureAssertion,
    "assert(isPng || isJpeg, 'screenshot asset is neither a valid PNG nor JPEG');"
  );
  validator = validator.replace("'screenshot PNG is unexpectedly small'", "'screenshot image is unexpectedly small'");
  validator = validator.replace('byte PNG).`);', 'byte image payload).`);');
}

await Promise.all([
  writeFile(patchUrl, patch),
  writeFile(validatorUrl, validator)
]);

console.log('Prepared Summit Sprint V20 screenshot transport for PNG or JPEG source bytes.');
