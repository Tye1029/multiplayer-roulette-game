/* Recorded CC0 dice foley; original score and result cues. */
(function(root,factory){
  const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.YahtzeeAudio=api;
})(typeof globalThis==='object'?globalThis:this,()=>{
  'use strict';
  function create(makeContext,isMuted){
    let context;const recordings=new Map();
    function unlock(){
      if(isMuted())return;
      try{context ||= makeContext();context.resume().catch(()=>{});for(const name of [1,2,3])if(!recordings.has(name))recordings.set(name,fetch("/assets/site-hub/audio/dice-throw-"+name+".ogg").then(r=>r.arrayBuffer()).then(b=>context.decodeAudioData(b)).catch(()=>null));}catch{}
    }
    function play(kind,delay=0){
      if(isMuted()||!context||context.state!=='running')return;
      const at=context.currentTime+delay;
      function note(hz,start,duration,volume=.035,type='sine'){
        const o=context.createOscillator(),g=context.createGain();o.type=type;o.frequency.setValueAtTime(hz,start);
        g.gain.setValueAtTime(.0001,start);g.gain.exponentialRampToValueAtTime(volume,start+.008);g.gain.exponentialRampToValueAtTime(.0001,start+duration);
        o.connect(g).connect(context.destination);o.start(start);o.stop(start+duration+.02);o.onended=()=>{o.disconnect();g.disconnect();};
      }
      if(kind==='roll'){
        const current=context;
        recordings.get(1+Math.floor(Math.random()*3))?.then(buffer=>{if(!buffer||isMuted()||current!==context||context.state!=='running')return;const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;gain.gain.value=.65;source.connect(gain).connect(context.destination);source.start(Math.max(at,context.currentTime));source.onended=()=>{source.disconnect();gain.disconnect();};});
      }else if(kind==='yahtzee'){
        [523.25,659.25,783.99,1046.5].forEach((hz,i)=>note(hz,at+i*.11,.45,.045,'triangle'));
        [523.25,659.25,783.99].forEach(hz=>note(hz,at+.55,.65,.025));
      }else if(kind==='win'){
        [392,523.25,659.25,783.99,1046.5].forEach((hz,i)=>note(hz,at+i*.1,.5,.035,'triangle'));
      }else if(kind==='lose'){
        [293.66,261.63,220,146.83].forEach((hz,i)=>note(hz,at+i*.17,.7,.035,'triangle'));
      }else if(kind==='score'){
        [440,554.37,659.25].forEach((hz,i)=>note(hz,at+i*.06,.16));
      }else if(kind==='go')note(880,at,.22,.045,'triangle');
      else if(kind==='countdown')note(440,at,.1,.025);
      else if(kind==='tally')note(600,at,.055,.018);
      else if(kind==='hold')note(330,at,.045,.022,'triangle');
    }
    return {unlock,play,pause:()=>context?.suspend().catch(()=>{}),close:()=>{context?.close().catch(()=>{});context=undefined;recordings.clear();}};
  }
  return {create};
});
