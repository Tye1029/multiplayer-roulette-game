from pathlib import Path
import re, sys

path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('chatgpt-build/TerrorCounter.as')
s = path.read_text(encoding='utf-8')

# Add Scaleform-native SharedObject as a persistence fallback. This is separate
# from ZFE, so HUD reloads can recover the count even when ZFE is late/absent.
if 'import flash.net.SharedObject;' not in s:
    marker = '    import flash.utils.Timer;\n'
    assert marker in s, 'Timer import marker not found'
    s = s.replace(marker, '    import flash.net.SharedObject;\n' + marker, 1)

if 'private var localState:SharedObject' not in s:
    marker = '        private var storageLoaded:Boolean = false;\n'
    assert marker in s, 'storageLoaded field not found'
    s = s.replace(marker, marker + '        private var localState:SharedObject = null;\n', 1)

# Load local fallback immediately after the HUD exists, before attempting ZFE.
if 'loadLocalState();' not in s:
    marker = '            buildCounter();\n'
    assert marker in s, 'buildCounter call not found'
    s = s.replace(marker, marker + '            loadLocalState();\n', 1)

# The actual v0.3 housekeeping loop already retries loadState() whenever
# storageLoaded is false. The bug is loadState marking it true even when
# readStorage failed. Only mark it loaded after a successful ZFE response.
old = '''            storageLoaded = true;\n\n            if (!jsonSuccess(raw) || raw.indexOf("\\\"found\\\":true") < 0)\n            {\n                return;\n            }'''
new = '''            if (!jsonSuccess(raw))\n            {\n                // ZFE bridge can appear before its storage service is ready.\n                // Leave storageLoaded false so onHousekeeping retries next tick.\n                return;\n            }\n\n            storageLoaded = true;\n\n            if (raw.indexOf("\\\"found\\\":true") < 0)\n            {\n                return;\n            }'''
assert old in s, 'v0.3 storageLoaded/jsonSuccess block not found'
s = s.replace(old, new, 1)

# Log a successful ZFE restore to make future diagnosis possible.
if '"restored count="' not in s:
    marker = '            updateCounter();\n        }\n\n        private function saveState():void'
    assert marker in s, 'loadState closing marker not found'
    s = s.replace(marker, '            updateCounter();\n            logZfe("info","storage","restored count=" + count);\n        }\n\n        private function saveState():void', 1)

# Every existing save path (automatic kill, arm state, reset, +/- correction)
# already funnels through saveState(), so save the local fallback there first.
marker = '''        private function saveState():void\n        {\n'''
assert marker in s, 'saveState opening not found'
if 'saveLocalState();' not in s[s.index(marker):s.index(marker)+180]:
    s = s.replace(marker, marker + '            saveLocalState();\n\n', 1)

# Add Scaleform SharedObject helpers immediately before loadState(). They are
# fully guarded; if Fallout 76 disables local shared objects, ZFE still works.
if 'private function loadLocalState():void' not in s:
    marker = '        private function loadState():void\n'
    assert marker in s, 'loadState function marker not found'
    helpers = '''        private function loadLocalState():void\n        {\n            try\n            {\n                localState = SharedObject.getLocal("TerrorCounterState");\n                if (localState != null &&\n                    localState.data != null &&\n                    localState.data.count != null)\n                {\n                    count = Math.max(0,int(localState.data.count));\n                    updateCounter();\n                }\n            }\n            catch (e:Error)\n            {\n                localState = null;\n            }\n        }\n\n        private function saveLocalState():void\n        {\n            try\n            {\n                if (localState == null)\n                {\n                    localState = SharedObject.getLocal("TerrorCounterState");\n                }\n\n                if (localState != null)\n                {\n                    localState.data.count = count;\n                    localState.flush();\n                }\n            }\n            catch (e:Error)\n            {\n                localState = null;\n            }\n        }\n\n'''
    s = s.replace(marker, helpers + marker, 1)

assert 'SharedObject.getLocal("TerrorCounterState")' in s
assert 'if (!jsonSuccess(raw))' in s
assert 'storageLoaded = true;' in s
assert 'restored count=' in s
assert 'saveLocalState();' in s
path.write_text(s, encoding='utf-8')
print('persistence patch applied: ZFE retry race fixed + SharedObject fallback')
