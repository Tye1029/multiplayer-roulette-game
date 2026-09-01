from pathlib import Path
import sys

path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('chatgpt-build/TerrorCounter.as')
s = path.read_text(encoding='utf-8')

# v0.16 fixes two concrete problems proven by the user's v0.15 log:
# 1) Scaleform SharedObject.flush() throws Error #1501, so the personal target
#    never survives HUD/game reloads. Move the personal target to the same ZFE
#    readStorage/writeStorage bridge that already persists the Terror kill count.
# 2) The core counter's `armed` flag can be stale across area transitions. Only
#    treat the Terror as present for personal-target gating if the encounter was
#    seen on/after the current tracked raid entry.
#
# No world-position writes, trigger edits, forced encounter activation, or
# coordinate movement are added.

field_marker = '        private var personalAutoReturnFiredThisEntry:Boolean = false;\n'
assert field_marker in s, 'v0.15 personal field marker not found'
s = s.replace(field_marker, field_marker + '        private var personalTrackedRaidEntryAt:Number = 0;\n', 1)

# Replace SharedObject-based personal target persistence with ZFE storage.
start = s.index('        private function raidEnsurePersonalCheckpointState():void\n')
end = s.index('        private function raidHasPersonalTarget():Boolean\n', start)
new_persist = r'''        private function raidExtractZfeStorageText(raw:String):String
        {
            if (raw == null || raw == "")
            {
                return "";
            }
            var marker:String = "\"text\":\"";
            var p:int = raw.indexOf(marker);
            if (p < 0)
            {
                return "";
            }
            p += marker.length;
            var q:int = raw.indexOf("\"",p);
            if (q < 0)
            {
                return "";
            }
            return raw.substring(p,q);
        }

        private function raidEnsurePersonalCheckpointState():void
        {
            if (personalCheckpointLoaded)
            {
                return;
            }

            if (zfeApi == null)
            {
                findZfeBridge();
            }
            if (zfeApi == null)
            {
                // Keep personalCheckpointLoaded false so housekeeping retries.
                return;
            }

            var raw:String = callZfe(
                "readStorage",
                "{\"vendor\":\"" + STORAGE_VENDOR +
                "\",\"path\":\"personal_raid_checkpoint_v1.txt\"}"
            );
            if (!jsonSuccess(raw))
            {
                // Storage can come online shortly after the bridge. Retry later.
                return;
            }

            personalCheckpointLoaded = true;
            personalCheckpointTarget = "";
            personalCheckpointSavedAt = 0;
            personalAutoReturnEnabled = false;

            if (raw.indexOf("\"found\":true") < 0)
            {
                logZfe("info","personal-checkpoint","ZFE restore: no saved personal target yet");
                return;
            }

            var state:String = raidExtractZfeStorageText(raw);
            var parts:Array = state.split("|");
            if (parts.length >= 4 && String(parts[0]) == "v1")
            {
                personalCheckpointTarget = String(parts[1]);
                personalAutoReturnEnabled = String(parts[2]) == "1";
                personalCheckpointSavedAt = Number(parts[3]);
            }

            logZfe("info","personal-checkpoint","ZFE restored target=" + personalCheckpointTarget + " autoReturn=" + personalAutoReturnEnabled);
        }

        private function raidPersistPersonalCheckpoint():Boolean
        {
            if (zfeApi == null)
            {
                findZfeBridge();
            }
            if (zfeApi == null)
            {
                logZfe("warn","personal-checkpoint","ZFE save unavailable: verified bridge not found");
                return false;
            }

            var state:String = "v1|" + personalCheckpointTarget + "|" +
                (personalAutoReturnEnabled ? "1" : "0") + "|" +
                String(Math.floor(personalCheckpointSavedAt));

            var result:String = callZfe(
                "writeStorage",
                "{\"vendor\":\"" + STORAGE_VENDOR +
                "\",\"path\":\"personal_raid_checkpoint_v1.txt\"" +
                ",\"text\":\"" + state + "\"}"
            );

            if (jsonSuccess(result))
            {
                personalCheckpointLoaded = true;
                logZfe("info","personal-checkpoint","ZFE saved target=" + personalCheckpointTarget + " autoReturn=" + personalAutoReturnEnabled);
                return true;
            }

            logZfe("warn","personal-checkpoint","ZFE writeStorage failed for personal target");
            return false;
        }

        private function raidTerrorDetectedThisEntry():Boolean
        {
            if (!armed || lastSeenSnakeEpoch <= 0 || personalTrackedRaidEntryAt <= 0)
            {
                return false;
            }
            // Small tolerance covers event ordering when the encounter meter and
            // tracked raid quest appear within the same HUD initialization burst.
            return lastSeenSnakeEpoch >= personalTrackedRaidEntryAt - 2000;
        }

'''
s = s[:start] + new_persist + s[end:]

# Save current target only when the Terror meter belongs to this tracked entry,
# and don't claim success when persistence itself failed.
old_save = r'''        private function raidSaveCurrentRaidArea():void
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
'''
assert old_save in s, 'v0.15 save helper not found'
new_save = r'''        private function raidSaveCurrentRaidArea():void
        {
            raidEnsurePersonalCheckpointState();
            if (!raidTerrorDetectedThisEntry())
            {
                checkpointLastOutcome = "Terror meter not detected - not saved";
                logZfe("warn","personal-checkpoint","SAVE refused: current-entry Ultracite Terror encounter meter is not active; quest objective is deliberately not trusted");
                return;
            }

            personalCheckpointTarget = "ULTRACITE_TERROR";
            personalCheckpointSavedAt = wallNow();
            if (raidPersistPersonalCheckpoint())
            {
                checkpointLastOutcome = "Personal target saved";
                logZfe("info","personal-checkpoint","SAVED personal target=ULTRACITE_TERROR source=current_entry_encounter_meter_verified; quest stage ignored");
            }
            else
            {
                checkpointLastOutcome = "Save failed - retry";
                logZfe("warn","personal-checkpoint","SAVE failed: personal target remains session-only until ZFE storage succeeds");
            }
        }
'''
s = s.replace(old_save,new_save,1)

# Menu/status gating must use current-entry Terror detection instead of the
# possibly stale core `armed` flag. Manual return no longer requires the quest
# row to be visible; this lets a user trigger it from inside the raid even when
# the quest tracker temporarily disappears or reports nonsense.
old_menu = '                sharedHudTools.AddMenuItem("TC_SAVE_RAID_TARGET","SAVE CURRENT RAID AREA",armed,false);\n                sharedHudTools.AddMenuItem("TC_NATIVE_RESPAWN_TEST",checkpointRequestPending ? "Travel In Progress - Wait" : "RETURN TO MY RAID CHECKPOINT",raidHasPersonalTarget() && raidQuestVisible && !armed && !raidDeathActive && !checkpointRequestPending,false);\n'
assert old_menu in s, 'v0.15 personal menu gating not found'
new_menu = '                sharedHudTools.AddMenuItem("TC_SAVE_RAID_TARGET","SAVE CURRENT RAID AREA",raidTerrorDetectedThisEntry(),false);\n                sharedHudTools.AddMenuItem("TC_NATIVE_RESPAWN_TEST",checkpointRequestPending ? "Travel In Progress - Wait" : "RETURN TO MY RAID CHECKPOINT",raidHasPersonalTarget() && !raidTerrorDetectedThisEntry() && !raidDeathActive && !checkpointRequestPending,false);\n'
s = s.replace(old_menu,new_menu,1)

# Status helper has two armed checks.
s = s.replace('            if (armed)\n            {\n                return "Status: At Terror - save this area";\n            }',
              '            if (raidTerrorDetectedThisEntry())\n            {\n                return "Status: At Terror - save this area";\n            }',1)
s = s.replace('            if (armed)\n            {\n                return "Status: At saved Ultracite Terror target";\n            }',
              '            if (raidTerrorDetectedThisEntry())\n            {\n                return "Status: At saved Ultracite Terror target";\n            }',1)

# Native return should refuse only when the Terror was actually detected on this
# entry, not because an old armed flag survived a transition.
old_guard = r'''            if (armed)
            {
                logZfe("info","checkpoint-request","refused request: Ultracite Terror encounter meter is already active");
                return;
            }
'''
assert old_guard in s, 'v0.14 armed dispatch guard not found'
new_guard = r'''            if (raidTerrorDetectedThisEntry())
            {
                logZfe("info","checkpoint-request","refused request: current-entry Ultracite Terror encounter meter is already active");
                return;
            }
'''
s = s.replace(old_guard,new_guard,1)

old_live_guard = r'''            if (!raidQuestVisible || raidDeathActive)
            {
                logZfe("warn","checkpoint-request","request refused: not at a valid live Gleaming Depths state");
                return;
            }
'''
assert old_live_guard in s, 'v0.15 live raid guard not found'
new_live_guard = r'''            if (raidDeathActive)
            {
                logZfe("warn","checkpoint-request","request refused while DeathRespawn state is active");
                return;
            }
'''
s = s.replace(old_live_guard,new_live_guard,1)

# Track the start time of each broad Gleaming Depths entry. This is intentionally
# independent of objective/stage number.
entry_fn = r'''        private function raidOnTrackedRaidEntry(now:Number):void
        {
            raidEnsurePersonalCheckpointState();
            personalAutoReturnDueAt = 0;
'''
assert entry_fn in s, 'v0.15 tracked entry helper not found'
entry_repl = r'''        private function raidOnTrackedRaidEntry(now:Number):void
        {
            raidEnsurePersonalCheckpointState();
            personalTrackedRaidEntryAt = now;
            personalAutoReturnDueAt = 0;
'''
s = s.replace(entry_fn,entry_repl,1)

# Auto-return uses current-entry Terror detection, not stale armed state.
old_auto_guard = '            if (!raidQuestVisible || armed || raidDeathActive || checkpointRequestPending)\n'
assert old_auto_guard in s, 'v0.15 auto return armed guard not found'
s = s.replace(old_auto_guard,'            if (!raidQuestVisible || raidTerrorDetectedThisEntry() || raidDeathActive || checkpointRequestPending)\n',1)

# Request completion must likewise be encounter-on-this-entry verified.
old_complete_guard = '''                if (armed)\n                {\n                    checkpointRequestPending = false;\n'''
assert old_complete_guard in s, 'v0.14 request completion armed guard not found'
s = s.replace(old_complete_guard,'''                if (raidTerrorDetectedThisEntry())\n                {\n                    checkpointRequestPending = false;\n''',1)

# Clear entry timestamp when the tracked raid disappears; personal target stays.
exit_marker = '''                personalAutoReturnDueAt = 0;\n                personalAutoReturnFiredThisEntry = false;\n                logZfe("info","raid","GLEAMING_DEPTHS no longer tracked; request state reset; personal saved target preserved");\n'''
assert exit_marker in s, 'v0.15 raid exit personal marker not found'
exit_repl = '''                personalAutoReturnDueAt = 0;\n                personalAutoReturnFiredThisEntry = false;\n                personalTrackedRaidEntryAt = 0;\n                logZfe("info","raid","GLEAMING_DEPTHS no longer tracked; request state reset; personal saved target preserved");\n'''
s = s.replace(exit_marker,exit_repl,1)

# SharedObject storage should no longer be used by the personal target path.
assert 'personal_raid_checkpoint_v1.txt' in s
assert 'ZFE saved target=' in s
assert 'raidTerrorDetectedThisEntry' in s
assert 'current_entry_encounter_meter_verified' in s
assert 'SharedObject.getLocal("TerrorCounterPersonalRaidCheckpoint")' not in s
for forbidden in ('setposition','setpos','teleport','writeprocessmemory','noclip'):
    assert forbidden not in s.lower(), forbidden

path.write_text(s, encoding='utf-8')
print('v0.16 patch applied: ZFE personal target persistence + current-entry Terror detection + manual return independent of quest-row visibility')
