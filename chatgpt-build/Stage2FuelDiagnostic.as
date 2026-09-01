package
{
   import flash.display.DisplayObject;
   import flash.display.MovieClip;
   import flash.events.Event;
   import flash.events.TimerEvent;
   import flash.utils.Timer;
   import flash.utils.getDefinitionByName;

   public class Stage2FuelDiagnostic extends MovieClip
   {
      private static const VERSION:String = "0.3";
      private static const VENDOR:String = "Stage2FuelDiagnostic";
      private static const QUEST_PROVIDER:String = "QuestTrackerProvider";
      private static const RAID_QUEST:Number = 7920170;
      private static const FORTY_FIVE_HEX:String = "0001F66A";
      private static const FORTY_FIVE_DECIMAL:Number = 128618;
      private static const TRACE_WINDOW_MS:Number = 15000;

      public var isReloadable:Boolean = true;

      private var zfe:Object = null;
      private var uiDataManager:Object = null;
      private var pollTimer:Timer = null;
      private var markerTimer:Timer = null;
      private var initialized:Boolean = false;
      private var bridgeLogged:Boolean = false;
      private var pendingLogs:Array = [];
      private var subscribed:Object = {};
      private var stage2Active:Boolean = false;
      private var traceUntil:Number = 0;
      private var traceStart:Number = 0;
      private var traceSeq:int = 0;
      private var lastQuestFingerprint:String = "";
      private var lastMenuFingerprint:String = "";
      private var lastHudMode:String = "";
      private var lastInventoryFingerprint:String = "";
      private var lastOptionalFingerprint:Object = {};
      private var worldLogged:Boolean = false;

      public function Stage2FuelDiagnostic()
      {
         super();
         mouseEnabled = false;
         mouseChildren = false;
         drawStartupMarker();
         if(stage != null)
         {
            initialize();
         }
         else
         {
            addEventListener(Event.ADDED_TO_STAGE,onAddedToStage);
         }
      }

      private function drawStartupMarker() : void
      {
         try
         {
            visible = true;
            graphics.clear();
            graphics.beginFill(0x2ECC71,0.92);
            graphics.drawRect(18,18,210,10);
            graphics.endFill();
         }
         catch(ignore:Error) {}
      }

      private function hideStartupMarker(event:TimerEvent = null) : void
      {
         try
         {
            graphics.clear();
            visible = false;
            if(markerTimer != null)
            {
               markerTimer.stop();
               markerTimer.removeEventListener(TimerEvent.TIMER_COMPLETE,hideStartupMarker);
            }
         }
         catch(ignore:Error) {}
      }

      private function onAddedToStage(event:Event) : void
      {
         removeEventListener(Event.ADDED_TO_STAGE,onAddedToStage);
         initialize();
      }

      private function initialize() : void
      {
         if(initialized) return;
         initialized = true;

         markerTimer = new Timer(8000,1);
         markerTimer.addEventListener(TimerEvent.TIMER_COMPLETE,hideStartupMarker);
         markerTimer.start();

         pollTimer = new Timer(1000);
         pollTimer.addEventListener(TimerEvent.TIMER,onPoll);
         pollTimer.start();

         try { findZFEBridge(); } catch(ignoreBridge:Error) {}
         log("info","startup","Stage 2 Fuel Diagnostic v" + VERSION + " loaded; loader-proof Private/Custom World diagnostic-only build; no inventory changes are performed; .45 FormID=" + FORTY_FIVE_HEX + " decimal=" + FORTY_FIVE_DECIMAL);
         try { trySubscribe(); } catch(ignoreSubscribe:Error) {}
         try { pollCore("startup"); } catch(ignorePoll:Error) {}
         try { probeWorldMode("startup"); } catch(ignoreWorld:Error) {}
      }

      private function onPoll(event:TimerEvent) : void
      {
         try
         {
            if(zfe == null) findZFEBridge();
         }
         catch(ignoreBridge:Error) {}

         try
         {
            if(uiDataManager == null || !isSubscribed(QUEST_PROVIDER) || !isSubscribed("PlayerInventoryData")) trySubscribe();
         }
         catch(ignoreSubscribe:Error) {}

         try { pollCore("poll"); } catch(ignoreCore:Error) {}
         try { if(!worldLogged) probeWorldMode("poll"); } catch(ignoreWorld:Error) {}

         if(stage2Active || inTraceWindow())
         {
            try { pollInventory("poll"); } catch(ignoreInventory:Error) {}
            try { probeOptionalProviders("poll"); } catch(ignoreOptional:Error) {}
         }
      }

      private function trySubscribe() : void
      {
         if(uiDataManager == null)
         {
            try
            {
               uiDataManager = getDefinitionByName("Shared.AS3.Data.BSUIDataManager");
            }
            catch(error:Error)
            {
               log("warn","provider","BSUIDataManager unavailable: " + clean(error.message));
               return;
            }
         }
         if(uiDataManager == null) return;

         subscribeOne(QUEST_PROVIDER,onQuestTrackerData);
         subscribeOne("MenuStackData",onMenuStackData);
         subscribeOne("HUDModeData",onHUDModeData);
         subscribeOne("PlayerInventoryData",onPlayerInventoryData);
      }

      private function isSubscribed(name:String) : Boolean
      {
         return subscribed[name] === true;
      }

      private function subscribeOne(name:String,handler:Function) : void
      {
         if(isSubscribed(name)) return;
         try
         {
            uiDataManager["Subscribe"](name,handler);
            subscribed[name] = true;
            log("info","provider","subscribed " + name);
         }
         catch(error:Error)
         {
            log("warn","provider","subscribe failed name=" + name + " error=" + clean(error.message));
         }
      }

      private function onQuestTrackerData(event:*) : void
      {
         try
         {
            var data:Object = eventData(event);
            if(data == null) data = getProviderData(QUEST_PROVIDER);
            processQuestData(data,"event");
         }
         catch(error:Error)
         {
            log("warn","quest-error",clean(error.message));
         }
      }

      private function onMenuStackData(event:*) : void
      {
         try
         {
            var data:Object = eventData(event);
            if(data == null) data = getProviderData("MenuStackData");
            processMenuData(data,"event");
         }
         catch(error:Error)
         {
            log("warn","menu-error",clean(error.message));
         }
      }

      private function onHUDModeData(event:*) : void
      {
         try
         {
            var data:Object = eventData(event);
            if(data == null) data = getProviderData("HUDModeData");
            processHudData(data,"event");
         }
         catch(error:Error)
         {
            log("warn","hud-error",clean(error.message));
         }
      }

      private function onPlayerInventoryData(event:*) : void
      {
         if(!stage2Active && !inTraceWindow()) return;
         try
         {
            var data:Object = eventData(event);
            if(data == null) data = getProviderData("PlayerInventoryData");
            processInventoryData(data,"event");
         }
         catch(error:Error)
         {
            log("warn","inventory-error",clean(error.message));
         }
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
            log("info","stage2","Stage 2 detected; fuel pickup/deposit tracing armed");
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
         var summary:String = shallowSummary(data,45);
         if(summary == lastInventoryFingerprint && source != "trace") return;
         lastInventoryFingerprint = summary;

         var matches:Array = [];
         collectInterestingRecords(data,"PlayerInventoryData",0,matches,80);
         if(inTraceWindow())
         {
            log("info","inventory-snapshot","seq=" + traceSeq + " t=" + traceElapsed() + "ms source=" + source + " summary=" + summary);
         }
         var i:int;
         for(i = 0; i < matches.length; i++)
         {
            log("info","item-candidate","seq=" + traceSeq + " t=" + traceElapsed() + "ms " + String(matches[i]));
         }
         if(matches.length > 0 && !inTraceWindow()) startTrace("inventory-candidate");
      }

      private function probeOptionalProviders(source:String) : void
      {
         if(uiDataManager == null) return;
         var names:Array = ["CrosshairAndActivateData","CrosshairData","ActivateData","HUDActivateData","QuickContainerData","PickUpHistoryData","CharacterInfoData"];
         var i:int;
         for(i = 0; i < names.length; i++)
         {
            var name:String = String(names[i]);
            var data:Object = getProviderData(name);
            if(data == null) continue;
            var summary:String = shallowSummary(data,40);
            if(lastOptionalFingerprint[name] == summary && !inTraceWindow()) continue;
            lastOptionalFingerprint[name] = summary;

            var matches:Array = [];
            collectInterestingRecords(data,name,0,matches,40);
            if(inTraceWindow())
            {
               log("info","provider-data","seq=" + traceSeq + " t=" + traceElapsed() + "ms source=" + source + " provider=" + name + " summary=" + summary);
            }
            var j:int;
            for(j = 0; j < matches.length; j++)
            {
               log("info","item-candidate","seq=" + traceSeq + " t=" + traceElapsed() + "ms " + String(matches[j]));
            }
         }
      }

      private function probeWorldMode(source:String) : void
      {
         if(uiDataManager == null || worldLogged) return;
         var names:Array = ["WorldInfoData","SessionInfoData","GameModeData","PlayerStateData"];
         var any:Boolean = false;
         var i:int;
         for(i = 0; i < names.length; i++)
         {
            var name:String = String(names[i]);
            var data:Object = getProviderData(name);
            if(data == null) continue;
            any = true;
            log("info","world-provider","source=" + source + " provider=" + name + " data=" + shallowSummary(data,50));
         }
         if(any) worldLogged = true;
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
         lastInventoryFingerprint = "";
         lastOptionalFingerprint = {};
         log("info","trace-window","BEGIN seq=" + traceSeq + " reason=" + reason + " durationMs=" + TRACE_WINDOW_MS);
         try { pollInventory("trace"); } catch(ignoreInventory:Error) {}
         try { probeOptionalProviders("trace"); } catch(ignoreProviders:Error) {}
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

      private function collectInterestingRecords(obj:Object,path:String,depth:int,out:Array,maxRecords:int) : void
      {
         if(obj == null || depth > 5 || out.length >= maxRecords) return;

         var primitive:String = "";
         var interesting:Boolean = false;
         var childKeys:Array = [];
         var key:String;
         try
         {
            var seen:int = 0;
            for(key in obj)
            {
               if(seen >= 80) break;
               seen++;
               var value:* = obj[key];
               if(value == null) continue;
               if(value is String || value is Number || value is Boolean || value is int || value is uint)
               {
                  var text:String = String(value);
                  if(primitive.length < 1300)
                  {
                     if(primitive.length > 0) primitive += ",";
                     primitive += clean(key) + "=" + clean(text);
                  }
                  if(isInterestingText((key + "=" + text).toUpperCase())) interesting = true;
               }
               else
               {
                  childKeys.push(key);
               }
            }
         }
         catch(ignoreEnumerate:Error) {}

         if(interesting && out.length < maxRecords)
         {
            out.push("providerPath=" + clean(path) + " fields={" + primitive + "}");
         }

         var i:int;
         for(i = 0; i < childKeys.length && i < 100 && out.length < maxRecords; i++)
         {
            key = String(childKeys[i]);
            try
            {
               collectInterestingRecords(obj[key],path + "." + key,depth + 1,out,maxRecords);
            }
            catch(ignoreChild:Error) {}
         }
      }

      private function isInterestingText(upper:String) : Boolean
      {
         if(upper == null) return false;
         return upper.indexOf("RAID FUEL") >= 0 || upper.indexOf("FUEL") >= 0 || upper.indexOf("DRILL") >= 0 || upper.indexOf(".45") >= 0 || upper.indexOf("1F66A") >= 0 || upper.indexOf(FORTY_FIVE_HEX) >= 0 || upper.indexOf(String(FORTY_FIVE_DECIMAL)) >= 0;
      }

      private function shallowSummary(obj:Object,maxKeys:int) : String
      {
         if(obj == null) return "null";
         var out:String = "{";
         var count:int = 0;
         try
         {
            for(var key:String in obj)
            {
               if(count >= maxKeys) { out += "..."; break; }
               if(count > 0) out += ",";
               var value:* = obj[key];
               if(value == null || value is String || value is Number || value is Boolean || value is int || value is uint)
               {
                  out += clean(key) + "=" + clean(String(value));
               }
               else
               {
                  var len:int = safeLength(value);
                  out += clean(key) + "=<object" + (len > 0 ? " len=" + len : "") + ">";
               }
               count++;
            }
         }
         catch(error:Error)
         {
            out += "<error:" + clean(error.message) + ">";
         }
         out += "}";
         return clean(out);
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
         while(current != null && depth < 10)
         {
            if(checkBridgeOwner(current,aliases,"ancestor:" + depth)) return;
            try { current = current.parent; } catch(ignoreParent:Error) { current = null; }
            depth++;
         }

         try
         {
            if(stage != null && stage.numChildren > 0)
            {
               var root:Object = stage.getChildAt(0);
               if(checkBridgeOwner(root,aliases,"stage-root")) return;
            }
         }
         catch(ignoreRoot:Error) {}
      }

      private function checkBridgeOwner(owner:Object,aliases:Array,where:String) : Boolean
      {
         if(owner == null) return false;
         var i:int;
         for(i = 0; i < aliases.length; i++)
         {
            try
            {
               var alias:String = String(aliases[i]);
               var candidate:Object = owner[alias];
               if(candidate != null && verifyBridge(candidate))
               {
                  zfe = candidate;
                  if(!bridgeLogged)
                  {
                     bridgeLogged = true;
                     logDirect("info","bridge","verified ZFE bridge alias=" + alias + " at " + where);
                  }
                  flushPendingLogs();
                  return true;
               }
            }
            catch(ignore:Error) {}
         }
         return false;
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
            if(pendingLogs.length < 600) pendingLogs.push({level:level,category:category,message:message});
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
