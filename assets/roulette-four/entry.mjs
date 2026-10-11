// Keep the isolated bot table available for regression tests and free practice.
if(new URLSearchParams(location.search).get('practice')==='1')await import('./table.mjs?v=four-player-roulette-connected-v8');
else await import('./online.mjs?v=2');
