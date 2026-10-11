/* Small, original synthesized effects. No media downloads or background loop. */
(function(root,factory){
  const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.YahtzeeAudio=api;
})(typeof globalThis==='object'?globalThis:this,()=>{
  'use strict';
  function create(makeContext,isMuted){
    let context,noise;
    function unlock(){
      if(isMuted())return;
      try{context ||= makeContext();context.resume().catch(()=>{});}catch{}
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
        if(!noise){noise=context.createBuffer(1,Math.ceil(context.sampleRate*.12),context.sampleRate);const samples=noise.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=(Math.random()*2-1)*Math.exp(-i/(context.sampleRate*.02));}
        // Short filtered impacts, with a few softer bounces as the dice settle.
        for(let i=0;i<9;i++){
          const start=at+i*.048+Math.random()*.012,source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();
          source.buffer=noise;filter.type='bandpass';filter.frequency.value=950+Math.random()*2000;filter.Q.value=.7;gain.gain.value=.28*(1-i*.065);
          source.connect(filter).connect(gain).connect(context.destination);source.start(start);
          source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
          note(190+Math.random()*220,start,.065,.024*(1-i*.07),'triangle');
        }
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
    return {unlock,play,pause:()=>context?.suspend().catch(()=>{}),close:()=>{context?.close().catch(()=>{});context=undefined;noise=undefined;}};
  }
  return {create};
});
