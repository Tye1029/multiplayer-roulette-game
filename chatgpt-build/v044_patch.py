from pathlib import Path

p = Path('chatgpt-build/Stage2FuelDiagnostic.as')
s = p.read_text()
s = s.replace('VERSION:String = "0.4.3"', 'VERSION:String = "0.4.4"')
s = s.replace('MAX_MATCHES:int = 12', 'MAX_MATCHES:int = 20')
start = s.index('         var newMatches:Array = [];')
end = s.index('      private function itemName', start)
block = '''         var exactMatches:Array = [];
         var fallbackMatches:Array = [];
         var currentCounts:Object = {};
         var currentNames:Object = {};
         var limit:int = Math.min(length,MAX_ITEMS);

         var i:int;
         for(i = 0; i < limit; i++)
         {
            var item:Object = safeIndex(inv,i);
            if(item == null) continue;
            var name:String = itemName(item);
            if(name == null || name.length == 0) continue;
            var upperName:String = name.toUpperCase();
            var match:Object;

            if(upperName.indexOf("FUEL CANISTER") >= 0)
            {
               match = makeMatch(item,i);
               exactMatches.push(match);
            }
            else if(isFuelLikeName(name) && fallbackMatches.length < MAX_MATCHES)
            {
               match = makeMatch(item,i);
               fallbackMatches.push(match);
            }
         }

         var newMatches:Array = exactMatches.length > 0 ? exactMatches : fallbackMatches;
         if(exactMatches.length > 0)
         {
            for(i = 0; i < fallbackMatches.length && newMatches.length < MAX_MATCHES; i++)
            {
               newMatches.push(fallbackMatches[i]);
            }
         }

         for(i = 0; i < newMatches.length; i++)
         {
            match = newMatches[i];
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

'''
s = s[:start] + block + s[end:]
p.write_text(s)
