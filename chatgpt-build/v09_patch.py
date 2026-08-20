from pathlib import Path
import re, sys

path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('chatgpt-build/TerrorCounter.as')
s = path.read_text(encoding='utf-8')

# v0.9: raw KeyboardEvent listeners do not reliably fire for HUDModLoader child
# widgets because the HUD layer is keyboard-deaf unless the game gives it focus.
# Use HUDModLoader's real SharedHUDTools API instead. F11 is handled globally by
# HUDTools, and our registered TerrorCounter menu exposes status / +1 / -1 / reset.

# Add a runtime-held SharedHUDTools instance. We resolve the class dynamically so
# the standalone SWF does not need SharedHUDTools on the Flex compiler classpath.
if 'private var sharedHudTools:Object = null;' not in s:
    marker = '        private var hudMessageProvider:Object = null;\n'
    assert marker in s, 'hudMessageProvider field marker not found'
    s = s.replace(marker, marker + '        private var sharedHudTools:Object = null;\n', 1)

# Stop listening for raw keyboard events; they are not delivered reliably to this
# HUD child movie. Leave the old handler compiled but unreachable.
s = s.replace('                stage.addEventListener(KeyboardEvent.KEY_DOWN, onResetHotkey);\n', '', 1)
s = s.replace('                stage.removeEventListener(KeyboardEvent.KEY_DOWN, onResetHotkey);\n', '', 1)

# Replace the old handcrafted HUDTools registration trigger with the official
# SharedHUDTools helper.
old = '''        private function onRegisterTimer(event:TimerEvent):void
        {
            registerHudTools();
        }
'''
new = '''        private function onRegisterTimer(event:TimerEvent):void
        {
            initSharedHudTools();
        }
'''
assert old in s, 'onRegisterTimer block not found'
s = s.replace(old, new, 1)

# Retry HUDTools discovery from the existing one-second housekeeping loop in case
# HUDTools loads slightly after TerrorCounter.
marker = '''        private function onHousekeeping(event:TimerEvent):void
        {
            var now:Number = wallNow();
'''
assert marker in s, 'onHousekeeping opening not found'
replacement = '''        private function onHousekeeping(event:TimerEvent):void
        {
            var now:Number = wallNow();

            if (sharedHudTools == null)
            {
                initSharedHudTools();
            }
'''
s = s.replace(marker, replacement, 1)

# Cleanly unsubscribe the official helper when the widget is removed/reloaded.
marker = '            unsubscribeGameData();\n'
assert marker in s, 'unsubscribeGameData marker not found'
cleanup = '''            if (sharedHudTools != null)
            {
                try
                {
                    sharedHudTools.Shutdown();
                }
                catch (e3:Error)
                {
                }
                sharedHudTools = null;
            }
            unsubscribeGameData();
'''
s = s.replace(marker, cleanup, 1)

# Insert the official SharedHUDTools integration immediately before the old
# registerHudTools() function. The legacy implementation remains compiled but is
# no longer called; this avoids risky surgery on unrelated message code.
marker = '        private function registerHudTools():void\n'
assert marker in s, 'legacy registerHudTools marker not found'
helpers = '''        private function initSharedHudTools():void
        {
            if (sharedHudTools != null)
            {
                return;
            }

            try
            {
                var hdtClass:Class = getDefinitionByName("SharedHUDTools") as Class;
                if (hdtClass == null)
                {
                    return;
                }

                var tools:Object = new hdtClass(MOD_NAME);
                if (tools == null)
                {
                    return;
                }

                if (!Boolean(tools.Register(onSharedHudMessage)))
                {
                    return;
                }

                tools.RegisterMenu(onSharedBuildMenu,onSharedSelectMenu);
                sharedHudTools = tools;
                logZfe("info","hudtools","registered SharedHUDTools menu");
            }
            catch (e:Error)
            {
                sharedHudTools = null;
            }
        }

        private function onSharedHudMessage(sender:String,msg:String):void
        {
        }

        private function onSharedBuildMenu(parentItem:String = null):void
        {
            if (sharedHudTools == null || parentItem != MOD_NAME)
            {
                return;
            }

            try
            {
                sharedHudTools.AddMenuItem("TC_STATUS","Current Kills: " + count,false,false);
                sharedHudTools.AddMenuItem("TC_ADD","Add 1",true,false);
                sharedHudTools.AddMenuItem("TC_SUB","Subtract 1",count > 0,false);
                sharedHudTools.AddMenuItem("TC_RESET","Reset Counter",true,false);
            }
            catch (e:Error)
            {
            }
        }

        private function onSharedSelectMenu(selectItem:String):void
        {
            if (selectItem == "TC_ADD")
            {
                count++;
                saveState();
                updateCounter();
                logZfe("info","counter","manual +1 via HUDTools count=" + count);
                return;
            }

            if (selectItem == "TC_SUB")
            {
                count = Math.max(0,count - 1);
                saveState();
                updateCounter();
                logZfe("info","counter","manual -1 via HUDTools count=" + count);
                return;
            }

            if (selectItem == "TC_RESET")
            {
                count = 0;
                armed = false;
                lastSeenSnakeEpoch = 0;
                cooldownUntilEpoch = 0;
                saveState();
                updateCounter();
                logZfe("info","counter","manual reset via HUDTools");
            }
        }

'''
s = s.replace(marker, helpers + marker, 1)

assert 'getDefinitionByName("SharedHUDTools")' in s
assert 'tools.RegisterMenu(onSharedBuildMenu,onSharedSelectMenu);' in s
assert 'Current Kills: ' in s
assert 'manual +1 via HUDTools' in s
assert 'manual -1 via HUDTools' in s
assert 'manual reset via HUDTools' in s
assert 'stage.addEventListener(KeyboardEvent.KEY_DOWN, onResetHotkey);' not in s

path.write_text(s, encoding='utf-8')
print('v0.9 patch applied: official SharedHUDTools F11 menu with status/+1/-1/reset; raw hotkey listener disabled')
