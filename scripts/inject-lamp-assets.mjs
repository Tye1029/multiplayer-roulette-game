import { readFile, writeFile } from 'node:fs/promises';

const indexUrl = new URL('../index.html', import.meta.url);
const startMarker = '<!-- MODULAR_LAMP_ASSETS_START -->';
const endMarker = '<!-- MODULAR_LAMP_ASSETS_END -->';

// These are confirmed obsolete lamp/lighting experiments. This build step does
// not inspect, replace, or rewrite roulette gameplay or gun animation functions.
const obsoleteLampBlockIds = [
  'rr-v114-image2-lamp-rig',
  'rr-v115-lamp-and-light-runtime',
  'rr-v126-split-lamp-rig',
  'rr-v127-lamp-layer-fix',
  'rr-v130-table-surface-lighting',
  'rr-v134-clean-reactive-lighting',
  'rr-v135-overhead-table-light-fix',
  'rr-v136-center-bright-full-table-extension',
  'rr-v136-table-edge-layer',
  'rr-v137-reference-centered-textured-lighting',
  'rr-v139-visible-reference-lighting',
  'rr-v140-lighting-debug-rebuild',
  'rr-v140-lighting-debug-tools',
  'rr-v141-debug-bootstrap',
  'rr-v141-debug-visible-fix',
  'rr-v142-warm-rough-table-authoritative',
  'rr-v143-clean-moving-light-authoritative',
  'rr-v143-remove-debug-ui',
  'rr-v144-targeted-light-balance',
  'rr-v145-single-driver-light-sync',
  'rr-v145-single-driver-light-sync-script',
  'rr-v146-lamp-art-cleanup',
  'rr-v147-halo-bulb-direction-fix',
  'rr-v148-final-lamp-asset-cleanup',
  'rr-live-lamp-calibration-style',
  'rr-live-lamp-calibration-script',
  'rr-live-lamp-calibration-overrides'
];

const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function removeObsoleteLampBlocks(source) {
  let html = source;
  for (const id of obsoleteLampBlockIds) {
    const escaped = escapeRegex(id);
    const pattern = new RegExp(
      String.raw`(?:\n)?\s*<(style|script)\b[^>]*\bid=["']${escaped}["'][^>]*>[\s\S]*?<\/\1>\s*`,
      'gi'
    );
    html = html.replace(pattern, '\n');
  }
  return html;
}

const uploadedRouletteAudioFunctions = String.raw`
    function rouletteUploadedAudio(src,volume=.2,rate=1){
      if(document.hidden)return null;
      try{
        const audio=new Audio(src);
        audio.preload='auto';
        audio.volume=Math.max(0,Math.min(1,Number(volume)||0));
        audio.playbackRate=Math.max(.7,Math.min(1.35,Number(rate)||1));
        audio.preservesPitch=false;
        audio.playsInline=true;
        audio.play().catch(()=>{});
        return audio;
      }catch(_){return null}
    }
    let rouletteSpinPlayback=null;
    let rouletteSpinTimers=[];
    let rouletteHammerVariant=0;
    let rouletteDryVariant=0;
    function rouletteClearSpinPlayback(){
      for(const timer of rouletteSpinTimers)clearTimeout(timer);
      rouletteSpinTimers=[];
      try{rouletteSpinPlayback?.pause()}catch(_){}
      rouletteSpinPlayback=null;
    }
    function rouletteScheduleSpinSound(callback,delay){
      const timer=setTimeout(callback,delay);
      rouletteSpinTimers.push(timer);
      return timer;
    }
    function rouletteSpinSound(speedMultiplier=1){
      rouletteClearSpinPlayback();
      const opening=Number(speedMultiplier)>=1.2;
      if(!opening){
        rouletteSpinPlayback=rouletteUploadedAudio('assets/roulette/audio/freesound_community-revolver-chamber-spin-ratchet-sound-90521.mp3',.2,.94);
        rouletteScheduleSpinSound(()=>rouletteUploadedAudio('assets/roulette/audio/freesound_community-revolver-cocking-104722.mp3',.16,1),720);
        return;
      }
      rouletteSpinPlayback=rouletteUploadedAudio('assets/roulette/audio/freesound_community-revolver-spin-96947.mp3',.36,.82);
      const ratchet='assets/roulette/audio/freesound_community-revolver-chamber-spin-ratchet-sound-90521.mp3';
      [360,900,1540,2320,3200,4100].forEach((delay,index)=>{
        rouletteScheduleSpinSound(()=>rouletteUploadedAudio(ratchet,Math.max(.06,.12-index*.009),1.07-index*.055),delay);
      });
      rouletteScheduleSpinSound(()=>rouletteUploadedAudio('assets/roulette/audio/freesound_community-revolver-cocking-104722.mp3',.2,1),4780);
    }
    function rouletteShotIndexSound(){
      const sources=[
        'assets/roulette/audio/freesound_community-pistol-hammer-cocking-back-4-39887.mp3',
        'assets/roulette/audio/freesound_community-cocking-a-revolver-6279.mp3'
      ];
      const source=sources[rouletteHammerVariant%sources.length];
      rouletteHammerVariant=(rouletteHammerVariant+1)%sources.length;
      rouletteUploadedAudio(source,.24,1);
    }
    function rouletteBlankSound(){
      const sources=[
        'assets/roulette/audio/spinopel-dry-fire-gun-364844.mp3',
        'assets/roulette/audio/freesound_community-gun-dry-firing-3-39820.mp3'
      ];
      const source=sources[rouletteDryVariant%sources.length];
      rouletteDryVariant=(rouletteDryVariant+1)%sources.length;
      rouletteUploadedAudio(source,.31,1);
      setTimeout(()=>rouletteUploadedAudio('assets/roulette/audio/freesound_community-revolver-cocking-104722.mp3',.045,1),45);
    }
    function rouletteGunshotSound(){
      window.RouletteAmbientAudio?.duckForShot?.();
      rouletteUploadedAudio('assets/roulette/audio/freesound_community-single-pistol-gunshot-33-37187.mp3',.78,1);
    }
`;

function replaceLegacyRouletteAudio(source) {
  const start = source.indexOf('function rouletteSpinSound');
  const end = source.indexOf('function rouletteTone', start);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error('Could not locate the legacy roulette sound function block.');
  }

  let html = source.slice(0, start) + uploadedRouletteAudioFunctions + source.slice(end);
  html = html.replace(
    /\s*wrap\('rouletteSpinSound',[\s\S]*?wrap\('rouletteGunshotSound',live\);/g,
    '\n  /* Uploaded recordings replace all premium procedural roulette sound wrappers. */'
  );
  return html;
}

const criticalStyle = `  <link id="rrLampExternalStyles" rel="stylesheet" href="/assets/roulette/lamp.css?v=18">
  <style id="rrLampCriticalHide">
    [data-roulette-game] > .rr-lamp,
    [data-roulette-game] .rr-lamp-fixture,
    [data-roulette-game] .rr-v106-lamp-art,
    [data-roulette-game] .rr-v114-lamp-art,
    [data-roulette-game] .rr-v120-lamp-rig,
    [data-roulette-game] .rr-v122-lamp-rig,
    [data-roulette-game] .rr-v123-lamp-layer,
    [data-roulette-game] .rr-v124-lamp-fixture,
    [data-roulette-game] .rr126-swing::before,
    [data-roulette-game] .rr126-swing::after,
    [data-roulette-game] .rr126-bulb-glow,
    [data-roulette-game] .rr126-room-glow,
    [data-roulette-game] .rr126-beam,
    [data-roulette-game] .rr126-swing > img:not(#rrLampPng),
    [data-roulette-game] .rr126-swing > [class*="lamp-body"],
    [data-roulette-game] .rr126-swing > [class*="lamp-shade"],
    [data-roulette-game] .rr126-swing > [class*="shade-art"],
    [data-roulette-game] .rr126-swing > [class*="underside"] {
      display:none!important;visibility:hidden!important;opacity:0!important;
    }
    [data-roulette-game] .rr126-lamp-rig{position:absolute!important;inset:0 0 auto 0!important;width:100%!important;height:58%!important;z-index:4!important;pointer-events:none!important;overflow:visible!important}
    [data-roulette-game] .rr126-chain{position:absolute!important;top:0!important;left:49.75%;width:12.5px;height:5%;transform:translateX(-50%) scaleX(.56);background:url('/assets/roulette/decor/workshop-lamp-chain.png') center top/12.5px auto repeat-y!important;z-index:2!important}
    [data-roulette-game] .rr126-swing{position:absolute!important;top:calc(20% - 26px);left:49.75%;width:44%!important;aspect-ratio:325/273!important;transform:translateX(-50%);transform-origin:50% 0!important;overflow:visible!important;visibility:visible!important;opacity:1!important;z-index:3!important}
    [data-roulette-game] #rrLampPng{position:absolute!important;left:calc(50% - .75%)!important;top:90.5%!important;width:94%!important;height:auto!important;transform:translate(-50%,-50%) scale(1.1)!important;visibility:visible!important;opacity:1!important}
    [data-roulette-game] .rr130-table-illumination{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;pointer-events:none!important}
    @media(min-width:701px){[data-roulette-game] .rr126-lamp-rig{height:51%!important}[data-roulette-game] .rr126-swing{width:31%!important;max-width:230px!important}}
    @media(max-width:700px),(hover:none) and (pointer:coarse){[data-roulette-game] .rr126-lamp-rig{height:57%!important}[data-roulette-game] .rr126-swing{width:43%!important;max-width:none!important}}
  </style>`;

const block = `${startMarker}\n` +
  `${criticalStyle}\n` +
  '  <script src="/assets/roulette/lamp-config.js?v=19" defer></script>\n' +
  '  <script src="/assets/roulette/lamp.js?v=20" defer></script>\n' +
  '  <script src="/assets/roulette/lamp-bootstrap.js?v=19" defer></script>\n' +
  '  <script src="/assets/roulette/turn-animation.js?v=5" defer></script>\n' +
  '  <script src="/assets/roulette/turn-fire.js?v=2" defer></script>\n' +
  '  <script src="/assets/roulette/audio-manager.js?v=3" defer></script>\n' +
  `${endMarker}`;

let html = await readFile(indexUrl, 'utf8');
html = removeObsoleteLampBlocks(html);
html = replaceLegacyRouletteAudio(html);
const markerPattern = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`, 'm');

if (markerPattern.test(html)) {
  html = html.replace(markerPattern, block);
} else if (html.includes('</head>')) {
  html = html.replace('</head>', `${block}\n</head>`);
} else {
  throw new Error('Cannot inject isolated assets: index.html has no </head> tag');
}

await writeFile(indexUrl, html);
console.log('Replaced duplicate legacy roulette sounds with uploaded recordings and injected isolated ambient audio.');
