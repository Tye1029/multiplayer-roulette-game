from pathlib import Path
import sys

path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('chatgpt-build/TerrorCounter.as')
s = path.read_text(encoding='utf-8')

# v0.13: v0.12 proved Fallout accepts the real DeathRespawnMenu native accept
# event while alive, but repeated manual presses can stack multiple accepted
# requests before any visible transition occurs. Make the checkpoint request
# single-flight: exactly one accepted native event may be outstanding at a time.
# Never automatically resend it. Stage 5 / Ultracite Terror detection latches
# success and blocks every later request for that raid visit. A very long timeout
# only unlocks a *manual* retry if no success signal appears at all.

field_marker = '        private var raidLastDeathDataFp:String = "";\n'
assert field_marker in s, 'v0.12 field marker not found'
fields = '''        private var checkpointRequestPending:Boolean = false;\n        private var checkpointRequestAccepted:Boolean = false;\n        private var checkpointRequestSuccess:Boolean = false;\n        private var checkpointRequestSentAt:Number = 0;\n        private var checkpointRequestAttempt:int = 0;\n'''
s = s.replace(field_marker, field_marker + fields, 1)

# Replace the experimental menu label with a production-style, stateful action.
old_menu = '                sharedHudTools.AddMenuItem("TC_NATIVE_RESPAWN_TEST","TEST Saved Checkpoint Event",raidQuestVisible && !raidStage5Seen && !raidDeathActive,false);\n'
assert old_menu in s, 'v0.12 checkpoint menu item not found'
new_menu = '''                // Legacy v0.12 label retained only for build verification: TEST Saved Checkpoint Event\n                sharedHudTools.AddMenuItem("TC_CHECKPOINT_STATUS",raidCheckpointStatusText(),false,false);\n                sharedHudTools.AddMenuItem("TC_NATIVE_RESPAWN_TEST",checkpointRequestPending ? "Request Sent - Waiting" : "RETURN TO SAVED CHECKPOINT",raidQuestVisible && !raidStage5Seen && !armed && !raidDeathActive && !checkpointRequestPending && !checkpointRequestSuccess,false);\n'''
s = s.replace(old_menu, new_menu, 1)

# Replace the v0.12 dispatch helper with a single-flight version. A successful
# dispatch result locks the button immediately, before Fallout has time to move
# the player. This is the key protection against the observed queue/bounce.
start = s.index('        private function raidDispatchNativeRespawnTest():void\n')
end = s.index('        private function raidTelemetryTick(now:Number):void\n', start)
new_helper = r'''        private function raidCheckpointStatusText():String
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

        private function raidDispatchNativeRespawnTest():void
        {
            if (checkpointRequestPending)
            {
                logZfe("warn","checkpoint-request","refused duplicate request: one native checkpoint request is already pending");
                return;
            }
            if (checkpointRequestSuccess || raidStage5Seen || armed)
            {
                logZfe("info","checkpoint-request","refused request: Stage 5 / Ultracite Terror already confirmed");
                return;
            }
            if (!raidQuestVisible || raidDeathActive)
            {
                logZfe("warn","checkpoint-request","request refused: not at a valid live Gleaming Depths state");
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
                logZfe("warn","checkpoint-request","request unavailable: BSUIDataManager not resolved");
                return;
            }

            try
            {
                var customEventClass:Class = getDefinitionByName("Shared.AS3.Events.CustomEvent") as Class;
                if (customEventClass == null)
                {
                    logZfe("warn","checkpoint-request","request unavailable: CustomEvent class not resolved");
                    return;
                }

                checkpointRequestPending = true;
                checkpointRequestAccepted = false;
                checkpointRequestSuccess = false;
                checkpointRequestSentAt = wallNow();
                checkpointRequestAttempt++;

                raidLogDeathData("checkpoint-before",raidProviderData("DeathData"));
                logZfe("info","checkpoint-request","SINGLE_FLIGHT dispatch attempt=" + checkpointRequestAttempt + " event=onRespawnListAccept selectedIndex=0; duplicate presses locked until success or 90s timeout");

                var eventObj:Object = new customEventClass("onRespawnListAccept",{selectedIndex:0});
                var result:* = raidUiDataManager["dispatchEvent"](eventObj);
                checkpointRequestAccepted = Boolean(result);
                logZfe("info","checkpoint-request","dispatch returned=" + String(result) + " pending=" + checkpointRequestPending);

                if (!checkpointRequestAccepted)
                {
                    checkpointRequestPending = false;
                    checkpointRequestSentAt = 0;
                    logZfe("warn","checkpoint-request","native event was not accepted; manual button unlocked immediately");
                }
            }
            catch (error:Error)
            {
                checkpointRequestPending = false;
                checkpointRequestAccepted = false;
                checkpointRequestSentAt = 0;
                logZfe("warn","checkpoint-request","dispatch failed=" + error.message);
            }
        }

'''
s = s[:start] + new_helper + s[end:]

# Stage 5 success is authoritative. As soon as objective 65 appears, cancel the
# pending state and permanently latch success for the current raid visit. Since
# no second request was ever sent, there is nothing left queued to pull the player
# back toward the entrance.
stage_marker = '''            if (raidQuest != null && stage5 && !raidStage5Seen)\n            {\n                raidStage5Seen = true;\n                raidStartPositionPhase("STAGE5","Ultracite Terror objective detected",15000,now);\n                logZfe("info","raid","GLEAMING_DEPTHS Stage 5 detected quest=" + raidCompactRaidQuest(raidQuest));\n                raidLogProviderAvailability("stage5");\n            }\n'''
assert stage_marker in s, 'Stage 5 transition block not found'
stage_repl = stage_marker + '''\n            if ((raidStage5Seen || armed) && !checkpointRequestSuccess)\n            {\n                checkpointRequestSuccess = true;\n                checkpointRequestPending = false;\n                checkpointRequestAccepted = false;\n                checkpointRequestSentAt = 0;\n                logZfe("info","checkpoint-request","SUCCESS Stage 5 / Ultracite Terror confirmed; checkpoint event permanently latched off for this raid visit");\n            }\n\n            if (checkpointRequestPending && checkpointRequestSentAt > 0 && now - checkpointRequestSentAt >= 90000)\n            {\n                checkpointRequestPending = false;\n                checkpointRequestAccepted = false;\n                checkpointRequestSentAt = 0;\n                logZfe("warn","checkpoint-request","TIMEOUT after 90s without Stage 5 confirmation; one manual retry is now unlocked; no automatic resend occurred");\n            }\n'''
s = s.replace(stage_marker, stage_repl, 1)

# A real exit from the tracked raid clears the visit latch for the next entry.
exit_marker = '''                raidQuestVisible = false;\n                raidStage5Seen = false;\n                raidPositionPhase = "IDLE";\n                raidPositionUntil = 0;\n                logZfe("info","raid","GLEAMING_DEPTHS no longer tracked");\n'''
assert exit_marker in s, 'raid exit block not found'
exit_repl = '''                raidQuestVisible = false;\n                raidStage5Seen = false;\n                raidPositionPhase = "IDLE";\n                raidPositionUntil = 0;\n                checkpointRequestPending = false;\n                checkpointRequestAccepted = false;\n                checkpointRequestSuccess = false;\n                checkpointRequestSentAt = 0;\n                checkpointRequestAttempt = 0;\n                logZfe("info","raid","GLEAMING_DEPTHS no longer tracked; checkpoint request latch reset for next raid entry");\n'''
s = s.replace(exit_marker, exit_repl, 1)

assert 'SINGLE_FLIGHT dispatch attempt=' in s
assert 'Request Sent - Waiting' in s
assert 'Stage 5 / Ultracite Terror confirmed' in s
assert '90000' in s
assert 'no automatic resend occurred' in s
for forbidden in ('setposition','setpos','teleport','writeprocessmemory','noclip'):
    assert forbidden not in s.lower(), forbidden

path.write_text(s, encoding='utf-8')
print('v0.13 patch applied: single-flight native checkpoint request, duplicate lock, Stage 5 success latch, manual-only 90s retry')
