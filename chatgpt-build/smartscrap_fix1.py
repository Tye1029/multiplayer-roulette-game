from pathlib import Path
import sys

path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('chatgpt-build/SmartScrap.as')
s = path.read_text(encoding='utf-8')

replacements = [
    (
'''        private function callZfe(cmd:String,payload:String):String
        {
            if(zfe==null) return "";
            try { return String(zfe.call(cmd,payload)); } catch(e:Error) { zfe=null; return ""; }
        }''',
'''        private function callZfe(cmd:String,payload:String):String
        {
            if(zfe==null) return "";
            try { return String(zfe.call(cmd,payload)); } catch(e:Error) { zfe=null; return ""; }
            return "";
        }'''
    ),
    (
'''        private function enc(s:String):String
        {
            try { return encodeURIComponent(s); } catch(e:Error) { return s; }
        }''',
'''        private function enc(s:String):String
        {
            try { return encodeURIComponent(s); } catch(e:Error) { return s; }
            return s;
        }'''
    ),
    (
'''        private function dec(s:String):String
        {
            try { return decodeURIComponent(s); } catch(e:Error) { return s; }
        }''',
'''        private function dec(s:String):String
        {
            try { return decodeURIComponent(s); } catch(e:Error) { return s; }
            return s;
        }'''
    ),
]

for old, new in replacements:
    assert old in s, 'expected return-flow block not found'
    s = s.replace(old, new, 1)

path.write_text(s, encoding='utf-8')
print('SmartScrap Flex return-flow patch applied')
