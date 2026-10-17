(() => {
 const panel=document.createElement('section');panel.className='panel';panel.id='reportsPanel';panel.innerHTML='<h2>Bug reports & suggestions</h2><p>Verified Torn identities appear with reports. Guest reports are labeled separately.</p><button id="loadReports">Load reports</button><div id="reportRows"></div><p id="reportStatus" role="status"></p>';
 document.querySelector('main').append(panel);
 const link=document.createElement('a');link.href='#reportsPanel';link.textContent='Reports';document.querySelector('.admin-nav').append(link);
 let before;
 document.getElementById('loadReports').onclick=async()=>{
  const button=document.getElementById('loadReports');button.disabled=true;
  try{
   const response=await fetch('/.netlify/functions/site-hub',{method:'POST',headers:{'Content-Type':'application/json','X-Admin-Password':document.getElementById('password').value},body:JSON.stringify({action:'reports',before})});
   const data=await response.json();if(!response.ok)throw Error(data.error||'Could not load reports.');
   for(const r of data.reports){const article=document.createElement('article');article.style.cssText='padding:18px 0;border-bottom:1px solid #454750';const title=document.createElement('h3');title.textContent=`${r.sender?`${r.sender.name} [${r.sender.id}]`:'Guest'} · ${new Date(r.created_at).toLocaleString()}`;const text=document.createElement('p');text.textContent=r.message||'Debug report';article.append(title,text);if(r.debug){const pre=document.createElement('pre');pre.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere';pre.textContent=JSON.stringify(r.debug,null,2);article.append(pre);}document.getElementById('reportRows').append(article);}
   before=data.reports.at(-1)?.created_at||before;button.textContent='Load older reports';document.getElementById('reportStatus').textContent=data.reports.length?'Reports loaded.':'No more reports.';
  }catch(e){document.getElementById('reportStatus').textContent=e.message;}finally{button.disabled=false;}
 };
})();
