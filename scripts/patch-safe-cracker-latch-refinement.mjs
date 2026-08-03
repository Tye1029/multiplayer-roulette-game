import { readFile, writeFile } from 'node:fs/promises';

const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const start = '/* SAFE_CRACKER_LATCH_REFINEMENT_V8_START */';
const end = '/* SAFE_CRACKER_LATCH_REFINEMENT_V8_END */';

let css = await readFile(cssUrl, 'utf8');
if (!css.includes('/* SAFE_CRACKER_LATCH_SEQUENCE_V1_START */')) {
  throw new Error('Safe Cracker latch refinement v8 requires the mounted latch sequence.');
}

const refinementCss = String.raw`${start}
/* Final latch finish pass: raise the upper pair a small amount while preserving
   the clear space between the display and dial. Every visible latch component
   receives a directional brushed-steel grain, irregular scratches, and a bright
   reflected highlight. Only the existing right-side cylinders may animate. */
.safe-cracker-game .sc-bolts {
  top: 0 !important;
  bottom: 0 !important;
  display: block !important;
  justify-content: initial !important;
}

.safe-cracker-game .sc-latch-mount {
  position: absolute !important;
}

.safe-cracker-game .sc-bolts.left .sc-latch-mount {
  left: 0;
  transform-origin: left center;
}

.safe-cracker-game .sc-bolts.right .sc-latch-mount {
  right: 0;
  transform-origin: right center;
}

/* Tiny upward correction requested for the upper pair. */
.safe-cracker-game .sc-latch-mount:nth-child(1) {
  top: calc(22.5% + 2px);
  transform: scale(.9);
}

.safe-cracker-game .sc-latch-mount:nth-child(2) {
  top: 51%;
  transform: translateY(-50%) scale(.68);
}

.safe-cracker-game .sc-bolts.left .sc-latch-mount:nth-child(2) { left: -11px; }
.safe-cracker-game .sc-bolts.right .sc-latch-mount:nth-child(2) { right: -11px; }

.safe-cracker-game .sc-latch-mount:nth-child(3) {
  bottom: 17%;
  transform: scale(.9);
}

/* Tall fixed support beneath each barrel. Broad silver bands create brushed
   metal, while the narrow angled marks read as individual wear scratches. */
.safe-cracker-game .sc-latch-spine {
  position: absolute;
  top: -14px;
  bottom: -14px;
  width: 18px;
  z-index: 2;
  display: block;
  overflow: visible;
  border: 2px solid #0d1215;
  border-radius: 4px;
  background:
    linear-gradient(112deg, transparent 0 18%, rgba(255,255,255,.22) 18.3% 18.9%, transparent 19.2% 63%, rgba(0,0,0,.18) 63.3% 63.9%, transparent 64.2%),
    linear-gradient(164deg, transparent 0 37%, rgba(255,255,255,.14) 37.3% 37.9%, transparent 38.2% 76%, rgba(0,0,0,.13) 76.3% 76.9%, transparent 77.2%),
    linear-gradient(104deg, transparent 0 29%, rgba(255,255,255,.05) 30%, rgba(255,255,255,.55) 36%, rgba(255,255,255,.12) 42%, transparent 48%),
    radial-gradient(ellipse at 38% 20%, rgba(255,255,255,.28), transparent 39%),
    linear-gradient(90deg, #12191d 0%, #59666c 16%, #a9b4b8 31%, #e3e9eb 43%, #9ba7ac 55%, #59666c 72%, #151c20 100%);
  box-shadow:
    inset 1px 0 2px rgba(255,255,255,.42),
    inset -3px 0 5px rgba(0,0,0,.34),
    inset 0 0 12px rgba(255,255,255,.08),
    0 5px 8px rgba(0,0,0,.48);
}

.safe-cracker-game .sc-bolts.left .sc-latch-spine { left: 5px; }
.safe-cracker-game .sc-bolts.right .sc-latch-spine { right: 5px; }

.safe-cracker-game .sc-latch-spine::before,
.safe-cracker-game .sc-latch-spine::after {
  content: '';
  position: absolute;
  left: 50%;
  width: 24px;
  height: 7px;
  border: 2px solid #0b1012;
  background:
    linear-gradient(115deg, transparent 0 28%, rgba(255,255,255,.5) 34%, rgba(255,255,255,.1) 41%, transparent 47%),
    linear-gradient(103deg, transparent 0 65%, rgba(0,0,0,.14) 65.3% 66%, transparent 66.3%),
    linear-gradient(90deg, #171e22 0%, #77848a 24%, #dbe2e4 45%, #879399 63%, #1a2125 100%);
  box-shadow:
    inset 0 1px 1px rgba(255,255,255,.38),
    inset 0 -2px 3px rgba(0,0,0,.34),
    0 2px 3px rgba(0,0,0,.42);
  transform: translateX(-50%);
}

.safe-cracker-game .sc-latch-spine::before {
  top: 13px;
  border-radius: 5px 5px 2px 2px;
}

.safe-cracker-game .sc-latch-spine::after {
  bottom: 13px;
  border-radius: 2px 2px 5px 5px;
}

/* Main backplates: mirrored glare keeps the lighting physically consistent. */
.safe-cracker-game .sc-latch-mount::before {
  background:
    linear-gradient(111deg, transparent 0 13%, rgba(255,255,255,.19) 13.3% 13.9%, transparent 14.2% 46%, rgba(0,0,0,.14) 46.3% 46.9%, transparent 47.2% 79%, rgba(255,255,255,.1) 79.3% 79.9%, transparent 80.2%),
    linear-gradient(166deg, transparent 0 32%, rgba(0,0,0,.12) 32.3% 32.9%, transparent 33.2% 68%, rgba(255,255,255,.11) 68.3% 68.9%, transparent 69.2%),
    linear-gradient(112deg, transparent 0 21%, rgba(255,255,255,.04) 22%, rgba(255,255,255,.43) 29%, rgba(255,255,255,.08) 37%, transparent 44%),
    radial-gradient(ellipse at 31% 17%, rgba(255,255,255,.25), transparent 39%),
    linear-gradient(90deg, #171f23 0%, #647178 20%, #bac4c8 37%, #e0e6e8 46%, #7d8a90 61%, #3f4b50 76%, #141b1f 100%) !important;
  box-shadow:
    inset 1px 0 2px rgba(255,255,255,.3),
    inset 0 1px 1px rgba(255,255,255,.24),
    inset -4px 0 7px rgba(0,0,0,.3),
    0 6px 9px rgba(0,0,0,.42) !important;
}

.safe-cracker-game .sc-bolts.right .sc-latch-mount::before {
  background:
    linear-gradient(69deg, transparent 0 13%, rgba(255,255,255,.19) 13.3% 13.9%, transparent 14.2% 46%, rgba(0,0,0,.14) 46.3% 46.9%, transparent 47.2% 79%, rgba(255,255,255,.1) 79.3% 79.9%, transparent 80.2%),
    linear-gradient(14deg, transparent 0 32%, rgba(0,0,0,.12) 32.3% 32.9%, transparent 33.2% 68%, rgba(255,255,255,.11) 68.3% 68.9%, transparent 69.2%),
    linear-gradient(68deg, transparent 0 21%, rgba(255,255,255,.04) 22%, rgba(255,255,255,.43) 29%, rgba(255,255,255,.08) 37%, transparent 44%),
    radial-gradient(ellipse at 69% 17%, rgba(255,255,255,.25), transparent 39%),
    linear-gradient(270deg, #171f23 0%, #647178 20%, #bac4c8 37%, #e0e6e8 46%, #7d8a90 61%, #3f4b50 76%, #141b1f 100%) !important;
}

/* Inward mounting ears receive the same brushed and reflective treatment. */
.safe-cracker-game .sc-latch-mount::after {
  background:
    linear-gradient(108deg, transparent 0 22%, rgba(255,255,255,.17) 22.3% 22.9%, transparent 23.2% 58%, rgba(0,0,0,.13) 58.3% 58.9%, transparent 59.2%),
    linear-gradient(118deg, transparent 0 24%, rgba(255,255,255,.42) 31%, rgba(255,255,255,.08) 39%, transparent 46%),
    radial-gradient(ellipse at 34% 16%, rgba(255,255,255,.23), transparent 42%),
    linear-gradient(90deg, #151c20 0%, #657279 25%, #d8dfe1 47%, #77848a 66%, #192125 100%) !important;
  box-shadow:
    inset 0 1px 2px rgba(255,255,255,.3),
    inset -3px 0 5px rgba(0,0,0,.27),
    0 4px 6px rgba(0,0,0,.46) !important;
}

.safe-cracker-game .sc-bolts.right .sc-latch-mount::after {
  background:
    linear-gradient(72deg, transparent 0 22%, rgba(255,255,255,.17) 22.3% 22.9%, transparent 23.2% 58%, rgba(0,0,0,.13) 58.3% 58.9%, transparent 59.2%),
    linear-gradient(62deg, transparent 0 24%, rgba(255,255,255,.42) 31%, rgba(255,255,255,.08) 39%, transparent 46%),
    radial-gradient(ellipse at 66% 16%, rgba(255,255,255,.23), transparent 42%),
    linear-gradient(270deg, #151c20 0%, #657279 25%, #d8dfe1 47%, #77848a 66%, #192125 100%) !important;
}

.safe-cracker-game .sc-latch-screw {
  position: absolute;
  top: 11px;
  width: 13px;
  height: 13px;
  z-index: 4;
  display: block;
  border: 1px solid #070a0c;
  border-radius: 50%;
  background:
    linear-gradient(126deg, transparent 0 29%, rgba(255,255,255,.52) 36%, rgba(255,255,255,.09) 44%, transparent 51%),
    linear-gradient(158deg, transparent 0 64%, rgba(0,0,0,.16) 64.4% 65.1%, transparent 65.5%),
    radial-gradient(circle at 34% 27%, #fff 0 8%, #cbd3d6 18%, #7a868c 40%, #394247 66%, #111619 84%, #050708 100%);
  box-shadow:
    inset 0 1px 1px rgba(255,255,255,.42),
    inset 0 -2px 3px rgba(0,0,0,.48),
    0 2px 3px rgba(0,0,0,.52);
}

.safe-cracker-game .sc-bolts.left .sc-latch-screw { left: 38px; }
.safe-cracker-game .sc-bolts.right .sc-latch-screw { right: 38px; }

.safe-cracker-game .sc-latch-screw::before,
.safe-cracker-game .sc-latch-screw::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  border-radius: 2px;
  background: linear-gradient(180deg, #070a0c, #30383c 48%, #080b0d);
  box-shadow: 0 1px 0 rgba(255,255,255,.12);
  transform: translate(-50%, -50%);
}

.safe-cracker-game .sc-latch-screw::before { width: 8px; height: 2px; }
.safe-cracker-game .sc-latch-screw::after { width: 2px; height: 8px; }

/* Cylinders retain the protected movement classes. Their broad vertical grain
   and narrow white reflection create the strongest polished-steel glare. */
.safe-cracker-game .sc-latch-mount > i {
  background:
    linear-gradient(104deg, transparent 0 15%, rgba(255,255,255,.22) 15.3% 15.9%, transparent 16.2% 45%, rgba(0,0,0,.15) 45.3% 45.9%, transparent 46.2% 73%, rgba(255,255,255,.12) 73.3% 73.9%, transparent 74.2%),
    linear-gradient(163deg, transparent 0 29%, rgba(0,0,0,.12) 29.3% 29.9%, transparent 30.2% 62%, rgba(255,255,255,.11) 62.3% 62.9%, transparent 63.2%),
    linear-gradient(112deg, transparent 0 20%, rgba(255,255,255,.04) 21%, rgba(255,255,255,.58) 29%, rgba(255,255,255,.14) 37%, transparent 45%),
    radial-gradient(ellipse at 42% 15%, rgba(255,255,255,.32), transparent 35%),
    linear-gradient(90deg, #101619 0%, #4e5a60 13%, #9da9ae 28%, #e7ecee 43%, #aab5ba 55%, #69757b 69%, #232b2f 86%, #11171a 100%) !important;
  box-shadow:
    inset 1px 0 2px rgba(255,255,255,.44),
    inset -4px 0 6px rgba(0,0,0,.3),
    inset 0 0 12px rgba(255,255,255,.08),
    0 7px 9px rgba(0,0,0,.54) !important;
}

@media (max-width: 700px) {
  .safe-cracker-game .sc-latch-mount:nth-child(1) {
    top: calc(22.5% + 5px);
    transform: scale(.86);
  }

  .safe-cracker-game .sc-latch-mount:nth-child(2) {
    top: 51%;
    transform: translateY(-50%) scale(.62);
  }

  .safe-cracker-game .sc-bolts.left .sc-latch-mount:nth-child(2) { left: -9px; }
  .safe-cracker-game .sc-bolts.right .sc-latch-mount:nth-child(2) { right: -9px; }

  .safe-cracker-game .sc-latch-mount:nth-child(3) {
    bottom: 17%;
    transform: scale(.86);
  }

  .safe-cracker-game .sc-latch-spine {
    top: -11px;
    bottom: -11px;
    width: 15px;
  }

  .safe-cracker-game .sc-bolts.left .sc-latch-spine { left: 5px; }
  .safe-cracker-game .sc-bolts.right .sc-latch-spine { right: 5px; }

  .safe-cracker-game .sc-latch-spine::before,
  .safe-cracker-game .sc-latch-spine::after {
    width: 20px;
    height: 6px;
  }

  .safe-cracker-game .sc-latch-spine::before { top: 11px; }
  .safe-cracker-game .sc-latch-spine::after { bottom: 11px; }

  .safe-cracker-game .sc-latch-screw {
    top: 9px;
    width: 11px;
    height: 11px;
  }

  .safe-cracker-game .sc-bolts.left .sc-latch-screw { left: 31px; }
  .safe-cracker-game .sc-bolts.right .sc-latch-screw { right: 31px; }
  .safe-cracker-game .sc-latch-screw::before { width: 7px; }
  .safe-cracker-game .sc-latch-screw::after { height: 7px; }
}
${end}`;

const oldBlock = /\/\* SAFE_CRACKER_LATCH_REFINEMENT_V(?:5|6|7|8)_START \*\/[\s\S]*?\/\* SAFE_CRACKER_LATCH_REFINEMENT_V(?:5|6|7|8)_END \*\/\n?/g;
css = css.replace(oldBlock, '').trimEnd() + `\n\n${refinementCss}\n`;
await writeFile(cssUrl, css);

let client = await readFile(clientUrl, 'utf8');
if (!client.includes('// SAFE_CRACKER_LATCH_SEQUENCE_V1_HELPER')) {
  throw new Error('Safe Cracker latch refinement v8 could not find the latch helper.');
}
const mountReturnPattern = /    return `<span class="sc-latch-mount">[^`]*<\/span>`;/;
const mountedReturn = '    return `<span class="sc-latch-mount"><b class="sc-latch-spine" aria-hidden="true"></b><em class="sc-latch-screw" aria-hidden="true"></em><i class="${latchClass}"></i></span>`;';
if (mountReturnPattern.test(client)) {
  client = client.replace(mountReturnPattern, mountedReturn);
} else if (!client.includes('class="sc-latch-spine"') || !client.includes('class="sc-latch-screw"')) {
  throw new Error('Safe Cracker latch refinement v8 could not upgrade the latch mount markup.');
}
await writeFile(clientUrl, client);

let html = await readFile(indexUrl, 'utf8');
html = html.replace(/&latch=\d+/g, '&latch=8');
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker latch refinement v8: the top pair is slightly higher, all six assemblies have stronger directional brushed steel and reflective glare, repetitive line textures remain absent, and only the existing right cylinders animate.');
