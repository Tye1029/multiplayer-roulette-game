import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../assets/duel-shell.js',import.meta.url),'utf8');
const listeners=new Map();
const options=['mines','draw','fishing','roulette','safecracker','mountainrace','blackjackduel'].map(value=>({value,textContent:value}));
const select={options,value:'fishing'};
const buttons=[-1,1].map(step=>({dataset:{wagerStep:String(step)},addEventListener:(_,fn)=>listeners.set(step,fn)}));
const events=[];
const input={value:'1000',min:'1000',max:'',disabled:false,
  get valueAsNumber(){return this.value===''?NaN:Number(this.value);},
  stepUp(){this.value=String(Math.min(this.max?Number(this.max):Infinity,Number(this.value)+1000));},
  stepDown(){this.value=String(Math.max(Number(this.min),Number(this.value)-1000));},
  dispatchEvent(event){events.push(event.type);},addEventListener(){}};
const document={getElementById:id=>({duelModeSelect:select,duelWagerInput:input}[id]),querySelectorAll:()=>buttons};
vm.runInNewContext(source,{document,Event:class{constructor(type){this.type=type;}},MutationObserver:class{observe(){}}});
assert.deepEqual(options.filter(o=>!o.hidden).map(o=>o.value),['fishing','roulette','safecracker','blackjackduel']);
assert.equal(options.find(o=>o.value==='fishing').textContent,'Fishing Duel');
assert.equal(buttons[0].disabled,true);
listeners.get(1)();assert.equal(input.value,'2000');assert.deepEqual(events,['input','change']);
listeners.get(-1)();listeners.get(-1)();assert.equal(input.value,'1000');
input.value='';listeners.get(1)();assert.equal(input.value,'2000');
input.disabled=true;listeners.get(1)();assert.equal(input.value,'2000');
input.disabled=false;input.max='2000';listeners.get(1)();assert.equal(input.value,'2000');assert.equal(buttons[1].disabled,true);

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const money=html.match(/    function money\(value\) \{[\s\S]*?\n    \}/)[0];
const context=vm.createContext({});vm.runInContext(money,context);
assert.equal(vm.runInContext('money(1)',context),'1 Chip');
assert.equal(vm.runInContext('money(2000)',context),'2,000 Chips');
assert(html.indexOf('duel-card duel-create-card') < html.indexOf('duel-card duel-join-card'), 'New match must precede open matches');
assert(!html.includes('Connect your Torn API key, send Xanax'));
const controller={window:{}};
vm.runInNewContext(fs.readFileSync(new URL('../assets/fishing/fishing-controller.js',import.meta.url),'utf8'),controller);
const restY=controller.window.FishingSceneController.prototype.catchRestY;
for(const height of [140,176,430]){
  const y=restY.call({water:{getBoundingClientRect:()=>({height})},hook:()=>({querySelector:()=>({offsetHeight:104})})},'left');
  assert(y<=.48);assert(y*height+104<=height-7.9,'The whole catch and caption must stay inside the water');
}
console.log('XAN DUELS shell validated: listed modes, Chips formatting, wager min/max/disabled controls, and narrow-screen catch fit.');
