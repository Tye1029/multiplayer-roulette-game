from pathlib import Path
import sys

path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('chatgpt-build/TerrorCounter.as')
s = path.read_text(encoding='utf-8')

# v0.10: fold the read-only Gleaming Depths diagnostic into the already-reliable
# TerrorCounter HUD movie. Keep counter/menu behavior unchanged. Telemetry is
# deliberately light: one-second housekeeping polling and flat provider scans.

field_marker = '        private var sharedHudTools:Object = null;\n'
assert field_marker in s, 'sharedHudTools field marker not found'
fields = '''        private var raidUiDataManager:Object = null;
        private var raidTelemetryStarted:Boolean = false;
        private var raidQuestVisible:Boolean = false;
        private var raidStage5Seen:Boolean = false;
        private var raidDeathActive:Boolean = false;
        private var raidTraceUntil:Number = 0;
        private var raidPositionPhase:String = "IDLE";
        private var raidPositionUntil:Number = 0;
        private var raidLastPositionProbeAt:Number = 0;
        private var raidProviderFingerprints:Object = {};
        private var raidPositionFingerprints:Object = {};
        private var raidEntryPositions:Object = {};
'''
s = s.replace(field_marker, field_marker + fields, 1)

house_marker = '''        private function onHousekeeping(event:TimerEvent):void
        {
            var now:Number = wallNow();

            if (sharedHudTools == null)
            {
                initSharedHudTools();
            }
'''
assert house_marker in s, 'v0.9 onHousekeeping marker not found'
s = s.replace(house_marker, house_marker + '\n            raidTelemetryTick(now);\n', 1)

insert_marker = '        private function registerHudTools():void\n'
assert insert_marker in s, 'registerHudTools insertion marker not found'
helpers = r'''        private function raidTelemetryTick(now:Number):void
        {
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
                return;
            }

            if (!raidTelemetryStarted)
            {
                raidTelemetryStarted = true;
                logZfe("info","raid-telemetry","TerrorCounter v0.10 integrated raid telemetry active; read-only; safe flat provider probing");
            }

            var questData:Object = raidProviderData("QuestTrackerProvider");
            var raidQuest:Object = raidFindGleamingDepthsQuest(questData);
            var stage5:Boolean = raidQuestHasStage5(raidQuest);

            if (raidQuest != null && !raidQuestVisible)
            {
                raidQuestVisible = true;
                raidStage5Seen = false;
                raidStartPositionPhase("ENTRY","Gleaming Depths quest became visible",12000,now);
                logZfe("info","raid","GLEAMING_DEPTHS entry detected quest=" + raidCompactRaidQuest(raidQuest));
            }
            else if (raidQuest == null && raidQuestVisible)
            {
                raidQuestVisible = false;
                raidStage5Seen = false;
                raidPositionPhase = "IDLE";
                raidPositionUntil = 0;
                logZfe("info","raid","GLEAMING_DEPTHS no longer tracked");
            }

            if (raidQuest != null && stage5 && !raidStage5Seen)
            {
                raidStage5Seen = true;
                raidStartPositionPhase("STAGE5","Ultracite Terror objective detected",15000,now);
                logZfe("info","raid","GLEAMING_DEPTHS Stage 5 detected quest=" + raidCompactRaidQuest(raidQuest));
            }

            var hudData:Object = raidProviderData("HUDModeData");
            var menuData:Object = raidProviderData("MenuStackData");
            var hudMode:String = raidSafeString(hudData,"hudMode");
            var menuNames:String = raidMenuNames(menuData);
            var deathNow:Boolean = hudMode == "DeathRespawnMode" || menuNames.indexOf("DeathRespawnMenu") >= 0;

            if (deathNow && !raidDeathActive)
            {
                raidDeathActive = true;
                raidTraceUntil = now + 15000;
                raidProviderFingerprints = {};
                logZfe("info","respawn-window","BEGIN hudMode=" + hudMode + " menus=" + menuNames + " durationMs=15000");
                raidStartPositionPhase("RESPAWN_TRANSITION","DeathRespawnMenu / DeathRespawnMode detected",15000,now);
            }
            else if (!deathNow && raidDeathActive)
            {
                raidDeathActive = false;
            }

            if (raidTraceUntil > now)
            {
                logZfe("info","respawn-timeline","hudMode=" + hudMode + " menus=" + menuNames);
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

            if (raidPositionUntil > now && now - raidLastPositionProbeAt >= 900)
            {
                raidLastPositionProbeAt = now;
                raidProbePositions();
            }
        }

        private function raidProviderData(provider:String):Object
        {
            if (raidUiDataManager == null)
            {
                return null;
            }
            try
            {
                var wrapper:Object = raidUiDataManager["GetDataFromClient"](provider);
                if (wrapper != null)
                {
                    return wrapper["data"];
                }
            }
            catch (e:Error)
            {
            }
            return null;
        }

        private function raidStartPositionPhase(phase:String,reason:String,durationMs:Number,now:Number):void
        {
            raidPositionPhase = phase;
            raidPositionUntil = now + durationMs;
            raidLastPositionProbeAt = 0;
            logZfe("info","raid-position-phase","phase=" + phase + " reason=" + reason + " captureMs=" + durationMs);
            raidProbePositions();
        }

        private function raidProbePositions():void
        {
            raidProbeProviderPosition("CharacterInfoData");
            raidProbeProviderPosition("PlayerInfoData");
            raidProbeProviderPosition("PlayerStateData");
            raidProbeProviderPosition("MapMenuData");
            raidProbeProviderPosition("DeathRespawnData");
            raidProbeProviderPosition("RespawnData");
        }

        private function raidProbeProviderPosition(provider:String):void
        {
            var data:Object = raidProviderData(provider);
            if (data == null)
            {
                return;
            }
            raidProbeFlatObject(provider,"root",data);

            var names:Array = ["position","Position","playerPosition","PlayerPosition","worldPosition","WorldPosition","location","Location","coordinates","Coordinates","coords","Coords","transform","Transform"];
            for (var i:int = 0; i < names.length; i++)
            {
                var key:String = String(names[i]);
                var child:* = raidSafeValue(data,key);
                if (child != null && !(child is String) && !(child is Number) && !(child is Boolean) && !(child is int) && !(child is uint))
                {
                    raidProbeFlatObject(provider,key,Object(child));
                }
            }
        }

        private function raidProbeFlatObject(provider:String,path:String,obj:Object):void
        {
            if (obj == null)
            {
                return;
            }

            var fields:String = raidInterestingPositionFields(obj,50);
            if (fields != "")
            {
                var fieldKey:String = provider + ":" + path + ":fields";
                var fieldFp:String = raidPositionPhase + ":" + fields;
                if (raidPositionFingerprints[fieldKey] != fieldFp)
                {
                    raidPositionFingerprints[fieldKey] = fieldFp;
                    logZfe("info","coordinate-field","phase=" + raidPositionPhase + " source=" + provider + " path=" + path + " fields=" + fields);
                }
            }

            var x:Number = raidAxisNumber(obj,"x");
            var y:Number = raidAxisNumber(obj,"y");
            var z:Number = raidAxisNumber(obj,"z");
            if (isNaN(x) || isNaN(y) || isNaN(z))
            {
                return;
            }

            var heading:Number = raidHeadingNumber(obj);
            var candidateKey:String = provider + ":" + path;
            var fp:String = raidPositionPhase + ":" + raidNum(x) + ":" + raidNum(y) + ":" + raidNum(z) + ":" + (isNaN(heading) ? "unknown" : raidNum(heading));
            if (raidPositionFingerprints[candidateKey] == fp)
            {
                return;
            }

            raidPositionFingerprints[candidateKey] = fp;
            logZfe("info","coordinate-candidate","phase=" + raidPositionPhase + " key=" + candidateKey + " x=" + raidNum(x) + " y=" + raidNum(y) + " z=" + raidNum(z) + " heading=" + (isNaN(heading) ? "unknown" : raidNum(heading)) + " status=READ_ONLY_UNVERIFIED");

            if (raidPositionPhase == "ENTRY")
            {
                raidEntryPositions[candidateKey] = {x:x,y:y,z:z,heading:heading};
                logZfe("info","raid-position","phase=ENTRY key=" + candidateKey + " x=" + raidNum(x) + " y=" + raidNum(y) + " z=" + raidNum(z) + " heading=" + (isNaN(heading) ? "unknown" : raidNum(heading)));
            }
            else if (raidPositionPhase == "STAGE5")
            {
                logZfe("info","raid-position","phase=STAGE5 key=" + candidateKey + " x=" + raidNum(x) + " y=" + raidNum(y) + " z=" + raidNum(z) + " heading=" + (isNaN(heading) ? "unknown" : raidNum(heading)));
                var entry:Object = raidEntryPositions[candidateKey];
                if (entry != null)
                {
                    logZfe("info","raid-position-delta","key=" + candidateKey + " dx=" + raidNum(x - Number(entry.x)) + " dy=" + raidNum(y - Number(entry.y)) + " dz=" + raidNum(z - Number(entry.z)) + " status=UNVERIFIED_UNTIL_REPEATABLE");
                }
            }
        }

        private function raidTraceProvider(provider:String):void
        {
            var data:Object = raidProviderData(provider);
            if (data == null)
            {
                return;
            }
            var compact:String = raidCompactObject(data,55);
            if (compact == "" || raidProviderFingerprints[provider] == compact)
            {
                return;
            }
            raidProviderFingerprints[provider] = compact;
            logZfe("info","respawn-provider","provider=" + provider + " data=" + compact);
        }

        private function raidFindGleamingDepthsQuest(data:Object):Object
        {
            var quests:Object = raidSafeValue(data,"quests");
            var count:int = raidSafeLength(quests);
            for (var i:int = 0; i < count && i < 25; i++)
            {
                var q:Object = raidSafeIndex(quests,i);
                if (q == null)
                {
                    continue;
                }
                var title:String = raidSafeString(q,"title").toUpperCase();
                if (title.indexOf("GLEAMING DEPTHS") >= 0)
                {
                    return q;
                }
                var id:* = raidSafeValue(q,"questId");
                try
                {
                    if (Number(id) == 7920170)
                    {
                        return q;
                    }
                }
                catch (e:Error)
                {
                }
            }
            return null;
        }

        private function raidQuestHasStage5(q:Object):Boolean
        {
            if (q == null)
            {
                return false;
            }
            var objectives:Object = raidSafeValue(q,"objectives");
            var count:int = raidSafeLength(objectives);
            for (var i:int = 0; i < count && i < 20; i++)
            {
                var obj:Object = raidSafeIndex(objectives,i);
                if (obj == null)
                {
                    continue;
                }
                var title:String = raidSafeString(obj,"title").toUpperCase();
                var objectiveId:String = raidSafeString(obj,"objectiveId");
                var state:String = raidSafeString(obj,"state");
                if (title.indexOf("ULTRACITE TERROR") >= 0 || objectiveId == "65")
                {
                    logZfe("info","raid-objective","id=" + objectiveId + " state=" + state + " title=" + raidSafeString(obj,"title"));
                    return true;
                }
            }
            return false;
        }

        private function raidCompactRaidQuest(q:Object):String
        {
            if (q == null)
            {
                return "null";
            }
            var out:String = "questId=" + raidSafeString(q,"questId") + ",title=" + raidSafeString(q,"title") + ",objectives=[";
            var objectives:Object = raidSafeValue(q,"objectives");
            var count:int = raidSafeLength(objectives);
            for (var i:int = 0; i < count && i < 12; i++)
            {
                var obj:Object = raidSafeIndex(objectives,i);
                if (obj == null)
                {
                    continue;
                }
                if (i > 0)
                {
                    out += ";";
                }
                out += raidSafeString(obj,"objectiveId") + ":" + raidSafeString(obj,"state") + ":" + raidSafeString(obj,"title");
            }
            return out + "]";
        }

        private function raidMenuNames(data:Object):String
        {
            var stack:Object = raidSafeValue(data,"menuStackA");
            var count:int = raidSafeLength(stack);
            var out:String = "[";
            for (var i:int = 0; i < count && i < 25; i++)
            {
                var entry:Object = raidSafeIndex(stack,i);
                if (entry == null)
                {
                    continue;
                }
                if (out.length > 1)
                {
                    out += ",";
                }
                out += raidSafeString(entry,"menuName");
            }
            return out + "]";
        }

        private function raidInterestingPositionFields(obj:Object,maxKeys:int):String
        {
            var out:String = "";
            var count:int = 0;
            try
            {
                for (var key:String in obj)
                {
                    if (count >= maxKeys)
                    {
                        break;
                    }
                    var value:* = obj[key];
                    if (raidPrimitive(value) && raidInterestingPositionKey(key))
                    {
                        if (out != "")
                        {
                            out += ",";
                        }
                        out += key + "=" + String(value);
                        count++;
                    }
                }
            }
            catch (e:Error)
            {
            }
            return raidClean(out);
        }

        private function raidInterestingPositionKey(key:String):Boolean
        {
            var lower:String = key == null ? "" : key.toLowerCase();
            var norm:String = raidNormalizeKey(key);
            if (lower.indexOf("position") >= 0 || lower.indexOf("coord") >= 0 || lower.indexOf("location") >= 0 || lower.indexOf("world") >= 0 || lower.indexOf("cell") >= 0 || lower.indexOf("heading") >= 0 || lower.indexOf("yaw") >= 0 || lower.indexOf("rotation") >= 0 || lower.indexOf("angle") >= 0 || lower.indexOf("direction") >= 0)
            {
                return true;
            }
            return norm == "x" || norm == "y" || norm == "z" || norm == "posx" || norm == "posy" || norm == "posz" || norm == "worldx" || norm == "worldy" || norm == "worldz" || norm == "playerx" || norm == "playery" || norm == "playerz";
        }

        private function raidAxisNumber(obj:Object,axis:String):Number
        {
            try
            {
                for (var key:String in obj)
                {
                    var norm:String = raidNormalizeKey(key);
                    if (raidAxisKeyMatches(norm,axis) && raidNumeric(obj[key]))
                    {
                        return Number(obj[key]);
                    }
                }
            }
            catch (e:Error)
            {
            }
            return Number.NaN;
        }

        private function raidAxisKeyMatches(norm:String,axis:String):Boolean
        {
            if (axis == "x")
            {
                return norm == "x" || norm == "posx" || norm == "positionx" || norm == "worldx" || norm == "playerx" || norm == "locationx" || norm == "coordx" || norm == "coordinatex" || norm == "xpos";
            }
            if (axis == "y")
            {
                return norm == "y" || norm == "posy" || norm == "positiony" || norm == "worldy" || norm == "playery" || norm == "locationy" || norm == "coordy" || norm == "coordinatey" || norm == "ypos";
            }
            return norm == "z" || norm == "posz" || norm == "positionz" || norm == "worldz" || norm == "playerz" || norm == "locationz" || norm == "coordz" || norm == "coordinatez" || norm == "zpos";
        }

        private function raidHeadingNumber(obj:Object):Number
        {
            try
            {
                for (var key:String in obj)
                {
                    var norm:String = raidNormalizeKey(key);
                    if ((norm == "heading" || norm == "yaw" || norm == "angle" || norm == "rotation" || norm == "rotationz" || norm == "playerheading" || norm == "direction") && raidNumeric(obj[key]))
                    {
                        return Number(obj[key]);
                    }
                }
            }
            catch (e:Error)
            {
            }
            return Number.NaN;
        }

        private function raidNormalizeKey(key:String):String
        {
            var text:String = key == null ? "" : key.toLowerCase();
            text = text.split("_").join("");
            text = text.split("-").join("");
            text = text.split(" ").join("");
            text = text.split(".").join("");
            return text;
        }

        private function raidNumeric(value:*):Boolean
        {
            if (value == null)
            {
                return false;
            }
            if (value is Number || value is int || value is uint)
            {
                return !isNaN(Number(value));
            }
            if (value is String)
            {
                var text:String = String(value);
                return text != "" && !isNaN(Number(text));
            }
            return false;
        }

        private function raidPrimitive(value:*):Boolean
        {
            return value == null || value is String || value is Number || value is Boolean || value is int || value is uint;
        }

        private function raidCompactObject(obj:Object,maxKeys:int):String
        {
            if (obj == null)
            {
                return "";
            }
            var out:String = "";
            var count:int = 0;
            try
            {
                for (var key:String in obj)
                {
                    if (count >= maxKeys)
                    {
                        break;
                    }
                    var value:* = obj[key];
                    if (raidPrimitive(value))
                    {
                        if (out != "")
                        {
                            out += ",";
                        }
                        out += key + "=" + String(value);
                        count++;
                    }
                }
            }
            catch (e:Error)
            {
            }
            return raidClean(out);
        }

        private function raidSafeValue(obj:Object,key:String):*
        {
            try
            {
                if (obj != null)
                {
                    return obj[key];
                }
            }
            catch (e:Error)
            {
            }
            return null;
        }

        private function raidSafeString(obj:Object,key:String):String
        {
            var value:* = raidSafeValue(obj,key);
            return value == null ? "" : String(value);
        }

        private function raidSafeLength(obj:Object):int
        {
            try
            {
                if (obj != null && obj["length"] != null)
                {
                    return int(obj["length"]);
                }
            }
            catch (e:Error)
            {
            }
            return 0;
        }

        private function raidSafeIndex(obj:Object,index:int):Object
        {
            try
            {
                if (obj != null && index >= 0 && index < raidSafeLength(obj))
                {
                    return obj[index];
                }
            }
            catch (e:Error)
            {
            }
            return null;
        }

        private function raidNum(value:Number):String
        {
            if (isNaN(value))
            {
                return "NaN";
            }
            return value.toFixed(3);
        }

        private function raidClean(text:String):String
        {
            if (text == null)
            {
                return "";
            }
            text = text.split("\r").join(" ");
            text = text.split("\n").join(" ");
            text = text.split("|").join("/");
            if (text.length > 1100)
            {
                text = text.substr(0,1100) + "...";
            }
            return text;
        }

'''
s = s.replace(insert_marker, helpers + insert_marker, 1)

assert 'TerrorCounter v0.10 integrated raid telemetry active' in s
assert 'private function raidTelemetryTick(now:Number):void' in s
assert 'raidTelemetryTick(now);' in s
assert 'coordinate-candidate' in s
assert 'raid-position-delta' in s
assert 'respawn-window' in s

path.write_text(s, encoding='utf-8')
print('v0.10 patch applied: integrated read-only Gleaming Depths respawn/position telemetry; no recursive display/native scans')
