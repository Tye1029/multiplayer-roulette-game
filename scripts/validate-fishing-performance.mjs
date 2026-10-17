import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8').replace(/\r\n/g,'\n');
function fn(name){
  const a=html.indexOf(`    function ${name}(`),b=html.indexOf('\n    }',a);
  assert(a>=0&&b>a);return html.slice(a,b+6);
}
let buffers=0,scheduled=[];
const ctx={sampleRate:1000,currentTime:5,createBuffer:(_,length)=>{buffers++;return{getChannelData:()=>new Float32Array(length)}}};
const listeners={},root={dataset:{},isConnected:true,addEventListener:(name,callback)=>listeners[name]=callback};
const test=vm.createContext({Map,Set,Math,document:{hidden:false},getAudioContext:()=>ctx,sfxGain:{},
  scheduleTone:(...args)=>scheduled.push(['tone',...args]),duelFishingPlayNoise:(...args)=>scheduled.push(['noise',...args]),
  duelFishingPlayFlop:side=>scheduled.push(['flop',side])});
vm.runInContext(fn('duelFishingNoiseBuffer')+fn('duelFishingPlaySplash')+fn('duelFishingBindReelAudio'),test);
assert.equal(vm.runInContext('duelFishingNoiseBuffer(.48)===duelFishingNoiseBuffer(.48)',test),true);
assert.equal(buffers,1,'Repeated splashes must reuse decoded/generated noise');
vm.runInContext('duelFishingPlaySplash("left")',test);
assert(scheduled.some(s=>s[0]==='noise'&&s.at(-1)===.105),'Secondary splash must use the audio clock instead of a delayed JS timeout');
test.root=root;vm.runInContext('duelFishingBindReelAudio(root)',test);
scheduled=[];const event={detail:{side:'left',catchId:'one'}};
listeners['fishing:reel-start'](event);listeners['fishing:reel-start'](event);
assert.equal(scheduled.filter(s=>s[0]==='tone').length,4,'Duplicate polls must not replay reel audio');
assert.equal(scheduled.filter(s=>s[0]==='flop').length,0,'Flop must wait for the visible surface cue');
listeners['fishing:fish-surfaced'](event);listeners['fishing:fish-surfaced'](event);
assert.equal(scheduled.filter(s=>s[0]==='flop').length,1);
const audio=fn('duelFishingHandleAudio');
assert(!audio.includes('duelFishingPlayResult')&&!audio.includes('duelFishingPlayFlop'),'Polling must not duplicate result or catch sounds');
assert(html.includes('duelSharedCountdownLabel(duelSharedCountdownGame)!==label'),'Late animation frames must skip obsolete countdown beeps');
console.log('Fishing performance passed: cached audio, audio-clock splash layers, one visible-surface flop, stale countdown protection and no poll-driven duplicate fanfare.');
