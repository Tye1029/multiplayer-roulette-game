import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

function nearestFunctionHeader(position) {
  const windowStart = Math.max(0, position - 2400);
  const before = html.slice(windowStart, position);
  const asyncIndex = before.lastIndexOf('async function ');
  const functionIndex = before.lastIndexOf('function ');
  const relative = Math.max(asyncIndex, functionIndex);
  const headerStart = relative >= 0 ? windowStart + relative : Math.max(0, position - 260);
  const headerEnd = html.indexOf('{', headerStart);
  return headerEnd >= 0 && headerEnd < position
    ? html.slice(headerStart, headerEnd + 1).replace(/\s+/g, ' ').slice(0, 700)
    : html.slice(Math.max(0, position - 260), position + 100).replace(/\s+/g, ' ');
}

function logCalls(patterns, label) {
  let found = 0;
  for (const pattern of patterns) {
    let cursor = 0;
    while (cursor < html.length) {
      const call = html.indexOf(pattern, cursor);
      if (call < 0) break;
      const before = html.slice(Math.max(0, call - 32), call);
      if (!/function\s+$/.test(before)) {
        console.log(`MOUNTAIN_RACE_V12_${label}_${found + 1}: ${nearestFunctionHeader(call)}`);
        found += 1;
      }
      cursor = call + pattern.length;
    }
  }
  return found;
}

const adoptionCalls = logCalls(['rnbAdoptGame('], 'ADOPT_CALLER');
const actCalls = logCalls(["duelRequest('act'", 'duelRequest("act"'], 'ACT_CALLER');
const getCalls = logCalls(["duelRequest('get'", 'duelRequest("get"'], 'GET_CALLER');
console.log(`MOUNTAIN_RACE_V12_COUNTS: adopt=${adoptionCalls} act=${actCalls} get=${getCalls}`);
if (!adoptionCalls || !actCalls || !getCalls) throw new Error('Generated Remote Bot caller diagnostics were incomplete.');
