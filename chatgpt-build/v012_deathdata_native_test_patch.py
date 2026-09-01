from pathlib import Path
import sys

path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('chatgpt-build/TerrorCounter.as')
s = path.read_text(encoding='utf-8')

# v0.12: the real interface BA2 shows DeathRespawnMenu subscribes to the exact
# provider "DeathData" and dispatches CustomEvent("onRespawnListAccept",
# {selectedIndex:0}) for its Respawn/Leave Raid accept action. Add focused
# DeathData tracing plus a MANUAL-ONLY HUDTools test for that exact event.
# Nothing fires automatically and no position/movement primitive is used.

field_marker = '        private var raidLastMenuRawFp:String = "";\n'
assert field_marker in s, 'v0.11 field marker not found'
fields = '''        private var raidDeathDataSubscribed:Boolean = false;\n        private var raidLastDeathDataFp:String = "";\n'''
s = s.replace(field_marker, field_marker + fields, 1)

# Subscribe to the exact provider used by interface/deathrespawn.swf. Keep this
# outside the HUD/menu subscription gate so it can retry later if DeathData is
# not available yet at initial HUD startup.
marker = '''            if (raidFastTimer == null)\n            {\n'''
assert marker in s, 'raidFastTimer marker not found'
death_sub = '''            if (!raidDeathDataSubscribed)\n            {\n                try\n                {\n                    raidUiDataManager["Subscribe"]("DeathData",raidOnDeathDataEvent);\n                    raidDeathDataSubscribed = true;\n                    logZfe("info","raid-provider","subscribed exact DeathRespawnMenu provider DeathData");\n                }\n                catch (deathDataError:Error)\n                {\n                    // Retry on a later housekeeping tick. Some providers only\n                    // become attachable after the relevant native menu exists.\n                }\n            }\n\n'''
s = s.replace(marker, death_sub + marker, 1)

# Add the exact DeathData event handler immediately before the fast timer handler.
marker = '        private function raidOnFastTimer(event:TimerEvent):void\n'
assert marker in s, 'raidOnFastTimer marker not found'
handlers = r'''        private function raidOnDeathDataEvent(event:*):void
        {
            var data:Object = raidEventData(event);
            if (data == null)
            {
                data = raidProviderData("DeathData");
            }
            raidLogDeathData("event",data);
        }

        private function raidLogDeathData(source:String,data:Object):void
        {
            if (data == null)
            {
                return;
            }

            var fp:String = raidCompactObject(data,90);
            if (fp == "" || fp == raidLastDeathDataFp)
            {
                return;
            }
            raidLastDeathDataFp = fp;

            logZfe(
                "info",
                "death-data",
                "source=" + source +
                " respawnTimer=" + raidSafeString(data,"respawnTimer") +
                " isInRaid=" + raidSafeString(data,"isInRaid") +
                " killerWasPlayer=" + raidSafeString(data,"killerWasPlayer") +
                " showNextPrev=" + raidSafeString(data,"showNextPrev") +
                " data=" + fp
            );
        }

'''
s = s.replace(marker, handlers + marker, 1)

# Sample the exact provider during the high-frequency death window as a fallback
# in case its CHANGE event lands between menu/HUD events.
trace_marker = '''            if (raidTraceUntil > now)\n            {\n                raidTraceProvider("DeathRespawnData");\n'''
assert trace_marker in s, 'v0.11 fast trace marker not found'
trace_repl = '''            if (raidTraceUntil > now)\n            {\n                raidLogDeathData("fast250",raidProviderData("DeathData"));\n                raidTraceProvider("DeathData");\n                raidTraceProvider("DeathRespawnData");\n'''
s = s.replace(trace_marker, trace_repl, 1)

# Also include DeathData in the slower one-second trace block from v0.10.
slow_marker = '''            if (raidTraceUntil > now)\n            {\n                logZfe("info","respawn-timeline","hudMode=" + hudMode + " menus=" + menuNames);\n                raidTraceProvider("DeathRespawnData");\n'''
assert slow_marker in s, 'v0.10 slow trace marker not found'
slow_repl = '''            if (raidTraceUntil > now)\n            {\n                logZfe("info","respawn-timeline","hudMode=" + hudMode + " menus=" + menuNames);\n                raidLogDeathData("housekeeping",raidProviderData("DeathData"));\n                raidTraceProvider("DeathData");\n                raidTraceProvider("DeathRespawnData");\n'''
s = s.replace(slow_marker, slow_repl, 1)

# Provider availability snapshots should now explicitly show DeathData.
old_names = 'var names:Array = ["DeathRespawnData","DeathRespawnMenuData","RespawnData","RespawnMenuData","CharacterInfoData","PlayerInfoData","PlayerStateData","MapMenuData","MenuStackData","HUDModeData","QuestTrackerProvider"];'
assert old_names in s, 'provider availability list not found'
new_names = 'var names:Array = ["DeathData","DeathRespawnData","DeathRespawnMenuData","RespawnData","RespawnMenuData","CharacterInfoData","PlayerInfoData","PlayerStateData","MapMenuData","MenuStackData","HUDModeData","QuestTrackerProvider"];'
s = s.replace(old_names,new_names,1)

# Add a manual HUDTools item. It is only enabled while the Gleaming Depths quest
# is visible, Stage 5 has not appeared yet, and we are not currently dead.
menu_marker = '                sharedHudTools.AddMenuItem("TC_RESET","Reset Counter",true,false);\n'
assert menu_marker in s, 'HUDTools menu marker not found'
menu_add = menu_marker + '                sharedHudTools.AddMenuItem("TC_NATIVE_RESPAWN_TEST","TEST Saved Checkpoint Event",raidQuestVisible && !raidStage5Seen && !raidDeathActive,false);\n'
s = s.replace(menu_marker,menu_add,1)

select_marker = '''        private function onSharedSelectMenu(selectItem:String):void\n        {\n            if (selectItem == "TC_ADD")\n'''
assert select_marker in s, 'HUDTools select marker not found'
select_repl = '''        private function onSharedSelectMenu(selectItem:String):void\n        {\n            if (selectItem == "TC_NATIVE_RESPAWN_TEST")\n            {\n                raidDispatchNativeRespawnTest();\n                return;\n            }\n\n            if (selectItem == "TC_ADD")\n'''
s = s.replace(select_marker,select_repl,1)

# Dispatch the exact event found in interface/deathrespawn.swf. This is a manual
# experiment only because the same event is used by the raid Leave Raid button.
# Native behavior while alive is unknown, so log that uncertainty explicitly.
insert_marker = '        private function raidTelemetryTick(now:Number):void\n'
assert insert_marker in s, 'raidTelemetryTick marker not found'
helper = r'''        private function raidDispatchNativeRespawnTest():void
        {
            if (!raidQuestVisible || raidStage5Seen || raidDeathActive)
            {
                logZfe("warn","checkpoint-test","manual native event refused: not at a valid live Gleaming Depths entry state");
                return;
            }

            if (raidUiDataManager == null)
            {
                try
                {
                    raidUiDataManager = getDefinitionByName("Shared.AS3.Data.BSUIDataManager");
                }
                catch (e:Error)
                {
                    raidUiDataManager = null;
                }
            }
            if (raidUiDataManager == null)
            {
                logZfe("warn","checkpoint-test","manual native event unavailable: BSUIDataManager not resolved");
                return;
            }

            try
            {
                var customEventClass:Class = getDefinitionByName("Shared.AS3.Events.CustomEvent") as Class;
                if (customEventClass == null)
                {
                    logZfe("warn","checkpoint-test","manual native event unavailable: CustomEvent class not resolved");
                    return;
                }

                logZfe("info","checkpoint-test","MANUAL dispatch event=onRespawnListAccept selectedIndex=0 source=DeathRespawnMenu exact callback; expected outcomes are checkpoint load, no-op, or Leave Raid; never automatic");
                var eventObj:Object = new customEventClass("onRespawnListAccept",{selectedIndex:0});
                var result:* = raidUiDataManager["dispatchEvent"](eventObj);
                logZfe("info","checkpoint-test","dispatch returned=" + String(result));
            }
            catch (error:Error)
            {
                logZfe("warn","checkpoint-test","dispatch failed=" + error.message);
            }
        }

'''
s = s.replace(insert_marker,helper + insert_marker,1)

assert 'Subscribe"]("DeathData",raidOnDeathDataEvent)' in s
assert 'respawnTimer=' in s
assert 'onRespawnListAccept' in s
assert 'TC_NATIVE_RESPAWN_TEST' in s
assert 'TEST Saved Checkpoint Event' in s
# Manual event only; no coordinate/movement/process manipulation primitives.
for forbidden in ('setposition','setpos','teleport','writeprocessmemory','noclip'):
    assert forbidden not in s.lower(), forbidden

path.write_text(s, encoding='utf-8')
print('v0.12 patch applied: exact DeathData tracing + manual-only DeathRespawnMenu native accept event test')
