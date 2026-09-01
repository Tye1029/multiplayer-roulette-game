from pathlib import Path
import sys

path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('chatgpt-build/TerrorCounter.as')
s = path.read_text(encoding='utf-8')

# v0.15: personal raid target. Do NOT treat Fallout's quest objective/stage as
# the saved destination. The user explicitly saves the current verified
# Ultracite Terror area, that preference persists in a separate SharedObject,
# and return-to-checkpoint uses Fallout's native checkpoint event while the
# Terror encounter meter remains the authoritative arrival confirmation.

field_marker = '        private var checkpointLastOutcome:String = "Ready";\n'
assert field_marker in s, 'v0.14 field marker not found'
fields = '''        private var personalCheckpointLoaded:Boolean = false;\n        private var personalCheckpointTarget:String = "";\n        private var personalCheckpointSavedAt:Number = 0;\n        private var personalAutoReturnEnabled:Boolean = false;\n        private var personalAutoReturnDueAt:Number = 0;\n        private var personalAutoReturnFiredThisEntry:Boolean = false;\n'''
s = s.replace(field_marker, field_marker + fields, 1)

# Replace the checkpoint part of the HUDTools menu with a small personal-target
# section. Checked/saved state is owned by this mod and never rewritten from the
# quest objective list.
old_menu = '''                sharedHudTools.AddMenuItem("TC_CHECKPOINT_STATUS",raidCheckpointStatusText(),false,false);\n                sharedHudTools.AddMenuItem("TC_NATIVE_RESPAWN_TEST",checkpointRequestPending ? "Travel In Progress - Wait" : "RETURN TO SAVED RAID CHECKPOINT",raidQuestVisible && !armed && !raidDeathActive && !checkpointRequestPending,false);\n'''
assert old_menu in s, 'v0.14 checkpoint menu block not found'
new_menu = '''                sharedHudTools.AddMenuItem("TC_PERSONAL_TARGET",raidSavedTargetText(),false,false);\n                sharedHudTools.AddMenuItem("TC_SAVE_RAID_TARGET","SAVE CURRENT RAID AREA",armed,false);\n                sharedHudTools.AddMenuItem("TC_NATIVE_RESPAWN_TEST",checkpointRequestPending ? "Travel In Progress - Wait" : "RETURN TO MY RAID CHECKPOINT",raidHasPersonalTarget() && raidQuestVisible && !armed && !raidDeathActive && !checkpointRequestPending,false);\n                sharedHudTools.AddMenuItem("TC_AUTO_RAID_RETURN",raidAutoReturnText(),raidHasPersonalTarget(),false);\n                sharedHudTools.AddMenuItem("TC_CLEAR_RAID_TARGET","CLEAR SAVED RAID TARGET",raidHasPersonalTarget() && !checkpointRequestPending,false);\n                sharedHudTools.AddMenuItem("TC_CHECKPOINT_STATUS",raidCheckpointStatusText(),false,false);\n'''
s = s.replace(old_menu, new_menu, 1)

# Add menu handlers before the existing native-return handler.
select_marker = '''        private function onSharedSelectMenu(selectItem:String):void\n        {\n            if (selectItem == "TC_NATIVE_RESPAWN_TEST")\n'''
assert select_marker in s, 'HUDTools select marker not found'
select_repl = '''        private function onSharedSelectMenu(selectItem:String):void\n        {\n            if (selectItem == "TC_SAVE_RAID_TARGET")\n            {\n                raidSaveCurrentRaidArea();\n                return;\n            }\n            if (selectItem == "TC_AUTO_RAID_RETURN")\n            {\n                raidToggleAutoReturn();\n                return;\n            }\n            if (selectItem == "TC_CLEAR_RAID_TARGET")\n            {\n                raidClearPersonalTarget();\n                return;\n            }\n            if (selectItem == "TC_NATIVE_RESPAWN_TEST")\n'''
s = s.replace(select_marker, select_repl, 1)

# Replace status helper with personal-target-aware copy and add persistence/
# target helpers immediately before the native dispatch function.
status_start = s.index('        private function raidCheckpointStatusText():String\n')
dispatch_start = s.index('        private function raidDispatchNativeRespawnTest():void\n', status_start)
old_helpers = s[status_start:dispatch_start]
new_helpers = r'''        private function raidEnsurePersonalCheckpointState():void
        {
            if (personalCheckpointLoaded)
            {
                return;
            }
            personalCheckpointLoaded = true;
            try
            {
                var so:SharedObject = SharedObject.getLocal("TerrorCounterPersonalRaidCheckpoint");
                if (so != null && so.data != null)
                {
                    if (so.data["target"] != null)
                    {
                        personalCheckpointTarget = String(so.data["target"]);
                    }
                    if (so.data["savedAt"] != null)
                    {
                        personalCheckpointSavedAt = Number(so.data["savedAt"]);
                    }
                    if (so.data["autoReturn"] != null)
                    {
                        personalAutoReturnEnabled = Boolean(so.data["autoReturn"]);
                    }
                }
                logZfe("info","personal-checkpoint","restored target=" + personalCheckpointTarget + " autoReturn=" + personalAutoReturnEnabled);
            }
            catch (e:Error)
            {
                logZfe("warn","personal-checkpoint","restore failed=" + e.message);
            }
        }

        private function raidPersistPersonalCheckpoint():void
        {
            try
            {
                var so:SharedObject = SharedObject.getLocal("TerrorCounterPersonalRaidCheckpoint");
                so.data["target"] = personalCheckpointTarget;
                so.data["savedAt"] = personalCheckpointSavedAt;
                so.data["autoReturn"] = personalAutoReturnEnabled;
                so.flush();
                logZfe("info","personal-checkpoint","saved target=" + personalCheckpointTarget + " autoReturn=" + personalAutoReturnEnabled);
            }
            catch (e:Error)
            {
                logZfe("warn","personal-checkpoint","save failed=" + e.message);
            }
        }

        private function raidHasPersonalTarget():Boolean
        {
            raidEnsurePersonalCheckpointState();
            return personalCheckpointTarget == "ULTRACITE_TERROR";
        }

        private function raidSavedTargetText():String
        {
            raidEnsurePersonalCheckpointState();
            if (personalCheckpointTarget == "ULTRACITE_TERROR")
            {
                return "Saved Target: Ultracite Terror";
            }
            return "Saved Target: None";
        }

        private function raidAutoReturnText():String
        {
            raidEnsurePersonalCheckpointState();
            return "Auto Return on Raid Entry: " + (personalAutoReturnEnabled ? "ON" : "OFF");
        }

        private function raidCheckpointStatusText():String
        {
            raidEnsurePersonalCheckpointState();
            if (!raidHasPersonalTarget())
            {
                if (armed)
                {
                    return "Status: At Terror - save this area";
                }
                return "Status: Save a personal raid target first";
            }
            if (armed)
            {
                return "Status: At saved Ultracite Terror target";
            }
            if (checkpointRequestPending)
            {
                if (checkpointRequestSawLoading)
                {
                    return "Status: Traveling to personal target";
                }
                return "Status: Request accepted - waiting";
            }
            if (!raidQuestVisible)
            {
                return "Status: Target saved - enter Gleaming Depths";
            }
            if (checkpointLastOutcome != "" && checkpointLastOutcome != "Ready")
            {
                return "Status: " + checkpointLastOutcome;
            }
            return "Status: Ready - quest stage ignored";
        }

        private function raidSaveCurrentRaidArea():void
        {
            raidEnsurePersonalCheckpointState();
            if (!armed)
            {
                checkpointLastOutcome = "Terror meter not detected - not saved";
                logZfe("warn","personal-checkpoint","SAVE refused: Ultracite Terror encounter meter is not active; quest objective is deliberately not trusted");
                return;
            }

            personalCheckpointTarget = "ULTRACITE_TERROR";
            personalCheckpointSavedAt = wallNow();
            checkpointLastOutcome = "Personal target saved";
            raidPersistPersonalCheckpoint();
            logZfe("info","personal-checkpoint","SAVED personal target=ULTRACITE_TERROR source=encounter_meter_verified; quest stage ignored");
        }

        private function raidClearPersonalTarget():void
        {
            raidEnsurePersonalCheckpointState();
            if (checkpointRequestPending)
            {
                logZfe("warn","personal-checkpoint","CLEAR refused while checkpoint travel is pending");
                return;
            }
            personalCheckpointTarget = "";
            personalCheckpointSavedAt = 0;
            personalAutoReturnEnabled = false;
            personalAutoReturnDueAt = 0;
            personalAutoReturnFiredThisEntry = false;
            checkpointLastOutcome = "Personal target cleared";
            raidPersistPersonalCheckpoint();
            logZfe("info","personal-checkpoint","CLEARED personal raid target");
        }

        private function raidToggleAutoReturn():void
        {
            raidEnsurePersonalCheckpointState();
            if (!raidHasPersonalTarget())
            {
                logZfe("warn","personal-checkpoint","Auto Return cannot be enabled until a personal target is saved");
                return;
            }
            personalAutoReturnEnabled = !personalAutoReturnEnabled;
            personalAutoReturnDueAt = 0;
            personalAutoReturnFiredThisEntry = false;
            if (personalAutoReturnEnabled && raidQuestVisible && !armed)
            {
                personalAutoReturnDueAt = wallNow() + 5000;
            }
            raidPersistPersonalCheckpoint();
            logZfe("info","personal-checkpoint","Auto Return on Raid Entry=" + personalAutoReturnEnabled);
        }

        private function raidOnTrackedRaidEntry(now:Number):void
        {
            raidEnsurePersonalCheckpointState();
            personalAutoReturnDueAt = 0;
            personalAutoReturnFiredThisEntry = false;
            if (personalAutoReturnEnabled && raidHasPersonalTarget())
            {
                personalAutoReturnDueAt = now + 5000;
                logZfe("info","personal-checkpoint","Auto Return scheduled in 5s for saved target=ULTRACITE_TERROR; quest stage ignored");
            }
        }

        private function raidMaybeAutoReturn(now:Number):void
        {
            raidEnsurePersonalCheckpointState();
            if (!personalAutoReturnEnabled || !raidHasPersonalTarget() || personalAutoReturnFiredThisEntry || personalAutoReturnDueAt <= 0 || now < personalAutoReturnDueAt)
            {
                return;
            }
            if (!raidQuestVisible || armed || raidDeathActive || checkpointRequestPending)
            {
                return;
            }

            var hud:Object = raidProviderData("HUDModeData");
            var menus:Object = raidProviderData("MenuStackData");
            var hudMode:String = raidSafeString(hud,"hudMode");
            var menuNames:String = raidMenuNames(menus);
            if (hudMode == "Loading" || menuNames.indexOf("LoadingMenu") >= 0)
            {
                return;
            }

            personalAutoReturnFiredThisEntry = true;
            personalAutoReturnDueAt = 0;
            logZfe("info","personal-checkpoint","AUTO_RETURN dispatching one single-flight request to personal target=ULTRACITE_TERROR");
            raidDispatchNativeRespawnTest();
        }

'''
s = s[:status_start] + new_helpers + s[dispatch_start:]

# Require the mod-owned target before any native checkpoint request. No quest
# stage/objective is consulted here.
guard_marker = '''            if (!raidQuestVisible || raidDeathActive)\n            {\n                logZfe("warn","checkpoint-request","request refused: not at a valid live Gleaming Depths state");\n                return;\n            }\n'''
assert guard_marker in s, 'v0.14 live-raid guard not found'
personal_guard = '''            raidEnsurePersonalCheckpointState();\n            if (!raidHasPersonalTarget())\n            {\n                logZfe("warn","checkpoint-request","request refused: no personal raid target has been saved");\n                return;\n            }\n'''
s = s.replace(guard_marker, personal_guard + guard_marker, 1)

# Ensure state is restored even if the HUDTools menu has not been opened.
tick_marker = '''        private function raidTelemetryTick(now:Number):void\n        {\n'''
assert tick_marker in s, 'raidTelemetryTick marker not found'
s = s.replace(tick_marker, tick_marker + '            raidEnsurePersonalCheckpointState();\n', 1)

# The raid quest is used only as a broad "inside Gleaming Depths" signal. On a
# new tracked entry, schedule the optional personal auto-return. Objective IDs
# never modify personalCheckpointTarget.
entry_marker = '''                logZfe("info","raid","GLEAMING_DEPTHS entry detected quest=" + raidCompactRaidQuest(raidQuest));\n                raidLogProviderAvailability("entry");\n'''
assert entry_marker in s, 'entry marker not found'
s = s.replace(entry_marker, entry_marker + '                raidOnTrackedRaidEntry(now);\n', 1)

# Run optional auto-return from the normal one-second telemetry path. It never
# retries automatically; the existing single-flight request settlement remains
# authoritative.
position_marker = '''            if (raidPositionUntil > now && now - raidLastPositionProbeAt >= 900)\n            {\n'''
assert position_marker in s, 'end-of-tick position marker not found'
s = s.replace(position_marker, '            raidMaybeAutoReturn(now);\n\n' + position_marker, 1)

# Per-entry auto state resets when the tracked raid disappears. Persisted target
# and Auto Return preference intentionally remain untouched.
exit_marker = '''                checkpointRequestStableSince = 0;\n                checkpointLastOutcome = "Ready";\n                logZfe("info","raid","GLEAMING_DEPTHS no longer tracked; checkpoint request state reset for next raid entry");\n'''
assert exit_marker in s, 'v0.14 exit marker not found'
exit_repl = '''                checkpointRequestStableSince = 0;\n                checkpointLastOutcome = "Ready";\n                personalAutoReturnDueAt = 0;\n                personalAutoReturnFiredThisEntry = false;\n                logZfe("info","raid","GLEAMING_DEPTHS no longer tracked; request state reset; personal saved target preserved");\n'''
s = s.replace(exit_marker, exit_repl, 1)

# Log a clearer completion message: arrival is encounter-meter verified, not
# inferred from the quest stage.
old_complete = 'logZfe("info","checkpoint-request","COMPLETE Ultracite Terror encounter meter detected; request finished; quest stage was ignored");'
assert old_complete in s, 'v0.14 completion log not found'
s = s.replace(old_complete, 'logZfe("info","checkpoint-request","COMPLETE personal target ULTRACITE_TERROR verified by encounter meter; request finished; quest stage ignored");', 1)

assert 'Saved Target: Ultracite Terror' in s
assert 'SAVE CURRENT RAID AREA' in s
assert 'RETURN TO MY RAID CHECKPOINT' in s
assert 'Auto Return on Raid Entry: ' in s
assert 'TerrorCounterPersonalRaidCheckpoint' in s
assert 'encounter_meter_verified' in s
assert 'quest stage ignored' in s.lower()
for forbidden in ('setposition','setpos','teleport','writeprocessmemory','noclip'):
    assert forbidden not in s.lower(), forbidden

path.write_text(s, encoding='utf-8')
print('v0.15 patch applied: persistent personal Ultracite Terror target, save/current/clear controls, optional one-shot auto return; quest stage never owns the saved target')
