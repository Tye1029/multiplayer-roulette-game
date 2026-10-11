/* XAN_HUB_V1_20261011: install before game audio contexts are constructed. */
(() => {
  const read=(key,fallback)=>{try{return localStorage.getItem(key)??fallback;}catch{return fallback;}};
  const contexts=new Set(),media=new Set();
  let muted=read('xan-muted','0')==='1';
  const NativeAudio=window.Audio;
  window.Audio=function(...args){const audio=new NativeAudio(...args);audio.muted=muted;audio.addEventListener('play',()=>{audio.muted=muted;});media.add(audio);return audio;};
  window.Audio.prototype=NativeAudio.prototype;
  const NativeContext=window.AudioContext||window.webkitAudioContext;
  if(NativeContext){
    class SiteAudioContext extends NativeContext{
      constructor(...args){super(...args);contexts.add(this);if(muted)super.suspend().catch(()=>{});}
      resume(){return muted?Promise.resolve():super.resume();}
      close(){contexts.delete(this);return super.close();}
    }
    window.AudioContext=SiteAudioContext;if(window.webkitAudioContext)window.webkitAudioContext=SiteAudioContext;
  }
  function apply(){
    document.documentElement.dataset.theme=read('xan-theme','dark');
    for(const a of media)a.muted=muted;
    document.querySelectorAll('audio,video').forEach(a=>a.muted=muted);
    for(const c of contexts)if(c.state!=='closed')(muted?c.suspend():c.resume()).catch(()=>{});
    window.dispatchEvent(new CustomEvent('xan-preferences',{detail:{muted}}));
  }
  window.XanPreferences={get muted(){return muted;},sound(value){muted=!value;try{localStorage.setItem('xan-muted',muted?'1':'0');}catch{}apply();},theme(value){try{localStorage.setItem('xan-theme',value);}catch{}apply();}};
  window.addEventListener('storage',e=>{if(['xan-muted','xan-theme'].includes(e.key)){muted=read('xan-muted','0')==='1';apply();}});
  apply();
})();
