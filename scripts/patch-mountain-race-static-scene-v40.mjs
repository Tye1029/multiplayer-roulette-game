import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const runtimeUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', root);
const prototypeUrl = new URL('assets/mountain-race/mountain-race.js', root);
const cssUrl = new URL('assets/mountain-race/mountain-race.css', root);
const indexUrl = new URL('index.html', root);
const previewUrl = new URL('mountain-race-preview.html', root);
const marker = 'MOUNTAIN_RACE_STATIC_SCENE_V40';
const required = (source, before, after, label) => {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint V40 could not find ${label}.`);
  return source.replace(before, after);
};

let [runtime, prototype, css, html, preview] = await Promise.all([
  readFile(runtimeUrl, 'utf8'), readFile(prototypeUrl, 'utf8'), readFile(cssUrl, 'utf8'),
  readFile(indexUrl, 'utf8'), readFile(previewUrl, 'utf8')
]);

const morphHelpers = String.raw`

  // MOUNTAIN_RACE_STATIC_SCENE_V40
  // Preserve decoded terrain/image nodes and patch only stateful DOM fields.
  function morphMountainNode(current, next) {
    if (!current || !next) return;
    if (current.nodeType !== next.nodeType || (current.nodeType === 1 && current.tagName !== next.tagName)) {
      current.replaceWith(next.cloneNode(true));
      return;
    }
    if (current.nodeType === 3) {
      if (current.nodeValue !== next.nodeValue) current.nodeValue = next.nodeValue;
      return;
    }
    if (current.nodeType !== 1) return;
    const currentElement = current;
    const nextElement = next;
    const currentAnimationKey = currentElement.getAttribute('data-mr-animation-key');
    const nextAnimationKey = nextElement.getAttribute('data-mr-animation-key');
    if (currentElement.classList.contains('mr-climber') && currentAnimationKey !== nextAnimationKey) {
      currentElement.replaceWith(nextElement.cloneNode(true));
      return;
    }
    for (const name of currentElement.getAttributeNames()) {
      if (!nextElement.hasAttribute(name)) currentElement.removeAttribute(name);
    }
    for (const attribute of nextElement.attributes) {
      if (currentElement.getAttribute(attribute.name) !== attribute.value) currentElement.setAttribute(attribute.name, attribute.value);
    }
    let index = 0;
    while (index < nextElement.childNodes.length || index < currentElement.childNodes.length) {
      const currentChild = currentElement.childNodes[index];
      const nextChild = nextElement.childNodes[index];
      if (!nextChild) {
        currentChild.remove();
        continue;
      }
      if (!currentChild) {
        currentElement.append(nextChild.cloneNode(true));
        index += 1;
        continue;
      }
      morphMountainNode(currentChild, nextChild);
      index += 1;
    }
  }
`;

if (!runtime.includes(marker)) {
  runtime = required(runtime, '\n  function render() {', `${morphHelpers}\n  function render() {`, 'multiplayer morph helper insertion');
  runtime = required(runtime,
    'style="--mr-climber-bottom:${bottom}px;--mr-climber-left:${contactLeft}%;--mr-previous-climber-left:${previousContactLeft}%;--mr-slip-fall:${slipFall}px" data-mr-finished=',
    'style="--mr-climber-bottom:${bottom}px;--mr-climber-left:${contactLeft}%;--mr-previous-climber-left:${previousContactLeft}%;--mr-slip-fall:${slipFall}px" data-mr-animation-key="${escapeHtml(raw.lastInput?.at || animation)}" data-mr-finished=',
    'multiplayer animation key');
  runtime = required(runtime,
    '<div class="mr-mountain-wall" style="--mr-wall-scroll:${scroll}px">',
    '<div class="mr-mountain-wall" style="--mr-wall-scroll:${scroll}px;--mr-wall-height:${Math.max(2060, 300 + total * 92)}px">',
    'multiplayer dynamic wall height');
  runtime = required(runtime,
    '      previousGameElement.replaceChildren(...nextGameElement.childNodes);',
    '      morphMountainNode(previousGameElement, nextGameElement);',
    'multiplayer full-tree replacement');
}

if (!prototype.includes(marker)) {
  prototype = required(prototype, '\n  function render() {', `${morphHelpers}\n  function render() {`, 'prototype morph helper insertion');
  prototype = required(prototype,
    'style="--mr-climber-bottom:${bottom}px;--mr-climber-left:${contactLeft}%;--mr-previous-climber-left:${previousContactLeft}%;--mr-slip-fall:${slipFall}px" aria-label=',
    'style="--mr-climber-bottom:${bottom}px;--mr-climber-left:${contactLeft}%;--mr-previous-climber-left:${previousContactLeft}%;--mr-slip-fall:${slipFall}px" data-mr-animation-key="${escapeHtml(player.lastInput?.at || player.animation)}" aria-label=',
    'prototype animation key');
  prototype = required(prototype,
    '<div class="mr-mountain-wall" style="--mr-wall-scroll:${scroll}px">',
    '<div class="mr-mountain-wall" style="--mr-wall-scroll:${scroll}px;--mr-wall-height:${Math.max(2060, 300 + total * 92)}px">',
    'prototype dynamic wall height');
  // The prototype has the same stable-root replacement pattern after its template creation.
  prototype = prototype.replace('previousGameElement.replaceChildren(...nextGameElement.childNodes);', 'morphMountainNode(previousGameElement, nextGameElement);');
}

if (!css.includes(marker)) css += String.raw`

/* MOUNTAIN_RACE_STATIC_SCENE_V40 */
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-mountain-wall {
  height: var(--mr-wall-height, 2508px) !important;
  contain: layout style paint;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-cliff-art,
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-start-art,
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-summit-art {
  backface-visibility: hidden;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-cliff-art img {
  min-height: 100% !important;
}
`;

html = html.replace(/(?:&visual=\d+)+/g, '&visual=40');
preview = preview.replace(/(?:&visual=\d+)+/g, '&visual=40');
await Promise.all([
  writeFile(runtimeUrl, runtime), writeFile(prototypeUrl, prototype), writeFile(cssUrl, css),
  writeFile(indexUrl, html), writeFile(previewUrl, preview)
]);
console.log('Applied Summit Sprint V40 static terrain morphing and route-sized mountain walls.');
