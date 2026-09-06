import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
function section(start, end) {
  const from = html.indexOf(start);
  const to = html.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `Missing debug section: ${start}`);
  return html.slice(from, to);
}

function fixture() {
  const elements = new Map(), writes = [], copied = [], documentEvents = new Map();
  function element(id) {
    if (elements.has(id)) return elements.get(id);
    const classes = new Set(), events = new Map();
    const node = {
      id, dataset: { collapsed: '1' }, children: [], events,
      closest: () => null,
      addEventListener: (name, handler) => events.set(name, handler),
      setAttribute: () => {},
      classList: {
        toggle(name, enabled) {
          if (classes.has(name) === enabled) return;
          enabled ? classes.add(name) : classes.delete(name);
          writes.push(`${id}.class`);
        },
        add: name => classes.add(name), remove: name => classes.delete(name)
      },
      appendChild(child) { child.parent = node; node.children.push(child); writes.push(`${id}.append`); },
      replaceChildren() { node.children = []; writes.push(`${id}.clear`); },
      remove() { this.parent.children.splice(this.parent.children.indexOf(this), 1); }
    };
    for (const property of ['textContent', 'innerHTML']) {
      let value = '';
      Object.defineProperty(node, property, {
        get: () => value,
        set: next => { value = String(next); writes.push(`${id}.${property}`); }
      });
    }
    Object.defineProperty(node, 'firstChild', { get: () => node.children[0] });
    elements.set(id, node);
    return node;
  }
  let anonymous = 0;
  const document = {
    hidden: false,
    getElementById: element,
    createElement: () => element(`anonymous-${++anonymous}`),
    addEventListener: (name, handler) => documentEvents.set(name, handler),
    querySelectorAll: () => ['rnbControlPanel', 'rnbGamePanel', 'rnbBotPanel'].map(element)
  };
  const context = vm.createContext({
    document, window: { addEventListener() {} },
    location: { href: 'https://test.invalid/' },
    navigator: { onLine: true, clipboard: { writeText: async text => copied.push(text) } },
    localStorage: { getItem: () => null }, setTimeout() {},
    copyText: async text => copied.push(text),
    rouletteLatestGame: null, rouletteVisualRuntime: null, duelLastActiveGame: null
  });
  return { context, element, writes, copied, document, documentEvents };
}

// Execute the real Roulette debug handlers, including copy and expand.
const roulette = fixture();
vm.runInContext(`(()=>{${section("    const dock=document.getElementById('rouletteDebugDock');", '  const duelRequestBeforeMutationPause=')}globalThis.snapshot=snapshot;globalThis.add=add;})();`, roulette.context);
roulette.context.rouletteLatestGame = { gameId: 'roulette-current', mode: 'roulette', status: 'playing', rouletteState: { revision: 1 } };
roulette.context.add('request', { action: 'get' });
let snapshot = roulette.context.snapshot();
assert.equal(snapshot.logs.length, 1, 'Collapsed debug must still collect request logs');
assert.equal(roulette.element('rrdLog').children.length, 0, 'Collapsed debug must not append invisible log rows');
assert.equal(roulette.element('rrdRevision').textContent, '', 'Collapsed debug must not rewrite invisible fields');
roulette.writes.length = 0;
roulette.document.hidden = true;
roulette.element('rouletteDebugDock').dataset.collapsed = '0';
roulette.context.rouletteLatestGame.rouletteState.revision = 2;
roulette.context.add('response', { status: 200 });
snapshot = roulette.context.snapshot();
assert.equal(snapshot.game.rouletteState.revision, 2);
assert.equal(snapshot.logs.length, 2);
assert.equal(roulette.writes.length, 0, 'Background debug collection must not mutate DOM');
roulette.document.hidden = false;
roulette.context.snapshot();
assert.equal(roulette.element('rrdRevision').textContent, '2');
assert.equal(roulette.element('rrdLog').children.length, 2, 'Opening must show logs collected while hidden');
roulette.element('rouletteDebugDock').dataset.collapsed = '1';
roulette.context.rouletteLatestGame.rouletteState.revision = 3;
roulette.writes.length = 0;
await roulette.element('rrdCopy').onclick();
assert.equal(JSON.parse(roulette.copied[0]).game.rouletteState.revision, 3, 'Copy reads current data even if the panel was not rendered');
assert.equal(roulette.writes.length, 0);
roulette.element('rouletteDebugToggle').onclick();
assert.equal(roulette.element('rrdRevision').textContent, '3', 'Expand refreshes immediately');
assert.equal(roulette.element('rrdLog').children.length, 3, 'Expand includes the copy event');

// Execute the real Remote Bot renderer, expansion event, and snapshot-copy path.
const bot = fixture();
vm.runInContext(section(" const $=id=>document.getElementById(id), dock=$('rnbDock')", '  function rnbReadPendingStart('), bot.context);
vm.runInContext(section('  function rnbDebugState(g)', ' async function hardCancelAll('), bot.context);
bot.context.duelLastActiveGame = {
  gameId: 'safe-current', mode: 'safecracker', status: 'playing', revision: 1,
  remoteNetworkTest: true, creator: { name: 'Player' }, joiner: { name: 'Bot', isRemoteBot: true },
  safecrackerState: { revision: 1, me: { stage: 1 }, opponent: { stage: 0 } }
};
bot.context.render();
assert.equal(JSON.parse(bot.context.debugSnapshot('game')).logs.length, 1, 'Collapsed panel still records authoritative state changes');
assert.equal(bot.element('rnbGameKv').innerHTML, '');
assert.equal(bot.element('rnbGameLog').textContent, '');
bot.writes.length = 0;
bot.document.hidden = true;
bot.element('rnbGamePanel').dataset.collapsed = '0';
bot.context.duelLastActiveGame.revision = 2;
bot.context.duelLastActiveGame.safecrackerState.revision = 2;
bot.context.render();
assert.equal(bot.writes.length, 0, 'Hidden Remote Bot debug must not mutate DOM');
assert.equal(JSON.parse(bot.context.debugSnapshot('game')).logs.length, 2, 'Hidden state changes remain available in copied logs');
await bot.element('rnbCopyGame').events.get('click')({ currentTarget: bot.element('rnbCopyGame') });
const copied = JSON.parse(bot.copied[0]);
assert.equal(copied.game.revision, 2);
assert.equal(copied.logs.length, 2);
bot.document.hidden = false;
bot.element('rnbGamePanel').dataset.collapsed = '1';
const toggle = { dataset: { rnbToggle: 'rnbGamePanel' }, lastElementChild: bot.element('gameIndicator') };
bot.documentEvents.get('click')({ target: { closest: selector => selector === '[data-rnb-toggle]' ? toggle : null } });
assert.match(bot.element('rnbGameKv').innerHTML, /safe-current/, 'Panel expansion must render current game immediately');
assert.match(bot.element('rnbGameLog').textContent, /"gameRevision":2/);
assert.equal(bot.element('rnbBotKv').innerHTML, '', 'Opening one panel must not rebuild the other collapsed panel');
bot.element('rnbGamePanel').dataset.collapsed = '1';
bot.writes.length = 0;
bot.context.render();
assert.equal(bot.writes.length, 0, 'Idle collapsed debug must produce no repeated DOM writes');
assert.equal(JSON.parse(bot.context.debugSnapshot('game')).logs.length, 2, 'Unchanged polling must not duplicate state log entries');

console.log('Idle debug rendering validated: hidden panels retain logs and copy data without DOM churn; expansion refreshes immediately.');
