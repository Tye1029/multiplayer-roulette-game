package
{
   import flash.display.MovieClip;
   import flash.events.Event;
   import flash.events.TimerEvent;
   import flash.utils.Timer;
   import flash.utils.getDefinitionByName;

   public class Stage2FuelDiagnostic extends MovieClip
   {
      private static const VERSION:String = "0.2";
      private static const VENDOR:String = "Stage2FuelDiagnostic";
      private static const QUEST_PROVIDER:String = "QuestTrackerProvider";
      private static const RAID_QUEST:Number = 7920170;
      private static const FORTY_FIVE_HEX:String = "0001F66A";
      private static const FORTY_FIVE_DECIMAL:Number = 128618;
      private static const TRACE_WINDOW_MS:Number = 15000;

      private var zfe:Object = null;
      private var uiDataManager:Object = null;
      private var pollTimer:Timer = null;
      private var bridgeLogged:Boolean = false;
      private var pendingLogs:Array = [];
      private var coreSubscribed:Boolean = false;
      private var inventorySubscribed:Boolean = false;
      private var stage2Active:Boolean = false;
      private var traceUntil:Number = 0;
      private var traceStart:Number = 0;
      private var traceSeq:int = 0;
      private var lastQuestFingerprint:String = "";
      private var lastMenuFingerprint:String = "";
      private var lastHudMode:String = "";
      private var lastInventoryFingerprint:String = "";
      private var optionalFingerprints:Object = {};
      private var lastBridgeRetry:Number = 0;
      private var lastSubscribeRetry:Number = 0;

      public function Stage2FuelDiagnostic()
      {
         super();
         mouseEnabled = false;
         mouseChildren = false;
         visible = false;
         if(stage != null)
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
         log("info","startup","Stage 2 Fuel Diagnostic v" + VERSION + " loaded; lightweight Private/Custom World diagnostic-only build; no inventory changes are performed; .45 reference FormID=" + FORTY_FIVE_HEX + " decimal=" + FORTY_FIVE_DECIMAL);
         trySubscribe();
         pollCore("startup");

         pollTimer = new Timer(1000);
         pollTimer.addEventListener(TimerEvent.TIMER,onPoll);
         pollTimer.start();
      }

      private function onPoll(event:TimerEvent) : void
      {
         var now:Number = new Date().time;
         if(zfe == null && now - lastBridgeRetry >= 1000)
         {
            lastBridgeRetry = now;
            findZFEBridge();
         }
         if((!coreSubscribed || !inventorySubscribed || uiDataManager == null) && now - lastSubscribeRetry >= 2000)
         {
            lastSubscribeRetry = now;
            trySubscribe();
         }
         pollCore("poll");
         if(stage2Active || inTraceWindow())
         {
            pollInventory("poll");
            probeOptionalProviders("poll");
         }
      }

      private function trySubscribe() : void
      {
         try
         {
            uiDataManager = getDefinitionByName("Shared.AS3.Data.BSUIDataManager");
         }
         catch(error:Error)
         {
            log("warn","provider","BSUIDataManager not available yet: " + clean(error.message));
            return;
         }

         if(uiDataManager == null) return;

         if(!coreSubscribed)
         {
            var q:Boolean = subscribeOne(QUEST_PROVIDER,onQuestTrackerData);
            var m:Boolean = subscribeOne("MenuStackData",onMenuStackData);
            var h:Boolean = subscribeOne("HUDModeData",onHUDModeData);
            coreSubscribed = q || m || h;
            log("info","provider","core subscriptions quest=" + q + " menu=" + m + " hud=" + h);
         }

         if(!inventorySubscribed)
         {
            inventorySubscribed = subscribeOne("PlayerInventoryData",onPlayerInventoryData);
            log("info","provider","PlayerInventoryData subscription=" + inventorySubscribed);
         }
      }

      private function subscribeOne(name:String,handler:Function) : Boolean
      {
         try
         {
            uiDataManager["Subscribe"](name,handler);
            return true;
         }
         catch(error:Error)
         {
            log("warn","provider","subscribe failed name=" + name + " error=" + clean(error.message));
         }
         return false;
      }

      private function onQuestTrackerData(event:*) : void
      {
         var data:Object = eventData(event);
         if(data == null) data = getProviderData(QUEST_PROVIDER);
         processQuestData(data,"event");
      }

      private function onMenuStackData(event:*) : void
      {
         var data:Object = eventData(event);
         if(data == null) data = getProviderData("MenuStackData");
         processMenuData(data,"event");
      }

      private function onHUDModeData(event:*) : void
      {
         var data:Object = eventData(event);
         if(data == null) data = getProviderData("HUDModeData");
         processHudData(data,"event");
      }

      private function onPlayerInventoryData(event:*) : void
      {
         if(!stage2Active && !inTraceWindow()) return;
         var data:Object = eventData(event);
         if(data == null) data = getProviderData("PlayerInventoryData");
         processInventoryData(data,"event");
      }

      private function eventData(event:*) : Object
      {
         try
         {
            if(event != null && event["data"] != null) return event["data"];
         }
         catch(ignore:Error) {}
         return null;
      }

      private function pollCore(source:String) : void
      {
         if(uiDataManager == null) return;
         processQuestData(getProviderData(QUEST_PROVIDER),source);
         processMenuData(getProviderData("MenuStackData"),source);
         processHudData(getProviderData("HUDModeData"),source);
      }

      private function pollInventory(source:String) : void
      {
         if(uiDataManager == null) return;
         processInventoryData(getProviderData("PlayerInventoryData"),source);
      }

      private function getProviderData(name:String) : Object
      {
         try
         {
            if(uiDataManager == null) return null;
            var wrapper:Object = uiDataManager["GetDataFromClient"](name,false,false);
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
         var fp:String = questFingerprint(quests);
         if(fp == lastQuestFingerprint) return;
         lastQuestFingerprint = fp;

         var foundRaid:Boolean = false;
         var foundStage2:Boolean = false;
         var count:int = safeLength(quests);
         var i:int;
         for(i = 0; i < count && i < 30; i++)
         {
            var q:Object = safeIndex(quests,i);
            if(q == null || !isRaidQuest(q)) continue;
            foundRaid = true;
            var objectives:Object = safeValue(q,"objectives");
            var n:int = safeLength(objectives);
            log("info","raid","GLEAMING_DEPTHS source=" + source + " questId=" + clean(safeString(q,"questId")) + " objectives=" + n + " title=" + clean(safeString(q,"title")));
            var j:int;
            for(j = 0; j < n && j < 30; j++)
            {
               var obj:Object = safeIndex(objectives,j);
               if(obj == null) continue;
               var title:String = safeString(obj,"title");
               var upper:String = title.toUpperCase();
               log("info","raid-objective","obj[" + j + "] id=" + clean(safeString(obj,"objectiveId")) + " state=" + clean(safeString(obj,"state")) + " progress=" + clean(safeString(obj,"progress")) + " title=" + clean(title));
               if(upper.indexOf("DRILL") >= 0 || upper.indexOf("FUEL") >= 0 || upper.indexOf("TUNNEL") >= 0 || upper.indexOf("BORING") >= 0)
               {
                  foundStage2 = true;
               }
            }
         }

         if(foundStage2 && !stage2Active)
         {
            stage2Active = true;
            log("info","stage2","Stage 2 detected; PlayerInventoryData and activation tracing armed");
            startTrace("stage2-detected");
         }
         else if(!foundStage2 && stage2Active)
         {
            stage2Active = false;
            log("info","stage2","Stage 2 objective no longer detected");
         }
         log("info","quest-summary","source=" + source + " gleamingDepths=" + foundRaid + " stage2=" + foundStage2);
      }

      private function processMenuData(data:Object,source:String) : void
      {
         if(data == null) return;
         var a:String = stackNames(safeValue(data,"menuStackA"));
         var b:String = stackNames(safeValue(data,"menuStackB"));
         var fp:String = a + "||" + b;
         if(fp == lastMenuFingerprint) return;
         lastMenuFingerprint = fp;
         log("info","menu","source=" + source + " stackA=" + a + " stackB=" + b);
         if(stage2Active) startTrace("stage2-menu-change");
      }

      private function processHudData(data:Object,source:String) : void
      {
         if(data == null) return;
         var mode:String = safeString(data,"hudMode");
         if(mode == lastHudMode) return;
         var old:String = lastHudMode;
         lastHudMode = mode;
         log("info","hud-mode","source=" + source + " old=" + clean(old) + " new=" + clean(mode));
         if(stage2Active && mode == "ActivateTypeMode") startTrace("stage2-activate");
      }

      private function processInventoryData(data:Object,source:String) : void
      {
         if(data == null) return;
         var dump:String = compactObject(data,100,4);
         if(dump == "" || dump == "{}") return;
         var fp:String = dump;
         if(fp == lastInventoryFingerprint && source != "trace") return;
         lastInventoryFingerprint = fp;
         var upper:String = dump.toUpperCase();
         var interesting:Boolean = containsInteresting(upper);
         if(inTraceWindow() || interesting)
         {
            log("info","inventory","seq=" + traceSeq + " t=" + traceElapsed() + "ms source=" + source + " interesting=" + interesting + " data=" + dump);
         }
         if(interesting)
         {
            logCandidatePaths("PlayerInventoryData",data);
            if(!inTraceWindow()) startTrace("inventory-interesting");
         }
      }

      private function probeOptionalProviders(source:String) : void
      {
         if(uiDataManager == null) return;
         var names:Array = ["CrosshairAndActivateData","ActivateData","HUDActivateData","QuickContainerData","PickUpHistoryData","CharacterInfoData"];
         var i:int;
         for(i = 0; i < names.length; i++)
         {
            var name:String = String(names[i]);
            var data:Object = getProviderData(name);
            if(data == null) continue;
            var dump:String = compactObject(data,80,3);
            if(dump == "" || dump == "{}") continue;
            if(optionalFingerprints[name] == dump && !inTraceWindow()) continue;
            optionalFingerprints[name] = dump;
            var interesting:Boolean = containsInteresting(dump.toUpperCase());
            if(inTraceWindow() || interesting)
            {
               log("info","provider-data","seq=" + traceSeq + " t=" + traceElapsed() + "ms source=" + source + " provider=" + name + " interesting=" + interesting + " data=" + dump);
            }
            if(interesting)
            {
               logCandidatePaths(name,data);
               if(!inTraceWindow()) startTrace("provider-interesting:" + name);
            }
         }
      }

      private function startTrace(reason:String) : void
      {
         var now:Number = new Date().time;
         if(inTraceWindow())
         {
            traceUntil = Math.max(traceUntil,now + TRACE_WINDOW_MS);
            log("debug","trace-window","EXTEND seq=" + traceSeq + " reason=" + reason + " remainingMs=" + int(traceUntil - now));
            return;
         }
         traceSeq++;
         traceStart = now;
         traceUntil = now + TRACE_WINDOW_MS;
         optionalFingerprints = {};
         lastInventoryFingerprint = "";
         log("info","trace-window","BEGIN seq=" + traceSeq + " reason=" + reason + " durationMs=" + TRACE_WINDOW_MS);
         pollInventory("trace");
         probeOptionalProviders("trace");
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

      private function containsInteresting(upper:String) : Boolean
      {
         if(upper == null) return false;
         return upper.indexOf("RAID FUEL") >= 0 || upper.indexOf("FUEL") >= 0 || upper.indexOf("DRILL") >= 0 || upper.indexOf(".45") >= 0 || upper.indexOf("1F66A") >= 0 || upper.indexOf(FORTY_FIVE_HEX) >= 0 || upper.indexOf(String(FORTY_FIVE_DECIMAL)) >= 0;
      }

      private function logCandidatePaths(provider:String,obj:Object) : void
      {
         var matches:Array = [];
         collectCandidatePaths(obj,"",0,matches,60);
         var i:int;
         for(i = 0; i < matches.length; i++)
         {
            log("info","item-candidate","provider=" + provider + " " + String(matches[i]));
         }
      }

      private function collectCandidatePaths(obj:Object,path:String,depth:int,out:Array,maxMatches:int) : void
      {
         if(obj == null || depth > 5 || out.length >= maxMatches) return;
         try
         {
            for(var key:String in obj)
            {
               if(out.length >= maxMatches) return;
               var value:* = obj[key];
               var next:String = path == "" ? key : path + "." + key;
               if(value == null) continue;
               if(value is String || value is Number || value is Boolean || value is int || value is uint)
               {
                  var text:String = String(value);
                  var combined:String = (key + "=" + text).toUpperCase();
                  if(containsInteresting(combined) || key.toUpperCase().indexOf("FORM") >= 0 || key.toUpperCase().indexOf("ITEM") >= 0 || key.toUpperCase().indexOf("ID") >= 0 || key.toUpperCase().indexOf("COUNT") >= 0 || key.toUpperCase().indexOf("QTY") >= 0)
                  {
                     out.push("path=" + clean(next) + " value=" + clean(text));
                  }
               }
               else
               {
                  collectCandidatePaths(value,next,depth + 1,out,maxMatches);
               }
            }
         }
         catch(ignore:Error) {}
      }

      private function questFingerprint(quests:Object) : String
      {
         var out:String = "";
         var count:int = safeLength(quests);
         var i:int;
         for(i = 0; i < count && i < 30; i++)
         {
            var q:Object = safeIndex(quests,i);
            if(q == null) continue;
            out += safeString(q,"questId") + ":" + safeString(q,"title") + "|";
            var objs:Object = safeValue(q,"objectives");
            var j:int;
            for(j = 0; j < safeLength(objs) && j < 30; j++)
            {
               var obj:Object = safeIndex(objs,j);
               if(obj != null) out += safeString(obj,"objectiveId") + ":" + safeString(obj,"state") + ":" + safeString(obj,"progress") + ":" + safeString(obj,"title") + ";";
            }
         }
         return out;
      }

      private function isRaidQuest(q:Object) : Boolean
      {
         var title:String = safeString(q,"title").toUpperCase();
         if(title.indexOf("GLEAMING DEPTHS") >= 0) return true;
         var raw:* = safeValue(q,"questId");
         try { if(Number(raw) == RAID_QUEST) return true; } catch(ignore:Error) {}
         var text:String = String(raw).toUpperCase();
         return text == "0078DA2A" || text == "78DA2A" || text == "0X0078DA2A" || text == "0X78DA2A";
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
         catch(error:Error)
         {
            out += "<error:" + clean(error.message) + ">";
         }
         return clean(out + "}");
      }

      private function formatValue(value:*,maxKeys:int,depth:int) : String
      {
         if(value == null) return "null";
         if(value is String || value is Number || value is Boolean || value is int || value is uint) return clean(String(value));
         if(depth < 0) return "<object>";
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
         if(text.length > 1800) text = text.substr(0,1800) + "...";
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
         for each(var entry:Object in copy)
         {
            logDirect(String(entry.level),String(entry.category),String(entry.message));
         }
      }
   }
}
