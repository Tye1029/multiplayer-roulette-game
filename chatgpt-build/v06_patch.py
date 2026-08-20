from pathlib import Path
import re, sys

path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('chatgpt-build/TerrorCounter.as')
s = path.read_text(encoding='utf-8')

# Replace the narrow bridge lookup with the ZFE-documented HUDModLoader search:
# current object, ancestor chain, and first-level children of those ancestors.
# Every candidate must pass getRuntimeInfo before it is trusted.
pat = re.compile(r'''        private function findZfeBridge\(\):void\n        \{.*?\n        \}\n\n        private function bridgeOn\(container:Object,name:String\):Object''', re.S)

replacement = '''        private function findZfeBridge():void
        {
            zfeApi = null;

            var cursor:Object = this;
            var depth:int = 0;
            var api:Object = null;

            while (cursor != null && depth < 16)
            {
                api = verifiedBridgeOnContainer(cursor);
                if (api != null)
                {
                    zfeApi = api;
                    logZfe("info","bridge","verified bridge on ancestor depth=" + depth);
                    return;
                }

                api = verifiedBridgeOnFirstLevelChildren(cursor);
                if (api != null)
                {
                    zfeApi = api;
                    logZfe("info","bridge","verified bridge on child of ancestor depth=" + depth);
                    return;
                }

                try
                {
                    cursor = cursor.parent;
                }
                catch (e:Error)
                {
                    cursor = null;
                }

                depth++;
            }

            // Some loaded HUD movies report a local root that is not encountered
            // through the normal parent chain. Check it explicitly as a fallback.
            var r:Object = null;
            try
            {
                r = root;
            }
            catch (e2:Error)
            {
                r = null;
            }

            if (r != null)
            {
                api = verifiedBridgeOnContainer(r);
                if (api == null)
                {
                    api = verifiedBridgeOnFirstLevelChildren(r);
                }

                if (api != null)
                {
                    zfeApi = api;
                    logZfe("info","bridge","verified bridge from explicit root scan");
                    return;
                }
            }
        }

        private function verifiedBridgeOnContainer(container:Object):Object
        {
            var api:Object = null;

            api = bridgeOn(container,"__ZFE");
            if (verifyZfeBridge(api)) { return api; }

            api = bridgeOn(container,"ZFECodeObj");
            if (verifyZfeBridge(api)) { return api; }

            api = bridgeOn(container,"__SFCodeObj");
            if (verifyZfeBridge(api)) { return api; }

            return null;
        }

        private function verifiedBridgeOnFirstLevelChildren(container:Object):Object
        {
            if (container == null)
            {
                return null;
            }

            var childCount:int = 0;
            try
            {
                childCount = int(container.numChildren);
            }
            catch (e:Error)
            {
                childCount = 0;
            }

            for (var i:int = 0; i < childCount; i++)
            {
                var child:Object = null;
                try
                {
                    child = container.getChildAt(i);
                }
                catch (e2:Error)
                {
                    child = null;
                }

                var api:Object = verifiedBridgeOnContainer(child);
                if (api != null)
                {
                    return api;
                }
            }

            return null;
        }

        private function verifyZfeBridge(api:Object):Boolean
        {
            if (api == null)
            {
                return false;
            }

            try
            {
                if (api.call == null)
                {
                    return false;
                }

                var raw:String = String(api.call("getRuntimeInfo","{}"));
                return jsonSuccess(raw);
            }
            catch (e:Error)
            {
                return false;
            }

            return false;
        }

        private function bridgeOn(container:Object,name:String):Object'''

s, n = pat.subn(replacement, s, count=1)
assert n == 1, 'findZfeBridge/bridgeOn block not found'

# Make writeStorage observable in zfe.log so future tests tell us whether the
# persistence call itself succeeded.
old = '''            callZfe(
                "writeStorage",
                "{\\\"vendor\\\":\\\"" + STORAGE_VENDOR +
                "\\\",\\\"path\\\":\\\"" + STORAGE_PATH +
                "\\\",\\\"text\\\":\\\"" + state + "\\\"}"
            );'''
new = '''            var writeResult:String = callZfe(
                "writeStorage",
                "{\\\"vendor\\\":\\\"" + STORAGE_VENDOR +
                "\\\",\\\"path\\\":\\\"" + STORAGE_PATH +
                "\\\",\\\"text\\\":\\\"" + state + "\\\"}"
            );

            if (jsonSuccess(writeResult))
            {
                logZfe("info","storage","saved count=" + count);
            }
            else
            {
                logZfe("warn","storage","writeStorage failed");
            }'''
assert old in s, 'writeStorage call block not found'
s = s.replace(old, new, 1)

assert 'verifiedBridgeOnFirstLevelChildren' in s
assert 'api.call("getRuntimeInfo","{}")' in s
assert 'saved count=' in s
path.write_text(s, encoding='utf-8')
print('v0.6 patch applied: ancestor/child ZFE discovery + verified storage bridge')
