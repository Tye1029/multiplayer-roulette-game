"""Original result stings. Card foley now uses the CC0 recordings in assets/site-hub/audio."""
import math
import pathlib
import random
import struct
import wave

RATE = 24000
OUT = pathlib.Path(__file__).resolve().parents[1] / 'assets/bluff/audio'
OUT.mkdir(parents=True, exist_ok=True)
rng = random.Random(73019)

def save(name, seconds, events, chord=None):
    samples = [0.0] * int(seconds * RATE)
    for start, duration, gain, pitch in events:
        smooth = previous = 0.0
        for i in range(int(duration * RATE)):
            t = i / RATE
            noise = rng.uniform(-1, 1)
            smooth = .55 * smooth + .45 * noise
            friction = smooth - previous
            previous = smooth
            attack = min(1, t / .006)
            envelope = attack * math.exp(-t / (duration / 4))
            thud = math.sin(2 * math.pi * pitch * t) * math.exp(-t * 85)
            at = int(start * RATE) + i
            if at < len(samples):
                samples[at] += gain * envelope * (friction * 1.8 + thud * .5)
    if chord:
        for start, frequency, duration, gain in chord:
            for i in range(int(duration * RATE)):
                t = i / RATE
                envelope = min(1, t / .035) * math.exp(-t / (duration / 3))
                # Inharmonic resonances and a gentle attack resemble struck strings.
                value = sum(math.sin(2 * math.pi * frequency * partial * t) / partial**1.8 for partial in [1, 2.003, 3.008, 4.016])
                at = int(start * RATE) + i
                if at < len(samples):
                    samples[at] += gain * envelope * value
    peak = max(1, max(abs(v) for v in samples) / .8)
    with wave.open(str(OUT / (name + '.wav')), 'wb') as file:
        file.setparams((1, 2, RATE, 0, 'NONE', 'not compressed'))
        file.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, v / peak)) * 32767)) for v in samples))

save('win', 2.1, [(i * .065, .10, .07, 400) for i in range(6)],
     [(i * .11, f, 1.5, .14) for i, f in enumerate([261.63, 329.63, 392, 523.25])])
save('lose', 1.6, [(0, .3, .27, 95)],
     [(0, 146.83, 1.4, .20), (.10, 174.61, 1.2, .14), (.25, 110, 1.1, .17)])
