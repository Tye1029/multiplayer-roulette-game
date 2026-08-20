from pathlib import Path
import re, sys

path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('chatgpt-build/TerrorCounter.as')
s = path.read_text(encoding='utf-8')

marker = '        private static const HDT_BROADCAST:String = "BROADCASTALLMODS";\n'
insert = '''        private static const HDT_BROADCAST:String = "BROADCASTALLMODS";\n\n        // Survives ordinary child-HUD reconstruction when the same AS3\n        // ApplicationDomain is retained. ZFE storage remains the durable copy.\n        private static var sessionCount:int = 0;\n        private static var sessionCountValid:Boolean = false;\n'''
if 'private static var sessionCount:int' not in s:
    assert marker in s, 'static marker not found'
    s = s.replace(marker, insert, 1)

marker = '        private var lastPersistEpoch:Number = 0;\n'
insert = '''        private var lastPersistEpoch:Number = 0;\n        private var storageLoaded:Boolean = false;\n        private var countDirtyBeforeStorageLoad:Boolean = false;\n'''
if 'private var storageLoaded:Boolean' not in s:
    assert marker in s, 'state marker not found'
    s = s.replace(marker, insert, 1)

old = '''            initialized = true;\n\n            buildCounter();\n            findGameClasses();\n            findZfeBridge();\n            loadState();\n            setupGameSubscriptions();\n'''
new = '''            initialized = true;\n\n            if (sessionCountValid)\n            {\n                count = sessionCount;\n            }\n\n            buildCounter();\n            findGameClasses();\n            findZfeBridge();\n            loadState();\n            setupGameSubscriptions();\n'''
assert old in s, 'onAdded state block not found'
s = s.replace(old, new, 1)

old = '''            if (zfeApi == null)\n            {\n                findZfeBridge();\n                return;\n            }\n\n            var raw:String = callZfe("target.v1.get", "{}");\n'''
new = '''            if (zfeApi == null)\n            {\n                findZfeBridge();\n                if (zfeApi == null)\n                {\n                    return;\n                }\n            }\n\n            if (!storageLoaded)\n            {\n                loadState();\n            }\n\n            var raw:String = callZfe("target.v1.get", "{}");\n'''
assert old in s, 'onTargetPoll bridge block not found'
s = s.replace(old, new, 1)

old = '''            count++;\n            armed = false;\n'''
new = '''            count++;\n            sessionCount = count;\n            sessionCountValid = true;\n            if (!storageLoaded)\n            {\n                countDirtyBeforeStorageLoad = true;\n            }\n            armed = false;\n'''
assert old in s, 'automatic increment block not found'
s = s.replace(old, new, 1)

pattern = r'''        private function loadState\(\):void\n        \{.*?\n        \}\n\n        private function saveState\(\):void'''
replacement = '''        private function loadState():void\n        {\n            if (zfeApi == null || storageLoaded)\n            {\n                return;\n            }\n\n            var payload:String =\n                "{\\\"vendor\\\":\\\"" + VENDOR + "\\\",\\\"path\\\":\\\"" + STORAGE_PATH + "\\\"}";\n\n            var raw:String = callZfe("readStorage", payload);\n\n            if (!jsonSuccess(raw))\n            {\n                return;\n            }\n\n            storageLoaded = true;\n\n            if (countDirtyBeforeStorageLoad)\n            {\n                sessionCount = count;\n                sessionCountValid = true;\n                countDirtyBeforeStorageLoad = false;\n                saveState();\n                updateCounter();\n                return;\n            }\n\n            if (raw.indexOf("\\\"found\\\":true") < 0)\n            {\n                sessionCount = count;\n                sessionCountValid = true;\n                saveState();\n                updateCounter();\n                return;\n            }\n\n            var text:String = extractJsonString(raw, "text");\n            if (text == null || text.length == 0)\n            {\n                sessionCount = count;\n                sessionCountValid = true;\n                updateCounter();\n                return;\n            }\n\n            var parts:Array = text.split("|");\n            if (parts.length < 5 || parts[0] != STATE_VERSION)\n            {\n                sessionCount = count;\n                sessionCountValid = true;\n                updateCounter();\n                return;\n            }\n\n            count = Math.max(0, int(parts[1]));\n            armed = parts[2] == "1";\n            lastSeenSnakeEpoch = Number(parts[3]);\n            cooldownUntilEpoch = Number(parts[4]);\n\n            var now:Number = wallNow();\n\n            if (armed &&\n                (lastSeenSnakeEpoch <= 0 || now - lastSeenSnakeEpoch > ARM_EXPIRE_MS))\n            {\n                armed = false;\n                lastSeenSnakeEpoch = 0;\n            }\n\n            if (cooldownUntilEpoch < now)\n            {\n                cooldownUntilEpoch = 0;\n            }\n\n            sessionCount = count;\n            sessionCountValid = true;\n            updateCounter();\n            logZfe("info", "storage", "restored count=" + count);\n        }\n\n        private function saveState():void'''

s, n = re.subn(pattern, lambda m: replacement, s, count=1, flags=re.S)
assert n == 1, 'loadState block not found'

old = '''        private function saveState():void\n        {\n            if (zfeApi == null)\n'''
new = '''        private function saveState():void\n        {\n            sessionCount = count;\n            sessionCountValid = true;\n\n            if (zfeApi == null)\n'''
assert old in s, 'saveState opening not found'
s = s.replace(old, new, 1)

old = '''            if (selection == "RESET")\n            {\n                count = 0;\n                armed = false;\n'''
new = '''            if (selection == "RESET")\n            {\n                count = 0;\n                sessionCount = count;\n                sessionCountValid = true;\n                if (!storageLoaded)\n                {\n                    countDirtyBeforeStorageLoad = true;\n                }\n                armed = false;\n'''
assert old in s, 'reset block not found'
s = s.replace(old, new, 1)

old = '''            else if (selection == "PLUS")\n            {\n                count++;\n                saveState();\n'''
new = '''            else if (selection == "PLUS")\n            {\n                count++;\n                sessionCount = count;\n                sessionCountValid = true;\n                if (!storageLoaded)\n                {\n                    countDirtyBeforeStorageLoad = true;\n                }\n                saveState();\n'''
assert old in s, 'plus block not found'
s = s.replace(old, new, 1)

old = '''            else if (selection == "MINUS")\n            {\n                count = Math.max(0, count - 1);\n                saveState();\n'''
new = '''            else if (selection == "MINUS")\n            {\n                count = Math.max(0, count - 1);\n                sessionCount = count;\n                sessionCountValid = true;\n                if (!storageLoaded)\n                {\n                    countDirtyBeforeStorageLoad = true;\n                }\n                saveState();\n'''
assert old in s, 'minus block not found'
s = s.replace(old, new, 1)

assert 'if (!storageLoaded)' in s
assert 'restored count=' in s
assert 'sessionCountValid' in s
path.write_text(s, encoding='utf-8')
print('persistence patch applied: delayed ZFE restore + session fallback')
