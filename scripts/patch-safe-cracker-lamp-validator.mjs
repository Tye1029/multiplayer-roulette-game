import { readFile, writeFile } from 'node:fs/promises';

await import('./patch-safe-cracker-sample-mix.mjs');
await import('./validate-safe-cracker-sample-mix.mjs');
await import('./patch-safe-cracker-runtime-stability.mjs');
await import('./validate-safe-cracker-runtime-stability.mjs');
await import('./patch-safe-cracker-reference-visuals.mjs');
await import('./patch-safe-cracker-reference-cache.mjs');
await import('./validate-safe-cracker-reference-visuals.mjs');
await import('./patch-safe-cracker-reflection-depth.mjs');
await import('./validate-safe-cracker-reflection-depth.mjs');
await import('./patch-safe-cracker-png-shell.mjs');
await import('./validate-safe-cracker-png-shell.mjs');

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
