/* POCKET_PUTT_V4 — a shot's playback clock never changes when a poll arrives. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.PuttPlayback=factory();})(globalThis,()=>{
  function create(){
    let key='',anchor=0,initial=0;
    return {
      reset(){key='';anchor=initial=0;},
      accept(state,monotonicNow){
        const shot=state.lastShot,next=shot?[state.id,state.match,state.hole,shot.id].join(':'):'';
        if(next===key)return;
        key=next;anchor=monotonicNow;initial=shot?Math.max(0,state.serverNow-shot.startedAt):0;
      },
      elapsed(monotonicNow){return initial+Math.max(0,monotonicNow-anchor);}
    };
  }
  return {create};
});
