(function(root,factory){const motion=factory();if(typeof module==='object'&&module.exports)module.exports=motion;else root.DerbyMotion=motion;})(typeof window==='object'?window:globalThis,()=>{
 'use strict';
 function hash(text){let n=2166136261;for(const c of String(text))n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;}
 const cache=new Map();
 function plan(order,seed){const key=String(seed)+':'+order.join(',');if(cache.has(key))return cache.get(key);
  let state=hash(key);const random=()=>{state=(state+0x6D2B79F5)|0;let t=Math.imul(state^(state>>>15),1|state);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296;};
  const shuffle=()=>{const list=[0,1,2,3,4,5];for(let i=5;i>0;i--){const j=Math.floor(random()*(i+1));[list[i],list[j]]=[list[j],list[i]];}return list;};
  const formations=[shuffle()];for(let i=1;i<4;i++){const list=shuffle();if(list[0]===formations[i-1][0])[list[0],list[3]]=[list[3],list[0]];formations.push(list);}
  const centers=[.14,.35,.60,.80],spreads=[.14,.24,.24,.12];
  const paths=Array.from({length:6},(_,id)=>{const rank=order.indexOf(id),x=[0,1700,4000,6600,8700,9800+rank*365+Math.floor(random()*100)],y=[0,...formations.map((f,i)=>centers[i]+spreads[i]*(.5-f.indexOf(id)/5)),1];
   const d=x.slice(1).map((n,i)=>(y[i+1]-y[i])/(n-x[i])),slopes=[d[0]];
   // Shape-preserving cubics maintain positive speed and continuous velocity,
   // without pauses or overshoot as racers accelerate and fade.
   for(let i=1;i<x.length-1;i++){const left=x[i]-x[i-1],right=x[i+1]-x[i],w1=2*right+left,w2=right+2*left;slopes.push((w1+w2)/(w1/d[i-1]+w2/d[i]));}slopes.push(d.at(-1));
   return {x,y,slopes,finish:x.at(-1)};
  });
  if(cache.size>=8)cache.delete(cache.keys().next().value);cache.set(key,paths);return paths;
 }
 function position(id,order,seed,elapsed){const p=plan(order,seed)[id];if(elapsed<=0)return 0;if(elapsed>=p.finish)return 1;let i=0;while(elapsed>p.x[i+1])i++;const h=p.x[i+1]-p.x[i],t=(elapsed-p.x[i])/h,t2=t*t,t3=t2*t;return (2*t3-3*t2+1)*p.y[i]+(t3-2*t2+t)*h*p.slopes[i]+(-2*t3+3*t2)*p.y[i+1]+(t3-t2)*h*p.slopes[i+1];}
 function ranking(order,seed,elapsed){return [...order].sort((a,b)=>position(b,order,seed,elapsed)-position(a,order,seed,elapsed));}
 return {position,ranking,plan,hash};
});
