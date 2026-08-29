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
      private static const VERSION:String = "0.1";
      private static const VENDOR:String = "RaidCheckpointDiagnostic";
      private static const QUEST_PROVIDER:String = "QuestTrackerProvider";
      private static const TARGET_QUEST_DECIMAL:Number = 7920170;
      private static const MAX_QUESTS:int = 25;
      private static const MAX_OBJECTIVES:int = 20;

      private var zfe:Object = null;
      private var uiDataManager:Object = null;
      private var pollTimer:Timer;
      private var subscribed:Boolean = false;
      private var pendingLogs:Array = [];
      private var bridgeLogged:Boolean = false;
      private var hierarchyLogged:Boolean = false;
      private var lastQuestFingerprint:String = "";
      private var lastMenuFingerprint:String = "";
      private var lastHudFingerprint:String = "";
      private var lastCharacterFingerprint:String = "";
      private var lastNoQuestLogAt:Number = 0;
      private var lastClassWaitLogAt:Number = 0;

      public function RaidCheckpointDiagnostic()
      {
         super();
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
         log("info","startup","Raid Checkpoint Diagnostic v" + VERSION + " loaded; diagnostic-only, no movement actions are performed");
         logHierarchyOnce();
         trySubscribe();
         pollAll("startup");
         pollTimer = new Timer(1000);
         pollTimer.addEventListener(TimerEvent.TIMER,onPoll);
         pollTimer.start();
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
            log("info","provider","subscribed QuestTrackerProvider, MenuStackData and HUDModeData");
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
         var data:Object = null;
         try
         {
            data = event != null ? event["data"] : null;
         }
         catch(ignore:Error)
         {
         }
         if(data == null)
         {
            data = getProviderData(QUEST_PROVIDER);
         }
         processQuestData(data,"event");
      }

      private function onMenuStackData(event:*) : void
      {
         var data:Object = null;
         try
         {
            data = event != null ? event["data"] : null;
         }
         catch(ignore:Error)
         {
         }
         if(data == null)
         {
            data = getProviderData("MenuStackData");
         }
         processMenuStack(data,"event");
      }

      private function onHUDModeData(event:*) : void
      {
         var data:Object = null;
         try
         {
            data = event != null ? event["data"] : null;
         }
         catch(ignore:Error)
         {
         }
         if(data == null)
         {
            data = getProviderData("HUDModeData");
         }
         processHudMode(data,"event");
      }

      private function onCharacterInfoData(event:*) : void
      {
         var data:Object = null;
         try
         {
            data = event != null ? event["data"] : null;
         }
         catch(ignore:Error)
         {
         }
         if(data == null)
         {
            data = getProviderData("CharacterInfoData");
         }
         processCharacterInfo(data,"event");
      }

      private function pollAll(source:String) : void
      {
         if(uiDataManager == null)
         {
            return;
         }
         processQuestData(getProviderData(QUEST_PROVIDER),source);
         processMenuStack(getProviderData("MenuStackData"),source);
         processHudMode(getProviderData("HUDModeData"),source);
         processCharacterInfo(getProviderData("CharacterInfoData"),source);
      }

      private function getProviderData(provider:String) : Object
      {
         try
         {
            if(uiDataManager == null)
            {
               return null;
            }
            var wrapper:Object = uiDataManager["GetDataFromClient"](provider);
            if(wrapper != null)
            {
               return wrapper["data"];
            }
         }
         catch(ignore:Error)
         {
         }
         return null;
      }

      private function processQuestData(data:Object, source:String) : void
      {
         if(data == null)
         {
            return;
         }
         var quests:Object = safeValue(data,"quests");
         if(quests == null || !hasLength(quests))
         {
            var emptyNow:Number = new Date().time;
            if(emptyNow - lastNoQuestLogAt > 15000)
            {
               lastNoQuestLogAt = emptyNow;
               log("info","quest","QuestTrackerProvider available but has no quest array yet");
            }
            return;
         }

         var fingerprint:String = makeQuestFingerprint(quests);
         if(fingerprint == lastQuestFingerprint)
         {
            return;
         }
         lastQuestFingerprint = fingerprint;

         var total:int = safeLength(quests);
         var raidFound:Boolean = false;
         var raidGuess:int = 0;
         var i:int;
         var q:Object;
         for(i = 0; i < total && i < MAX_QUESTS; i++)
         {
            q = safeIndex(quests,i);
            if(q != null && isGleamingDepthsQuest(q))
            {
               raidFound = true;
               raidGuess = guessStage(q);
               logRaidQuest(q,source,raidGuess);
            }
         }

         log("info","quest-summary","change source=" + source + " tracked=" + total + " gleamingDepths=" + raidFound + " checkpointGuess=" + (raidGuess > 0 ? String(raidGuess) : "unknown"));

         if(!raidFound)
         {
            for(i = 0; i < total && i < MAX_QUESTS; i++)
            {
               q = safeIndex(quests,i);
               if(q != null)
               {
                  log("debug","quest-list","q[" + i + "] id=" + clean(safeString(q,"questId")) + " state=" + clean(safeString(q,"state")) + " title=" + clean(safeString(q,"title")));
               }
            }
         }
      }

      private function logRaidQuest(q:Object, source:String, stageGuess:int) : void
      {
         var qid:String = safeString(q,"questId");
         var title:String = safeString(q,"title");
         var state:String = safeString(q,"state");
         var objectives:Object = safeValue(q,"objectives");
         var objectiveCount:int = safeLength(objectives);
         log("info","raid","GLEAMING_DEPTHS source=" + source + " questId=" + clean(qid) + " state=" + clean(state) + " stageGuess=" + (stageGuess > 0 ? String(stageGuess) : "unknown") + " objectives=" + objectiveCount + " title=" + clean(title));
         log("debug","raid-raw","quest fields: " + compactObject(q,50));

         var i:int;
         for(i = 0; i < objectiveCount && i < MAX_OBJECTIVES; i++)
         {
            var obj:Object = safeIndex(objectives,i);
            if(obj == null)
            {
               continue;
            }
            log("info","raid-objective","obj[" + i + "] id=" + clean(safeString(obj,"objectiveId")) + " state=" + clean(safeString(obj,"state")) + " progress=" + clean(safeString(obj,"progress")) + " offMap=" + clean(safeString(obj,"isOffMap")) + " context=" + clean(safeString(obj,"contextQuestID")) + " title=" + clean(safeString(obj,"title")));
            log("debug","raid-objective-raw","obj[" + i + "] fields: " + compactObject(obj,45));
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
            if(q == null)
            {
               continue;
            }
            out += safeString(q,"questId") + ":" + safeString(q,"state") + ":" + safeString(q,"title") + "|";
            var objs:Object = safeValue(q,"objectives");
            var j:int;
            var objectiveCount:int = safeLength(objs);
            for(j = 0; j < objectiveCount && j < MAX_OBJECTIVES; j++)
            {
               var obj:Object = safeIndex(objs,j);
               if(obj != null)
               {
                  out += safeString(obj,"objectiveId") + ":" + safeString(obj,"state") + ":" + safeString(obj,"progress") + ":" + safeString(obj,"title") + ";";
               }
            }
         }
         return out;
      }

      private function isGleamingDepthsQuest(q:Object) : Boolean
      {
         var title:String = safeString(q,"title").toUpperCase();
         if(title.indexOf("GLEAMING DEPTHS") >= 0)
         {
            return true;
         }
         var idValue:* = safeValue(q,"questId");
         try
         {
            if(Number(idValue) == TARGET_QUEST_DECIMAL)
            {
               return true;
            }
         }
         catch(ignore:Error)
         {
         }
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
            if(obj == null)
            {
               continue;
            }
            var title:String = safeString(obj,"title").toUpperCase();
            var candidate:int = 0;
            if(title.indexOf("ULTRACITE TERROR") >= 0)
            {
               candidate = 5;
            }
            else if(title.indexOf("HORDE") >= 0 || title.indexOf("CRYSTAL") >= 0)
            {
               candidate = 4;
            }
            else if(title.indexOf("EPSILON") >= 0)
            {
               candidate = 3;
            }
            else if(title.indexOf("DRILL") >= 0)
            {
               candidate = 2;
            }
            else if(title.indexOf("EN06") >= 0 || title.indexOf("GUARDIAN") >= 0)
            {
               candidate = 1;
            }
            if(candidate > best)
            {
               best = candidate;
            }
         }
         return best;
      }

      private function processMenuStack(data:Object, source:String) : void
      {
         if(data == null)
         {
            return;
         }
         var a:String = stackNames(safeValue(data,"menuStackA"));
         var b:String = stackNames(safeValue(data,"menuStackB"));
         var fingerprint:String = a + "||" + b;
         if(fingerprint == lastMenuFingerprint)
         {
            return;
         }
         lastMenuFingerprint = fingerprint;
         log("info","menu","change source=" + source + " stackA=" + a + " stackB=" + b);
      }

      private function stackNames(stack:Object) : String
      {
         if(stack == null)
         {
            return "[]";
         }
         var count:int = safeLength(stack);
         var out:String = "[";
         var i:int;
         for(i = 0; i < count && i < 20; i++)
         {
            if(i > 0)
            {
               out += ",";
            }
            var entry:Object = safeIndex(stack,i);
            if(entry != null)
            {
               out += clean(safeString(entry,"menuName"));
            }
         }
         return out + "]";
      }

      private function processHudMode(data:Object, source:String) : void
      {
         if(data == null)
         {
            return;
         }
         var mode:String = safeString(data,"hudMode");
         var fingerprint:String = mode + "|" + compactPrimitiveSubset(data,20);
         if(fingerprint == lastHudFingerprint)
         {
            return;
         }
         lastHudFingerprint = fingerprint;
         log("info","hud-mode","change source=" + source + " hudMode=" + clean(mode) + " fields=" + compactObject(data,25));
      }

      private function processCharacterInfo(data:Object, source:String) : void
      {
         if(data == null)
         {
            return;
         }
         var fingerprint:String = compactPrimitiveSubset(data,35);
         if(fingerprint == "" || fingerprint == lastCharacterFingerprint)
         {
            return;
         }
         lastCharacterFingerprint = fingerprint;
         log("debug","character","change source=" + source + " fields=" + compactObject(data,35));
      }

      private function compactPrimitiveSubset(obj:Object, maxKeys:int) : String
      {
         if(obj == null)
         {
            return "";
         }
         var out:String = "";
         var count:int = 0;
         try
         {
            for(var key:String in obj)
            {
               if(count >= maxKeys)
               {
                  break;
               }
               var value:* = obj[key];
               if(value == null || value is String || value is Number || value is Boolean || value is int || value is uint)
               {
                  out += key + "=" + String(value) + ";";
                  count++;
               }
            }
         }
         catch(ignore:Error)
         {
         }
         return out;
      }

      private function compactObject(obj:Object, maxKeys:int) : String
      {
         if(obj == null)
         {
            return "null";
         }
         var out:String = "";
         var count:int = 0;
         try
         {
            for(var key:String in obj)
            {
               if(count >= maxKeys)
               {
                  out += "...";
                  break;
               }
               if(count > 0)
               {
                  out += ", ";
               }
               var value:* = obj[key];
               out += clean(key) + "=";
               if(value == null)
               {
                  out += "null";
               }
               else if(value is String || value is Number || value is Boolean || value is int || value is uint)
               {
                  out += clean(String(value));
               }
               else if(hasLength(value))
               {
                  out += "[len:" + safeLength(value) + "]";
               }
               else
               {
                  out += "{" + clean(getQualifiedClassName(value)) + "}";
               }
               count++;
            }
         }
         catch(error:Error)
         {
            out += " <enumeration-error:" + clean(error.message) + ">";
         }
         return out;
      }

      private function logHierarchyOnce() : void
      {
         if(hierarchyLogged)
         {
            return;
         }
         hierarchyLogged = true;
         try
         {
            var host:DisplayObject = this;
            var depth:int = 0;
            while(host != null && depth < 8)
            {
               log("debug","hierarchy","depth=" + depth + " name=" + clean(host.name) + " class=" + clean(getQualifiedClassName(host)) + " native=" + nativeAliases(host));
               host = host.parent;
               depth++;
            }
         }
         catch(error:Error)
         {
            log("warn","hierarchy","failed: " + clean(error.message));
         }
      }

      private function nativeAliases(host:Object) : String
      {
         var names:Array = ["__ZFE","ZFECodeObj","__SFCodeObj","BGSCodeObj","BRG_OBJ"];
         var found:Array = [];
         var i:int;
         for(i = 0; i < names.length; i++)
         {
            try
            {
               if(host != null && host[names[i]] != null)
               {
                  found.push(names[i]);
               }
            }
            catch(ignore:Error)
            {
            }
         }
         return found.length > 0 ? found.join(",") : "none";
      }

      private function findZFEBridge() : Boolean
      {
         var host:DisplayObject = this;
         var depth:int = 0;
         while(host != null && depth < 8)
         {
            if(tryBridgeHost(host,"ancestor:" + depth))
            {
               return true;
            }
            host = host.parent;
            depth++;
         }

         try
         {
            var r:DisplayObject = root;
            if(r != null && tryBridgeHost(r,"root"))
            {
               return true;
            }
            var container:DisplayObjectContainer = r as DisplayObjectContainer;
            if(container != null)
            {
               var i:int;
               for(i = 0; i < container.numChildren && i < 80; i++)
               {
                  if(tryBridgeHost(container.getChildAt(i),"root-child:" + i))
                  {
                     return true;
                  }
               }
            }
         }
         catch(ignoreRoot:Error)
         {
         }
         return false;
      }

      private function tryBridgeHost(host:Object, where:String) : Boolean
      {
         if(host == null)
         {
            return false;
         }
         var aliases:Array = ["__ZFE","ZFECodeObj","__SFCodeObj"];
         var i:int;
         for(i = 0; i < aliases.length; i++)
         {
            var candidate:Object = null;
            try
            {
               candidate = host[aliases[i]];
            }
            catch(ignoreRead:Error)
            {
               candidate = null;
            }
            if(candidate == null)
            {
               continue;
            }
            try
            {
               if(!(candidate["call"] is Function))
               {
                  continue;
               }
               var result:* = candidate["call"]("getRuntimeInfo","{}");
               if(result != null)
               {
                  zfe = candidate;
                  if(!bridgeLogged)
                  {
                     bridgeLogged = true;
                     emitLog("info","bridge","verified ZFE bridge alias=" + aliases[i] + " at " + where);
                     flushPendingLogs();
                  }
                  return true;
               }
            }
            catch(ignoreCall:Error)
            {
            }
         }
         return false;
      }

      private function log(level:String, category:String, message:String) : void
      {
         message = clean(message);
         if(message.length > 3400)
         {
            message = message.substr(0,3400) + "...[truncated]";
         }
         if(zfe != null)
         {
            emitLog(level,category,message);
         }
         else
         {
            if(pendingLogs.length >= 80)
            {
               pendingLogs.shift();
            }
            pendingLogs.push({level:level,category:category,message:message});
         }
      }

      private function flushPendingLogs() : void
      {
         if(zfe == null)
         {
            return;
         }
         while(pendingLogs.length > 0)
         {
            var entry:Object = pendingLogs.shift();
            emitLog(String(entry.level),String(entry.category),String(entry.message));
         }
      }

      private function emitLog(level:String, category:String, message:String) : void
      {
         if(zfe == null)
         {
            return;
         }
         try
         {
            var payload:String = "{\"vendor\":\"" + jsonEscape(VENDOR) + "\",\"level\":\"" + jsonEscape(level) + "\",\"category\":\"" + jsonEscape(category) + "\",\"message\":\"" + jsonEscape(message) + "\"}";
            zfe["call"]("log",payload);
         }
         catch(ignore:Error)
         {
         }
      }

      private function safeValue(obj:Object, key:String) : *
      {
         if(obj == null)
         {
            return null;
         }
         try
         {
            return obj[key];
         }
         catch(ignore:Error)
         {
         }
         return null;
      }

      private function safeString(obj:Object, key:String) : String
      {
         var value:* = safeValue(obj,key);
         return value == null ? "" : String(value);
      }

      private function safeIndex(obj:Object, index:int) : Object
      {
         if(obj == null)
         {
            return null;
         }
         try
         {
            return obj[index] as Object;
         }
         catch(ignore:Error)
         {
         }
         return null;
      }

      private function hasLength(obj:Object) : Boolean
      {
         if(obj == null)
         {
            return false;
         }
         try
         {
            return obj["length"] != null;
         }
         catch(ignore:Error)
         {
         }
         return false;
      }

      private function safeLength(obj:Object) : int
      {
         if(obj == null)
         {
            return 0;
         }
         try
         {
            return int(obj["length"]);
         }
         catch(ignore:Error)
         {
         }
         return 0;
      }

      private function clean(value:String) : String
      {
         if(value == null)
         {
            return "";
         }
         value = value.replace(/\r/g," ");
         value = value.replace(/\n/g," ");
         value = value.replace(/\t/g," ");
         return value;
      }

      private function jsonEscape(value:String) : String
      {
         if(value == null)
         {
            return "";
         }
         value = value.replace(/\\/g,"\\\\");
         value = value.replace(/\"/g,"\\\"");
         value = value.replace(/\r/g,"\\r");
         value = value.replace(/\n/g,"\\n");
         value = value.replace(/\t/g,"\\t");
         return value;
      }
   }
}
