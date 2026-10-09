/* Recorded music/crowd + short announcer clips. Loaded only after a user gesture. */
(() => {
  'use strict';
  let enabled = localStorage.getItem('rps-muted') !== '1', unlocked = false, silent = false;
  const clips = new Map();
  let voice;
  function clip(name, loop = false) {
    if (!clips.has(name)) {
      const a = new Audio(`/assets/rps/audio/${name}.mp3?v=1`);
      a.preload = 'none'; a.loop = loop; clips.set(name, a);
    }
    return clips.get(name);
  }
  function play(a, volume, restart = false) {
    if (!enabled || !unlocked || document.hidden) return;
    a.volume = volume; if (restart) a.currentTime = 0;
    a.play().catch(() => {});
  }
  function ambience() {
    if (!enabled || !unlocked || document.hidden) return;
    if (silent) { clip('metal', true).pause(); clip('crowd', true).pause(); return; }
    play(clip('metal', true), .23); play(clip('crowd', true), .14);
  }
  function stop() { for (const a of clips.values()) a.pause(); }
  window.RPSAudio = {
    get enabled() { return enabled; },
    get unlocked() { return unlocked; },
    unlock() { unlocked = true; ambience(); },
    toggle() { enabled = !enabled; localStorage.setItem('rps-muted', enabled ? '0' : '1'); if (enabled) { unlocked = true; ambience(); } else stop(); return enabled; },
    hush(value) { if (silent === value) return; silent = value; ambience(); if (value) clip('cheer').pause(); },
    cue(name) {
      if (!enabled || !unlocked) return;
      if (name === 'swish') play(clip('swish'), .7, true);
      if (name === 'impact') play(clip('impact'), .7, true);
      if (name === 'cheer') play(clip('cheer'), .65, true);
    },
    say(name) { if (voice) voice.pause(); voice = clip(`voice-${name}`); play(voice, .85, true); },
    stop
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else ambience(); });
  window.addEventListener('pagehide', stop);
})();
