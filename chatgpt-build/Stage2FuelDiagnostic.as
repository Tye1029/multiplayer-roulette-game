package
{
   import flash.display.MovieClip;
   import flash.events.Event;
   import flash.events.TimerEvent;
   import flash.utils.Timer;
   import flash.utils.getDefinitionByName;
   import flash.utils.getQualifiedClassName;

   public class Stage2FuelDiagnostic extends MovieClip
   {
      private static const VERSION:String = "0.1";
      private static const VENDOR:String = "Stage2FuelDiagnostic";
      private static const QUEST_PROVIDER:String = "QuestTrackerProvider";
      private static const GLEAMING_DEPTHS_QUEST:Number = 7920170;
      private static const FORTY_FIVE_HEX:String = "0001F66A";
      private static const FORTY_FIVE_DECIMAL:Number = 128618;
      private static const TRACE_WINDOW_MS:Number = 12000;
      private static const MAX_QUESTS:int = 30;
      private static const MAX_OBJECTIVES:int = 25;

      private var zfe:Object = null;
      private var uiDataManager:Object = null;
      private var pollTimer:Timer;
      private var fastTimer:Timer;
      private var subscribed:Boolean = false;
      private var pendingLogs:Array = [];
      private var bridgeLogged:Boolean = false;
      private var lastClassWaitLogAt:Number = 0;
      private var lastQuestFingerprint:String = "";
      private var lastMenuFingerprint:String = "";
      private var lastHudMode:String = "";
      private var stage2Active:Boolean = false;
      private var traceUntil:Number = 0;
      private var traceStart:Number = 0;
      private var traceSequence:int = 0;
      private var lastProviderSweepAt:Number = 0;
      private var providerFingerprints:Object = {};
      private var providerAvailability:Object = {};

      private var providerNames:Array = [
         "CrosshairAndActivateData","CrosshairData","ActivateData","ActivatePromptData","HUDActivateData",
         "QuickContainerData","QuickContainerMenuData","ContainerMenuData","ContainerData",
         "InventoryData","PlayerInventoryData","PlayerInventoryProvider","PipboyInventoryData","PipboyData",
         "ItemCardData","ItemCardProvider","PickupData","PickUpData","PickUpHistoryData","MessageData",
         "CharacterInfoData","PlayerInfoData","PlayerStateData","MenuStackData","HUDModeData",
         "WorldInfoData","ServerInfoData","SessionInfoData","GameModeData","QuestTrackerProvider"
      ];

      public function Stage2FuelDiagnostic()
      {
         super();
         mouseEnabled = false;
         mouseChildren = false;
         visible = false;
         if(stage) initialize();
         else addEventListener(Event.ADDED_TO_STAGE,onAddedToStage);
      }

      private function onAddedToStage(event:Event) : void
      {
         removeEventListener(Event.ADDED_TO_STAGE,onAddedToStage);
         initialize();
      }

      private function initialize() : void
      {
         findZFEBridge();
         log("info","startup","Stage 2 Fuel Diagnostic v" + VERSION + " loaded; Private/Custom World compatible; diagnostic-only, no inventory changes are performed; reference .45 FormID=" + FORTY_FIVE_HEX + " decimal=" + FORTY_FIVE_DECIMAL + "; looking for Raid Fuel pickup/deposit data");
         trySubscribe();
         pollCore("startup");
         sweepProviders("startup",true);

         pollTimer = new Timer(1000);
         pollTimer.addEventListener(TimerEvent.TIMER,onPoll);
         pollTimer.start();

         fastTimer = new Timer(200);
         fastTimer.addEventListener(TimerEvent.TIMER,onFastPoll);
         fastTimer.start();
      }

      private function onPoll(event:TimerEvent) : void
      {
         if(zfe == null) findZFEBridge();
         if(!subscribed || uiDataManager == null) trySubscribe();
         pollCore("poll");
         sweepProviders("poll",false);
      }

      private function onFastPoll(event:TimerEvent) : void
      {
         if(uiDataManager == null) return;
         var hud:Object = getProviderData("HUDModeData",false);
         var mode:String = hud != null ? safeString(hud,"hudMode") : "";
         if(mode != lastHudMode)
         {
            var oldMode:String = lastHudMode;
            lastHudMode = mode;
            log("info","hud-mode","change old=" + clean(oldMode) + " new=" + clean(mode));
            if(mode == "ActivateTypeMode" && stage2Active) startTrace("stage2-activate-mode");
         }
         if(inTraceWindow()) sweepProviders("fast",false);
      }

      private function trySubscribe() : void
      {
         if(subscribed) return;
         try
         {
            uiDataManager = getDefinitionByName("Shared.AS3.Data.BSUIDataManager");
            if(uiDataManager == null) return;
            uiDataManager["Subscribe"](QUEST_PROVIDER,onQuestTrackerData);
            uiDataManager["Subscribe"]("MenuStackData",onMenuStackData);
            uiDataManager["Subscribe"]("HUDModeData",onHUDModeData);
            subscribed = true;
            log("info","provider","subscribed QuestTrackerProvider, MenuStackData and HUDModeData; additional inventory/activate providers are probed read-only");
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
         if(data == null) return;
         var mode:String = safeString(data,"hudMode");
         if(mode != lastHudMode)
         {
            var oldMode:String = lastHudMode;
            lastHudMode = mode;
            log("info","hud-mode","change source=event old=" + clean(oldMode) + " new=" + clean(mode) + " data=" + compactObject(data,40,2));
            if(mode == "ActivateTypeMode" && stage2Active) startTrace("stage2-activate-event");
         }
      }

      private function eventData(event:*) : Object
      {
         try { if(event != null) return event["data"]; }
         catch(ignore:Error) {}
         return null;
      }

      private function pollCore(source:String) : void
      {
         if(uiDataManager == null) return;
         processQuestData(getProviderData(QUEST_PROVIDER,false),source);
         processMenuStack(getProviderData("MenuStackData",false),source);
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

      private function processQuestData(data:Object,source:String) : void
      {
         if(data == null) return;
         var quests:Object = safeValue(data,"quests");
         if(quests == null) return;
         var fingerprint:String = makeQuestFingerprint(quests);
         if(fingerprint == lastQuestFingerprint) return;
         lastQuestFingerprint = fingerprint;

         var foundRaid:Boolean = false;
         var foundStage2:Boolean = false;
         var count:int = safeLength(quests);
         var i:int;
         for(i = 0; i < count && i < MAX_QUESTS; i++)
         {
            var q:Object = safeIndex(quests,i);
            if(q == null || !isGleamingDepthsQuest(q)) continue;
            foundRaid = true;
            var objectives:Object = safeValue(q,"objectives");
            var objectiveCount:int = safeLength(objectives);
            log("info","raid","GLEAMING_DEPTHS source=" + source + " questId=" + clean(safeString(q,"questId")) + " objectives=" + objectiveCount + " title=" + clean(safeString(q,"title")));
            var j:int;
            for(j = 0; j < objectiveCount && j < MAX_OBJECTIVES; j++)
            {
               var obj:Object = safeIndex(objectives,j);
               if(obj == null) continue;
               var title:String = safeString(obj,"title");
               var upper:String = title.toUpperCase();
               log("info","raid-objective","obj[" + j + "] id=" + clean(safeString(obj,"objectiveId")) + " state=" + clean(safeString(obj,"state")) + " progress=" + clean(safeString(obj,"progress")) + " title=" + clean(title));
               if(upper.indexOf("DRILL") >= 0 || upper.indexOf("FUEL") >= 0 || upper.indexOf("TUNNEL") >= 0 || upper.indexOf("BORING") >= 0) foundStage2 = true;
            }
         }

         if(foundStage2 && !stage2Active)
         {
            stage2Active = true;
            log("info","stage2","Stage 2 detected from raid objective text; fuel tracing armed");
            startTrace("stage2-detected");
         }
         else if(!foundStage2 && stage2Active)
         {
            stage2Active = false;
            log("info","stage2","Stage 2 objective no longer detected; trace remains available on fuel/drill provider matches");
         }
         log("info","quest-summary","change source=" + source + " gleamingDepths=" + foundRaid + " stage2=" + foundStage2);
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
            out += safeString(q,"questId") + ":" + safeString(q,"title") + "|";
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
         var raw:* = safeValue(q,"questId");
         try { if(Number(raw) == GLEAMING_DEPTHS_QUEST) return true; }
         catch(ignore:Error) {}
         var text:String = String(raw).toUpperCase();
         return text == "0078DA2A" || text == "78DA2A" || text == "0X0078DA2A" || text == "0X78DA2A";
      }

      private function processMenuStack(data:Object,source:String) : void
      {
         if(data == null) return;
         var a:String = stackNames(safeValue(data,"menuStackA"));
         var b:String = stackNames(safeValue(data,"menuStackB"));
         var fp:String = a + "||" + b;
         if(fp == lastMenuFingerprint) return;
         lastMenuFingerprint = fp;
         log("info","menu","change source=" + source + " stackA=" + a + " stackB=" + b);
         if(stage2Active && (a.indexOf("Container") >= 0 || a.indexOf("Pipboy") >= 0 || a.indexOf("Message") >= 0)) startTrace("stage2-menu-change");
      }

      private function stackNames(stack:Object) : String
      {
         if(stack == null) return "[]";
         var out:String = "[";
         var count:int = safeLength(stack);
         var i:int;
         for(i = 0; i < count && i < 30; i++)
         {
            if(i > 0) out += ",";
            var entry:Object = safeIndex(stack,i);
            if(entry != null) out += clean(safeString(entry,"menuName"));
         }
         return out + "]";
      }

      private function startTrace(reason:String) : void
      {
         var now:Number = new Date().time;
         if(inTraceWindow())
         {
            traceUntil = Math.max(traceUntil,now + TRACE_WINDOW_MS);
            log("debug","trace-window","EXTEND seq=" + traceSequence + " reason=" + reason + " remainingMs=" + int(traceUntil - now));
            return;
         }
         traceSequence++;
         traceStart = now;
         traceUntil = now + TRACE_WINDOW_MS;
         providerFingerprints = {};
         log("info","trace-window","BEGIN seq=" + traceSequence + " reason=" + reason + " durationMs=" + TRACE_WINDOW_MS + " stage2=" + stage2Active);
         sweepProviders("trace-begin",true);
      }

      private function inTraceWindow() : Boolean
      {
         return traceUntil > 0 && new Date().time <= traceUntil;
      }

      private function traceElapsed() : int
      {
         if(traceStart <= 0) return -1;
         return int(new Date().time - traceStart);
      }

      private function sweepProviders(source:String,force:Boolean) : void
      {
         if(uiDataManager == null) return;
         var now:Number = new Date().time;
         if(!force && !inTraceWindow() && now - lastProviderSweepAt < 2000) return;
         lastProviderSweepAt = now;

         var i:int;
         for(i = 0; i < providerNames.length; i++)
         {
            var name:String = String(providerNames[i]);
            var data:Object = getProviderData(name,false);
            if(data == null) continue;
            if(providerAvailability[name] !== true)
            {
               providerAvailability[name] = true;
               log("info","provider-found","provider=" + name + " class=" + clean(getQualifiedClassName(data)));
            }

            var dump:String = compactObject(data,100,3);
            if(dump == "" || dump == "{}") continue;
            var upper:String = dump.toUpperCase();
            var interesting:Boolean = containsInterestingText(upper);
            if(providerFingerprints[name] == dump && !force) continue;
            providerFingerprints[name] = dump;

            if(inTraceWindow() || interesting || force)
            {
               log("info","provider-data","seq=" + traceSequence + " t=" + traceElapsed() + "ms source=" + source + " provider=" + name + " interesting=" + interesting + " data=" + dump);
            }
            if(interesting)
            {
               logCandidatePaths(name,data);
               if(!inTraceWindow()) startTrace("interesting-provider:" + name);
            }
         }
      }

      private function containsInterestingText(upper:String) : Boolean
      {
         if(upper == null) return false;
         return upper.indexOf("RAID FUEL") >= 0 || upper.indexOf("FUEL CANISTER") >= 0 || upper.indexOf("FUEL") >= 0 || upper.indexOf("DRILL") >= 0 || upper.indexOf(".45") >= 0 || upper.indexOf(FORTY_FIVE_HEX) >= 0 || upper.indexOf("1F66A") >= 0 || upper.indexOf(String(FORTY_FIVE_DECIMAL)) >= 0;
      }

      private function logCandidatePaths(provider:String,obj:Object) : void
      {
         var matches:Array = [];
         collectCandidatePaths(obj,"",0,matches,40);
         if(matches.length > 0) log("info","item-candidate","provider=" + provider + " matches=" + matches.join(" || "));
      }

      private function collectCandidatePaths(obj:Object,path:String,depth:int,matches:Array,maxMatches:int) : void
      {
         if(obj == null || depth > 4 || matches.length >= maxMatches) return;
         try
         {
            for(var key:String in obj)
            {
               if(matches.length >= maxMatches) break;
               var value:* = obj[key];
               var nextPath:String = path.length > 0 ? path + "." + key : key;
               if(value == null) continue;
               if(value is String || value is Number || value is Boolean || value is int || value is uint)
               {
                  var text:String = (key + "=" + String(value)).toUpperCase();
                  if(containsInterestingText(text)) matches.push(clean(nextPath + "=" + String(value)));
               }
               else collectCandidatePaths(value,nextPath,depth + 1,matches,maxMatches);
            }
         }
         catch(ignore:Error) {}
      }

      private function compactObject(obj:Object,maxKeys:int,depth:int) : String
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
         catch(error:Error) { out += "<error:" + clean(error.message) + ">"; }
         return clean(out + "}");
      }

      private function formatValue(value:*,maxKeys:int,depth:int) : String
      {
         if(value == null) return "null";
         if(value is String || value is Number || value is Boolean || value is int || value is uint) return clean(String(value));
         if(depth < 0) return "<" + clean(getQualifiedClassName(value)) + ">";
         return compactObject(value,maxKeys,depth);
      }

      private function safeValue(obj:Object,key:String) : *
      {
         try { if(obj != null) return obj[key]; }
         catch(ignore:Error) {}
         return null;
      }

      private function safeString(obj:Object,key:String) : String
      {
         var value:* = safeValue(obj,key);
         return value == null ? "" : String(value);
      }

      private function safeLength(obj:Object) : int
      {
         try { if(obj != null && obj["length"] != null) return int(obj["length"]); }
         catch(ignore:Error) {}
         return 0;
      }

      private function safeIndex(obj:Object,index:int) : Object
      {
         try { if(obj != null && index >= 0 && index < safeLength(obj)) return obj[index]; }
         catch(ignore:Error) {}
         return null;
      }

      private function clean(text:String) : String
      {
         if(text == null) return "";
         text = text.split("\r").join(" ");
         text = text.split("\n").join(" ");
         text = text.split("|").join("/");
         if(text.length > 1500) text = text.substr(0,1500) + "...";
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
            try { current = current.parent; }
            catch(parentError:Error) { current = null; }
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
            if(zfe != null && zfe["call"] != null) zfe["call"]("log",VENDOR,{level:level,category:category,message:clean(message)});
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
