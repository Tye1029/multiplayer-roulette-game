(function (global) {
  'use strict';

  const audio = global.RouletteAudio;
  if (!audio) throw new Error('RouletteAudio must load before direct action bindings.');

  function silenceLegacy() {
    const noop = function () { return null; };
    try { rouletteSpinSound = noop; } catch {}
    try { rouletteShotIndexSound = noop; } catch {}
    try { rouletteBlankSound = noop; } catch {}
    try { rouletteGunshotSound = noop; } catch {}
    try { rouletteTone = noop; } catch {}
    global.rouletteSpinSound = noop;
    global.rouletteShotIndexSound = noop;
    global.rouletteBlankSound = noop;
    global.rouletteGunshotSound = noop;
  }

  silenceLegacy();

  if (typeof rouletteOpeningSequence !== 'function') {
    throw new Error('Opening sequence must load before direct audio bindings.');
  }
  if (typeof rouletteShotSequence !== 'function') {
    throw new Error('Shot sequence must load before direct audio bindings.');
  }

  const originalOpeningSequence = rouletteOpeningSequence;
  if (!originalOpeningSequence.__rrUploadedAudioBound) {
    const boundOpeningSequence = async function () {
      audio.openingSpin();
      silenceLegacy();
      return originalOpeningSequence.apply(this, arguments);
    };
    boundOpeningSequence.__rrUploadedAudioBound = true;
    rouletteOpeningSequence = boundOpeningSequence;
  }

  const originalShotSequence = rouletteShotSequence;
  if (!originalShotSequence.__rrUploadedAudioBound) {
    const boundShotSequence = async function (_game, state) {
      audio.hammer();
      const live = state?.lastOutcome === 'live';
      global.setTimeout(() => {
        if (live) audio.gunshot();
        else audio.blank();
      }, 255);
      silenceLegacy();
      return originalShotSequence.apply(this, arguments);
    };
    boundShotSequence.__rrUploadedAudioBound = true;
    rouletteShotSequence = boundShotSequence;
  }

  silenceLegacy();
  audio.markBindingsReady();
})(window);
