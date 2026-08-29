from pathlib import Path
import sys
p=Path(sys.argv[1] if len(sys.argv)>1 else 'chatgpt-build/SmartScrap.as')
s=p.read_text()

needle='    import flash.net.SharedObject;\n'
assert needle in s
s=s.replace(needle, needle+'    import flash.system.System;\n',1)
s=s.replace('private static const VERSION:String = "0.1.0";', 'private static const VERSION:String = "0.2.0";',1)

needle='        private static const CAT_WEAPONS:String = "WEAPONS";\n'
assert needle in s
glyphs=r'''        // Vector 5x7 font. SecureTrade child SWFs can render tofu when a font alias
        // is unresolved, so Smart Scrap draws its own glyphs and never depends on a runtime font.
        private static var GLYPHS:Object = {
            "A":["01110","10001","10001","11111","10001","10001","10001"],
            "B":["11110","10001","10001","11110","10001","10001","11110"],
            "C":["01111","10000","10000","10000","10000","10000","01111"],
            "D":["11110","10001","10001","10001","10001","10001","11110"],
            "E":["11111","10000","10000","11110","10000","10000","11111"],
            "F":["11111","10000","10000","11110","10000","10000","10000"],
            "G":["01111","10000","10000","10111","10001","10001","01111"],
            "H":["10001","10001","10001","11111","10001","10001","10001"],
            "I":["11111","00100","00100","00100","00100","00100","11111"],
            "J":["00111","00010","00010","00010","10010","10010","01100"],
            "K":["10001","10010","10100","11000","10100","10010","10001"],
            "L":["10000","10000","10000","10000","10000","10000","11111"],
            "M":["10001","11011","10101","10101","10001","10001","10001"],
            "N":["10001","11001","10101","10011","10001","10001","10001"],
            "O":["01110","10001","10001","10001","10001","10001","01110"],
            "P":["11110","10001","10001","11110","10000","10000","10000"],
            "Q":["01110","10001","10001","10001","10101","10010","01101"],
            "R":["11110","10001","10001","11110","10100","10010","10001"],
            "S":["01111","10000","10000","01110","00001","00001","11110"],
            "T":["11111","00100","00100","00100","00100","00100","00100"],
            "U":["10001","10001","10001","10001","10001","10001","01110"],
            "V":["10001","10001","10001","10001","10001","01010","00100"],
            "W":["10001","10001","10001","10101","10101","10101","01010"],
            "X":["10001","10001","01010","00100","01010","10001","10001"],
            "Y":["10001","10001","01010","00100","00100","00100","00100"],
            "Z":["11111","00001","00010","00100","01000","10000","11111"],
            "0":["01110","10001","10011","10101","11001","10001","01110"],
            "1":["00100","01100","00100","00100","00100","00100","01110"],
            "2":["01110","10001","00001","00010","00100","01000","11111"],
            "3":["11110","00001","00001","01110","00001","00001","11110"],
            "4":["00010","00110","01010","10010","11111","00010","00010"],
            "5":["11111","10000","10000","11110","00001","00001","11110"],
            "6":["01110","10000","10000","11110","10001","10001","01110"],
            "7":["11111","00001","00010","00100","01000","01000","01000"],
            "8":["01110","10001","10001","01110","10001","10001","01110"],
            "9":["01110","10001","10001","01111","00001","00001","01110"],
            ".":["00000","00000","00000","00000","00000","00110","00110"],
            ",":["00000","00000","00000","00000","00110","00110","00100"],
            ":":["00000","00110","00110","00000","00110","00110","00000"],
            ";":["00000","00110","00110","00000","00110","00110","00100"],
            "-":["00000","00000","00000","11111","00000","00000","00000"],
            "_":["00000","00000","00000","00000","00000","00000","11111"],
            "'":["00100","00100","00000","00000","00000","00000","00000"],
            "\"":["01010","01010","00000","00000","00000","00000","00000"],
            "!":["00100","00100","00100","00100","00100","00000","00100"],
            "?":["01110","10001","00001","00010","00100","00000","00100"],
            "/":["00001","00010","00010","00100","01000","01000","10000"],
            "\\":["10000","01000","01000","00100","00010","00010","00001"],
            "+":["00000","00100","00100","11111","00100","00100","00000"],
            "=":["00000","11111","00000","11111","00000","00000","00000"],
            "(":["00010","00100","01000","01000","01000","00100","00010"],
            ")":["01000","00100","00010","00010","00010","00100","01000"],
            "[":["01110","01000","01000","01000","01000","01000","01110"],
            "]":["01110","00010","00010","00010","00010","00010","01110"],
            "<":["00010","00100","01000","10000","01000","00100","00010"],
            ">":["01000","00100","00010","00001","00010","00100","01000"],
            "|":["00100","00100","00100","00100","00100","00100","00100"],
            "#":["01010","11111","01010","01010","11111","01010","00000"],
            "*":["00000","10101","01110","11111","01110","10101","00000"],
            "%":["11001","11010","00100","01000","10110","00110","00000"],
            "@":["01110","10001","10111","10101","10111","10000","01110"],
            "&":["01100","10010","10100","01000","10101","10010","01101"]
        };

'''
s=s.replace(needle,glyphs+needle,1)

needle='        private var localSO:SharedObject;\n'
assert needle in s
s=s.replace(needle,needle+'        private var settingsSource:String = "DEFAULTS";\n        private var settingsLoaded:Boolean = false;\n        private var lastScanError:String = "";\n',1)

old='''            searchField = new TextField();
            searchField.type = TextFieldType.INPUT;
            searchField.defaultTextFormat = new TextFormat(FONT_BODY,16,0xFFFFFF);
            searchField.embedFonts = true;
            searchField.background = true;
            searchField.backgroundColor = 0x20251D;
            searchField.border = true;
            searchField.borderColor = 0x60794A;
            searchField.x = 28; searchField.y = 216; searchField.width = 650; searchField.height = 32;
            searchField.text = searchText;
            searchField.addEventListener(Event.CHANGE,onSearchChanged);
            body.addChild(searchField);
'''
new='''            var searchBg:Shape = new Shape();
            searchBg.graphics.beginFill(0x20251D,1);
            searchBg.graphics.lineStyle(1,0x60794A,1);
            searchBg.graphics.drawRect(28,216,650,32);
            searchBg.graphics.endFill();
            body.addChild(searchBg);

            searchField = new TextField();
            searchField.type = TextFieldType.INPUT;
            searchField.defaultTextFormat = new TextFormat("_sans",16,0xFFFFFF);
            searchField.embedFonts = false;
            searchField.background = false;
            searchField.border = false;
            searchField.alpha = 0.01;
            searchField.x = 28; searchField.y = 216; searchField.width = 650; searchField.height = 32;
            searchField.text = searchText;
            searchField.addEventListener(Event.CHANGE,onSearchChanged);
            body.addChild(searchField);
            addText(body,searchText==""?"SEARCH - CLICK HERE TO TYPE":"SEARCH: "+searchText,38,222,625,22,14,false,0xDCE8D1);
'''
assert old in s
s=s.replace(old,new,1)

old='''            addButton(body,scanInProgress?"SCANNING...":"SCAN CURRENT INVENTORY",28,230,300,40,scanInProgress,function(e:MouseEvent):void {
                if(!scanInProgress) startScan();
            });
            addText(body,"KEEP: "+scanKeep+"    WOULD SCRAP: "+scanScrap+"    SCANNED: "+preview.length,350,238,800,30,18,true,0xE9C96C);
'''
new='''            addButton(body,scanInProgress?"SCANNING...":"SCAN CURRENT INVENTORY",28,230,300,40,scanInProgress,function(e:MouseEvent):void {
                if(!scanInProgress) startScan();
            });
            addButton(body,"COPY RESULTS",340,230,180,40,false,function(e:MouseEvent):void { copyDryRunResults(); });
            addButton(body,"COPY DEBUG",532,230,170,40,false,function(e:MouseEvent):void { copyDebugReport(); });
            addText(body,"KEEP: "+scanKeep+"  WOULD SCRAP: "+scanScrap+"  SCANNED: "+preview.length,725,238,790,30,18,true,0xE9C96C);
'''
assert old in s
s=s.replace(old,new,1)

s=s.replace('''            preview=[]; scanQueue=[]; scanIndex=0; scanKeep=0; scanScrap=0; previewScroll=0;
''','''            preview=[]; scanQueue=[]; scanIndex=0; scanKeep=0; scanScrap=0; previewScroll=0; lastScanError="";
''',1)
s=s.replace('''                statusText="Scan failed: "+e.message;
''','''                lastScanError=e.message;
                statusText="Scan failed: "+e.message;
''',1)

old='''        private function finishScannedItem(item:Object,fx:Array,unknownEffects:Boolean):void
        {
            var result:Object=evaluate(item,fx,unknownEffects);
            preview.push(result);
            if(result.keep) scanKeep++; else scanScrap++;
            render();
        }
'''
new='''        private function finishScannedItem(item:Object,fx:Array,unknownEffects:Boolean):void
        {
            var result:Object=evaluate(item,fx,unknownEffects);
            try { result.stars=int(item.numLegendaryStars); } catch(e:Error) { result.stars=0; }
            try { result.locked=Boolean(item.isTransferLocked); } catch(e2:Error) { result.locked=false; }
            try { result.equipped=int(item.equipState)==1; } catch(e3:Error) { result.equipped=false; }
            try { result.favorite=Boolean(item.favorite); } catch(e4:Error) { result.favorite=false; }
            var rawName:String="";
            try { rawName=String(item.text); } catch(e5:Error) {}
            var rawCat:String=((int(item.filterFlag)&4)!=0)?CAT_WEAPONS:detectPower(rawName)?CAT_POWER:CAT_ARMOR;
            result.category=rawCat;
            result.base=detectBase(rawName,rawCat);
            result.unknownEffects=unknownEffects;
            preview.push(result);
            if(result.keep) scanKeep++; else scanScrap++;
            if(scanIndex%5==0 || scanIndex>=scanQueue.length) render();
        }
'''
assert old in s
s=s.replace(old,new,1)

start=s.index('        private function addText(parentObj:Sprite,text:String,x:Number,y:Number,w:Number,h:Number,size:Number,bold:Boolean,color:uint):TextField')
end=s.index('        // ---------------- Persistence ----------------',start)
vector=r'''        private function addText(parentObj:Sprite,text:String,x:Number,y:Number,w:Number,h:Number,size:Number,bold:Boolean,color:uint):Sprite
        {
            var holder:Sprite=new Sprite();
            holder.x=x; holder.y=y; holder.mouseEnabled=false; holder.mouseChildren=false;
            parentObj.addChild(holder);
            drawVectorBlock(holder,text,w,h,size,bold,color);
            return holder;
        }

        private function normalizeVectorText(value:String):String
        {
            if(value==null) return "";
            var s:String=value;
            s=s.split("★").join("*");
            s=s.split("•").join("-");
            s=s.split("—").join("-");
            s=s.split("–").join("-");
            s=s.split("▼").join("V");
            s=s.split("’").join("'");
            s=s.split("‘").join("'");
            s=s.split("“").join("\"");
            s=s.split("”").join("\"");
            return s.toUpperCase();
        }

        private function wrapVectorText(value:String,maxChars:int):Array
        {
            var out:Array=[];
            if(maxChars<1) maxChars=1;
            var paragraphs:Array=normalizeVectorText(value).split("\n");
            for(var pi:int=0;pi<paragraphs.length;pi++)
            {
                var para:String=String(paragraphs[pi]);
                if(para.length==0) { out.push(""); continue; }
                var words:Array=para.split(" ");
                var line:String="";
                for each(var word:String in words)
                {
                    if(word.length>maxChars)
                    {
                        if(line!="") { out.push(line); line=""; }
                        while(word.length>maxChars) { out.push(word.substr(0,maxChars)); word=word.substr(maxChars); }
                        line=word;
                    }
                    else if(line=="") line=word;
                    else if(line.length+1+word.length<=maxChars) line+=" "+word;
                    else { out.push(line); line=word; }
                }
                if(line!="") out.push(line);
            }
            return out;
        }

        private function drawVectorBlock(holder:Sprite,value:String,w:Number,h:Number,size:Number,bold:Boolean,color:uint):void
        {
            var px:Number=Math.max(1.0,size/7.8);
            var charW:Number=px*6.0;
            var lineH:Number=px*8.2;
            var maxChars:int=Math.max(1,int(w/charW));
            var maxLines:int=Math.max(1,int(h/lineH));
            var lines:Array=wrapVectorText(value,maxChars);
            var lineCount:int=Math.min(maxLines,lines.length);
            holder.graphics.beginFill(color,1);
            for(var li:int=0;li<lineCount;li++)
            {
                var line:String=String(lines[li]);
                for(var ci:int=0;ci<line.length;ci++)
                {
                    var ch:String=line.charAt(ci);
                    if(ch==" ") continue;
                    var pattern:Array=GLYPHS[ch] as Array;
                    if(pattern==null) pattern=GLYPHS["?"] as Array;
                    for(var row:int=0;row<7;row++)
                    {
                        var bits:String=String(pattern[row]);
                        for(var col:int=0;col<5;col++)
                        {
                            if(bits.charAt(col)=="1")
                            {
                                var grow:Number=bold?0.16*px:0;
                                holder.graphics.drawRect(ci*charW+col*px,li*lineH+row*px,px+grow,px+grow);
                            }
                        }
                    }
                }
            }
            holder.graphics.endFill();
        }

        private function countTrueRules(o:Object):int
        {
            var c:int=0;
            for(var k:String in o) if(o[k]===true) c++;
            return c;
        }

        private function countCustomBuilds():int
        {
            var c:int=0;
            for(var k:String in builds) { try { c+=(builds[k] as Array).length; } catch(e:Error) {} }
            return c;
        }

        private function boolText(v:Boolean):String { return v?"YES":"NO"; }

        private function buildDryRunResultsReport():String
        {
            var lines:Array=[];
            lines.push("SMARTSCRAP_DRY_RUN_RESULTS_V"+VERSION);
            lines.push("MODE|DRY_RUN_ONLY");
            lines.push("TOTAL|scanned="+preview.length+"|keep="+scanKeep+"|would_scrap="+scanScrap);
            if(lastScanError!="") lines.push("SCAN_ERROR|"+lastScanError);
            for(var i:int=0;i<preview.length;i++)
            {
                var r:Object=preview[i];
                lines.push("ITEM|"+(i+1)+"|decision="+(r.keep?"KEEP":"WOULD_SCRAP")+"|name="+String(r.name)+"|effects="+String(r.effects)+"|reason="+String(r.reason));
            }
            return lines.join("\n");
        }

        private function buildDebugReport():String
        {
            var lines:Array=[];
            lines.push("SMARTSCRAP_DEBUG_V"+VERSION);
            lines.push("MODE|DRY_RUN_ONLY");
            lines.push("UI|menu_open="+boolText(isOpen)+"|active_tab="+activeTab+"|selected_item="+selectedItem+"|detail_mode="+detailMode+"|search="+searchText);
            lines.push("BRIDGES|secure_trade="+boolText(secureTrade!=null)+"|bsui="+boolText(bsuiClass!=null)+"|custom_event="+boolText(customEventClass!=null)+"|zfe="+boolText(zfe!=null));
            lines.push("SETTINGS|loaded="+boolText(settingsLoaded)+"|source="+settingsSource+"|never="+countTrueRules(never)+"|general="+countTrueRules(general)+"|global="+countTrueRules(globalFx)+"|custom_builds="+countCustomBuilds());
            lines.push("SCAN|in_progress="+boolText(scanInProgress)+"|queue="+scanQueue.length+"|index="+scanIndex+"|results="+preview.length+"|keep="+scanKeep+"|would_scrap="+scanScrap+"|last_error="+lastScanError);
            lines.push("STATUS|"+statusText);
            for(var i:int=0;i<preview.length;i++)
            {
                var r:Object=preview[i];
                lines.push("ITEM|"+(i+1)+"|decision="+(r.keep?"KEEP":"WOULD_SCRAP")+"|category="+String(r.category)+"|base="+String(r.base)+"|stars="+String(r.stars)+"|locked="+boolText(Boolean(r.locked))+"|equipped="+boolText(Boolean(r.equipped))+"|favorite="+boolText(Boolean(r.favorite))+"|unknown_effects="+boolText(Boolean(r.unknownEffects))+"|name="+String(r.name)+"|effects="+String(r.effects)+"|reason="+String(r.reason));
            }
            return lines.join("\n");
        }

        private function copyTextWithBackup(text:String,path:String,label:String):void
        {
            var clipboardAttempted:Boolean=false;
            try { System.setClipboard(text); clipboardAttempted=true; } catch(e:Error) {}
            if(zfe==null) locateZfe();
            var backedUp:Boolean=false;
            if(zfe!=null)
            {
                var raw:String=callZfe("writeStorage",'{"vendor":"'+STORAGE_VENDOR+'","path":"'+path+'","text":"'+jsonEscape(text)+'"}');
                backedUp=raw!="";
            }
            statusText=label+(clipboardAttempted?" SENT TO CLIPBOARD":" CLIPBOARD UNAVAILABLE")+(backedUp?" + ZFE BACKUP SAVED":"");
            render();
        }

        private function copyDebugReport():void { copyTextWithBackup(buildDebugReport(),"debug.txt","DEBUG"); }
        private function copyDryRunResults():void { copyTextWithBackup(buildDryRunResultsReport(),"dryrun.txt","DRY-RUN RESULTS"); }

'''
s=s[:start]+vector+s[end:]

old='''        private function loadSettings():void
        {
            try { localSO=SharedObject.getLocal("SmartScrapState"); } catch(e:Error) { localSO=null; }
            var text:String="";
            if(zfe!=null)
            {
                var raw:String=callZfe("readStorage",'{"vendor":"'+STORAGE_VENDOR+'","path":"'+STORAGE_PATH+'"}');
                text=extractJsonString(raw,"text");
            }
            if(text=="" && localSO!=null)
            {
                try { text=String(localSO.data.state); } catch(e2:Error) {}
            }
            if(text!="") parseSettings(text);
        }
'''
new='''        private function loadSettings():void
        {
            settingsLoaded=false;
            settingsSource="DEFAULTS";
            try { localSO=SharedObject.getLocal("SmartScrapState"); } catch(e:Error) { localSO=null; }
            var text:String="";
            if(zfe!=null)
            {
                var raw:String=callZfe("readStorage",'{"vendor":"'+STORAGE_VENDOR+'","path":"'+STORAGE_PATH+'"}');
                text=extractJsonString(raw,"text");
                if(text!="") settingsSource="ZFE";
            }
            if(text=="" && localSO!=null)
            {
                try
                {
                    text=String(localSO.data.state);
                    if(text!="" && text!="undefined") settingsSource="SHARED_OBJECT";
                    else text="";
                }
                catch(e2:Error) {}
            }
            if(text!="") { parseSettings(text); settingsLoaded=true; }
        }
'''
assert old in s
s=s.replace(old,new,1)
s=s.replace('F8 opens Smart Scrap. v0.1 is DRY RUN ONLY.','F8 opens Smart Scrap. v0.2 is DRY RUN ONLY.',1)

assert 'System.setClipboard' in s
assert 'COPY DEBUG' in s and 'COPY RESULTS' in s
assert 'GLYPHS' in s
assert 'dispatchEvent(new CustomEvent("Workbench::ScrapItem"' not in s
p.write_text(s)
print('SmartScrap v0.2 vector/debug patch applied')
