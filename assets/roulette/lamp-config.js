(function (global) {
  'use strict';

  const storageKey = 'rrLampCalibrationV9';
  const legacyStorageKey = 'rrLampCalibration';

  const groups = [
    ['Lamp PNG', [
      ['lampArtX', 'PNG horizontal', [-0.75, -35, 35, 0.25]],
      ['lampWidth', 'PNG width', [94, 25, 100, 0.5]],
      ['lampArtY', 'PNG vertical', [90.5, 55, 115, 0.25]],
      ['lampScale', 'PNG scale', [1.1, 0.55, 1.8, 0.01]],
      ['lampGlow', 'PNG glow', [0.8, 0, 1.5, 0.01]]
    ]],
    ['Rig and chains', [
      ['lampX', 'Rig + chains X', [49.75, 25, 75, 0.25]],
      ['lampY', 'Lamp rig vertical', [-26, -120, 140, 1]],
      ['chainHeight', 'Chain anchor height', [5, 5, 70, 0.5]],
      ['chainLeftLength', 'Left chain length', [70, 20, 180, 1]],
      ['chainRightLength', 'Right chain length', [101, 20, 180, 1]],
      ['chainWidth', 'Chain width', [12.5, 2, 50, 0.5]],
      ['chainStretch', 'Chain horizontal scale', [0.56, 0.35, 3, 0.01]]
    ]],
    ['Swing', [
      ['swing', 'Swing amount', [1.35, 0, 10, 0.05]],
      ['speed', 'Swing duration (sec)', [5.6, 1.2, 14, 0.1]]
    ]],
    ['Light', [
      ['lightHue', 'Light color / hue', [41, 0, 360, 1]],
      ['lightSaturation', 'Light saturation', [100, 0, 100, 1]],
      ['lightX', 'Light horizontal', [55.5, 10, 90, 0.5]],
      ['lightY', 'Light vertical', [39, 10, 90, 0.5]],
      ['spreadX', 'Light width', [75, 20, 120, 1]],
      ['spreadY', 'Light depth', [80, 20, 140, 1]],
      ['strength', 'Light strength', [0.25, 0.05, 1.25, 0.01]],
      ['track', 'Tracking distance', [7.5, 0, 20, 0.25]],
      ['trackSpeed', 'Tracking duration (sec)', [5.6, 1.2, 14, 0.1]]
    ]],
    ['Room and gun', [
      ['wallDark', 'Room darkness', [0.92, 0, 0.92, 0.01]],
      ['gunGleam', 'Gun glint', [0.03, 0, 1.5, 0.01]]
    ]]
  ];

  const definitions = {};
  const labels = {};
  for (const [, controls] of groups) {
    for (const [key, label, definition] of controls) {
      definitions[key] = definition;
      labels[key] = label;
    }
  }

  const defaults = Object.freeze(
    Object.fromEntries(Object.entries(definitions).map(([key, value]) => [key, value[0]]))
  );

  const bindings = Object.freeze({
    lampArtX: 'lampImage',
    lampWidth: 'lampImage',
    lampArtY: 'lampImage',
    lampScale: 'lampImage',
    lampGlow: 'lampImage',
    lampX: 'swingAndChains',
    lampY: 'swing',
    chainHeight: 'chains',
    chainLeftLength: 'leftChain',
    chainRightLength: 'rightChain',
    chainWidth: 'chains',
    chainStretch: 'chains',
    swing: 'swing',
    speed: 'swing',
    lightHue: 'trackedLight',
    lightSaturation: 'trackedLight',
    lightX: 'trackedLight',
    lightY: 'trackedLight',
    spreadX: 'trackedLight',
    spreadY: 'trackedLight',
    strength: 'trackedLight',
    track: 'trackedLight',
    trackSpeed: 'trackedLight',
    wallDark: 'roomOverlay',
    gunGleam: 'gunGlint'
  });

  function normalize(input = {}) {
    const value = { ...defaults, ...(input || {}) };

    if (input && input.undersideWidth != null && input.lampWidth == null) {
      value.lampWidth = Math.max(defaults.lampWidth, Number(input.undersideWidth) || defaults.lampWidth);
    }
    if (input && input.undersideY != null && input.lampArtY == null) {
      value.lampArtY = Number(input.undersideY);
    }
    if (input && input.undersideGlow != null && input.lampGlow == null) {
      value.lampGlow = Number(input.undersideGlow);
    }
    if (input && input.chainHeight != null) {
      if (input.chainLeftLength == null) value.chainLeftLength = 100;
      if (input.chainRightLength == null) value.chainRightLength = 100;
    }
    if (input && input.speed != null && input.trackSpeed == null) {
      value.trackSpeed = Number(input.speed);
    }

    for (const [key, definition] of Object.entries(definitions)) {
      const numeric = Number(value[key]);
      value[key] = Math.min(
        definition[2],
        Math.max(definition[1], Number.isFinite(numeric) ? numeric : definition[0])
      );
    }

    return value;
  }

  global.RouletteLampConfig = Object.freeze({
    storageKey,
    legacyStorageKey,
    groups,
    definitions: Object.freeze(definitions),
    labels: Object.freeze(labels),
    defaults,
    bindings,
    normalize
  });
})(window);