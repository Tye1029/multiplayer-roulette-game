import { readFile, writeFile } from 'node:fs/promises';

const indexUrl = new URL('../index.html', import.meta.url);
let html = await readFile(indexUrl, 'utf8');
const marker = '<style id="rr-v151-reactive-smoke-priority">';

if (!html.includes(marker)) {
  const style = `${marker}
  [data-roulette-game] .rr-smoke{
    display:block!important;
    position:absolute!important;
    inset:7% -12% 33%!important;
    z-index:3!important;
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
    inset:-16% -12%!important;
    display:block!important;
    visibility:visible!important;
    pointer-events:none!important;
  }
  [data-roulette-game] .rr-smoke-ambient{
    opacity:.30!important;
    filter:blur(11px)!important;
    background:
      repeating-linear-gradient(168deg,transparent 0 32px,rgba(176,181,184,.055) 38px 42px,transparent 49px 78px),
      radial-gradient(ellipse 38% 17% at 22% 52%,rgba(191,196,198,.11),transparent 72%),
      radial-gradient(ellipse 46% 20% at 72% 38%,rgba(169,175,178,.09),transparent 74%)!important;
    animation:rrRoomSmokeDrift 13s ease-in-out infinite alternate!important;
  }
  [data-roulette-game] .rr-smoke-lit{
    opacity:.26;
    filter:blur(13px) saturate(1.08)!important;
    background:
      radial-gradient(ellipse 34% 58% at 50% 48%,rgba(255,218,157,.24) 0,rgba(255,159,65,.12) 38%,transparent 76%),
      repeating-linear-gradient(171deg,transparent 0 27px,rgba(255,214,157,.08) 33px 38px,transparent 45px 72px)!important;
    background-size:125% 100%,100% 100%!important;
    mix-blend-mode:screen!important;
    will-change:transform,opacity;
  }
  @keyframes rrRoomSmokeDrift{
    0%{transform:translate3d(-2.5%,2%,0) scale(1.02);opacity:.22}
    50%{transform:translate3d(1.5%,-1%,0) scale(1.07);opacity:.34}
    100%{transform:translate3d(3%,-3%,0) scale(1.04);opacity:.26}
  }
  @media(max-width:600px){
    [data-roulette-game] .rr-smoke{inset:10% -18% 35%!important}
    [data-roulette-game] .rr-smoke-ambient{opacity:.25!important}
    [data-roulette-game] .rr-smoke-lit{opacity:.30}
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
console.log('Applied final-priority reactive smoke styling after legacy scene overrides.');
