from pathlib import Path
import sys

path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('chatgpt-build/TerrorCounter.as')
s = path.read_text(encoding='utf-8')

# v0.11: v0.10 proved the integrated telemetry loads, but one-second polling can
# miss the short DeathRespawnMode/DeathRespawnMenu transition. Add direct
# BSUIDataManager subscriptions plus a lightweight 250ms sampler. No recursive
# display/native-object scanning and no movement/manipulation actions.

field_marker = '        private var raidEntryPositions:Object = {};\n'
assert field_marker in s, 'v0.10 raid field marker not found'
fields = '''        private var raidEventSubscribed:Boolean = false;\n        private var raidFastTimer:Timer = null;\n        private var raidLastObservedDeathFp:String = "";\n        private var raidLastHudRawFp:String = "";\n        private var raidLastMenuRawFp:String = "";\n'''
s = s.replace(field_marker, field_marker + fields, 1)

# Match the working standalone diagnostic's GetDataFromClient calling convention.
s = s.replace('raidUiDataManager["GetDataFromClient"](provider);',
              'raidUiDataManager["GetDataFromClient"](provider,false,false);', 1)

# Once BSUIDataManager is available, subscribe and start the fast sampler.
marker = '''            if (raidUiDataManager == null)\n            {\n                return;\n            }\n\n            if (!raidTelemetryStarted)\n'''
assert marker in s, 'raidUiDataManager ready marker not found'
replacement = '''            if (raidUiDataManager == null)\n            {\n                return;\n            }\n\n            raidEnsureEventTracing();\n\n            if (!raidTelemetryStarted)\n'''
s = s.replace(marker, replacement, 1)

# Make the existing one-second path use the common observer too. This remains a
# fallback if a subscription is unavailable.
old = '''            var hudData:Object = raidProviderData("HUDModeData");\n            var menuData:Object = raidProviderData("MenuStackData");\n            var hudMode:String = raidSafeString(hudData,"hudMode");\n            var menuNames:String = raidMenuNames(menuData);\n            var deathNow:Boolean = hudMode == "DeathRespawnMode" || menuNames.indexOf("DeathRespawnMenu") >= 0;\n\n            if (deathNow && !raidDeathActive)\n            {\n                raidDeathActive = true;\n                raidTraceUntil = now + 15000;\n                raidProviderFingerprints = {};\n                logZfe("info","respawn-window","BEGIN hudMode=" + hudMode + " menus=" + menuNames + " durationMs=15000");\n                raidStartPositionPhase("RESPAWN_TRANSITION","DeathRespawnMenu / DeathRespawnMode detected",15000,now);\n            }\n            else if (!deathNow && raidDeathActive)\n            {\n                raidDeathActive = false;\n            }\n'''
assert old in s, 'v0.10 death polling block not found'
new = '''            var hudData:Object = raidProviderData("HUDModeData");\n            var menuData:Object = raidProviderData("MenuStackData");\n            raidObserveDeathState("housekeeping",hudData,menuData,now);\n            var hudMode:String = raidSafeString(hudData,"hudMode");\n            var menuNames:String = raidMenuNames(menuData);\n'''
s = s.replace(old, new, 1)

# Insert event/fast tracing helpers before raidProviderData.
insert_marker = '        private function raidProviderData(provider:String):Object\n'
assert insert_marker in s, 'raidProviderData marker not found'
helpers = r'''        private function raidEnsureEventTracing():void
        {
            if (raidUiDataManager == null)
            {
                return;
            }

            if (!raidEventSubscribed)
            {
                var any:Boolean = false;
                try
                {
                    raidUiDataManager["Subscribe"]("HUDModeData",raidOnHudModeEvent);
                    any = true;
                }
                catch (e:Error)
                {
                    logZfe("warn","raid-provider","HUDModeData subscription unavailable");
                }
                try
                {
                    raidUiDataManager["Subscribe"]("MenuStackData",raidOnMenuStackEvent);
                    any = true;
                }
                catch (e2:Error)
                {
                    logZfe("warn","raid-provider","MenuStackData subscription unavailable");
                }
                raidEventSubscribed = any;
                if (any)
                {
                    logZfe("info","raid-provider","event tracing subscribed to HUDModeData/MenuStackData");
                }
            }

            if (raidFastTimer == null)
            {
                raidFastTimer = new Timer(250);
                raidFastTimer.addEventListener(TimerEvent.TIMER,raidOnFastTimer);
                raidFastTimer.start();
                logZfe("info","raid-provider","250ms transition sampler started");
            }
        }

        private function raidOnHudModeEvent(event:*):void
        {
            var data:Object = raidEventData(event);
            if (data == null)
            {
                data = raidProviderData("HUDModeData");
            }
            raidLogHudRaw("event",data);
            raidObserveDeathState("event-hud",data,raidProviderData("MenuStackData"),wallNow());
        }

        private function raidOnMenuStackEvent(event:*):void
        {
            var data:Object = raidEventData(event);
            if (data == null)
            {
                data = raidProviderData("MenuStackData");
            }
            raidLogMenuRaw("event",data);
            raidObserveDeathState("event-menu",raidProviderData("HUDModeData"),data,wallNow());
        }

        private function raidOnFastTimer(event:TimerEvent):void
        {
            if (raidUiDataManager == null)
            {
                return;
            }
            var now:Number = wallNow();
            var hud:Object = raidProviderData("HUDModeData");
            var menus:Object = raidProviderData("MenuStackData");
            raidObserveDeathState("fast250",hud,menus,now);

            if (raidQuestVisible || raidTraceUntil > now)
            {
                raidLogHudRaw("fast250",hud);
                raidLogMenuRaw("fast250",menus);
            }

            if (raidTraceUntil > now)
            {
                raidTraceProvider("DeathRespawnData");
                raidTraceProvider("DeathRespawnMenuData");
                raidTraceProvider("RespawnData");
                raidTraceProvider("RespawnMenuData");
                raidTraceProvider("CharacterInfoData");
                raidTraceProvider("PlayerInfoData");
                raidTraceProvider("PlayerStateData");
                raidTraceProvider("MapMenuData");
                raidTraceProvider("MenuStackData");
                raidTraceProvider("HUDModeData");
                raidTraceProvider("QuestTrackerProvider");
            }
        }

        private function raidObserveDeathState(source:String,hudData:Object,menuData:Object,now:Number):void
        {
            var hudMode:String = raidSafeString(hudData,"hudMode");
            var menuNames:String = raidMenuNames(menuData);
            var deathNow:Boolean = hudMode == "DeathRespawnMode" || menuNames.indexOf("DeathRespawnMenu") >= 0;
            var fp:String = source + ":" + hudMode + ":" + menuNames + ":" + deathNow;

            if (deathNow || raidDeathActive || hudMode == "Loading" || menuNames.indexOf("LoadingMenu") >= 0)
            {
                if (raidLastObservedDeathFp != fp)
                {
                    raidLastObservedDeathFp = fp;
                    logZfe("info","respawn-observe","source=" + source + " hudMode=" + hudMode + " menus=" + menuNames + " death=" + deathNow);
                }
            }

            if (deathNow && !raidDeathActive)
            {
                raidDeathActive = true;
                raidTraceUntil = now + 15000;
                raidProviderFingerprints = {};
                logZfe("info","respawn-window","BEGIN source=" + source + " hudMode=" + hudMode + " menus=" + menuNames + " durationMs=15000");
                raidStartPositionPhase("RESPAWN_TRANSITION","DeathRespawnMenu / DeathRespawnMode detected",15000,now);
                raidLogProviderAvailability("respawn-begin");
            }
            else if (!deathNow && raidDeathActive && hudMode != "Loading" && menuNames.indexOf("LoadingMenu") < 0)
            {
                raidDeathActive = false;
                logZfe("info","respawn-window","DEATH_STATE_EXIT source=" + source + " hudMode=" + hudMode + " menus=" + menuNames);
            }
        }

        private function raidEventData(event:*):Object
        {
            try
            {
                if (event != null && event["data"] != null)
                {
                    return event["data"];
                }
            }
            catch (e:Error)
            {
            }
            return null;
        }

        private function raidLogHudRaw(source:String,data:Object):void
        {
            if (data == null)
            {
                return;
            }
            var fp:String = raidCompactObject(data,35);
            if (fp == "" || fp == raidLastHudRawFp)
            {
                return;
            }
            raidLastHudRawFp = fp;
            logZfe("info","hud-mode","source=" + source + " data=" + fp);
        }

        private function raidLogMenuRaw(source:String,data:Object):void
        {
            if (data == null)
            {
                return;
            }
            var names:String = raidMenuNames(data);
            var fp:String = names + ":" + raidCompactObject(data,35);
            if (fp == raidLastMenuRawFp)
            {
                return;
            }
            raidLastMenuRawFp = fp;
            logZfe("info","menu-stack","source=" + source + " names=" + names + " data=" + raidCompactObject(data,35));
        }

        private function raidLogProviderAvailability(reason:String):void
        {
            var names:Array = ["DeathRespawnData","DeathRespawnMenuData","RespawnData","RespawnMenuData","CharacterInfoData","PlayerInfoData","PlayerStateData","MapMenuData","MenuStackData","HUDModeData","QuestTrackerProvider"];
            var found:Array = [];
            for (var i:int = 0; i < names.length; i++)
            {
                var n:String = String(names[i]);
                if (raidProviderData(n) != null)
                {
                    found.push(n);
                }
            }
            logZfe("info","raid-provider","reason=" + reason + " available=" + found.join(","));
        }

'''
s = s.replace(insert_marker, helpers + insert_marker, 1)

# At entry and Stage 5, record provider availability once. This tells us whether
# any respawn-only data source appears during the real death transition.
entry_marker = '                logZfe("info","raid","GLEAMING_DEPTHS entry detected quest=" + raidCompactRaidQuest(raidQuest));\n'
assert entry_marker in s
s = s.replace(entry_marker, entry_marker + '                raidLogProviderAvailability("entry");\n', 1)
stage_marker = '                logZfe("info","raid","GLEAMING_DEPTHS Stage 5 detected quest=" + raidCompactRaidQuest(raidQuest));\n'
assert stage_marker in s
s = s.replace(stage_marker, stage_marker + '                raidLogProviderAvailability("stage5");\n', 1)

# Stop spamming the same objective line every housekeeping tick; Stage 5 is
# already logged once by the transition block above.
s = s.replace('                    logZfe("info","raid-objective","id=" + objectiveId + " state=" + state + " title=" + raidSafeString(obj,"title"));\n                    return true;',
              '                    return true;', 1)

assert 'raidUiDataManager["Subscribe"]("HUDModeData",raidOnHudModeEvent);' in s
assert 'new Timer(250)' in s
assert 'respawn-observe' in s
assert 'raidLogProviderAvailability("entry")' in s
assert 'GetDataFromClient"](provider,false,false)' in s
assert 'setposition' not in s.lower()
assert 'teleport' not in s.lower()

path.write_text(s, encoding='utf-8')
print('v0.11 patch applied: event-driven HUD/menu respawn tracing + 250ms safe sampler; no movement actions')
