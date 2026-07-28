(function (global) {
  'use strict';

  const NativeAudio = global.Audio;
  if (typeof NativeAudio !== 'function' || NativeAudio.__rrOpeningSpinSyncV1) return;

  const OPENING_SPIN_PATH = '/assets/roulette/audio/revolver-spinning-on-wood-v4.mp3';
  const FALLBACK_ANIMATION_MS = 5300;
  const MIN_PLAYBACK_RATE = 0.25;
  const MAX_PLAYBACK_RATE = 4;
  const MAX_SYNC_ATTEMPTS = 20;

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function sourcePath(value) {
    try {
      return new URL(String(value || ''), document.baseURI).pathname;
    } catch {
      return String(value || '');
    }
  }

  function isOpeningSpinSource(value) {
    return sourcePath(value).endsWith(OPENING_SPIN_PATH);
  }

  function animationTiming(animation) {
    const effect = animation?.effect;
    const timing = effect?.getTiming?.() || effect?.getComputedTiming?.();
    const duration = Number(timing?.duration);
    if (!Number.isFinite(duration) || duration <= 0) return null;

    const rawCurrentTime = Number(animation?.currentTime);
    const currentTime = Number.isFinite(rawCurrentTime)
      ? clamp(rawCurrentTime, 0, duration)
      : 0;
    const playbackRate = Math.max(0.01, Math.abs(Number(animation?.playbackRate) || 1));

    return {
      animation,
      duration,
      currentTime,
      playbackRate
    };
  }

  function findOpeningAnimation() {
    const roots = Array.from(document.querySelectorAll(
      '[data-roulette-game].rr-opening-active,' +
      '[data-roulette-game][data-roulette-opening="1"]'
    ));

    for (let index = roots.length - 1; index >= 0; index -= 1) {
      const facing = roots[index].querySelector(
        '[data-roulette-facing],.rr-turn-facing'
      );
      if (!facing?.getAnimations) continue;

      const candidates = facing.getAnimations()
        .map(animationTiming)
        .filter(Boolean)
        .sort((left, right) => {
          const leftRunning = left.animation.playState === 'running' ? 1 : 0;
          const rightRunning = right.animation.playState === 'running' ? 1 : 0;
          return (rightRunning - leftRunning) || (right.duration - left.duration);
        });

      if (candidates.length) return candidates[0];
    }

    return null;
  }

  function synchronizeClip(clip, attempt = 0) {
    if (!clip || clip.ended) return;

    const audioDuration = Number(clip.duration);
    if (!Number.isFinite(audioDuration) || audioDuration <= 0) return;

    const timing = findOpeningAnimation();
    if (!timing) {
      clip.playbackRate = clamp(
        audioDuration / (FALLBACK_ANIMATION_MS / 1000),
        MIN_PLAYBACK_RATE,
        MAX_PLAYBACK_RATE
      );

      if (attempt < MAX_SYNC_ATTEMPTS) {
        requestAnimationFrame(() => synchronizeClip(clip, attempt + 1));
      }
      return;
    }

    const progress = clamp(timing.currentTime / timing.duration, 0, 0.995);
    const expectedAudioTime = audioDuration * progress;

    try {
      if (Math.abs(Number(clip.currentTime) - expectedAudioTime) > 0.035) {
        clip.currentTime = expectedAudioTime;
      }
    } catch {}

    const remainingAnimationSeconds = Math.max(
      0.05,
      (timing.duration - timing.currentTime) / timing.playbackRate / 1000
    );
    const remainingAudioSeconds = Math.max(
      0.01,
      audioDuration - Number(clip.currentTime || 0)
    );

    clip.playbackRate = clamp(
      remainingAudioSeconds / remainingAnimationSeconds,
      MIN_PLAYBACK_RATE,
      MAX_PLAYBACK_RATE
    );
    clip.preservesPitch = true;
    try { clip.webkitPreservesPitch = true; } catch {}

    clip.__rrOpeningAnimationDurationMs = timing.duration / timing.playbackRate;
    clip.__rrOpeningPlaybackRate = clip.playbackRate;
  }

  function armOpeningClip(clip) {
    let stopped = false;

    const synchronize = () => {
      if (!stopped) synchronizeClip(clip);
    };
    const cleanup = () => {
      stopped = true;
    };

    clip.addEventListener('loadedmetadata', synchronize);
    clip.addEventListener('durationchange', synchronize);
    clip.addEventListener('playing', synchronize);
    clip.addEventListener('ended', cleanup, { once: true });
    clip.addEventListener('error', cleanup, { once: true });
  }

  function SyncedAudio(source) {
    const clip = new NativeAudio(source);
    if (isOpeningSpinSource(source)) armOpeningClip(clip);
    return clip;
  }

  Object.setPrototypeOf(SyncedAudio, NativeAudio);
  SyncedAudio.prototype = NativeAudio.prototype;
  Object.defineProperty(SyncedAudio, '__rrOpeningSpinSyncV1', {
    value: true,
    configurable: true
  });

  global.Audio = SyncedAudio;
})(window);
