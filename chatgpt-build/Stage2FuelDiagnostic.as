package
{
   import flash.display.MovieClip;
   import flash.events.Event;
   import flash.events.TimerEvent;
   import flash.utils.Timer;
   import flash.utils.getDefinitionByName;

   public class Stage2FuelDiagnostic extends MovieClip
   {
      private static const VERSION:String = "0.4.3";
      private static const MOD_NAME:String = "Stage2FuelDiagnostic";
      private static const MAX_ITEMS:int = 3000;
      private static const MAX_MATCHES:int = 12;
      private static const MAX_RAW_FIELDS:int = 64;
      private static const MAX_CHANGES:int = 24;

      public var isReloadable:Boolean = true;

      private var uiDataManager:Object = null;
      private var sharedTools:Object = null;
      private var retryTimer:Timer = null;
      private var subscribed:Boolean = false;
      private var hudToolsRegistered:Boolean = false;

      private var inventoryProviderSeen:Boolean = false;
      private var inventoryListSeen:Boolean = false;
      private var inventoryEventCount:int = 0;
      private var lastInventoryLength:int = 0;
      private var stage2Active:Boolean = false;
      private var questProviderSeen:Boolean = false;

      private var matches:Array = [];
      private var changes:Array = [];
      private var lastCounts:Object = {};
      private var lastNames:Object = {};
      private var lastScanSource:String = "none";
      private var lastScanError:String = "";
      private var scanCount:int = 0;

      public function Stage2FuelDiagnostic()
      {
         super();
         mouseEnabled = false;
         mouseChildren = false;
         visible = false;
         if(stage != null) initialize();
         else addEventListener(Event.ADDED_TO_STAGE,onAddedToStage);
      }

      private function onAddedToStage(event:Event) : void
      {
         removeEventListener(Event.ADDED_TO_STAGE,onAddedToStage);
         initialize();
      }

      private function initialize() : void
      {
         tryConnect();
         retryTimer = new Timer(2000);
         retryTimer.addEventListener(TimerEvent.TIMER,onRetry);
         retryTimer.start();
      }

      private function onRetry(event:TimerEvent) : void
      {
         tryConnect();
         if(uiDataManager != null)
         {
            scanCurrentInventory("timer");
            scanCurrentQuest();
         }
      }

      private function tryConnect() : void
      {
         if(uiDataManager == null)
         {
            try
            {
               uiDataManager = getDefinitionByName("Shared.AS3.Data.BSUIDataManager");
            }
            catch(ignore:Error)
            {
               uiDataManager = null;
            }
         }

         if(uiDataManager != null && !subscribed)
         {
            try
            {
               uiDataManager["Subscribe"]("PlayerInventoryData",onInventoryData);
               uiDataManager["Subscribe"]("QuestTrackerProvider",onQuestData);
               subscribed = true;
            }
            catch(error:Error)
            {
               lastScanError = "subscribe " + clean(error.message);
            }
         }

         if(sharedTools == null)
         {
            try
            {
               var toolsClass:Class = getDefinitionByName("SharedHUDTools") as Class;
               if(toolsClass != null) sharedTools = new toolsClass(MOD_NAME);
            }
            catch(ignoreTools:Error)
            {
               sharedTools = null;
            }
         }

         if(sharedTools != null && !hudToolsRegistered)
         {
            try
            {
               sharedTools["Register"](onReceiveMessage);
               sharedTools["RegisterMenu"](onBuildMenu,onSelectMenu);
               hudToolsRegistered = true;
            }
            catch(errorTools:Error)
            {
               lastScanError = "hudtools " + clean(errorTools.message);
            }
         }
      }

      private function onReceiveMessage(sender:String,msg:String) : void
      {
      }

      private function onInventoryData(event:*) : void
      {
         inventoryProviderSeen = true;
         inventoryEventCount++;
         var data:Object = eventData(event);
         if(data != null) scanInventoryData(data,"event");
      }

      private function onQuestData(event:*) : void
      {
         questProviderSeen = true;
         var data:Object = eventData(event);
         if(data != null) scanQuestData(data);
      }

      private function eventData(event:*) : Object
      {
         try
         {
            if(event != null && event["data"] != null) return event["data"];
         }
         catch(ignore:Error)
         {
         }
         return null;
      }

      private function getProviderData(name:String) : Object
      {
         try
         {
            if(uiDataManager == null) return null;
            var wrapper:Object = uiDataManager["GetDataFromClient"](name,false,false);
            if(wrapper != null && wrapper["data"] != null) return wrapper["data"];
         }
         catch(ignore:Error)
         {
         }
         return null;
      }

      private function scanCurrentInventory(source:String) : void
      {
         var data:Object = getProviderData("PlayerInventoryData");
         if(data != null)
         {
            inventoryProviderSeen = true;
            scanInventoryData(data,source);
         }
      }

      private function scanCurrentQuest() : void
      {
         var data:Object = getProviderData("QuestTrackerProvider");
         if(data != null)
         {
            questProviderSeen = true;
            scanQuestData(data);
         }
      }

      private function scanInventoryData(data:Object,source:String) : void
      {
         scanCount++;
         lastScanSource = source;
         lastScanError = "";

         var inv:Object = null;
         try { inv = data["InventoryList"]; } catch(ignoreList:Error) { inv = null; }
         if(inv == null)
         {
            inventoryListSeen = false;
            lastInventoryLength = 0;
            lastScanError = "PlayerInventoryData.InventoryList missing";
            return;
         }

         inventoryListSeen = true;
         var length:int = safeLength(inv);
         lastInventoryLength = length;
         var newMatches:Array = [];
         var currentCounts:Object = {};
         var currentNames:Object = {};
         var limit:int = Math.min(length,MAX_ITEMS);

         var i:int;
         for(i = 0; i < limit; i++)
         {
            var item:Object = safeIndex(inv,i);
            if(item == null) continue;
            var name:String = itemName(item);
            if(!isFuelLikeName(name)) continue;
            if(newMatches.length >= MAX_MATCHES) break;

            var match:Object = makeMatch(item,i);
            newMatches.push(match);
            currentCounts[match.key] = match.count;
            currentNames[match.key] = match.name;

            var oldCount:Number = lastCounts[match.key] == null ? 0 : Number(lastCounts[match.key]);
            if(oldCount != match.count)
            {
               addChange(match.name,match.serverHandleID,oldCount,match.count,source);
            }
         }

         for(var oldKey:String in lastCounts)
         {
            var previous:Number = Number(lastCounts[oldKey]);
            if(previous > 0 && currentCounts[oldKey] == null)
            {
               addChange(lastNames[oldKey] == null ? oldKey : String(lastNames[oldKey]),0,previous,0,source);
            }
         }

         matches = newMatches;
         lastCounts = currentCounts;
         lastNames = currentNames;
      }

      private function itemName(item:Object) : String
      {
         var s:String = safeString(item,"text");
         if(s.length == 0) s = safeString(item,"name");
         if(s.length == 0) s = safeString(item,"Name");
         if(s.length == 0) s = safeString(item,"sName");
         return s;
      }

      private function itemCount(item:Object) : Number
      {
         var n:Number = safeNumberMaybe(item,"count");
         if(isNaN(n)) n = safeNumberMaybe(item,"Count");
         if(isNaN(n)) n = safeNumberMaybe(item,"uCount");
         return isNaN(n) ? 0 : n;
      }

      private function makeMatch(item:Object,index:int) : Object
      {
         var name:String = itemName(item);
         var count:Number = itemCount(item);
         var serverHandleID:Number = safeNumber(item,"serverHandleID");
         var nodeID:Number = safeNumber(item,"nodeID");
         var raw:Array = collectScalarFields(item);
         var formField:String = findFormLikeField(raw);
         var key:String = serverHandleID > 0 ? "S:" + uint(serverHandleID).toString(16) : "N:" + name.toUpperCase();
         return {
            name:name,
            count:count,
            serverHandleID:serverHandleID,
            nodeID:nodeID,
            index:index,
            key:key,
            formField:formField,
            raw:raw
         };
      }

      private function collectScalarFields(item:Object) : Array
      {
         var out:Array = [];
         var n:int = 0;
         try
         {
            for(var key:String in item)
            {
               if(n >= MAX_RAW_FIELDS) break;
               var value:* = item[key];
               if(value == null)
               {
                  out.push({k:key,v:"null"});
                  n++;
               }
               else if(value is String || value is Number || value is Boolean || value is int || value is uint)
               {
                  out.push({k:key,v:clean(String(value))});
                  n++;
               }
            }
         }
         catch(ignore:Error)
         {
         }
         out.sortOn("k",Array.CASEINSENSITIVE);
         return out;
      }

      private function findFormLikeField(raw:Array) : String
      {
         if(raw == null) return "none";
         var i:int;
         for(i = 0; i < raw.length; i++)
         {
            var key:String = String(raw[i].k);
            var lower:String = key.toLowerCase();
            if(lower.indexOf("form") >= 0 && lower.indexOf("id") >= 0)
            {
               return key + "=" + String(raw[i].v);
            }
         }
         return "none";
      }

      private function isFuelLikeName(name:String) : Boolean
      {
         if(name == null || name.length == 0) return false;
         var upper:String = name.toUpperCase();
         return upper.indexOf("FUEL") >= 0 || upper.indexOf("CANISTER") >= 0 || upper.indexOf("RAID") >= 0 || upper.indexOf("DRILL") >= 0;
      }

      private function addChange(name:String,serverHandleID:Number,oldCount:Number,newCount:Number,source:String) : void
      {
         var line:String = name + " " + oldCount + " -> " + newCount;
         if(serverHandleID > 0) line += " Handle " + hex8(serverHandleID);
         line += " " + source;
         changes.unshift(line);
         while(changes.length > MAX_CHANGES) changes.pop();
      }

      private function scanQuestData(data:Object) : void
      {
         var found:Boolean = false;
         try
         {
            var quests:Object = data["quests"];
            var qLen:int = safeLength(quests);
            var qi:int;
            for(qi = 0; qi < qLen && qi < 40; qi++)
            {
               var q:Object = safeIndex(quests,qi);
               if(q == null) continue;
               var objectives:Object = q["objectives"];
               var oLen:int = safeLength(objectives);
               var oi:int;
               for(oi = 0; oi < oLen && oi < 40; oi++)
               {
                  var obj:Object = safeIndex(objectives,oi);
                  if(obj == null) continue;
                  var title:String = safeString(obj,"title").toUpperCase();
                  if(title.indexOf("DRILL") >= 0 || title.indexOf("FUEL") >= 0 || title.indexOf("TUNNEL") >= 0)
                  {
                     found = true;
                     break;
                  }
               }
               if(found) break;
            }
         }
         catch(ignore:Error)
         {
         }
         stage2Active = found;
      }

      public function onBuildMenu(parentItem:String = null) : *
      {
         if(sharedTools == null) return;
         try
         {
            if(parentItem == null || parentItem == MOD_NAME)
            {
               addStatus("VER","Version - " + VERSION);
               addStatus("INV","Inventory Provider - " + yesNo(inventoryProviderSeen));
               addStatus("LST","InventoryList Available - " + yesNo(inventoryListSeen));
               addStatus("LEN","Inventory Entries - " + lastInventoryLength);
               addStatus("EVT","Inventory Events - " + inventoryEventCount);
               addStatus("ST2","Stage 2 - " + yesNo(stage2Active));
               addStatus("MAT","Fuel Matches - " + matches.length);
               if(matches.length > 0)
               {
                  var first:Object = matches[0];
                  addStatus("TOP","Top - " + first.name + " x" + first.count);
                  addStatus("FORM","Form-like - " + first.formField);
               }
               else
               {
                  addStatus("TOP","Top - NONE");
               }
               sharedTools["AddMenuItem"]("DETAILS","Fuel Entry Fields",true,true);
               sharedTools["AddMenuItem"]("CHANGES","Recent Fuel Count Changes",true,true);
               sharedTools["AddMenuItem"]("REFRESH","Refresh Inventory Now",true,false);
               if(lastScanError.length > 0) addStatus("ERR","Last Error - " + lastScanError);
            }
            else if(parentItem == "DETAILS")
            {
               if(matches.length == 0)
               {
                  addStatus("NONE","No Fuel Canister entry found");
                  addStatus("TIP","Pick up one Fuel Canister then reopen this menu");
               }
               else
               {
                  var i:int;
                  for(i = 0; i < matches.length; i++)
                  {
                     var m:Object = matches[i];
                     sharedTools["AddMenuItem"]("M" + i,(i + 1) + ". " + clean(m.name) + " x" + m.count,true,true);
                  }
               }
            }
            else if(parentItem != null && parentItem.substr(0,1) == "M")
            {
               var idx:int = int(parentItem.substr(1));
               if(idx >= 0 && idx < matches.length) buildMatchDetails(matches[idx]);
            }
            else if(parentItem == "CHANGES")
            {
               if(changes.length == 0) addStatus("NOCH","No matching-item count changes yet");
               else
               {
                  var c:int;
                  for(c = 0; c < changes.length && c < 18; c++) addStatus("C" + c,String(changes[c]));
               }
            }
         }
         catch(error:Error)
         {
            lastScanError = "menu " + clean(error.message);
         }
      }

      private function buildMatchDetails(m:Object) : void
      {
         addStatus("N","Name - " + m.name);
         addStatus("C","Count - " + m.count);
         addStatus("S","serverHandleID - " + hex8(m.serverHandleID) + " / " + m.serverHandleID);
         addStatus("NODE","nodeID - " + hex8(m.nodeID) + " / " + m.nodeID);
         addStatus("I","InventoryList Index - " + m.index);
         addStatus("FORM","Form-like Field - " + m.formField);
         var raw:Array = m.raw as Array;
         if(raw != null)
         {
            var i:int;
            for(i = 0; i < raw.length && i < 48; i++)
            {
               addStatus("R" + i,String(raw[i].k) + " = " + String(raw[i].v));
            }
         }
      }

      private function addStatus(id:String,text:String) : void
      {
         sharedTools["AddMenuItem"](id,clean(text),false,false);
      }

      public function onSelectMenu(selectItem:String) : *
      {
         if(selectItem == "REFRESH")
         {
            scanCurrentInventory("manual");
            scanCurrentQuest();
         }
      }

      private function safeLength(obj:Object) : int
      {
         try
         {
            if(obj != null && obj["length"] != null) return int(obj["length"]);
         }
         catch(ignore:Error)
         {
         }
         return 0;
      }

      private function safeIndex(obj:Object,index:int) : Object
      {
         try
         {
            if(obj != null && index >= 0 && index < safeLength(obj)) return obj[index];
         }
         catch(ignore:Error)
         {
         }
         return null;
      }

      private function safeString(obj:Object,key:String) : String
      {
         try
         {
            if(obj != null && obj[key] != null) return String(obj[key]);
         }
         catch(ignore:Error)
         {
         }
         return "";
      }

      private function safeNumber(obj:Object,key:String) : Number
      {
         var n:Number = safeNumberMaybe(obj,key);
         return isNaN(n) ? 0 : n;
      }

      private function safeNumberMaybe(obj:Object,key:String) : Number
      {
         try
         {
            if(obj != null && obj[key] != null)
            {
               var n:Number = Number(obj[key]);
               if(!isNaN(n)) return n;
            }
         }
         catch(ignore:Error)
         {
         }
         return NaN;
      }

      private function hex8(value:Number) : String
      {
         if(isNaN(value) || value <= 0) return "NONE";
         var s:String = uint(value).toString(16).toUpperCase();
         while(s.length < 8) s = "0" + s;
         return s;
      }

      private function yesNo(value:Boolean) : String
      {
         return value ? "YES" : "NO";
      }

      private function clean(text:String) : String
      {
         if(text == null) return "";
         text = text.split("\r").join(" ");
         text = text.split("\n").join(" ");
         text = text.split("|").join("/");
         text = text.split(",").join(" ");
         text = text.split(";").join(" ");
         if(text.length > 190) text = text.substr(0,190);
         return text;
      }
   }
}
