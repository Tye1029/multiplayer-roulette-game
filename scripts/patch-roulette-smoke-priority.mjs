import { readFile, writeFile } from 'node:fs/promises';

const indexUrl = new URL('../index.html', import.meta.url);
let html = await readFile(indexUrl, 'utf8');
const marker = '<style id="rr-v151-reactive-smoke-priority">';

if (!html.includes(marker)) {
  const style = `${marker}
  [data-roulette-game]{
    --rr-smoke-density:1.05;
    --rr-smoke-light:1.12;
    --rr-smoke-blur:9px;
    --rr-smoke-speed:12s;
  }
  [data-roulette-game] .rr-smoke{
    display:block!important;
    position:absolute!important;
    inset:4% -18% 24%!important;
    z-index:5!important;
    opacity:1!important;
    visibility:visible!important;
    overflow:hidden!important;
    pointer-events:none!important;
    animation:none!important;
    transform:none!important;
    background:none!important;
    mix-blend-mode:screen!important;
  }
  [data-roulette-game] .rr-smoke-ambient,
  [data-roulette-game] .rr-smoke-lit{
    position:absolute!important;
    inset:-15% -12%!important;
    display:block!important;
    visibility:visible!important;
    pointer-events:none!important;
  }
  [data-roulette-game] .rr-smoke-ambient{
    opacity:calc(var(--rr-smoke-density) * .60)!important;
    filter:blur(var(--rr-smoke-blur))!important;
    background:
      repeating-linear-gradient(169deg,transparent 0 25px,rgba(194,199,202,.13) 31px 38px,transparent 45px 68px),
      radial-gradient(ellipse 48% 22% at 22% 55%,rgba(205,210,212,.25),transparent 74%),
      radial-gradient(ellipse 58% 24% at 74% 36%,rgba(180,187,191,.22),transparent 76%),
      radial-gradient(ellipse 70% 30% at 50% 72%,rgba(159,166,170,.16),transparent 78%)!important;
    animation:rrRoomSmokeDrift var(--rr-smoke-speed) ease-in-out infinite alternate!important;
  }
  [data-roulette-game] .rr-smoke-lit{
    opacity:calc(var(--rr-smoke-light) * .62)!important;
    filter:blur(calc(var(--rr-smoke-blur) + 3px)) saturate(1.15)!important;
    background:
      radial-gradient(ellipse 38% 66% at 50% 46%,rgba(255,229,178,.42) 0,rgba(255,169,77,.25) 38%,rgba(194,93,27,.08) 65%,transparent 80%),
      repeating-linear-gradient(171deg,transparent 0 24px,rgba(255,218,164,.15) 30px 37px,transparent 44px 68px)!important;
    background-size:125% 100%,100% 100%!important;
    mix-blend-mode:screen!important;
    will-change:transform,opacity;
  }
  @keyframes rrRoomSmokeDrift{
    0%{transform:translate3d(-2.5%,2%,0) scale(1.02)}
    50%{transform:translate3d(1.5%,-1%,0) scale(1.07)}
    100%{transform:translate3d(3%,-3%,0) scale(1.04)}
  }
  @media(max-width:600px){
    [data-roulette-game] .rr-smoke{inset:7% -22% 27%!important}
  }
  @media(prefers-reduced-motion:reduce){
    [data-roulette-game] .rr-smoke-ambient,
    [data-roulette-game] .rr-smoke-lit{animation:none!important;transform:none!important}
  }
</style>`;
  if (!html.includes('</head>')) throw new Error('Reactive smoke priority patch could not find </head>.');
  html = html.replace('</head>', `${style}\n</head>`);
}

await writeFile(indexUrl, html);
console.log('Applied final-priority visible smoke styling driven by live scene settings.');
