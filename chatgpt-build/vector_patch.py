from pathlib import Path
import re
import sys

path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('chatgpt-build/TerrorCounter.as')
s = path.read_text(encoding='utf-8')

marker = '        private var counterText:TextField;\n'
if 'private var counterGlyphs:Sprite;' not in s:
    assert marker in s, 'counterText declaration not found'
    s = s.replace(marker, marker + '        private var counterGlyphs:Sprite;\n', 1)

pattern = r'''        private function buildCounter\(\):void
        \{
.*?
        private function positionPanel\(\):void
'''

replacement = '''        private function buildCounter():void
        {
            panel = new Sprite();
            panel.mouseEnabled = false;
            panel.mouseChildren = false;
            addChild(panel);

            counterGlyphs = new Sprite();
            counterGlyphs.mouseEnabled = false;
            panel.addChild(counterGlyphs);

            redrawPanel();
        }

        private function updateCounter():void
        {
            redrawPanel();
        }

        private function redrawPanel():void
        {
            if (panel == null || counterGlyphs == null)
            {
                return;
            }

            var label:String = "TERROR KILLS: " + count;
            var textWidth:Number = drawVectorText(label, 8, 6, 2);

            panel.graphics.clear();
            panel.graphics.beginFill(0x000000, 0.38);
            panel.graphics.drawRoundRect(0, 0, textWidth + 16, 26, 8, 8);
            panel.graphics.endFill();

            positionPanel();
        }

        private function drawVectorText(text:String, startX:Number, startY:Number, pixel:Number):Number
        {
            counterGlyphs.graphics.clear();
            counterGlyphs.graphics.beginFill(0xFFFFFF, 1.0);

            var cursorX:Number = startX;
            var i:int;
            var row:int;
            var col:int;
            var ch:String;
            var glyph:Array;
            var rowBits:String;

            for (i = 0; i < text.length; i++)
            {
                ch = text.charAt(i).toUpperCase();

                if (ch == " ")
                {
                    cursorX += pixel * 4;
                    continue;
                }

                glyph = glyphFor(ch);

                for (row = 0; row < 7; row++)
                {
                    rowBits = String(glyph[row]);

                    for (col = 0; col < 5; col++)
                    {
                        if (rowBits.charAt(col) == "1")
                        {
                            counterGlyphs.graphics.drawRect(
                                cursorX + col * pixel,
                                startY + row * pixel,
                                pixel,
                                pixel
                            );
                        }
                    }
                }

                cursorX += pixel * 6;
            }

            counterGlyphs.graphics.endFill();
            return cursorX - startX;
        }

        private function glyphFor(ch:String):Array
        {
            switch (ch)
            {
                case "T": return ["11111","00100","00100","00100","00100","00100","00100"];
                case "E": return ["11111","10000","10000","11110","10000","10000","11111"];
                case "R": return ["11110","10001","10001","11110","10100","10010","10001"];
                case "O": return ["01110","10001","10001","10001","10001","10001","01110"];
                case "K": return ["10001","10010","10100","11000","10100","10010","10001"];
                case "I": return ["11111","00100","00100","00100","00100","00100","11111"];
                case "L": return ["10000","10000","10000","10000","10000","10000","11111"];
                case "S": return ["01111","10000","10000","01110","00001","00001","11110"];
                case ":": return ["00000","00100","00100","00000","00100","00100","00000"];
                case "0": return ["01110","10001","10011","10101","11001","10001","01110"];
                case "1": return ["00100","01100","00100","00100","00100","00100","01110"];
                case "2": return ["01110","10001","00001","00010","00100","01000","11111"];
                case "3": return ["11110","00001","00001","01110","00001","00001","11110"];
                case "4": return ["00010","00110","01010","10010","11111","00010","00010"];
                case "5": return ["11111","10000","10000","11110","00001","00001","11110"];
                case "6": return ["01110","10000","10000","11110","10001","10001","01110"];
                case "7": return ["11111","00001","00010","00100","01000","01000","01000"];
                case "8": return ["01110","10001","10001","01110","10001","10001","01110"];
                case "9": return ["01110","10001","10001","01111","00001","00001","01110"];
                default:  return ["00000","00000","00000","00000","00000","00000","00000"];
            }
        }

        private function positionPanel():void
'''

s, n = re.subn(pattern, lambda m: replacement, s, count=1, flags=re.S)
assert n == 1, 'HUD method block not found'
assert s.count('counterText') == 1, 'runtime counterText reference remains after vector patch'
assert 'TERROR KILLS: ' in s
assert 'drawVectorText' in s
path.write_text(s, encoding='utf-8')
print('vector HUD patch applied; no runtime font/TextField rendering remains')
