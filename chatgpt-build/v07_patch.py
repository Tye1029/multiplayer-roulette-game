from pathlib import Path
import re, sys

path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('chatgpt-build/TerrorCounter.as')
s = path.read_text(encoding='utf-8')

# v0.7: eliminate the false-positive path observed in the user's ZFE log.
# Successful kills are already reliably detected by EncounterHealthMeterArray
# reaching zero. UniversalRewardData can replay/still contain a raid reward
# after a death + menu/rejoin, so it must never increment the counter.

# 1) Replace ONLY the reward fallback with a no-op. isUltraciteTerror() sits
# immediately after this function in the source, so use it as the boundary and
# preserve it verbatim.
pat = re.compile(r'''        private function onRewardUpdate\(event:\*\):void\n        \{.*?\n        \}\n\n        private function isUltraciteTerror''', re.S)
replacement = '''        private function onRewardUpdate(event:*):void
        {
            // Intentionally disabled in v0.7.
            // Raid reward data can be replayed after death/menu/rejoin and is
            // not a reliable proof that Ultracite Terror actually died.
            return;
        }

        private function isUltraciteTerror'''
s, n = pat.subn(replacement, s, count=1)
assert n == 1, 'onRewardUpdate/isUltraciteTerror boundary not found'

# 2) Never restore an armed encounter from persistent storage. Arming is only
# valid for the currently-live HUD encounter and must be reacquired by seeing
# Ultracite Terror alive (>0 health) in EncounterHealthMeterArray.
pat = re.compile(r'''            if \(savedArmed &&\n                savedLastSeen > 0 &&\n                now - savedLastSeen <= ARM_EXPIRE_MS\)\n            \{\n                armed = true;\n                lastSeenSnakeEpoch = savedLastSeen;\n            \}''')
replacement = '''            // Never carry an armed encounter across a HUD/game reload.
            // A new instance must see the snake alive before a zero-health
            // transition is allowed to count.
            armed = false;
            lastSeenSnakeEpoch = 0;'''
s, n = pat.subn(replacement, s, count=1)
assert n == 1, 'saved armed restore block not found'

# 3) Do not persist transient armed/last-seen encounter state at all. Preserve
# the five-field v2 storage format for backward compatibility, but write zeros
# for those transient fields. Count and cooldown remain persisted.
old = '''                (armed ? "1" : "0") + "|" +
                Math.floor(lastSeenSnakeEpoch) + "|" +
                Math.floor(cooldownUntilEpoch);'''
new = '''                "0|" +
                "0|" +
                Math.floor(cooldownUntilEpoch);'''
assert old in s, 'state serialization armed fields not found'
s = s.replace(old, new, 1)

# 4) Sanity checks: direct health-zero is the only automatic increment path,
# and the snake-name helper must still exist after the patch.
assert 'registerAutomaticKill("raid_reward")' not in s
assert 'registerAutomaticKill("encounter_health_zero")' in s
assert 'private function isUltraciteTerror' in s
assert 'Intentionally disabled in v0.7' in s
assert 'Never carry an armed encounter across a HUD/game reload.' in s

path.write_text(s, encoding='utf-8')
print('v0.7 patch applied: direct encounter-health-zero kills only; reward fallback disabled; armed state never restored; snake-name helper preserved')
