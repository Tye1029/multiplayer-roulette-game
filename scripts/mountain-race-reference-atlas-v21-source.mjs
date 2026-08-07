import part1 from './mountain-race-reference-atlas-v21b-part1.mjs';
import part2 from './mountain-race-reference-atlas-v21b-part2.mjs';
import part3 from './mountain-race-reference-atlas-v21b-part3.mjs';

const referenceBase64 = `${part1}${part2}${part3}`.replace(/\s+/g, '');

if (!referenceBase64.startsWith('/9j/')) {
  throw new Error('Summit Sprint V21 reference source is not JPEG base64.');
}

export default referenceBase64;
