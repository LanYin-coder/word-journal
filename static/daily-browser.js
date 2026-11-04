// Read-only daily entries: browsing and revealing do not create learning records.
let dailyRequest=0,dailySnapshot=null,dailyRevealed=new Set(),dailyMode=localStorage.getItem('word-journal-daily-mode')||'none';
if(!['none','zh','en'].includes(dailyMode))dailyMode='none';
function dailyRouteDate(){const value=new URLSearchParams(location.search).get('date');return /^\d{4}-\d{2}-\d{2}$/.test(value||'')&&value<=localDate()?value:localDate()}
async function loadDailyEntries(selected=dailyRouteDate(),{updateURL=false}={}){
 const token=++dailyRequest;dailySnapshot=null;dailyRevealed.clear();document.getElementById('daily-date').value=selected;document.getElementById('daily-date').max=localDate();
 if(updateURL)history.replaceState({page:'daily'},'',routes.daily+'?date='+encodeURIComponent(selected));
 document.getElementById('daily-list').setAttribute('aria-busy','true');document.getElementById('daily-list').innerHTML='<p class="sub">正在读取词汇…</p>';
 try{const state=await api('/api/state?today='+encodeURIComponent(selected));if(token!==dailyRequest)return;dailySnapshot={...state,selected};renderDailyEntries()}
 catch(e){if(token!==dailyRequest)return;document.getElementById('daily-list').innerHTML=`<div class="empty"><b>读取失败</b><p>${esc(e.message)}</p></div>`}
 finally{if(token===dailyRequest)document.getElementById('daily-list').setAttribute('aria-busy','false')}
}
function renderDailyEntries(){
 if(!dailySnapshot)return;const {entries,words,dates,selected}=dailySnapshot,map=new Map(words.map(w=>[w.word,w])),list=entries.map(word=>map.get(word)).filter(Boolean);
 document.getElementById('daily-count').textContent=`${selected} · ${list.length} 词`;
 document.getElementById('daily-dates').innerHTML=dates.map(d=>`<button class="daily-day ${d.day===selected?'selected':''}" data-daily-date="${esc(d.day)}" aria-pressed="${d.day===selected}">${esc(d.day)}<small>${d.count} 词</small></button>`).join('')||'<span class="word-meta">暂无记录日期</span>';
 document.querySelectorAll('[data-daily-mode]').forEach(b=>{b.classList.toggle('selected',b.dataset.dailyMode===dailyMode);b.setAttribute('aria-pressed',String(b.dataset.dailyMode===dailyMode))});
 document.getElementById('daily-list').innerHTML=list.map((w,i)=>{const hidden=dailyMode!=='none'&&!dailyRevealed.has(w.word),mask=`<button class="mask daily-mask" data-daily-reveal="${i}" aria-label="显示${dailyMode==='zh'?'中文':'英文'}">点击显示${dailyMode==='zh'?'中文':'英文'}</button>`;return `<article class="daily-word"><span class="number">${String(i+1).padStart(2,'0')}</span><div class="daily-english">${hidden&&dailyMode==='en'?mask:`<div class="english">${esc(w.word)}</div>`}</div><div class="daily-meaning">${hidden&&dailyMode==='zh'?mask:`<div class="pos">${esc(w.pos)}</div><div class="meaning">${esc(w.meaning)}</div>`}</div></article>`}).join('')||'<div class="empty"><b>这一天没有记录词汇</b><p>选择其他日期，或从导航栏导入新词。</p></div>';
 document.getElementById('daily-list').querySelectorAll('[data-daily-reveal]').forEach(b=>b.onclick=()=>{const w=list[Number(b.dataset.dailyReveal)];if(!w)return;dailyRevealed.add(w.word);const cell=b.parentElement;b.outerHTML=dailyMode==='en'?`<div class="english">${esc(w.word)}</div>`:`<div class="pos">${esc(w.pos)}</div><div class="meaning">${esc(w.meaning)}</div>`;if(motionOK())cell.animate([{opacity:.2,transform:'translateY(4px)'},{opacity:1,transform:'translateY(0)'}],{duration:250,easing:'ease-out'})});
 document.querySelectorAll('[data-daily-date]').forEach(b=>b.onclick=()=>loadDailyEntries(b.dataset.dailyDate,{updateURL:true}));
}
function initDailyBrowser(){
 document.getElementById('daily-date').onchange=e=>{if(e.target.value)loadDailyEntries(e.target.value,{updateURL:true})};
 document.querySelectorAll('[data-daily-mode]').forEach(b=>b.onclick=()=>{dailyMode=b.dataset.dailyMode;localStorage.setItem('word-journal-daily-mode',dailyMode);dailyRevealed.clear();renderDailyEntries()});
 document.getElementById('daily-today').onclick=()=>loadDailyEntries(localDate(),{updateURL:true});document.getElementById('daily-yesterday').onclick=()=>loadDailyEntries(yesterdayDate(),{updateURL:true});
 document.addEventListener('click',e=>{const a=e.target.closest('a[data-route-page]');if(!a||e.button!==0||e.metaKey||e.ctrlKey||e.altKey||e.shiftKey)return;e.preventDefault();page(a.dataset.routePage).catch(err=>toast(err.message))});
}
