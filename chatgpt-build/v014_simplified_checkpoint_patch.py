from pathlib import Path
import sys

path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('chatgpt-build/TerrorCounter.as')
s = path.read_text(encoding='utf-8')

# v0.14: simplify checkpoint travel. The raid quest stage/objectives are known
# to be stale and contradictory, so they are no longer used to decide success
# or whether another manual checkpoint request is allowed. The Ultracite Terror
# encounter meter (the same source used by TerrorCounter) is authoritative for
# "we reached the snake". One request remains single-flight, but it unlocks for
# a manual retry after the native travel sequence has genuinely settled.

field_marker = '        private var checkpointRequestAttempt:int = 0;\n'
assert field_marker in s, 'v0.13 field marker not found'
fields = '''        private var checkpointRequestSawLoading:Boolean = false;\n        private var checkpointRequestStableSince:Number = 0;\n        private var checkpointLastOutcome:String = "Ready";\n'''
s = s.replace(field_marker, field_marker + fields, 1)

old_status = r'''        private function raidCheckpointStatusText():String
        {
            if (checkpointRequestSuccess || raidStage5Seen || armed)
            {
                return "Checkpoint: Stage 5 confirmed";
            }
            if (checkpointRequestPending)
            {
                return "Checkpoint: Request accepted - waiting";
            }
            if (!raidQuestVisible)
            {
                return "Checkpoint: Enter Gleaming Depths";
            }
            return "Checkpoint: Ready";
        }
'''
assert old_status in s, 'v0.13 status helper not found'
new_status = r'''        private function raidCheckpointStatusText():String
        {
            if (armed)
            {
                return "Checkpoint: Ultracite Terror area detected";
            }
            if (checkpointRequestPending)
            {
                if (checkpointRequestSawLoading)
                {
                    return "Checkpoint: Traveling - please wait";
                }
                return "Checkpoint: Request accepted - waiting";
            }
            if (!raidQuestVisible)
            {
                return "Checkpoint: Enter Gleaming Depths";
            }
            if (checkpointLastOutcome != "" && checkpointLastOutcome != "Ready")
            {
                return "Checkpoint: " + checkpointLastOutcome;
            }
            return "Checkpoint: Ready (quest stage ignored)";
        }
'''
s = s.replace(old_status, new_status, 1)

old_menu = '                sharedHudTools.AddMenuItem("TC_NATIVE_RESPAWN_TEST",checkpointRequestPending ? "Request Sent - Waiting" : "RETURN TO SAVED CHECKPOINT",raidQuestVisible && !raidStage5Seen && !armed && !raidDeathActive && !checkpointRequestPending && !checkpointRequestSuccess,false);\n'
assert old_menu in s, 'v0.13 checkpoint menu item not found'
new_menu = '                sharedHudTools.AddMenuItem("TC_NATIVE_RESPAWN_TEST",checkpointRequestPending ? "Travel In Progress - Wait" : "RETURN TO SAVED RAID CHECKPOINT",raidQuestVisible && !armed && !raidDeathActive && !checkpointRequestPending,false);\n'
s = s.replace(old_menu, new_menu, 1)

old_guard = r'''            if (checkpointRequestSuccess || raidStage5Seen || armed)
            {
                logZfe("info","checkpoint-request","refused request: Stage 5 / Ultracite Terror already confirmed");
                return;
            }
'''
assert old_guard in s, 'v0.13 stage success guard not found'
new_guard = r'''            if (armed)
            {
                logZfe("info","checkpoint-request","refused request: Ultracite Terror encounter meter is already active");
                return;
            }
'''
s = s.replace(old_guard, new_guard, 1)

set_marker = '''                checkpointRequestPending = true;\n                checkpointRequestAccepted = false;\n                checkpointRequestSuccess = false;\n                checkpointRequestSentAt = wallNow();\n                checkpointRequestAttempt++;\n'''
assert set_marker in s, 'v0.13 request state block not found'
set_repl = '''                checkpointRequestPending = true;\n                checkpointRequestAccepted = false;\n                checkpointRequestSuccess = false;\n                checkpointRequestSawLoading = false;\n                checkpointRequestStableSince = 0;\n                checkpointLastOutcome = "Request sent";\n                checkpointRequestSentAt = wallNow();\n                checkpointRequestAttempt++;\n'''
s = s.replace(set_marker, set_repl, 1)

# Remove v0.13's permanent Stage-5/quest-objective latch and 90 second lock.
old_latch = r'''            if ((raidStage5Seen || armed) && !checkpointRequestSuccess)
            {
                checkpointRequestSuccess = true;
                checkpointRequestPending = false;
                checkpointRequestAccepted = false;
                checkpointRequestSentAt = 0;
                logZfe("info","checkpoint-request","SUCCESS Stage 5 / Ultracite Terror confirmed; checkpoint event permanently latched off for this raid visit");
            }

            if (checkpointRequestPending && checkpointRequestSentAt > 0 && now - checkpointRequestSentAt >= 90000)
            {
                checkpointRequestPending = false;
                checkpointRequestAccepted = false;
                checkpointRequestSentAt = 0;
                logZfe("warn","checkpoint-request","TIMEOUT after 90s without Stage 5 confirmation; one manual retry is now unlocked; no automatic resend occurred");
            }
'''
assert old_latch in s, 'v0.13 permanent success latch block not found'
s = s.replace(old_latch, '', 1)

# Insert request-settlement logic after the current HUD/menu state is known.
marker = '''            var hudMode:String = raidSafeString(hudData,"hudMode");\n            var menuNames:String = raidMenuNames(menuData);\n'''
assert marker in s, 'hud/menu state marker not found'
settle = r'''
            var checkpointLoadingNow:Boolean = hudMode == "Loading" || menuNames.indexOf("LoadingMenu") >= 0;
            if (checkpointRequestPending)
            {
                if (armed)
                {
                    checkpointRequestPending = false;
                    checkpointRequestAccepted = false;
                    checkpointRequestSuccess = true;
                    checkpointRequestSawLoading = false;
                    checkpointRequestStableSince = 0;
                    checkpointRequestSentAt = 0;
                    checkpointLastOutcome = "Terror area reached";
                    logZfe("info","checkpoint-request","COMPLETE Ultracite Terror encounter meter detected; request finished; quest stage was ignored");
                }
                else if (checkpointLoadingNow)
                {
                    if (!checkpointRequestSawLoading)
                    {
                        logZfe("info","checkpoint-request","TRAVEL loading sequence detected");
                    }
                    checkpointRequestSawLoading = true;
                    checkpointRequestStableSince = 0;
                    checkpointLastOutcome = "Traveling";
                }
                else if (checkpointRequestSawLoading)
                {
                    if (checkpointRequestStableSince <= 0)
                    {
                        checkpointRequestStableSince = now;
                    }
                    else if (now - checkpointRequestStableSince >= 20000)
                    {
                        checkpointRequestPending = false;
                        checkpointRequestAccepted = false;
                        checkpointRequestSuccess = false;
                        checkpointRequestSawLoading = false;
                        checkpointRequestStableSince = 0;
                        checkpointRequestSentAt = 0;
                        checkpointLastOutcome = "Settled - retry available";
                        logZfe("warn","checkpoint-request","SETTLED for 20s without Terror encounter meter; manual retry unlocked; quest stage ignored");
                    }
                }
                else if (checkpointRequestSentAt > 0 && now - checkpointRequestSentAt >= 35000)
                {
                    checkpointRequestPending = false;
                    checkpointRequestAccepted = false;
                    checkpointRequestSuccess = false;
                    checkpointRequestSawLoading = false;
                    checkpointRequestStableSince = 0;
                    checkpointRequestSentAt = 0;
                    checkpointLastOutcome = "No travel - retry available";
                    logZfe("warn","checkpoint-request","NO_LOADING after 35s; manual retry unlocked; no automatic resend");
                }
            }
'''
s = s.replace(marker, marker + settle, 1)

# Clear the new transient fields when leaving the tracked raid.
exit_marker = '''                checkpointRequestSentAt = 0;\n                checkpointRequestAttempt = 0;\n                logZfe("info","raid","GLEAMING_DEPTHS no longer tracked; checkpoint request latch reset for next raid entry");\n'''
assert exit_marker in s, 'v0.13 exit reset marker not found'
exit_repl = '''                checkpointRequestSentAt = 0;\n                checkpointRequestAttempt = 0;\n                checkpointRequestSawLoading = false;\n                checkpointRequestStableSince = 0;\n                checkpointLastOutcome = "Ready";\n                logZfe("info","raid","GLEAMING_DEPTHS no longer tracked; checkpoint request state reset for next raid entry");\n'''
s = s.replace(exit_marker, exit_repl, 1)

assert 'quest stage ignored' in s.lower()
assert 'Ultracite Terror area detected' in s
assert 'RETURN TO SAVED RAID CHECKPOINT' in s
assert 'SETTLED for 20s without Terror encounter meter' in s
assert 'NO_LOADING after 35s' in s
assert 'permanently latched off' not in s
for forbidden in ('setposition','setpos','teleport','writeprocessmemory','noclip'):
    assert forbidden not in s.lower(), forbidden

path.write_text(s, encoding='utf-8')
print('v0.14 patch applied: quest-stage-independent, Terror-meter authoritative, retryable settled single-flight checkpoint travel')
