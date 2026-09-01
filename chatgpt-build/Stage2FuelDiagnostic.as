package
{
   import flash.display.MovieClip;
   import flash.events.Event;
   import flash.events.TimerEvent;
   import flash.utils.Timer;
   import flash.utils.getDefinitionByName;

   public class Stage2FuelDiagnostic extends MovieClip
   {
      private static const VERSION:String = "0.4.2";
      private static const MOD_NAME:String = "Stage2FuelDiagnostic";
      private static const MAX_ITEMS:int = 2500;
      private static const MAX_MATCHES:int = 12;
      private static const MAX_RAW_FIELDS:int = 50;
      private static const MAX_CHANGES:int = 24;

      public var isReloadable:Boolean = true;

      private var uiDataManager:Object = null;
      private var sharedTools:Object = null;
      private var retryTimer:Timer = null;
      private var subscribed:Boolean = false;
      private var hudToolsRegistered:Boolean = false;

      private var inventoryProviderSeen:Boolean = false;
      private var itemsArraySeen:Boolean = false;
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
            scanCurrentQuest("timer");
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
               lastScanError = "subscribe: " + clean(error.message);
            }
         }

         if(sharedTools == null)
         {
            try
            {
               var toolsClass:Class = getDefinitionByName("SharedHUDTools") as Class;
               if(toolsClass != null)
               {
                  sharedTools = new toolsClass(MOD_NAME);
               }
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
               lastScanError = "hudtools: " + clean(errorTools.message);
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

      private function scanCurrentQuest(source:String) : void
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

         var items:Object = null;
         try { items = data["aItems"]; } catch(ignoreItems:Error) { items = null; }
         if(items == null)
         {
            itemsArraySeen = false;
            lastInventoryLength = 0;
            lastScanError = "PlayerInventoryData.aItems missing";
            return;
         }

         itemsArraySeen = true;
         var length:int = safeLength(items);
         lastInventoryLength = length;
         var newMatches:Array = [];
         var currentCounts:Object = {};
         var currentNames:Object = {};

         var limit:int = Math.min(length,MAX_ITEMS);
         var i:int;
         for(i = 0; i < limit && newMatches.length < MAX_MATCHES; i++)
         {
            var item:Object = safeIndex(items,i);
            if(item == null) continue;
            var name:String = safeString(item,"sName");
            if(!isFuelLikeName(name)) continue;

            var match:Object = makeMatch(item,i);
            newMatches.push(match);
            var key:String = match.key;
            currentCounts[key] = match.count;
            currentNames[key] = match.name;

            var oldCount:Number = lastCounts[key] == null ? 0 : Number(lastCounts[key]);
            if(oldCount != match.count)
            {
               addChange(match.name,match.formId,match.handleId,oldCount,match.count,source);
            }
         }

         for(var oldKey:String in lastCounts)
         {
            var previous:Number = Number(lastCounts[oldKey]);
            if(previous > 0 && currentCounts[oldKey] == null)
            {
               addChange(lastNames[oldKey] == null ? oldKey : String(lastNames[oldKey]),0,0,previous,0,source);
            }
         }

         lastCounts = currentCounts;
         lastNames = currentNames;
         matches = newMatches;
      }

      private function makeMatch(item:Object,index:int) : Object
      {
         var name:String = safeString(item,"sName");
         var count:Number = safeNumber(item,"uCount");
         var formId:Number = safeNumber(item,"uFormID");
         var handleId:Number = safeNumber(item,"uHandleID");
         var filterFlag:Number = safeNumber(item,"iFilterFlag");
         var value:Number = safeNumber(item,"uValue");
         var rarity:Number = safeNumber(item,"uRarity");
         var weight:Number = safeNumber(item,"fWeight");
         var raw:Array = collectScalarFields(item);
         var key:String;
         if(formId > 0) key = "F:" + uint(formId).toString(16);
         else if(handleId > 0) key = "H:" + uint(handleId).toString(16);
         else key = "N:" + name.toUpperCase();
         return {
            name:name,
            count:count,
            formId:formId,
            handleId:handleId,
            filterFlag:filterFlag,
            value:value,
            rarity:rarity,
            weight:weight,
            index:index,
            key:key,
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
                  out.push(key + "=null");
                  n++;
               }
               else if(value is String || value is Number || value is Boolean || value is int || value is uint)
               {
                  out.push(key + "=" + clean(String(value)));
                  n++;
               }
            }
         }
         catch(ignore:Error)
         {
         }
         out.sort();
         return out;
      }

      private function isFuelLikeName(name:String) : Boolean
      {
         if(name == null || name.length == 0) return false;
         var upper:String = name.toUpperCase();
         return upper.indexOf("FUEL") >= 0 || upper.indexOf("CANISTER") >= 0 || upper.indexOf("RAID") >= 0 || upper.indexOf("DRILL") >= 0;
      }

      private function addChange(name:String,formId:Number,handleId:Number,oldCount:Number,newCount:Number,source:String) : void
      {
         var line:String = name + " | " + oldCount + " -> " + newCount;
         if(formId > 0) line += " | Form " + hex8(formId);
         if(handleId > 0) line += " | Handle " + hex8(handleId);
         line += " | " + source;
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
               addStatus("ARR","aItems Available - " + yesNo(itemsArraySeen));
               addStatus("LEN","Inventory Entries - " + lastInventoryLength);
               addStatus("EVT","Inventory Events - " + inventoryEventCount);
               addStatus("ST2","Stage 2 - " + yesNo(stage2Active));
               addStatus("MAT","Fuel Matches - " + matches.length);
               if(matches.length > 0)
               {
                  var first:Object = matches[0];
                  addStatus("TOP","Top - " + first.name + " x" + first.count + " / " + hex8(first.formId));
               }
               else
               {
                  addStatus("TOP","Top - NONE");
               }
               sharedTools["AddMenuItem"]("DETAILS","Fuel Item Details",true,true);
               sharedTools["AddMenuItem"]("CHANGES","Recent Fuel Count Changes",true,true);
               sharedTools["AddMenuItem"]("REFRESH","Refresh Inventory Now",true,false);
               if(lastScanError.length > 0) addStatus("ERR","Last Error - " + lastScanError);
            }
            else if(parentItem == "DETAILS")
            {
               if(matches.length == 0)
               {
                  addStatus("NONE","No Fuel/Canister/Raid/Drill names found");
                  addStatus("TIP","If fuel is visible, open your inventory once");
               }
               else
               {
                  var i:int;
                  for(i = 0; i < matches.length; i++)
                  {
                     var m:Object = matches[i];
                     sharedTools["AddMenuItem"]("M" + i,(i + 1) + ". " + m.name + " x" + m.count,true,true);
                  }
               }
            }
            else if(parentItem.substr(0,1) == "M")
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
            lastScanError = "menu: " + clean(error.message);
         }
      }

      private function buildMatchDetails(m:Object) : void
      {
         addStatus("N","Name - " + m.name);
         addStatus("C","Count - " + m.count);
         addStatus("F","Form ID - " + hex8(m.formId) + " / " + m.formId);
         addStatus("H","Handle ID - " + hex8(m.handleId) + " / " + m.handleId);
         addStatus("I","aItems Index - " + m.index);
         addStatus("FF","Filter Flag - " + m.filterFlag);
         addStatus("V","Value - " + m.value);
         addStatus("R","Rarity - " + m.rarity);
         addStatus("W","Weight - " + m.weight);
         var raw:Array = m.raw as Array;
         if(raw != null)
         {
            var i:int;
            for(i = 0; i < raw.length && i < 32; i++) addStatus("R" + i,String(raw[i]));
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
            scanCurrentQuest("manual");
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
         return 0;
      }

      private function hex8(value:Number) : String
      {
         if(value <= 0 || isNaN(value)) return "00000000";
         var text:String = uint(value).toString(16).toUpperCase();
         while(text.length < 8) text = "0" + text;
         if(text.length > 8) text = text.substr(text.length - 8);
         return text;
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
         text = text.split(";").join(",");
         text = text.split("|").join("/");
         if(text.length > 180) text = text.substr(0,180) + "...";
         return text;
      }
   }
}
