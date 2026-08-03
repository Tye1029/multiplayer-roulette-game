import { readFile, writeFile } from 'node:fs/promises';

await import('./patch-safe-cracker-sample-mix.mjs');
await import('./validate-safe-cracker-sample-mix.mjs');
await import('./patch-safe-cracker-texture-pass.mjs');
await import('./validate-safe-cracker-texture-pass.mjs');
await import('./patch-safe-cracker-active-render-guard.mjs');
await import('./validate-safe-cracker-active-render-guard.mjs');
await import('./patch-safe-cracker-dial-board-retention.mjs');
await import('./validate-safe-cracker-dial-board-retention.mjs');
await import('./rebuild-safe-cracker-recorded-singles.mjs');
await import('./patch-safe-cracker-uploaded-soundscape.mjs');
await import('./validate-safe-cracker-audio.mjs');
await import('./patch-safe-cracker-click-cues.mjs');
await import('./validate-safe-cracker-click-cues.mjs');
await import('./patch-safe-cracker-dial-click-v17.mjs');
await import('./validate-safe-cracker-dial-click-v17.mjs');
await import('./patch-safe-cracker-dial-sample-v18.mjs');
await import('./patch-safe-cracker-dial-sample-v22.mjs');
await import('./validate-safe-cracker-dial-sample-v18.mjs');

const packageUrl = new URL('../package.json', import.meta.url);
const validatorUrl = new URL('./validate-lamp.mjs', import.meta.url);
const packageJson = JSON.parse(await readFile(packageUrl, 'utf8'));
const buildCommand = String(packageJson.scripts?.build || '');

if (!buildCommand) throw new Error('Safe Cracker compatibility patch could not read the Netlify build command.');

let validator = await readFile(validatorUrl, 'utf8');
const expectedLine = `const expectedBuild = ${JSON.stringify(buildCommand)};`;
const pattern = /const expectedBuild = [^\n]+;/;

if (!pattern.test(validator)) {
  throw new Error('Safe Cracker compatibility patch could not find the lamp validator build expectation.');
}

if (!validator.includes(expectedLine)) {
  validator = validator.replace(pattern, expectedLine);
  await writeFile(validatorUrl, validator);
  console.log('Updated the lamp validator to recognize the Safe Cracker Netlify pipeline.');
} else {
  console.log('Lamp validator already recognizes the Safe Cracker Netlify pipeline.');
}
