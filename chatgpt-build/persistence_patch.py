from pathlib import Path
import re, sys

path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('chatgpt-build/TerrorCounter.as')
s = path.read_text(encoding='utf-8')

if 'private static var sessionCount:int' not in s:
    pat = r'(\s*private\s+static\s+const\s+HDT_BROADCAST\s*:\s*String\s*=\s*"BROADCASTALLMODS"\s*;\s*\n)'
    repl = (r'\1\n'
            '        // Same-session fallback; ZFE storage is the durable source.\n'
            '        private static var sessionCount:int = 0;\n'
            '        private static var sessionCountValid:Boolean = false;\n')
    s, n = re.subn(pat, repl, s, count=1)
    assert n == 1, 'HDT_BROADCAST marker not found'

if 'private var storageLoaded:Boolean' not in s:
    pat = r'(\s*private\s+var\s+lastPersistEpoch\s*:\s*Number\s*=\s*0\s*;\s*\n)'
    repl = (r'\1'
            '        private var storageLoaded:Boolean = false;\n'
            '        private var countDirtyBeforeStorageLoad:Boolean = false;\n')
    s, n = re.subn(pat, repl, s, count=1)
    assert n == 1, 'lastPersistEpoch marker not found'

if 'if (sessionCountValid)' not in s:
    pat = r'(\s*initialized\s*=\s*true\s*;\s*\n)(\s*buildCounter\s*\(\s*\)\s*;)'
    def add_session(m):
        indent = re.match(r'\s*', m.group(2)).group(0)
        return (m.group(1) + '\n' + indent + 'if (sessionCountValid)\n' + indent + '{\n' +
                indent + '    count = sessionCount;\n' + indent + '}\n\n' + m.group(2))
    s, n = re.subn(pat, add_session, s, count=1)
    assert n == 1, 'onAdded initialized/buildCounter sequence not found'

if 'if (!storageLoaded)' not in s.split('private function isUltraciteTerror',1)[0]:
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
    assert n == 1, 'onTargetPoll ZFE bridge block not found'

if 'countDirtyBeforeStorageLoad = true;' not in s.split('private function findZfeBridge',1)[0]:
    pat = re.compile(r'(?P<indent>\s*)count\s*\+\+\s*;\s*\n(?P=indent)armed\s*=\s*false\s*;')
    def inc_repl(m):
        i=m.group('indent')
        return (i+'count++;\n'+i+'sessionCount = count;\n'+i+'sessionCountValid = true;\n'+
                i+'if (!storageLoaded)\n'+i+'{\n'+i+'    countDirtyBeforeStorageLoad = true;\n'+i+'}\n'+
                i+'armed = false;')
    s, n = pat.subn(inc_repl, s, count=1)
    assert n == 1, 'automatic increment sequence not found'

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

            if (!jsonSuccess(raw))
            {
                return;
            }

            storageLoaded = true;

            if (countDirtyBeforeStorageLoad)
            {
                sessionCount = count;
                sessionCountValid = true;
                countDirtyBeforeStorageLoad = false;
                saveState();
                updateCounter();
                return;
            }

            if (raw.indexOf("\\\"found\\\":true") < 0)
            {
                sessionCount = count;
                sessionCountValid = true;
                saveState();
                updateCounter();
                return;
            }

            var text:String = extractJsonString(raw, "text");
            if (text == null || text.length == 0)
            {
                sessionCount = count;
                sessionCountValid = true;
                updateCounter();
                return;
            }

            var parts:Array = text.split("|");
            if (parts.length < 5 || parts[0] != STATE_VERSION)
            {
                sessionCount = count;
                sessionCountValid = true;
                updateCounter();
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

            sessionCount = count;
            sessionCountValid = true;
            updateCounter();
            logZfe("info", "storage", "restored count=" + count);
        }

        private function saveState():void'''
s, n = pat.subn(replacement, s, count=1)
assert n == 1, 'loadState/saveState boundary not found'

pat = re.compile(r'(private\s+function\s+saveState\s*\(\s*\)\s*:\s*void\s*\{)')
m = pat.search(s)
assert m, 'saveState opening not found'
after = s[m.end():m.end()+300]
if 'sessionCount = count;' not in after:
    insert = m.group(1) + '\n            sessionCount = count;\n            sessionCountValid = true;'
    s = s[:m.start()] + insert + s[m.end():]

def patch_manual_block(selection, assignment_pattern):
    global s
    block_pat = re.compile(r'(if|else\s+if)\s*\(\s*selection\s*==\s*"'+re.escape(selection)+r'"\s*\)\s*\{(?P<body>.*?)\n\s*\}', re.S)
    m = block_pat.search(s)
    assert m, selection+' menu block not found'
    block = m.group(0)
    if 'countDirtyBeforeStorageLoad = true;' in block:
        return
    ap = re.compile(assignment_pattern)
    am = ap.search(block)
    assert am, selection+' count assignment not found'
    indent = re.match(r'\s*', am.group(0)).group(0)
    injection = (am.group(0) + '\n' + indent + 'sessionCount = count;\n' +
                 indent + 'sessionCountValid = true;\n' +
                 indent + 'if (!storageLoaded)\n' + indent + '{\n' +
                 indent + '    countDirtyBeforeStorageLoad = true;\n' + indent + '}')
    block2 = block[:am.start()] + injection + block[am.end():]
    s = s[:m.start()] + block2 + s[m.end():]

patch_manual_block('RESET', r'\s*count\s*=\s*0\s*;')
patch_manual_block('PLUS', r'\s*count\s*\+\+\s*;')
patch_manual_block('MINUS', r'\s*count\s*=\s*Math\.max\s*\(\s*0\s*,\s*count\s*-\s*1\s*\)\s*;')

assert 'restored count=' in s
assert 'sessionCountValid' in s
assert 'storageLoaded' in s
assert s.count('countDirtyBeforeStorageLoad = true;') >= 4
path.write_text(s, encoding='utf-8')
print('persistence patch applied: delayed ZFE restore + session fallback')
