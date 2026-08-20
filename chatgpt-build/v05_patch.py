from pathlib import Path
import re, sys

path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('chatgpt-build/TerrorCounter.as')
s = path.read_text(encoding='utf-8')

# Session-level persistence that survives TerrorCounter HUD reconstruction.
# This does not depend on ZFE or SharedObject; it lasts as long as the parent
# Scaleform/ApplicationDomain stays alive, which covers raid exit/re-entry.
if 'private static var sessionCount:int' not in s:
    marker = '        private static const HDT_BROADCAST:String = "BROADCASTALLMODS";\n'
    assert marker in s, 'HDT_BROADCAST marker not found'
    insert = marker + '\n        private static var sessionCount:int = 0;\n        private static var sessionCountValid:Boolean = false;\n'
    s = s.replace(marker, insert, 1)

# Keyboard event import for Ctrl+F11 reset.
if 'import flash.events.KeyboardEvent;' not in s:
    marker = '    import flash.events.TimerEvent;\n'
    assert marker in s, 'TimerEvent import marker not found'
    s = s.replace(marker, marker + '    import flash.events.KeyboardEvent;\n', 1)

# On a recreated HUD instance, restore the session value before disk/ZFE reads.
# If a session value exists, it is the newest source of truth and we suppress an
# older disk read from overwriting it.
old = '''            buildCounter();\n            loadLocalState();\n            findGameClasses();\n            findZfeBridge();\n            if (zfeApi != null)\n            {\n                loadState();\n            }\n'''
new = '''            buildCounter();\n\n            if (sessionCountValid)\n            {\n                count = sessionCount;\n                storageLoaded = true;\n                updateCounter();\n            }\n            else\n            {\n                loadLocalState();\n            }\n\n            findGameClasses();\n            findZfeBridge();\n            if (zfeApi != null && !storageLoaded)\n            {\n                loadState();\n            }\n'''
assert old in s, 'onAdded persistence sequence not found'
s = s.replace(old, new, 1)

# Register Ctrl+F11 while this HUD instance is on stage.
old = '''            if (stage != null)\n            {\n                stage.addEventListener(Event.RESIZE, onStageResize);\n            }\n'''
new = '''            if (stage != null)\n            {\n                stage.addEventListener(Event.RESIZE, onStageResize);\n                stage.addEventListener(KeyboardEvent.KEY_DOWN, onResetHotkey);\n            }\n'''
assert old in s, 'stage add-listener block not found'
s = s.replace(old, new, 1)

old = '''            if (stage != null)\n            {\n                stage.removeEventListener(Event.RESIZE, onStageResize);\n            }\n'''
new = '''            if (stage != null)\n            {\n                stage.removeEventListener(Event.RESIZE, onStageResize);\n                stage.removeEventListener(KeyboardEvent.KEY_DOWN, onResetHotkey);\n            }\n'''
assert old in s, 'stage remove-listener block not found'
s = s.replace(old, new, 1)

# Every existing persistence path runs through saveState(). Make static session
# state the first write, so it is available even if both disk mechanisms fail.
marker = '''        private function saveState():void\n        {\n'''
assert marker in s, 'saveState opening not found'
if 'sessionCount = count;' not in s[s.index(marker):s.index(marker)+220]:
    s = s.replace(marker, marker + '            sessionCount = count;\n            sessionCountValid = true;\n\n', 1)

# When ZFE successfully restores on a fresh game launch, seed session fallback.
marker = '            count = savedCount;\n'
assert marker in s, 'saved count assignment not found'
if 'sessionCount = count;' not in s[s.index(marker):s.index(marker)+180]:
    s = s.replace(marker, marker + '            sessionCount = count;\n            sessionCountValid = true;\n', 1)

# When SharedObject successfully restores on a fresh launch, seed fallback.
old = '''                    count = Math.max(0,int(localState.data.count));\n                    updateCounter();\n'''
new = '''                    count = Math.max(0,int(localState.data.count));\n                    sessionCount = count;\n                    sessionCountValid = true;\n                    updateCounter();\n'''
assert old in s, 'SharedObject restore block not found'
s = s.replace(old, new, 1)

# Ctrl+F11 hotkey. F11 is keyCode 122 in Flash/AS3.
if 'private function onResetHotkey' not in s:
    marker = '        private function onStageResize(event:Event):void\n'
    assert marker in s, 'onStageResize marker not found'
    fn = '''        private function onResetHotkey(event:KeyboardEvent):void\n        {\n            if (!event.ctrlKey || event.keyCode != 122)\n            {\n                return;\n            }\n\n            count = 0;\n            armed = false;\n            lastSeenSnakeEpoch = 0;\n            cooldownUntilEpoch = 0;\n\n            saveState();\n            updateCounter();\n            logZfe("info","counter","manual reset via Ctrl+F11");\n        }\n\n'''
    s = s.replace(marker, fn + marker, 1)

assert 'private static var sessionCount:int = 0;' in s
assert 'KeyboardEvent.KEY_DOWN, onResetHotkey' in s
assert 'event.ctrlKey' in s and 'event.keyCode != 122' in s
assert 'sessionCountValid = true;' in s
path.write_text(s, encoding='utf-8')
print('v0.5 patch applied: session persistence + Ctrl+F11 reset')
