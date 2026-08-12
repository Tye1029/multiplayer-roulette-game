import { readFile, writeFile } from 'node:fs/promises';

const rootUrl = new URL('../', import.meta.url);
const cssUrl = new URL('assets/mountain-race/mountain-race.css', rootUrl);
const runtimeUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', rootUrl);
const indexUrl = new URL('index.html', rootUrl);
const marker = 'MOUNTAIN_RACE_FULL_CLIFF_V23';

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint Full Cliff V23 could not find ${label}.`);
  return source.replace(before, after);
}

let [css, runtime, html] = await Promise.all([
  readFile(cssUrl, 'utf8'),
  readFile(runtimeUrl, 'utf8'),
  readFile(indexUrl, 'utf8')
]);

if (!runtime.includes(marker)) {
  const runtimePatch = String.raw`

// MOUNTAIN_RACE_FULL_CLIFF_V23
// Use the complete approved V21 reference cliff instead of slicing/repeating it.
// The browser converts that already-committed photographic source into two full
// PNG lane plates plus a dedicated grass PNG. Gameplay remains live DOM above it.
function ensureFullCliffV23(root) {
  if (!root) return;
  root.dataset.mrFullCliff = '23';

  const install = atlas => {
    if (!atlas || !root?.style) return;
    root.style.setProperty('--mr-v23-left-cliff', 'url("' + atlas.left + '")');
    root.style.setProperty('--mr-v23-right-cliff', 'url("' + atlas.right + '")');
    root.style.setProperty('--mr-v23-grass', 'url("' + atlas.grass + '")');
    root.dataset.mrFullCliffReady = '1';
  };

  if (window.__mountainRaceFullCliffV23) {
    install(window.__mountainRaceFullCliffV23);
    return;
  }

  if (!window.__mountainRaceFullCliffV23Promise) {
    window.__mountainRaceFullCliffV23Promise = new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => {
        try {
          const sourceW = image.naturalWidth || image.width;
          const sourceH = image.naturalHeight || image.height;
          if (!sourceW || !sourceH) throw new Error('reference cliff has no dimensions');

          const drawCover = (ctx, outW, outH, mirror = false) => {
            const sourceRatio = sourceW / sourceH;
            const targetRatio = outW / outH;
            let sx = 0;
            let sy = 0;
            let sw = sourceW;
            let sh = sourceH;
            if (sourceRatio > targetRatio) {
              sw = Math.max(1, Math.round(sourceH * targetRatio));
              sx = Math.round((sourceW - sw) / 2);
            } else if (sourceRatio < targetRatio) {
              sh = Math.max(1, Math.round(sourceW / targetRatio));
              sy = Math.round((sourceH - sh) / 2);
            }
            ctx.save();
            if (mirror) {
              ctx.translate(outW, 0);
              ctx.scale(-1, 1);
            }
            ctx.drawImage(image, sx, sy, sw, sh, 0, 0, outW, outH);
            ctx.restore();
          };

          const makeCliff = mirror => {
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 1536;
            const ctx = canvas.getContext('2d', { alpha: false });
            if (!ctx) throw new Error('full cliff canvas unavailable');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            drawCover(ctx, canvas.width, canvas.height, mirror);

            // Warm top-left daylight with restrained crevice depth. This preserves
            // the actual photographed rock rather than tinting it into flat brown.
            const sunlight = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            sunlight.addColorStop(0, 'rgba(255,236,190,.12)');
            sunlight.addColorStop(.34, 'rgba(255,236,190,.025)');
            sunlight.addColorStop(.72, 'rgba(15,14,11,.015)');
            sunlight.addColorStop(1, 'rgba(7,8,7,.07)');
            ctx.fillStyle = sunlight;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const edgeDepth = ctx.createLinearGradient(0, 0, canvas.width, 0);
            edgeDepth.addColorStop(0, 'rgba(5,7,6,.12)');
            edgeDepth.addColorStop(.08, 'rgba(0,0,0,0)');
            edgeDepth.addColorStop(.90, 'rgba(0,0,0,0)');
            edgeDepth.addColorStop(1, 'rgba(4,6,5,.18)');
            ctx.fillStyle = edgeDepth;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            return canvas.toDataURL('image/png');
          };

          const makeGrass = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 768;
            canvas.height = 184;
            const ctx = canvas.getContext('2d', { alpha: false });
            if (!ctx) throw new Error('grass canvas unavailable');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            // The approved cliff source contains a clean grass/earth band at its
            // lower edge. Use the complete band rather than cloning narrow strips.
            const cropY = Math.max(0, Math.round(sourceH * .82));
            const cropH = Math.max(1, sourceH - cropY);
            ctx.drawImage(image, 0, cropY, sourceW, cropH, 0, 0, canvas.width, canvas.height);

            const light = ctx.createLinearGradient(0, 0, 0, canvas.height);
            light.addColorStop(0, 'rgba(255,239,195,.13)');
            light.addColorStop(.45, 'rgba(255,239,195,0)');
            light.addColorStop(1, 'rgba(8,10,7,.10)');
            ctx.fillStyle = light;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            return canvas.toDataURL('image/png');
          };

          const atlas = {
            left: makeCliff(false),
            right: makeCliff(true),
            grass: makeGrass()
          };
          window.__mountainRaceFullCliffV23 = atlas;
          resolve(atlas);
        } catch (error) {
          reject(error);
        }
      };
      image.onerror = () => reject(new Error('V23 full cliff reference failed to load'));
      image.src = 'assets/mountain-race/images/summit-sprint-reference-v21.jpg?fullcliff=23';
    }).catch(error => {
      console.warn('[Summit Sprint V23] full cliff fallback active:', error);
      return null;
    });
  }

  window.__mountainRaceFullCliffV23Promise.then(install);
}
`;

  runtime += runtimePatch;
  runtime = replaceRequired(
    runtime,
    '    ensureReferenceRebuildV22(root);',
    "    ensureReferenceRebuildV22(root);\n    ensureFullCliffV23(root);",
    'V22 environment installation'
  );
}

if (!css.includes(marker)) {
  css += String.raw`

/* MOUNTAIN_RACE_FULL_CLIFF_V23
   Full reference cliff plates. No repeated square crops, no stretched wood-like
   texture, no synthetic grass blades. Live climbers/arrows remain above terrain. */

[data-mountain-race-mount][data-mr-full-cliff="23"] .mr-climb-viewport {
  box-sizing: border-box !important;
  padding-inline: clamp(10px, 2.4vw, 17px) !important;
  background:
    radial-gradient(circle at 12% 2%, rgba(255,244,205,.23), transparent 29%),
    linear-gradient(180deg, #7fc1df 0%, #66a7c5 45%, #3f6e7d 100%) !important;
  overflow: hidden !important;
}

[data-mountain-race-mount][data-mr-full-cliff="23"] .mr-climb-viewport::before {
  content: '' !important;
  position: absolute !important;
  inset: 0 !important;
  z-index: 9 !important;
  pointer-events: none !important;
  background:
    radial-gradient(ellipse at 12% 3%, rgba(255,239,195,.14), transparent 32%),
    linear-gradient(106deg, rgba(255,232,185,.045), transparent 38%, rgba(5,8,7,.035) 100%) !important;
  opacity: 1 !important;
  mix-blend-mode: normal !important;
}

[data-mountain-race-mount][data-mr-full-cliff="23"] .mr-climb-viewport::after {
  content: none !important;
}

/* Center both lanes as one balanced pair and remove the pointed/cutout V22 edges. */
[data-mountain-race-mount][data-mr-full-cliff="23"] .mr-lanes,
[data-mountain-race-mount][data-mr-full-cliff="23"] .mr-race-lanes,
[data-mountain-race-mount][data-mr-full-cliff="23"] .mr-lane-grid {
  width: 100% !important;
  max-width: 100% !important;
  margin-inline: auto !important;
  box-sizing: border-box !important;
  display: grid !important;
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  gap: clamp(8px, 2vw, 14px) !important;
  justify-content: center !important;
  justify-items: stretch !important;
}

[data-mountain-race-mount][data-mr-full-cliff="23"] .mr-lane {
  position: relative !important;
  width: 100% !important;
  min-width: 0 !important;
  max-width: none !important;
  margin: 0 !important;
  justify-self: stretch !important;
  overflow: hidden !important;
  box-sizing: border-box !important;
  border-radius: 24px 24px 10px 10px !important;
  clip-path: none !important;
}

[data-mountain-race-mount][data-mr-full-cliff="23"] .mr-mountain-wall {
  left: 0 !important;
  right: 0 !important;
  width: 100% !important;
  margin: 0 !important;
  clip-path: none !important;
  border-radius: 22px 22px 8px 8px !important;
  overflow: hidden !important;
  background-color: #3d3c32 !important;
  background-image:
    linear-gradient(108deg, rgba(255,235,190,.055) 0%, transparent 38%, rgba(4,7,6,.055) 100%),
    var(--mr-v23-left-cliff, url("images/summit-sprint-reference-v21.jpg")) !important;
  background-size: 100% 100%, cover !important;
  background-position: center, center !important;
  background-repeat: no-repeat !important;
  filter: saturate(.96) contrast(1.055) brightness(1.035) !important;
  box-shadow:
    inset 9px 0 19px rgba(255,229,181,.045),
    inset -12px 0 22px rgba(4,6,5,.15) !important;
}

[data-mountain-race-mount][data-mr-full-cliff="23"] .mr-lane.opponent .mr-mountain-wall {
  background-image:
    linear-gradient(108deg, rgba(255,235,190,.045) 0%, transparent 38%, rgba(4,7,6,.06) 100%),
    var(--mr-v23-right-cliff, url("images/summit-sprint-reference-v21.jpg")) !important;
  background-size: 100% 100%, cover !important;
  background-position: center, center !important;
}

[data-mountain-race-mount][data-mr-full-cliff="23"] .mr-mountain-wall::before {
  content: '' !important;
  position: absolute !important;
  inset: 0 !important;
  z-index: 1 !important;
  pointer-events: none !important;
  background:
    radial-gradient(ellipse at 15% 4%, rgba(255,239,197,.10), transparent 31%),
    linear-gradient(104deg, rgba(255,229,184,.035), transparent 35%, rgba(3,6,5,.045) 100%) !important;
  opacity: 1 !important;
  mix-blend-mode: normal !important;
}

[data-mountain-race-mount][data-mr-full-cliff="23"] .mr-mountain-wall::after {
  content: '' !important;
  position: absolute !important;
  inset: 0 !important;
  z-index: 2 !important;
  pointer-events: none !important;
  background:
    linear-gradient(90deg, rgba(0,0,0,.08), transparent 7%, transparent 92%, rgba(0,0,0,.11)) !important;
  opacity: 1 !important;
}

/* The cliff art already contains real ledges. Keep only the live direction badge
   instead of stamping the same synthetic ledge sprite repeatedly over the photo. */
[data-mountain-race-mount][data-mr-full-cliff="23"] .mr-rock-hold {
  z-index: 8 !important;
  width: 56px !important;
  height: 56px !important;
  border: 0 !important;
  border-radius: 50% !important;
  background: transparent !important;
  background-image: none !important;
  box-shadow: none !important;
  filter: none !important;
  opacity: 1 !important;
}

[data-mountain-race-mount][data-mr-full-cliff="23"] .mr-rock-hold.unknown {
  opacity: 0 !important;
}

[data-mountain-race-mount][data-mr-full-cliff="23"] .mr-rock-hold b {
  display: grid !important;
  place-items: center !important;
  width: 38px !important;
  height: 38px !important;
  margin: 9px auto 0 !important;
  border-radius: 50% !important;
  border: 1px solid rgba(229,216,185,.60) !important;
  background:
    radial-gradient(circle at 31% 24%, rgba(255,255,255,.17), transparent 34%),
    linear-gradient(180deg, rgba(24,27,25,.96), rgba(5,8,7,.98)) !important;
  box-shadow:
    0 6px 11px rgba(0,0,0,.50),
    inset 0 1px 0 rgba(255,255,255,.13) !important;
}

[data-mountain-race-mount][data-mr-full-cliff="23"] .mr-rock-hold.current b {
  border-color: rgba(255,220,137,.95) !important;
  box-shadow:
    0 7px 12px rgba(0,0,0,.53),
    0 0 10px rgba(255,191,66,.78),
    0 0 24px rgba(255,143,41,.28),
    inset 0 1px 0 rgba(255,255,255,.20) !important;
}

[data-mountain-race-mount][data-mr-full-cliff="23"] .mr-lane.opponent .mr-rock-hold.current b {
  border-color: rgba(171,226,255,.92) !important;
  box-shadow:
    0 7px 12px rgba(0,0,0,.53),
    0 0 10px rgba(76,191,255,.76),
    0 0 23px rgba(39,145,213,.27),
    inset 0 1px 0 rgba(255,255,255,.18) !important;
}

[data-mountain-race-mount][data-mr-full-cliff="23"] .mr-direction-glyph-v18 {
  width: 22px !important;
  height: 22px !important;
  filter: drop-shadow(0 1px 1px rgba(0,0,0,.72)) !important;
}

/* Real reference grass/earth, centered from each lane midpoint. */
[data-mountain-race-mount][data-mr-full-cliff="23"] .mr-start-ledge,
[data-mountain-race-mount][data-mr-full-cliff="23"] .mr-finish-ledge {
  left: 50% !important;
  right: auto !important;
  width: min(91%, 320px) !important;
  max-width: calc(100% - 12px) !important;
  margin: 0 !important;
  transform: translateX(-50%) !important;
  box-sizing: border-box !important;
  border: 0 !important;
  border-radius: 22px 22px 14px 14px !important;
  background:
    linear-gradient(180deg, rgba(255,238,192,.055), rgba(5,8,6,.09)),
    var(--mr-v23-grass, linear-gradient(180deg, #697b40 0 34%, #3c3022 35% 100%)) !important;
  background-size: 100% 100%, cover !important;
  background-position: center !important;
  background-repeat: no-repeat !important;
  box-shadow:
    0 13px 20px rgba(2,6,5,.37),
    inset 0 1px 0 rgba(255,239,197,.12),
    inset 0 -10px 17px rgba(3,7,5,.17) !important;
}

[data-mountain-race-mount][data-mr-full-cliff="23"] .mr-start-ledge::before,
[data-mountain-race-mount][data-mr-full-cliff="23"] .mr-finish-ledge::before {
  content: none !important;
  display: none !important;
  animation: none !important;
}

[data-mountain-race-mount][data-mr-full-cliff="23"] .mr-start-ledge::after,
[data-mountain-race-mount][data-mr-full-cliff="23"] .mr-finish-ledge::after {
  content: '' !important;
  position: absolute !important;
  left: 14% !important;
  right: 14% !important;
  bottom: -9px !important;
  height: 17px !important;
  border-radius: 50% !important;
  background: radial-gradient(ellipse, rgba(0,0,0,.34), transparent 70%) !important;
  pointer-events: none !important;
}

[data-mountain-race-mount][data-mr-full-cliff="23"] .mr-climber {
  z-index: 12 !important;
  transform-origin: 50% 100% !important;
  filter:
    drop-shadow(5px 8px 5px rgba(2,5,4,.42))
    drop-shadow(-1px -1px 1px rgba(255,229,185,.10)) !important;
}

/* Remove V22's residual route-line emphasis; the photographed ropes are enough. */
[data-mountain-race-mount][data-mr-full-cliff="23"] .mr-route-rope {
  opacity: .08 !important;
}

/* Keep the control deck centered to the same viewport geometry. */
[data-mountain-race-mount][data-mr-full-cliff="23"] .mr-command-deck {
  left: 50% !important;
  right: auto !important;
  width: min(94%, 620px) !important;
  max-width: calc(100% - 18px) !important;
  transform: translateX(-50%) !important;
  box-sizing: border-box !important;
}
`;
}

html = html.replace(/mountain-race-multiplayer\.js\?([^"']*)/g, (full, query) => full.includes('fullcliff=23') ? full : `mountain-race-multiplayer.js?${query}&fullcliff=23`);
html = html.replace(/mountain-race\.css\?([^"']*)/g, (full, query) => full.includes('fullcliff=23') ? full : `mountain-race.css?${query}&fullcliff=23`);

await Promise.all([
  writeFile(cssUrl, css),
  writeFile(runtimeUrl, runtime),
  writeFile(indexUrl, html)
]);
