from pathlib import Path
import re, sys

path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('chatgpt-build/TerrorCounter.as')
s = path.read_text(encoding='utf-8')

# v0.8: avoid F11/HUDLoader entirely. Reuse the existing keyboard handler and
# give TerrorCounter three dedicated correction shortcuts:
#   Ctrl+Alt+R    reset to zero
#   Ctrl+Alt+Up   add one
#   Ctrl+Alt+Down subtract one
# All changes run through saveState() so ZFE/local/session persistence stays in sync.

pat = re.compile(r'''        private function onResetHotkey\(event:KeyboardEvent\):void\n        \{.*?\n        \}\n\n        private function onStageResize''', re.S)
replacement = '''        private function onResetHotkey(event:KeyboardEvent):void
        {
            if (!event.ctrlKey || !event.altKey)
            {
                return;
            }

            if (event.keyCode == 82) // R
            {
                count = 0;
                armed = false;
                lastSeenSnakeEpoch = 0;
                cooldownUntilEpoch = 0;
                saveState();
                updateCounter();
                logZfe("info","counter","manual reset via Ctrl+Alt+R");
                return;
            }

            if (event.keyCode == 38) // Up Arrow
            {
                count++;
                saveState();
                updateCounter();
                logZfe("info","counter","manual +1 via Ctrl+Alt+Up count=" + count);
                return;
            }

            if (event.keyCode == 40) // Down Arrow
            {
                count = Math.max(0,count - 1);
                saveState();
                updateCounter();
                logZfe("info","counter","manual -1 via Ctrl+Alt+Down count=" + count);
                return;
            }
        }

        private function onStageResize'''
s, n = pat.subn(replacement, s, count=1)
assert n == 1, 'existing onResetHotkey block not found'

assert 'manual reset via Ctrl+Alt+R' in s
assert 'manual +1 via Ctrl+Alt+Up' in s
assert 'manual -1 via Ctrl+Alt+Down' in s
assert 'event.keyCode == 82' in s
assert 'event.keyCode == 38' in s
assert 'event.keyCode == 40' in s
assert 'event.keyCode != 122' not in s

path.write_text(s, encoding='utf-8')
print('v0.8 patch applied: Ctrl+Alt+R reset, Ctrl+Alt+Up +1, Ctrl+Alt+Down -1')
