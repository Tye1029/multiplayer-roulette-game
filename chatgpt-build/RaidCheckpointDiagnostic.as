package
{
   import flash.display.DisplayObject;
   import flash.display.DisplayObjectContainer;
   import flash.display.MovieClip;
   import flash.events.Event;
   import flash.events.TimerEvent;
   import flash.utils.Timer;
   import flash.utils.getDefinitionByName;
   import flash.utils.getQualifiedClassName;

   public class RaidCheckpointDiagnostic extends MovieClip
   {
      private static const VERSION:String = "0.3";
      private static const VENDOR:String = "RaidCheckpointDiagnostic";
      private static const QUEST_PROVIDER:String = "QuestTrackerProvider";
      private static const TARGET_QUEST_DECIMAL:Number = 7920170;
      private static const TRACE_WINDOW_MS:Number = 15000;
      private static const ENTRY_COORD_WINDOW_MS:Number = 12000;
      private static const STAGE5_COORD_WINDOW_MS:Number = 18000;
      private static const MAX_QUESTS:int = 25;
      private static const MAX_OBJECTIVES:int = 20;

      private var zfe:Object = null;
      private var uiDataManager:Object = null;
      private var pollTimer:Timer;
      private var fastTimer:Timer;
      private var subscribed:Boolean = false;
      private var pendingLogs:Array = [];
      private var bridgeLogged:Boolean = false;
      private var lastQuestFingerprint:String = "";
      private var lastMenuFingerprint:String = "";
      private var lastHudFingerprint:String = "";
      private var lastCharacterFingerprint:String = "";
      private var lastNoQuestLogAt:Number = 0;
      private var lastClassWaitLogAt:Number = 0;
      private var traceUntil:Number = 0;
      private var traceSequence:int = 0;
      private var lastTraceSnapshotAt:Number = 0;
      private var lastCoordinateSnapshotAt:Number = 0;
      private var lastDeathState:Boolean = false;
      private var raidVisible:Boolean = false;
      private var highestStageSeen:int = 0;
      private var coordinatePhase:String = "IDLE";
      private var coordinateBurstUntil:Number = 0;
      private var coordinateScanBudget:int = 0;
      private var coordinateCandidateFingerprints:Object = {};
      private var coordinateFieldFingerprints:Object = {};
      private var coordinateProviderFingerprints:Object = {};
      private var coordinateBaselines:Object = {};

      private var providerNames:Array = [
         "DeathRespawnData","DeathRespawnMenuData","RespawnData","RespawnMenuData",
         "CharacterInfoData","PlayerInfoData","PlayerStateData","MapMenuData",
         "MenuStackData","HUDModeData","QuestTrackerProvider"
      ];

      private var coordinateProviderNames:Array = [
         "PlayerPositionData","PlayerLocationData","PlayerPositionProvider","PlayerLocationProvider",
         "PlayerData","PlayerInfoData","PlayerStateData","CharacterInfoData","PlayerCameraData",
         "LocationData","LocationProvider","WorldData","WorldspaceData","CellData",
         "MapMenuData","MapData","MapMarkerData","CompassData","CompassMarkerData",
         "DeathRespawnData","DeathRespawnMenuData","RespawnData","RespawnMenuData",
         "HUDModeData","MenuStackData","QuestTrackerProvider"
      ];

      private var providerFingerprints:Object = {};

      public function RaidCheckpointDiagnostic()
      {
         super();
         mouseEnabled = false;
         mouseChildren = false;
         visible = false;
         if(stage)
         {
            initialize();
         }
         else
         {
            addEventListener(Event.ADDED_TO_STAGE,onAddedToStage);
         }
      }

      private function onAddedToStage(event:Event) : void
      {
         removeEventListener(Event.ADDED_TO_STAGE,onAddedToStage);
         initialize();
      }

      private function initialize() : void
      {
         findZFEBridge();
         log("info","startup","Raid Checkpoint Diagnostic v" + VERSION + " loaded; respawn tracing plus player/world coordinate probing; diagnostic-only, no movement actions are performed");
         trySubscribe();
         pollAll("startup");

         pollTimer = new Timer(1000);
         pollTimer.addEventListener(TimerEvent.TIMER,onPoll);
         pollTimer.start();

         fastTimer = new Timer(100);
         fastTimer.addEventListener(TimerEvent.TIMER,onFastPoll);
         fastTimer.start();
      }

      private function onPoll(event:TimerEvent) : void
      {
         if(zfe == null)
         {
            findZFEBridge();
         }
         if(!subscribed || uiDataManager == null)
         {
            trySubscribe();
         }
         pollAll("poll");
      }

      private function onFastPoll(event:TimerEvent) : void
      {
         if(uiDataManager == null)
         {
            return;
         }

         var hud:Object = getProviderData("HUDModeData",false);
         var menus:Object = getProviderData("MenuStackData",false);
         var mode:String = hud != null ? safeString(hud,"hudMode") : "";
         var menuText:String = menus != null ? stackNames(safeValue(menus,"menuStackA")) : "[]";
         var deathNow:Boolean = mode == "DeathRespawnMode" || menuText.indexOf("DeathRespawnMenu") >= 0;

         if(deathNow && !lastDeathState)
         {
            startTraceWindow("death-enter",mode,menuText);
         }
         lastDeathState = deathNow;

         var now:Number = new Date().time;
         if(inTraceWindow())
         {
            traceProviders("fast");
            if(now - lastTraceSnapshotAt >= 500)
            {
               lastTraceSnapshotAt = now;
               log("info","respawn-timeline","seq=" + traceSequence + " t=" + traceElapsed() + "ms hudMode=" + clean(mode) + " menus=" + clean(menuText));
               snapshotContext("timeline");
            }
         }

         if(inCoordinateWindow() && now - lastCoordinateSnapshotAt >= 500)
         {
            lastCoordinateSnapshotAt = now;
            probeCoordinates("fast");
         }
      }

      private function startTraceWindow(reason:String,mode:String,menuText:String) : void
      {
         traceSequence++;
         traceUntil = new Date().time + TRACE_WINDOW_MS;
         lastTraceSnapshotAt = 0;
         log("info","respawn-window","BEGIN seq=" + traceSequence + " reason=" + reason + " hudMode=" + clean(mode) + " menus=" + clean(menuText) + " durationMs=" + TRACE_WINDOW_MS);
         setCoordinatePhase("RESPAWN_TRANSITION","normal death/respawn sequence detected",TRACE_WINDOW_MS + 5000);
         snapshotContext("begin");
      }

      private function inTraceWindow() : Boolean
      {
         return traceUntil > 0 && new Date().time <= traceUntil;
      }

      private function traceElapsed() : Number
      {
         if(traceUntil <= 0)
         {
            return -1;
         }
         return TRACE_WINDOW_MS - Math.max(0,traceUntil - new Date().time);
      }

      private function setCoordinatePhase(phase:String,reason:String,durationMs:Number) : void
      {
         coordinatePhase = phase;
         coordinateBurstUntil = new Date().time + durationMs;
         lastCoordinateSnapshotAt = 0;
         log("info","raid-position-phase","phase=" + phase + " reason=" + clean(reason) + " captureMs=" + durationMs);
         probeCoordinates("phase-begin");
      }

      private function inCoordinateWindow() : Boolean
      {
         return coordinateBurstUntil > 0 && new Date().time <= coordinateBurstUntil;
      }

      private function trySubscribe() : void
      {
         if(subscribed)
         {
            return;
         }
         try
         {
            uiDataManager = getDefinitionByName("Shared.AS3.Data.BSUIDataManager");
            if(uiDataManager == null)
            {
               return;
            }
            uiDataManager["Subscribe"](QUEST_PROVIDER,onQuestTrackerData);
            uiDataManager["Subscribe"]("MenuStackData",onMenuStackData);
            uiDataManager["Subscribe"]("HUDModeData",onHUDModeData);
            try
            {
               uiDataManager["Subscribe"]("CharacterInfoData",onCharacterInfoData);
            }
            catch(characterSubscribeError:Error)
            {
               log("warn","provider","CharacterInfoData subscription unavailable: " + clean(characterSubscribeError.message));
            }
            subscribed = true;
            log("info","provider","subscribed QuestTrackerProvider, MenuStackData, HUDModeData and CharacterInfoData");
         }
         catch(error:Error)
         {
            var now:Number = new Date().time;
            if(now - lastClassWaitLogAt > 10000)
            {
               lastClassWaitLogAt = now;
               log("warn","provider","waiting for BSUIDataManager: " + clean(error.message));
            }
         }
      }

      private function onQuestTrackerData(event:*) : void
      {
         var data:Object = eventData(event);
         if(data == null) data = getProviderData(QUEST_PROVIDER,false);
         processQuestData(data,"event");
      }

      private function onMenuStackData(event:*) : void
      {
         var data:Object = eventData(event);
         if(data == null) data = getProviderData("MenuStackData",false);
         processMenuStack(data,"event");
      }

      private function onHUDModeData(event:*) : void
      {
         var data:Object = eventData(event);
         if(data == null) data = getProviderData("HUDModeData",false);
         processHudMode(data,"event");
      }

      private function onCharacterInfoData(event:*) : void
      {
         var data:Object = eventData(event);
         if(data == null) data = getProviderData("CharacterInfoData",false);
         processCharacterInfo(data,"event");
      }

      private function eventData(event:*) : Object
      {
         try
         {
            if(event != null) return event["data"];
         }
         catch(ignore:Error) {}
         return null;
      }

      private function pollAll(source:String) : void
      {
         if(uiDataManager == null) return;
         processQuestData(getProviderData(QUEST_PROVIDER,false),source);
         processMenuStack(getProviderData("MenuStackData",false),source);
         processHudMode(getProviderData("HUDModeData",false),source);
         processCharacterInfo(getProviderData("CharacterInfoData",false),source);
         if(inTraceWindow()) traceProviders(source);
         if(inCoordinateWindow()) probeCoordinates(source);
      }

      private function getProviderData(provider:String,createIfMissing:Boolean = false) : Object
      {
         try
         {
            if(uiDataManager == null) return null;
            var wrapper:Object = uiDataManager["GetDataFromClient"](provider,createIfMissing,false);
            if(wrapper != null) return wrapper["data"];
         }
         catch(ignore:Error) {}
         return null;
      }

      private function traceProviders(source:String) : void
      {
         var i:int;
         for(i = 0; i < providerNames.length; i++)
         {
            var name:String = String(providerNames[i]);
            var data:Object = getProviderData(name,false);
            if(data == null) continue;
            var fingerprint:String = compactObject(data,80,2);
            if(fingerprint == "") continue;
            if(providerFingerprints[name] == fingerprint) continue;
            providerFingerprints[name] = fingerprint;
            log("info","respawn-provider","seq=" + traceSequence + " t=" + traceElapsed() + "ms source=" + source + " provider=" + name + " data=" + fingerprint);
         }
      }

      private function probeCoordinates(source:String) : void
      {
         if(uiDataManager == null) return;
         coordinateScanBudget = 300;
         var available:Array = [];
         var i:int;
         for(i = 0; i < coordinateProviderNames.length; i++)
         {
            var name:String = String(coordinateProviderNames[i]);
            var data:Object = getProviderData(name,false);
            if(data == null) continue;
            available.push(name);
            scanCoordinateCandidates(name,data,"root",0);

            var interesting:String = primitivePositionFields(data,60);
            if(interesting != "")
            {
               var providerFingerprint:String = coordinatePhase + ":" + interesting;
               if(coordinateProviderFingerprints[name] != providerFingerprint)
               {
                  coordinateProviderFingerprints[name] = providerFingerprint;
                  log("info","coordinate-provider","phase=" + coordinatePhase + " source=" + source + " provider=" + name + " fields=" + interesting);
               }
            }
         }

         scanSpecialCoordinateObjects();

         if(source == "phase-begin")
         {
            log("info","coordinate-probe","phase=" + coordinatePhase + " availableProviders=" + clean(available.join(",")) + " note=all coordinate candidates are read-only and unverified until compared across entry and checkpoint placement");
         }
      }

      private function scanSpecialCoordinateObjects() : void
      {
         var p:Object = this;
         var depth:int = 0;
         while(p != null && depth < 8)
         {
            scanNamedCoordinateObject(p,"BGSCodeObj","ancestor:" + depth);
            scanNamedCoordinateObject(p,"__SFCodeObj","ancestor:" + depth);
            scanNamedCoordinateObject(p,"BRG_OBJ","ancestor:" + depth);
            try { p = p.parent; } catch(ignore:Error) { p = null; }
            depth++;
         }
      }

      private function scanNamedCoordinateObject(owner:Object,key:String,where:String) : void
      {
         try
         {
            if(owner != null && owner[key] != null)
            {
               scanCoordinateCandidates(key,owner[key],where,0);
            }
         }
         catch(ignore:Error) {}
      }

      private function scanCoordinateCandidates(sourceName:String,obj:Object,path:String,depth:int) : void
      {
         if(obj == null || depth > 4 || coordinateScanBudget <= 0) return;
         coordinateScanBudget--;

         var x:Number = findAxisNumber(obj,"x");
         var y:Number = findAxisNumber(obj,"y");
         var z:Number = findAxisNumber(obj,"z");
         if(!isNaN(x) && !isNaN(y) && !isNaN(z))
         {
            var heading:Number = findHeadingNumber(obj);
            var context:String = primitiveContextFields(obj,35);
            var candidateKey:String = sourceName + ":" + path;
            var fingerprint:String = coordinatePhase + ":" + formatNumber(x) + ":" + formatNumber(y) + ":" + formatNumber(z) + ":" + (isNaN(heading) ? "" : formatNumber(heading)) + ":" + context;
            if(coordinateCandidateFingerprints[candidateKey] != fingerprint)
            {
               coordinateCandidateFingerprints[candidateKey] = fingerprint;
               var hint:String = sourceName.toLowerCase().indexOf("map") >= 0 ? "map-or-world-unverified" : "provider-triplet-unverified";
               log("info","coordinate-candidate","phase=" + coordinatePhase + " source=" + sourceName + " path=" + path + " x=" + formatNumber(x) + " y=" + formatNumber(y) + " z=" + formatNumber(z) + " heading=" + (isNaN(heading) ? "unknown" : formatNumber(heading)) + " space=" + hint + " context=" + context);
               rememberCoordinate(candidateKey,x,y,z,heading);
            }
         }

         var fields:String = primitivePositionFields(obj,45);
         if(fields != "")
         {
            var fieldKey:String = sourceName + ":" + path;
            var fieldFingerprint:String = coordinatePhase + ":" + fields;
            if(coordinateFieldFingerprints[fieldKey] != fieldFingerprint)
            {
               coordinateFieldFingerprints[fieldKey] = fieldFingerprint;
               log("info","coordinate-field","phase=" + coordinatePhase + " source=" + sourceName + " path=" + path + " fields=" + fields);
            }
         }

         if(depth >= 4) return;
         var count:int = 0;
         try
         {
            for(var key:String in obj)
            {
               if(count >= 45 || coordinateScanBudget <= 0) break;
               var value:* = obj[key];
               if(value != null && !isPrimitive(value))
               {
                  scanCoordinateCandidates(sourceName,value,path + "." + cleanKey(key),depth + 1);
               }
               count++;
            }
         }
         catch(ignore:Error) {}
      }

      private function rememberCoordinate(candidateKey:String,x:Number,y:Number,z:Number,heading:Number) : void
      {
         var holder:Object = coordinateBaselines[candidateKey];
         if(holder == null)
         {
            holder = {};
            coordinateBaselines[candidateKey] = holder;
         }

         if(coordinatePhase == "ENTRY")
         {
            holder["entry"] = {x:x,y:y,z:z,heading:heading};
            log("info","raid-position","phase=ENTRY key=" + candidateKey + " x=" + formatNumber(x) + " y=" + formatNumber(y) + " z=" + formatNumber(z) + " heading=" + (isNaN(heading) ? "unknown" : formatNumber(heading)) + " status=UNVERIFIED_COORDINATE_CANDIDATE");
         }
         else if(coordinatePhase == "STAGE5")
         {
            holder["stage5"] = {x:x,y:y,z:z,heading:heading};
            log("info","raid-position","phase=STAGE5 key=" + candidateKey + " x=" + formatNumber(x) + " y=" + formatNumber(y) + " z=" + formatNumber(z) + " heading=" + (isNaN(heading) ? "unknown" : formatNumber(heading)) + " status=UNVERIFIED_COORDINATE_CANDIDATE");
            if(holder["entry"] != null)
            {
               var entry:Object = holder["entry"];
               log("info","raid-position-delta","key=" + candidateKey + " dx=" + formatNumber(x - Number(entry.x)) + " dy=" + formatNumber(y - Number(entry.y)) + " dz=" + formatNumber(z - Number(entry.z)) + " status=UNVERIFIED_UNTIL_REPEATABLE_ACROSS_MULTIPLE_RUNS");
            }
         }
      }

      private function findAxisNumber(obj:Object,axis:String) : Number
      {
         var aliases:Array;
         if(axis == "x") aliases = ["x","posx","positionx","worldx","playerx","locationx","coordx","coordinatex","xpos","fposx","fpositionx"];
         else if(axis == "y") aliases = ["y","posy","positiony","worldy","playery","locationy","coordy","coordinatey","ypos","fposy","fpositiony"];
         else aliases = ["z","posz","positionz","worldz","playerz","locationz","coordz","coordinatez","zpos","fposz","fpositionz"];

         try
         {
            for(var key:String in obj)
            {
               var normalized:String = normalizeKey(key);
               if(stringInArray(normalized,aliases))
               {
                  var value:* = obj[key];
                  if(isNumericPrimitive(value)) return Number(value);
               }
            }
         }
         catch(ignore:Error) {}
         return Number.NaN;
      }

      private function findHeadingNumber(obj:Object) : Number
      {
         var aliases:Array = ["heading","yaw","angle","rotation","rotationz","headingdegrees","playerheading","direction","fheading","fyaw"];
         try
         {
            for(var key:String in obj)
            {
               if(stringInArray(normalizeKey(key),aliases))
               {
                  var value:* = obj[key];
                  if(isNumericPrimitive(value)) return Number(value);
               }
            }
         }
         catch(ignore:Error) {}
         return Number.NaN;
      }

      private function primitivePositionFields(obj:Object,maxKeys:int) : String
      {
         if(obj == null) return "";
         var out:String = "";
         var count:int = 0;
         try
         {
            for(var key:String in obj)
            {
               if(count >= maxKeys) break;
               var value:* = obj[key];
               if(isPrimitive(value) && isInterestingPositionKey(key))
               {
                  if(out != "") out += ",";
                  out += cleanKey(key) + "=" + clean(String(value));
                  count++;
               }
            }
         }
         catch(ignore:Error) {}
         return out;
      }

      private function primitiveContextFields(obj:Object,maxKeys:int) : String
      {
         if(obj == null) return "";
         var out:String = "";
         var count:int = 0;
         try
         {
            for(var key:String in obj)
            {
               if(count >= maxKeys) break;
               var lower:String = key.toLowerCase();
               var value:* = obj[key];
               if(isPrimitive(value) && (lower.indexOf("cell") >= 0 || lower.indexOf("world") >= 0 || lower.indexOf("location") >= 0 || lower.indexOf("region") >= 0 || lower.indexOf("instance") >= 0 || lower.indexOf("interior") >= 0 || lower.indexOf("exterior") >= 0 || lower.indexOf("heading") >= 0 || lower.indexOf("yaw") >= 0))
               {
                  if(out != "") out += ",";
                  out += cleanKey(key) + "=" + clean(String(value));
                  count++;
               }
            }
         }
         catch(ignore:Error) {}
         return out;
      }

      private function isInterestingPositionKey(key:String) : Boolean
      {
         var lower:String = key.toLowerCase();
         var normalized:String = normalizeKey(key);
         if(lower.indexOf("position") >= 0 || lower.indexOf("coord") >= 0 || lower.indexOf("location") >= 0 || lower.indexOf("world") >= 0 || lower.indexOf("cell") >= 0 || lower.indexOf("heading") >= 0 || lower.indexOf("yaw") >= 0 || lower.indexOf("rotation") >= 0 || lower.indexOf("angle") >= 0 || lower.indexOf("direction") >= 0) return true;
         return stringInArray(normalized,["x","y","z","posx","posy","posz","playerx","playery","playerz","worldx","worldy","worldz"]);
      }

      private function normalizeKey(key:String) : String
      {
         var text:String = key == null ? "" : key.toLowerCase();
         text = text.split("_").join("");
         text = text.split("-").join("");
         text = text.split(" ").join("");
         text = text.split(".").join("");
         return text;
      }

      private function cleanKey(key:String) : String
      {
         if(key == null) return "";
         return clean(key);
      }

      private function stringInArray(value:String,values:Array) : Boolean
      {
         var i:int;
         for(i = 0; i < values.length; i++)
         {
            if(value == String(values[i])) return true;
         }
         return false;
      }

      private function isPrimitive(value:*) : Boolean
      {
         return value == null || value is String || value is Number || value is Boolean || value is int || value is uint;
      }

      private function isNumericPrimitive(value:*) : Boolean
      {
         if(value == null) return false;
         if(value is Number || value is int || value is uint) return !isNaN(Number(value));
         if(value is String)
         {
            var text:String = String(value);
            if(text == "") return false;
            return !isNaN(Number(text));
         }
         return false;
      }

      private function formatNumber(value:Number) : String
      {
         if(isNaN(value)) return "NaN";
         return value.toFixed(3);
      }

      private function snapshotContext(reason:String) : void
      {
         if(!inTraceWindow() && reason != "begin") return;
         try
         {
            log("debug","respawn-context","seq=" + traceSequence + " t=" + traceElapsed() + "ms reason=" + reason + " self=" + describeDisplay(this));
            var p:DisplayObject = this;
            var depth:int = 0;
            while(p != null && depth < 8)
            {
               log("debug","respawn-ancestor","seq=" + traceSequence + " t=" + traceElapsed() + "ms depth=" + depth + " " + describeDisplay(p));
               p = p.parent;
               depth++;
            }
            if(stage != null)
            {
               logDisplayTree(stage,0,4,0,120);
            }
            inspectSpecialObjects();
         }
         catch(error:Error)
         {
            log("warn","respawn-context","snapshot failed: " + clean(error.message));
         }
      }

      private function inspectSpecialObjects() : void
      {
         var p:Object = this;
         var depth:int = 0;
         while(p != null && depth < 8)
         {
            inspectNamedObject(p,"BGSCodeObj","ancestor:" + depth);
            inspectNamedObject(p,"__SFCodeObj","ancestor:" + depth);
            inspectNamedObject(p,"BRG_OBJ","ancestor:" + depth);
            inspectNamedObject(p,"__ZFE","ancestor:" + depth);
            inspectNamedObject(p,"ZFECodeObj","ancestor:" + depth);
            try { p = p.parent; } catch(ignore:Error) { p = null; }
            depth++;
         }
      }

      private function inspectNamedObject(owner:Object,key:String,where:String) : void
      {
         try
         {
            if(owner != null && owner[key] != null)
            {
               var value:Object = owner[key];
               log("info","respawn-object","seq=" + traceSequence + " t=" + traceElapsed() + "ms where=" + where + " key=" + key + " class=" + clean(getQualifiedClassName(value)) + " fields=" + compactObject(value,120,1));
            }
         }
         catch(ignore:Error) {}
      }

      private function logDisplayTree(node:DisplayObject,depth:int,maxDepth:int,count:int,maxCount:int) : int
      {
         if(node == null || depth > maxDepth || count >= maxCount) return count;
         log("debug","respawn-tree","seq=" + traceSequence + " t=" + traceElapsed() + "ms d=" + depth + " " + describeDisplay(node));
         count++;
         if(node is DisplayObjectContainer)
         {
            var c:DisplayObjectContainer = DisplayObjectContainer(node);
            var n:int = Math.min(c.numChildren,30);
            var i:int;
            for(i = 0; i < n && count < maxCount; i++)
            {
               try { count = logDisplayTree(c.getChildAt(i),depth + 1,maxDepth,count,maxCount); } catch(ignore:Error) {}
            }
         }
         return count;
      }

      private function describeDisplay(obj:DisplayObject) : String
      {
         if(obj == null) return "null";
         var nameText:String = "";
         try { nameText = obj.name; } catch(ignore:Error) {}
         var extras:String = "";
         try { extras = compactPrimitiveSubset(obj,25); } catch(ignore2:Error) {}
         return "name=" + clean(nameText) + " class=" + clean(getQualifiedClassName(obj)) + " visible=" + obj.visible + " alpha=" + obj.alpha + " uiX=" + int(obj.x) + " uiY=" + int(obj.y) + " fields=" + extras;
      }

      private function processQuestData(data:Object,source:String) : void
      {
         if(data == null) return;
         var quests:Object = safeValue(data,"quests");
         if(quests == null || safeLength(quests) == 0)
         {
            var emptyNow:Number = new Date().time;
            if(emptyNow - lastNoQuestLogAt > 15000)
            {
               lastNoQuestLogAt = emptyNow;
               log("info","quest","QuestTrackerProvider available but has no quest array yet");
            }
            if(raidVisible)
            {
               raidVisible = false;
               highestStageSeen = 0;
               coordinatePhase = "IDLE";
               coordinateBurstUntil = 0;
            }
            return;
         }

         var fingerprint:String = makeQuestFingerprint(quests);
         if(fingerprint == lastQuestFingerprint) return;
         lastQuestFingerprint = fingerprint;

         var total:int = safeLength(quests);
         var raidFound:Boolean = false;
         var raidGuess:int = 0;
         var i:int;
         for(i = 0; i < total && i < MAX_QUESTS; i++)
         {
            var q:Object = safeIndex(quests,i);
            if(q != null && isGleamingDepthsQuest(q))
            {
               raidFound = true;
               raidGuess = guessStage(q);
               logRaidQuest(q,source,raidGuess);
            }
         }

         if(raidFound && !raidVisible)
         {
            raidVisible = true;
            highestStageSeen = 0;
            setCoordinatePhase("ENTRY","Gleaming Depths quest became visible after raid load",ENTRY_COORD_WINDOW_MS);
         }

         if(raidFound && raidGuess > highestStageSeen)
         {
            if(raidGuess == 5 && highestStageSeen < 5)
            {
               setCoordinatePhase("STAGE5","Ultracite Terror objective detected after checkpoint placement",STAGE5_COORD_WINDOW_MS);
            }
            highestStageSeen = raidGuess;
         }

         if(!raidFound && raidVisible)
         {
            raidVisible = false;
            highestStageSeen = 0;
            coordinatePhase = "IDLE";
            coordinateBurstUntil = 0;
         }

         log("info","quest-summary","change source=" + source + " tracked=" + total + " gleamingDepths=" + raidFound + " checkpointGuess=" + (raidGuess > 0 ? String(raidGuess) : "unknown") + " highestStageSeen=" + highestStageSeen);
      }

      private function logRaidQuest(q:Object,source:String,stageGuess:int) : void
      {
         var objectives:Object = safeValue(q,"objectives");
         var objectiveCount:int = safeLength(objectives);
         log("info","raid","GLEAMING_DEPTHS source=" + source + " questId=" + clean(safeString(q,"questId")) + " state=" + clean(safeString(q,"state")) + " stageGuess=" + (stageGuess > 0 ? String(stageGuess) : "unknown") + " objectives=" + objectiveCount + " title=" + clean(safeString(q,"title")));
         if(inTraceWindow()) log("info","raid-raw","seq=" + traceSequence + " t=" + traceElapsed() + "ms quest=" + compactObject(q,120,3));
         var i:int;
         for(i = 0; i < objectiveCount && i < MAX_OBJECTIVES; i++)
         {
            var obj:Object = safeIndex(objectives,i);
            if(obj == null) continue;
            log("info","raid-objective","obj[" + i + "] id=" + clean(safeString(obj,"objectiveId")) + " state=" + clean(safeString(obj,"state")) + " progress=" + clean(safeString(obj,"progress")) + " offMap=" + clean(safeString(obj,"isOffMap")) + " context=" + clean(safeString(obj,"contextQuestID")) + " title=" + clean(safeString(obj,"title")));
            if(inTraceWindow()) log("info","raid-objective-raw","seq=" + traceSequence + " t=" + traceElapsed() + "ms obj[" + i + "]=" + compactObject(obj,100,3));
         }
      }

      private function makeQuestFingerprint(quests:Object) : String
      {
         var out:String = "";
         var count:int = safeLength(quests);
         var i:int;
         for(i = 0; i < count && i < MAX_QUESTS; i++)
         {
            var q:Object = safeIndex(quests,i);
            if(q == null) continue;
            out += safeString(q,"questId") + ":" + safeString(q,"state") + ":" + safeString(q,"title") + "|";
            var objs:Object = safeValue(q,"objectives");
            var j:int;
            for(j = 0; j < safeLength(objs) && j < MAX_OBJECTIVES; j++)
            {
               var obj:Object = safeIndex(objs,j);
               if(obj != null) out += safeString(obj,"objectiveId") + ":" + safeString(obj,"state") + ":" + safeString(obj,"progress") + ":" + safeString(obj,"title") + ";";
            }
         }
         return out;
      }

      private function isGleamingDepthsQuest(q:Object) : Boolean
      {
         var title:String = safeString(q,"title").toUpperCase();
         if(title.indexOf("GLEAMING DEPTHS") >= 0) return true;
         var idValue:* = safeValue(q,"questId");
         try { if(Number(idValue) == TARGET_QUEST_DECIMAL) return true; } catch(ignore:Error) {}
         var idText:String = String(idValue).toUpperCase();
         return idText == "0078DA2A" || idText == "78DA2A" || idText == "0X0078DA2A" || idText == "0X78DA2A";
      }

      private function guessStage(q:Object) : int
      {
         var objs:Object = safeValue(q,"objectives");
         var count:int = safeLength(objs);
         var best:int = 0;
         var i:int;
         for(i = 0; i < count; i++)
         {
            var obj:Object = safeIndex(objs,i);
            if(obj == null) continue;
            var title:String = safeString(obj,"title").toUpperCase();
            var candidate:int = 0;
            if(title.indexOf("ULTRACITE TERROR") >= 0) candidate = 5;
            else if(title.indexOf("HORDE") >= 0 || title.indexOf("CRYSTAL") >= 0) candidate = 4;
            else if(title.indexOf("EPSILON") >= 0) candidate = 3;
            else if(title.indexOf("DRILL") >= 0) candidate = 2;
            else if(title.indexOf("EN06") >= 0 || title.indexOf("GUARDIAN") >= 0) candidate = 1;
            if(candidate > best) best = candidate;
         }
         return best;
      }

      private function processMenuStack(data:Object,source:String) : void
      {
         if(data == null) return;
         var a:String = stackNames(safeValue(data,"menuStackA"));
         var b:String = stackNames(safeValue(data,"menuStackB"));
         var fingerprint:String = a + "||" + b;
         if(fingerprint == lastMenuFingerprint) return;
         lastMenuFingerprint = fingerprint;
         log("info","menu","change source=" + source + " stackA=" + a + " stackB=" + b);
         if(a.indexOf("DeathRespawnMenu") >= 0 && !inTraceWindow()) startTraceWindow("menu-detected",safeString(getProviderData("HUDModeData",false),"hudMode"),a);
         if(inTraceWindow()) log("info","menu-raw","seq=" + traceSequence + " t=" + traceElapsed() + "ms data=" + compactObject(data,120,3));
      }

      private function stackNames(stack:Object) : String
      {
         if(stack == null) return "[]";
         var count:int = safeLength(stack);
         var out:String = "[";
         var i:int;
         for(i = 0; i < count && i < 30; i++)
         {
            if(i > 0) out += ",";
            var entry:Object = safeIndex(stack,i);
            if(entry != null) out += clean(safeString(entry,"menuName"));
         }
         return out + "]";
      }

      private function processHudMode(data:Object,source:String) : void
      {
         if(data == null) return;
         var mode:String = safeString(data,"hudMode");
         var fingerprint:String = mode + "|" + compactPrimitiveSubset(data,30);
         if(fingerprint == lastHudFingerprint) return;
         lastHudFingerprint = fingerprint;
         log("info","hud-mode","change source=" + source + " hudMode=" + clean(mode) + " fields=" + compactObject(data,50,2));
         if(mode == "DeathRespawnMode" && !inTraceWindow()) startTraceWindow("hud-mode-detected",mode,stackNames(safeValue(getProviderData("MenuStackData",false),"menuStackA")));
      }

      private function processCharacterInfo(data:Object,source:String) : void
      {
         if(data == null) return;
         var fingerprint:String = compactPrimitiveSubset(data,50);
         if(fingerprint == "" || fingerprint == lastCharacterFingerprint) return;
         lastCharacterFingerprint = fingerprint;
         if(inTraceWindow()) log("info","character","seq=" + traceSequence + " t=" + traceElapsed() + "ms source=" + source + " data=" + compactObject(data,100,2));
         if(inCoordinateWindow()) scanCoordinateCandidates("CharacterInfoData",data,"event",0);
      }

      private function compactPrimitiveSubset(obj:Object,maxKeys:int) : String
      {
         if(obj == null) return "";
         var out:String = "";
         var count:int = 0;
         try
         {
            for(var key:String in obj)
            {
               if(count >= maxKeys) break;
               var value:* = obj[key];
               if(isPrimitive(value))
               {
                  out += key + "=" + String(value) + ";";
                  count++;
               }
            }
         }
         catch(ignore:Error) {}
         return out;
      }

      private function compactObject(obj:Object,maxKeys:int,depth:int = 1) : String
      {
         if(obj == null) return "null";
         if(depth < 0) return "<depth>";
         var out:String = "{";
         var count:int = 0;
         try
         {
            for(var key:String in obj)
            {
               if(count >= maxKeys) { out += "..."; break; }
               if(count > 0) out += ",";
               var value:* = obj[key];
               out += clean(key) + "=" + formatValue(value,Math.max(8,int(maxKeys / 4)),depth - 1);
               count++;
            }
         }
         catch(error:Error)
         {
            out += "<error:" + clean(error.message) + ">";
         }
         return out + "}";
      }

      private function formatValue(value:*,maxKeys:int,depth:int) : String
      {
         if(value == null) return "null";
         if(isPrimitive(value)) return clean(String(value));
         if(depth < 0) return "<" + clean(getQualifiedClassName(value)) + ">";
         return compactObject(value,maxKeys,depth);
      }

      private function safeValue(obj:Object,key:String) : *
      {
         try { if(obj != null) return obj[key]; } catch(ignore:Error) {}
         return null;
      }

      private function safeString(obj:Object,key:String) : String
      {
         var value:* = safeValue(obj,key);
         return value == null ? "" : String(value);
      }

      private function safeLength(obj:Object) : int
      {
         try { if(obj != null && obj["length"] != null) return int(obj["length"]); } catch(ignore:Error) {}
         return 0;
      }

      private function safeIndex(obj:Object,index:int) : Object
      {
         try { if(obj != null && index >= 0 && index < safeLength(obj)) return obj[index]; } catch(ignore:Error) {}
         return null;
      }

      private function clean(text:String) : String
      {
         if(text == null) return "";
         text = text.split("\r").join(" ");
         text = text.split("\n").join(" ");
         text = text.split("|").join("/");
         if(text.length > 1200) text = text.substr(0,1200) + "...";
         return text;
      }

      private function findZFEBridge() : void
      {
         var aliases:Array = ["__ZFE","ZFECodeObj","BRG_OBJ","__SFCodeObj"];
         var current:Object = this;
         var depth:int = 0;
         while(current != null && depth < 8)
         {
            var i:int;
            for(i = 0; i < aliases.length; i++)
            {
               try
               {
                  var candidate:Object = current[aliases[i]];
                  if(candidate != null && verifyBridge(candidate))
                  {
                     zfe = candidate;
                     if(!bridgeLogged)
                     {
                        bridgeLogged = true;
                        logDirect("info","bridge","verified ZFE bridge alias=" + aliases[i] + " at ancestor:" + depth);
                     }
                     flushPendingLogs();
                     return;
                  }
               }
               catch(ignore:Error) {}
            }
            try { current = current.parent; } catch(parentError:Error) { current = null; }
            depth++;
         }
      }

      private function verifyBridge(candidate:Object) : Boolean
      {
         try
         {
            if(candidate == null || candidate["call"] == null) return false;
            var result:* = candidate["call"]("getRuntimeInfo",VENDOR,{});
            return result != null;
         }
         catch(ignore:Error) {}
         return false;
      }

      private function log(level:String,category:String,message:String) : void
      {
         if(zfe == null)
         {
            if(pendingLogs.length < 500) pendingLogs.push({level:level,category:category,message:message});
            return;
         }
         logDirect(level,category,message);
      }

      private function logDirect(level:String,category:String,message:String) : void
      {
         try
         {
            if(zfe != null && zfe["call"] != null)
            {
               zfe["call"]("log",VENDOR,{level:level,category:category,message:clean(message)});
            }
         }
         catch(ignore:Error) {}
      }

      private function flushPendingLogs() : void
      {
         if(zfe == null || pendingLogs.length == 0) return;
         var copy:Array = pendingLogs.concat();
         pendingLogs = [];
         for each(var entry:Object in copy) logDirect(String(entry.level),String(entry.category),String(entry.message));
      }
   }
}
