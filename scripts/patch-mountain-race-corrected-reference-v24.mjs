import { readFile, writeFile } from 'node:fs/promises';

const rootUrl = new URL('../', import.meta.url);
const cssUrl = new URL('assets/mountain-race/mountain-race.css', rootUrl);
const runtimeUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', rootUrl);
const indexUrl = new URL('index.html', rootUrl);
const marker = 'MOUNTAIN_RACE_CORRECTED_REFERENCE_V24';

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint Corrected Reference V24 could not find ${label}.`);
  return source.replace(before, after);
}

let [css, runtime, html] = await Promise.all([
  readFile(cssUrl, 'utf8'),
  readFile(runtimeUrl, 'utf8'),
  readFile(indexUrl, 'utf8')
]);

if (!runtime.includes(marker)) {
  runtime += String.raw`

// MOUNTAIN_RACE_CORRECTED_REFERENCE_V24
// V23 sampled the center of the complete reference frame, so each narrow lane
// contained both cliffs/chasm and was then stretched. V24 crops the real left
// and right cliff faces independently, preserves their native ~1:3 proportions,
// stacks two sharp photographic sections to fill the long scrolling wall, and
// derives the grass and route ledges from their actual locations in the reference.
function ensureCorrectedReferenceV24(root) {
  if (!root) return;
  root.dataset.mrCorrectedReference = '24';

  const install = atlas => {
    if (!atlas || !root?.style) return;
    root.style.setProperty('--mr-v24-left-cliff', 'url("' + atlas.left + '")');
    root.style.setProperty('--mr-v24-right-cliff', 'url("' + atlas.right + '")');
    root.style.setProperty('--mr-v24-grass', 'url("' + atlas.grass + '")');
    root.style.setProperty('--mr-v24-holds', 'url("' + atlas.holds + '")');
    root.dataset.mrCorrectedReferenceReady = '1';
  };

  if (window.__mountainRaceCorrectedReferenceV24) {
    install(window.__mountainRaceCorrectedReferenceV24);
    return;
  }

  if (!window.__mountainRaceCorrectedReferenceV24Promise) {
    window.__mountainRaceCorrectedReferenceV24Promise = new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => {
        try {
          const sourceW = image.naturalWidth || image.width;
          const sourceH = image.naturalHeight || image.height;
          if (!sourceW || !sourceH) throw new Error('corrected reference has no dimensions');

          // Coordinates were measured on the approved 955 x 1647 reference.
          // Ratios make the same crop work if the build source is resized.
          const sx = value => (value / 955) * sourceW;
          const sy = value => (value / 1647) * sourceH;
          const leftRect = { x: sx(105), y: sy(125), w: sx(290), h: sy(870) };
          const rightRect = { x: sx(555), y: sy(125), w: sx(290), h: sy(870) };

          const drawCrop = (ctx, rect, dx, dy, dw, dh, mirror = false) => {
            ctx.save();
            if (mirror) {
              ctx.translate(dx + dw, dy);
              ctx.scale(-1, 1);
              ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h, 0, 0, dw, dh);
            } else {
              ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h, dx, dy, dw, dh);
            }
            ctx.restore();
          };

          const makeCliff = (firstRect, secondRect, mirrorSecond) => {
            const canvas = document.createElement('canvas');
            canvas.width = 320;
            canvas.height = 1920;
            const ctx = canvas.getContext('2d', { alpha: false });
            if (!ctx) throw new Error('corrected cliff canvas unavailable');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            // Each original 290x870 crop is ~1:3. It is scaled proportionally to
            // 320x960 and stacked, instead of stretching one short crop to 1700px.
            drawCrop(ctx, firstRect, 0, 0, 320, 960, false);
            drawCrop(ctx, secondRect, 0, 960, 320, 960, mirrorSecond);

            // Hide the join with a narrow geological fracture rather than blur.
            const seamY = 960;
            ctx.beginPath();
            for (let x = 0; x <= canvas.width; x += 10) {
              const y = seamY + Math.sin(x * 0.082) * 4 + Math.sin(x * 0.029 + 1.7) * 3;
              if (x === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.strokeStyle = 'rgba(20,17,12,.42)';
            ctx.lineWidth = 2.2;
            ctx.stroke();
            ctx.translate(0, 2);
            ctx.strokeStyle = 'rgba(223,190,132,.10)';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.setTransform(1, 0, 0, 1, 0, 0);

            const daylight = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            daylight.addColorStop(0, 'rgba(255,239,199,.10)');
            daylight.addColorStop(.30, 'rgba(255,239,199,.018)');
            daylight.addColorStop(.76, 'rgba(7,9,8,0)');
            daylight.addColorStop(1, 'rgba(5,7,6,.055)');
            ctx.fillStyle = daylight;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            return canvas.toDataURL('image/png');
          };

          const grassRects = [
            [95, 1060, 150, 150],
            [720, 1060, 150, 150],
            [35, 1055, 150, 150],
            [770, 1025, 150, 150]
          ];
          const rockRects = [
            [220, 310, 150, 150],
            [600, 320, 150, 150],
            [200, 640, 150, 150],
            [560, 670, 150, 150]
          ];

          const makeGrass = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 768;
            canvas.height = 190;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('corrected grass canvas unavailable');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            ctx.save();
            ctx.beginPath();
            const points = [
              [16,48],[36,27],[80,14],[130,8],[190,11],[248,5],[310,10],[376,4],
              [444,9],[512,5],[580,10],[644,6],[705,16],[748,40],[746,98],[724,130],
              [682,154],[620,171],[549,182],[465,188],[380,188],[292,184],[211,175],
              [140,161],[78,142],[36,116]
            ];
            points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
            ctx.closePath();
            ctx.clip();

            for (let i = 0; i < 4; i += 1) {
              const [rx, ry, rw, rh] = rockRects[i];
              ctx.drawImage(image, sx(rx), sy(ry), sx(rw), sy(rh), i * 192, 62, 194, 128);
              const [gx, gy, gw, gh] = grassRects[i];
              ctx.drawImage(image, sx(gx), sy(gy), sx(gw), sy(gh), i * 192, 0, 194, 92);
            }

            const sun = ctx.createLinearGradient(0, 0, 0, canvas.height);
            sun.addColorStop(0, 'rgba(255,241,197,.14)');
            sun.addColorStop(.36, 'rgba(255,241,197,.02)');
            sun.addColorStop(1, 'rgba(5,8,5,.08)');
            ctx.fillStyle = sun;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.restore();
            return canvas.toDataURL('image/png');
          };

          const holdRects = [
            [205,165,155,80],
            [245,310,155,85],
            [210,490,170,95],
            [255,745,165,95],
            [520,170,160,85],
            [505,460,185,100]
          ];

          const makeHolds = () => {
            const tileW = 160;
            const tileH = 96;
            const canvas = document.createElement('canvas');
            canvas.width = tileW * holdRects.length;
            canvas.height = tileH;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('corrected hold canvas unavailable');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            holdRects.forEach(([rx, ry, rw, rh], index) => {
              const ox = index * tileW;
              ctx.save();
              ctx.translate(ox, 0);
              ctx.beginPath();
              ctx.moveTo(8, 42);
              ctx.lineTo(18, 25);
              ctx.lineTo(43, 13);
              ctx.lineTo(78, 8);
              ctx.lineTo(119, 12);
              ctx.lineTo(148, 28);
              ctx.lineTo(156, 48);
              ctx.lineTo(147, 68);
              ctx.lineTo(124, 83);
              ctx.lineTo(85, 90);
              ctx.lineTo(49, 86);
              ctx.lineTo(22, 70);
              ctx.closePath();
              ctx.clip();
              ctx.drawImage(image, sx(rx), sy(ry), sx(rw), sy(rh), 0, 0, tileW, tileH);
              ctx.restore();
            });
            return canvas.toDataURL('image/png');
          };

          const atlas = {
            left: makeCliff(leftRect, rightRect, true),
            right: makeCliff(rightRect, leftRect, true),
            grass: makeGrass(),
            holds: makeHolds()
          };
          window.__mountainRaceCorrectedReferenceV24 = atlas;
          resolve(atlas);
        } catch (error) {
          reject(error);
        }
      };
      image.onerror = () => reject(new Error('V24 approved reference failed to load'));
      image.src = 'assets/mountain-race/images/summit-sprint-reference-v21.jpg?corrected=24';
    }).catch(error => {
      console.warn('[Summit Sprint V24] corrected reference fallback active:', error);
      return null;
    });
  }

  window.__mountainRaceCorrectedReferenceV24Promise.then(install);
}
`;

  const installationCandidates = [
    '    ensureFullCliffV23(root);',
    '    ensureReferenceRebuildV22(root);',
    '    ensureReferenceAtlasV21(root);'
  ];
  const installationNeedle = installationCandidates.find(candidate => runtime.includes(candidate));
  if (!installationNeedle) throw new Error('Summit Sprint Corrected Reference V24 could not find a visual installation hook.');
  runtime = replaceRequired(
    runtime,
    installationNeedle,
    `${installationNeedle}\n    ensureCorrectedReferenceV24(root);`,
    'latest visual installation hook'
  );
}

if (!css.includes(marker)) {
  css += String.raw`

/* MOUNTAIN_RACE_CORRECTED_REFERENCE_V24
   True left/right cliff crops from the approved reference. Two proportional
   photographic sections are stacked to fill the scroll wall; nothing is blurred
   or stretched from the center of the complete screenshot. */

[data-mountain-race-mount][data-mr-corrected-reference="24"] .mr-climb-viewport {
  box-sizing: border-box !important;
  padding-inline: clamp(9px, 2vw, 15px) !important;
  overflow: hidden !important;
  background:
    radial-gradient(circle at 10% 2%, rgba(255,244,205,.27), transparent 28%),
    linear-gradient(180deg, #8bc7df 0%, #6ca9c2 47%, #456e79 100%) !important;
}

[data-mountain-race-mount][data-mr-corrected-reference="24"] .mr-climb-viewport::before {
  content: '' !important;
  position: absolute !important;
  inset: 0 !important;
  z-index: 9 !important;
  pointer-events: none !important;
  background:
    radial-gradient(ellipse at 11% 2%, rgba(255,240,199,.12), transparent 28%),
    linear-gradient(108deg, rgba(255,232,185,.035), transparent 40%, rgba(5,8,7,.025) 100%) !important;
  opacity: 1 !important;
  mix-blend-mode: normal !important;
}

[data-mountain-race-mount][data-mr-corrected-reference="24"] .mr-climb-viewport::after {
  content: none !important;
}

[data-mountain-race-mount][data-mr-corrected-reference="24"] .mr-race-stage,
[data-mountain-race-mount][data-mr-corrected-reference="24"] .mr-lanes,
[data-mountain-race-mount][data-mr-corrected-reference="24"] .mr-race-lanes,
[data-mountain-race-mount][data-mr-corrected-reference="24"] .mr-lane-grid {
  box-sizing: border-box !important;
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  justify-content: center !important;
  justify-items: stretch !important;
}

[data-mountain-race-mount][data-mr-corrected-reference="24"] .mr-lane {
  width: 100% !important;
  min-width: 0 !important;
  max-width: none !important;
  margin: 0 !important;
  justify-self: stretch !important;
  overflow: hidden !important;
  clip-path: none !important;
  border-radius: 21px 21px 8px 8px !important;
}

[data-mountain-race-mount][data-mr-corrected-reference="24"] .mr-mountain-wall {
  left: 0 !important;
  right: 0 !important;
  width: 100% !important;
  margin: 0 !important;
  overflow: hidden !important;
  clip-path: none !important;
  border-radius: 18px 18px 7px 7px !important;
  background-color: #48443a !important;
  background-image: none !important;
  filter: none !important;
  box-shadow:
    inset 7px 0 15px rgba(255,229,181,.035),
    inset -10px 0 18px rgba(4,6,5,.10),
    0 10px 22px rgba(2,6,6,.20) !important;
}

[data-mountain-race-mount][data-mr-corrected-reference-ready="1"] .mr-mountain-wall {
  background-image:
    linear-gradient(108deg, rgba(255,237,199,.028) 0%, transparent 40%, rgba(4,7,6,.035) 100%),
    var(--mr-v24-left-cliff) !important;
  background-size: 100% 100%, 100% 100% !important;
  background-position: center, center !important;
  background-repeat: no-repeat !important;
}

[data-mountain-race-mount][data-mr-corrected-reference-ready="1"] .mr-lane.opponent .mr-mountain-wall {
  background-image:
    linear-gradient(108deg, rgba(255,237,199,.025) 0%, transparent 40%, rgba(4,7,6,.038) 100%),
    var(--mr-v24-right-cliff) !important;
}

[data-mountain-race-mount][data-mr-corrected-reference="24"] .mr-mountain-wall::before {
  content: '' !important;
  position: absolute !important;
  inset: 0 !important;
  z-index: 1 !important;
  pointer-events: none !important;
  background: linear-gradient(100deg, rgba(255,230,183,.022), transparent 33%, rgba(3,6,5,.028) 100%) !important;
  opacity: 1 !important;
  mix-blend-mode: normal !important;
}

[data-mountain-race-mount][data-mr-corrected-reference="24"] .mr-mountain-wall::after {
  content: none !important;
}

[data-mountain-race-mount][data-mr-corrected-reference="24"] .mr-stage-ridge,
[data-mountain-race-mount][data-mr-corrected-reference="24"] .mr-lane-ridge {
  opacity: 0 !important;
}

[data-mountain-race-mount][data-mr-corrected-reference="24"] .mr-route-rope {
  opacity: .07 !important;
  filter: none !important;
}

/* Real reference ledges are visible at every route point. Only the direction
   badge is hidden for unrevealed future prompts. */
[data-mountain-race-mount][data-mr-corrected-reference="24"] .mr-rock-hold {
  z-index: 8 !important;
  width: 88px !important;
  height: 58px !important;
  border: 0 !important;
  border-radius: 0 !important;
  color: #f4f4ed !important;
  background-color: transparent !important;
  background-image: var(--mr-v24-holds) !important;
  background-size: 600% 100% !important;
  background-repeat: no-repeat !important;
  box-shadow: none !important;
  clip-path: polygon(5% 44%, 12% 25%, 27% 12%, 49% 5%, 75% 10%, 92% 28%, 98% 50%, 91% 72%, 75% 87%, 52% 95%, 29% 90%, 13% 74%) !important;
  filter: drop-shadow(0 8px 5px rgba(5,7,6,.47)) !important;
  opacity: 1 !important;
}

[data-mountain-race-mount][data-mr-corrected-reference="24"] .mr-rock-hold:nth-of-type(6n + 1) { background-position: 0% 0 !important; }
[data-mountain-race-mount][data-mr-corrected-reference="24"] .mr-rock-hold:nth-of-type(6n + 2) { background-position: 20% 0 !important; }
[data-mountain-race-mount][data-mr-corrected-reference="24"] .mr-rock-hold:nth-of-type(6n + 3) { background-position: 40% 0 !important; }
[data-mountain-race-mount][data-mr-corrected-reference="24"] .mr-rock-hold:nth-of-type(6n + 4) { background-position: 60% 0 !important; }
[data-mountain-race-mount][data-mr-corrected-reference="24"] .mr-rock-hold:nth-of-type(6n + 5) { background-position: 80% 0 !important; }
[data-mountain-race-mount][data-mr-corrected-reference="24"] .mr-rock-hold:nth-of-type(6n) { background-position: 100% 0 !important; }

[data-mountain-race-mount][data-mr-corrected-reference="24"] .mr-rock-hold.unknown,
[data-mountain-race-mount][data-mr-corrected-reference="24"] .mr-rock-hold.distant {
  opacity: .88 !important;
  filter: drop-shadow(0 8px 5px rgba(5,7,6,.38)) saturate(.90) brightness(.91) !important;
}

[data-mountain-race-mount][data-mr-corrected-reference="24"] .mr-rock-hold.unknown b,
[data-mountain-race-mount][data-mr-corrected-reference="24"] .mr-rock-hold.distant b {
  opacity: 0 !important;
}

[data-mountain-race-mount][data-mr-corrected-reference="24"] .mr-rock-hold.passed {
  opacity: .67 !important;
  filter: drop-shadow(0 7px 4px rgba(5,7,6,.35)) saturate(.78) brightness(.84) !important;
}

[data-mountain-race-mount][data-mr-corrected-reference="24"] .mr-rock-hold b {
  display: grid !important;
  place-items: center !important;
  width: 34px !important;
  height: 34px !important;
  margin: auto !important;
  border: 1px solid rgba(235,225,203,.62) !important;
  border-radius: 50% !important;
  clip-path: none !important;
  background:
    radial-gradient(circle at 32% 24%, rgba(255,255,255,.18), transparent 34%),
    linear-gradient(180deg, rgba(25,28,26,.97), rgba(5,8,7,.98)) !important;
  box-shadow: 0 5px 9px rgba(0,0,0,.54), inset 0 1px 0 rgba(255,255,255,.13) !important;
  text-shadow: 0 2px 2px rgba(0,0,0,.78) !important;
}

[data-mountain-race-mount][data-mr-corrected-reference="24"] .mr-rock-hold.current {
  opacity: 1 !important;
  filter:
    drop-shadow(0 9px 6px rgba(5,7,6,.50))
    drop-shadow(0 0 11px rgba(255,190,68,.65)) !important;
}

[data-mountain-race-mount][data-mr-corrected-reference="24"] .mr-lane.opponent .mr-rock-hold.current {
  filter:
    drop-shadow(0 9px 6px rgba(5,7,6,.50))
    drop-shadow(0 0 11px rgba(79,190,255,.55)) !important;
}

[data-mountain-race-mount][data-mr-corrected-reference="24"] .mr-start-ledge,
[data-mountain-race-mount][data-mr-corrected-reference="24"] .mr-finish-ledge {
  left: 50% !important;
  width: 88% !important;
  height: 70px !important;
  transform: translate(-50%, 50%) !important;
  border: 0 !important;
  border-radius: 0 !important;
  color: rgba(245,244,225,.92) !important;
  background-color: transparent !important;
  background-image: var(--mr-v24-grass) !important;
  background-size: 100% 100% !important;
  background-position: center !important;
  background-repeat: no-repeat !important;
  box-shadow: none !important;
  filter: drop-shadow(0 11px 7px rgba(3,7,5,.43)) !important;
  clip-path: none !important;
}

[data-mountain-race-mount][data-mr-corrected-reference="24"] .mr-start-ledge::before,
[data-mountain-race-mount][data-mr-corrected-reference="24"] .mr-start-ledge::after,
[data-mountain-race-mount][data-mr-corrected-reference="24"] .mr-finish-ledge::before,
[data-mountain-race-mount][data-mr-corrected-reference="24"] .mr-finish-ledge::after {
  content: none !important;
}

[data-mountain-race-mount][data-mr-corrected-reference="24"] .mr-climber {
  left: 50% !important;
  filter:
    drop-shadow(5px 9px 5px rgba(3,6,5,.45))
    drop-shadow(-1px -1px 1px rgba(255,231,188,.08)) !important;
}
`;
}

html = html.replace(/mountain-race-multiplayer\.js\?([^"']*)/g, (full, query) => full.includes('corrected=24') ? full : `mountain-race-multiplayer.js?${query}&corrected=24`);
html = html.replace(/mountain-race\.css\?([^"']*)/g, (full, query) => full.includes('corrected=24') ? full : `mountain-race.css?${query}&corrected=24`);

await Promise.all([
  writeFile(cssUrl, css),
  writeFile(runtimeUrl, runtime),
  writeFile(indexUrl, html)
]);
