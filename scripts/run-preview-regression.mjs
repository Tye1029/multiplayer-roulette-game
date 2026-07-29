import { readFile, writeFile, rm } from 'node:fs/promises';

const sourceUrl = new URL('./preview-regression.mjs', import.meta.url);
const runtimeUrl = new URL('./.preview-regression.runtime.mjs', import.meta.url);
const source = await readFile(sourceUrl, 'utf8');
const isolated = source.replace(
  'await gotoWithRetry(harness, target.href);',
  "await gotoWithRetry(harness, absolute('/lamp-calibration.html'));"
);

if (isolated === source) throw new Error('Preview regression harness entry point was not found.');
await writeFile(runtimeUrl, isolated);
try {
  await import(`${runtimeUrl.href}?run=${Date.now()}`);
} finally {
  await rm(runtimeUrl, { force: true });
}
