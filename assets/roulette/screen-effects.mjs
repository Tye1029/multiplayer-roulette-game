/* Shared fatal-shot presentation. It never changes the game outcome. */
export function screenCrack(host,soundEnabled=true) {
  if (!host || host.querySelector('.xan-screen-crack')) return;
  const layer=document.createElement('div');layer.className='xan-screen-crack';layer.setAttribute('aria-hidden','true');
  layer.innerHTML='<svg viewBox="0 0 100 100" preserveAspectRatio="none"><g fill="none" stroke="#dbe7e7" stroke-width=".7"><path d="M49 46 34 28 19 12 0 4 M49 46 62 19 70 0 M49 46 76 37 100 19 M49 46 73 59 100 67 M49 46 60 77 70 100 M49 46 34 70 17 100 M49 46 21 51 0 70 M34 28 38 9 M76 37 90 43 100 35 M60 77 82 82 M21 51 19 73 M34 70 42 80 35 100 M19 12 16 30 0 33"/><path opacity=".5" d="M34 28 62 19 76 37 73 59 60 77 34 70 21 51Z M39 39 52 30 62 40 62 53 46 61 37 51Z"/></g><path fill="#08090ddd" d="m49 40 5 3 3 5-5 7-8-4-2-6Z"/></svg>';
  host.append(layer);
  if(soundEnabled&&!document.hidden&&!window.XanPreferences?.muted){const sound=new Audio('/assets/site-hub/audio/glass-break.ogg');sound.volume=.5;sound.play().catch(()=>{});}
}
