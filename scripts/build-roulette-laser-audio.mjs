// Export the approved two-player Redshift PCM for the four-player audio mixer.
import fs from 'node:fs/promises';
import vm from 'node:vm';
const source=await fs.readFile(new URL('../assets/roulette/audio-manager.js',import.meta.url),'utf8');
const start=source.indexOf('  function laserBuffer('),end=source.indexOf('  function laserCue(',start);
if(start<0||end<0)throw Error('Redshift PCM generator is missing');
const context=vm.createContext({laserBuffers:new Map()});vm.runInContext(source.slice(start,end),context);
for(const cue of ['fire','error','charge','cycle']){
 const clip=context.laserBuffer({sampleRate:32000,createBuffer:(_channels,n,rate)=>{const samples=new Float32Array(n);return {sampleRate:rate,getChannelData:()=>samples};}},cue),samples=clip.getChannelData(0),wav=Buffer.alloc(44+samples.length*2);
 wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(32000,24);wav.writeUInt32LE(64000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(samples.length*2,40);
 samples.forEach((s,i)=>wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,s))*32767),44+i*2));
 await fs.writeFile(new URL('../assets/site-hub/audio/laser-'+cue+'.wav',import.meta.url),wav);
}
