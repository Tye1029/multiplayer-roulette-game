/* Session-only, allowlisted diagnostics. API keys, tokens and concealed picks are never captured. */
(() => {
  const $=id=>document.getElementById(id),events=[];let read=()=>({}),sequence=0;
  function report(){return JSON.stringify({build:'HAND_OF_DOOM_V3_20261009',capturedAt:new Date().toISOString(),
    viewport:{width:innerWidth,height:innerHeight,pixelRatio:devicePixelRatio},online:navigator.onLine,visibility:document.visibilityState,
    ...read(),events},null,2);}
  function refresh(){if(!$('debug-panel').hidden && document.activeElement!==$('debug-report')) $('debug-report').value=report();}
  function record(type,details={}){events.push({sequence:++sequence,at:new Date().toISOString(),type,...details});if(events.length>100)events.shift();refresh();}
  $('debug').onclick=()=>{const open=$('debug-panel').hidden;$('debug-panel').hidden=!open;$('debug').setAttribute('aria-expanded',String(open));if(open){refresh();$('debug-panel').scrollIntoView({block:'nearest'});}};
  $('close-debug').onclick=()=>{$('debug-panel').hidden=true;$('debug').setAttribute('aria-expanded','false');$('debug').focus();};
  $('refresh-debug').onclick=()=>{$('debug-report').value=report();$('debug-status').textContent='Report refreshed.';};
  $('copy-debug').onclick=async()=>{const text=report();$('debug-report').value=text;try{await navigator.clipboard.writeText(text);$('debug-status').textContent='Copied. Paste this report with your bug description.';}catch{$('debug-report').focus();$('debug-report').select();$('debug-status').textContent='Report selected. Copy it manually or download it.';}};
  $('download-debug').onclick=()=>{const url=URL.createObjectURL(new Blob([report()],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='rps-debug.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  window.addEventListener('error',e=>record('browser-error',{file:String(e.filename||'').split('/').pop().split('?')[0],line:e.lineno}));
  window.addEventListener('unhandledrejection',()=>record('unhandled-rejection'));
  window.RPSDebug={record,install(fn){read=fn;},refresh};
})();
