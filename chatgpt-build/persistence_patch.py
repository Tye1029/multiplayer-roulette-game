from pathlib import Path
import re, sys

path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('chatgpt-build/TerrorCounter.as')
s = path.read_text(encoding='utf-8')

# Track whether a durable storage read has actually completed.
if 'private var storageLoaded:Boolean' not in s:
    pat = r'(\s*private\s+var\s+lastPersistEpoch\s*:\s*Number\s*=\s*0\s*;\s*\n)'
    repl = r'\1        private var storageLoaded:Boolean = false;\n'
    s, n = re.subn(pat, repl, s, count=1)
    assert n == 1, 'lastPersistEpoch marker not found'

# Core bug fix: when ZFE is discovered after onAddedToStage, do not return
# immediately. Retry loadState until readStorage itself answers successfully.
pat = re.compile(r'''(?P<indent>\s*)if\s*\(\s*zfeApi\s*==\s*null\s*\)\s*\{\s*findZfeBridge\s*\(\s*\)\s*;\s*return\s*;\s*\}\s*(?=var\s+raw\s*:\s*String\s*=\s*callZfe\s*\(\s*"target\.v1\.get")''', re.S)

def bridge_repl(m):
    i = m.group('indent')
    return (i + 'if (zfeApi == null)\n' + i + '{\n' +
            i + '    findZfeBridge();\n' +
            i + '    if (zfeApi == null)\n' + i + '    {\n' +
            i + '        return;\n' + i + '    }\n' + i + '}\n\n' +
            i + 'if (!storageLoaded)\n' + i + '{\n' +
            i + '    loadState();\n' + i + '}\n\n')

s, n = pat.subn(bridge_repl, s, count=1)
assert n == 1, 'onTargetPoll ZFE discovery block not found'

# Replace loadState so only a successful readStorage response marks storage as
# initialized. Until then, onTargetPoll retries every 200 ms.
pat = re.compile(r'''\s*private\s+function\s+loadState\s*\(\s*\)\s*:\s*void\s*\{.*?\n\s*\}\s*\n\s*private\s+function\s+saveState\s*\(\s*\)\s*:\s*void''', re.S)
replacement = '''
        private function loadState():void
        {
            if (zfeApi == null || storageLoaded)
            {
                return;
            }

            var payload:String =
                "{\\\"vendor\\\":\\\"" + VENDOR + "\\\",\\\"path\\\":\\\"" + STORAGE_PATH + "\\\"}";

            var raw:String = callZfe("readStorage", payload);

            // The bridge can exist before its storage service is ready.
            // Only a successful storage call finishes initialization.
            if (!jsonSuccess(raw))
            {
                return;
            }

            storageLoaded = true;

            if (raw.indexOf("\\\"found\\\":true") < 0)
            {
                // First run: keep zero/current value and create the state file.
                saveState();
                updateCounter();
                return;
            }

            var text:String = extractJsonString(raw, "text");
            if (text == null || text.length == 0)
            {
                return;
            }

            var parts:Array = text.split("|");
            if (parts.length < 5 || parts[0] != STATE_VERSION)
            {
                return;
            }

            count = Math.max(0, int(parts[1]));
            armed = parts[2] == "1";
            lastSeenSnakeEpoch = Number(parts[3]);
            cooldownUntilEpoch = Number(parts[4]);

            var now:Number = wallNow();

            if (armed &&
                (lastSeenSnakeEpoch <= 0 || now - lastSeenSnakeEpoch > ARM_EXPIRE_MS))
            {
                armed = false;
                lastSeenSnakeEpoch = 0;
            }

            if (cooldownUntilEpoch < now)
            {
                cooldownUntilEpoch = 0;
            }

            updateCounter();
            logZfe("info", "storage", "restored count=" + count);
        }

        private function saveState():void'''

s, n = pat.subn(replacement, s, count=1)
assert n == 1, 'loadState/saveState boundary not found'

assert 'storageLoaded' in s
assert 'restored count=' in s
assert 'if (!storageLoaded)' in s
path.write_text(s, encoding='utf-8')
print('persistence patch applied: delayed ZFE storage restore retry')
