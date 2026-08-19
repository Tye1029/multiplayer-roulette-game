import { readFile, writeFile } from 'node:fs/promises';

const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const oldTransform = '  transform: rotate(var(--digit-angle)) translateY(calc(var(--radius) * -1)) rotate(calc(var(--digit-angle) * -1));';
const physicalTransform = '  transform: rotate(var(--digit-angle)) translateY(calc(var(--radius) * -1));';
const duplicateOverride = `.sc-dial-number {\n${physicalTransform}\n}\n\n`;

let css = await readFile(cssUrl, 'utf8');
if (!css.includes(physicalTransform) && !css.includes(oldTransform)) {
  throw new Error('Safe Cracker dial-orientation cleanup could not find the dial-number transform.');
}
css = css.replace(oldTransform, physicalTransform);
css = css.replace(duplicateOverride, '');
await writeFile(cssUrl, css);

console.log('Normalized Safe Cracker dial numerals to one physical radial orientation rule.');