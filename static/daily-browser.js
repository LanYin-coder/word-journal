// Read-only daily entries: browsing and revealing do not create learning records.
let dailyRequest=0,dailySnapshot=null,dailyRevealed=new Set(),dailyMode=localStorage.getItem('word-journal-daily-mode')||'none';
if(!['none','zh','en'].includes(dailyMode))dailyMode='none';
function dailyRouteDate(){const value=new URLSearchParams(location.search).get('date');return /^\d{4}-\d{2}-\d{2}$/.test(value||'')&&value<=localDate()?value:localDate()}
async function loadDailyEntries(selected=dailyRouteDate(),{updateURL=false}={}){
 pronunciation.stop();const token=++dailyRequest;dailySnapshot=null;dailyRevealed.clear();document.getElementById('daily-date').value=selected;document.getElementById('daily-date').max=localDate();
 if(updateURL)history.replaceState({page:'daily'},'',routes.daily+'?date='+encodeURIComponent(selected));
 document.getElementById('daily-list').setAttribute('aria-busy','true');document.getElementById('daily-list').innerHTML='<p class="sub">正在读取词汇…</p>';
 try{const state=await api('/api/state?today='+encodeURIComponent(selected));if(token!==dailyRequest)return;dailySnapshot={...state,selected};renderDailyEntries()}
 catch(e){if(token!==dailyRequest)return;document.getElementById('daily-list').innerHTML=`<div class="empty"><b>读取失败</b><p>${esc(e.message)}</p></div>`}
 finally{if(token===dailyRequest)document.getElementById('daily-list').setAttribute('aria-busy','false')}
}
function renderDailyEntries(){
 pronunciation.stop();
 if(!dailySnapshot)return;const {entries,words,dates,selected}=dailySnapshot,map=new Map(words.map(w=>[w.word,w])),list=entries.map(word=>map.get(word)).filter(Boolean);
 document.getElementById('daily-count').textContent=`${selected} · ${list.length} 词`;
 document.getElementById('daily-dates').innerHTML=dates.map(d=>`<button class="daily-day ${d.day===selected?'selected':''}" data-daily-date="${esc(d.day)}" aria-pressed="${d.day===selected}">${esc(d.day)}<small>${d.count} 词</small></button>`).join('')||'<span class="word-meta">暂无记录日期</span>';
 document.querySelectorAll('[data-daily-mode]').forEach(b=>{b.classList.toggle('selected',b.dataset.dailyMode===dailyMode);b.setAttribute('aria-pressed',String(b.dataset.dailyMode===dailyMode))});
 const speaker='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></svg>';
 const english=(w,i,hidden=false)=>{const phonetic=String(w.phonetic||'').trim().replace(/^[/\[\s]+|[/\]\s]+$/g,'');return `<div class="daily-word-heading">${hidden?`<button class="mask daily-mask" data-daily-reveal="${i}" aria-label="显示英文">点击显示英文</button>`:`<div class="english" lang="en">${esc(w.word)}</div>`}<button class="daily-speak" data-daily-speak="${i}" aria-label="播放英文发音" title="播放英文发音">${speaker}</button></div>${!hidden&&phonetic?`<div class="daily-phonetic" lang="en">/${esc(phonetic)}/</div>`:''}`};
 document.getElementById('daily-list').innerHTML=list.map((w,i)=>{const hidden=dailyMode!=='none'&&!dailyRevealed.has(w.word);return `<article class="daily-word"><span class="number">${String(i+1).padStart(2,'0')}</span><div class="daily-english">${english(w,i,hidden&&dailyMode==='en')}</div><div class="daily-meaning">${hidden&&dailyMode==='zh'?`<button class="mask daily-mask" data-daily-reveal="${i}" aria-label="显示中文">点击显示中文</button>`:`<div class="pos">${esc(w.pos)}</div><div class="meaning">${esc(w.meaning)}</div>`}</div></article>`}).join('')||'<div class="empty"><b>这一天没有记录词汇</b><p>选择其他日期，或从导航栏导入新词。</p></div>';
 const container=document.getElementById('daily-list');
 container.onclick=e=>{
  const play=e.target.closest('[data-daily-speak]');if(play){const w=list[Number(play.dataset.dailySpeak)];if(w)speakDailyWord(w.word,play);return}
  const reveal=e.target.closest('[data-daily-reveal]');if(!reveal)return;const i=Number(reveal.dataset.dailyReveal),w=list[i];if(!w)return;dailyRevealed.add(w.word);const cell=reveal.closest(dailyMode==='en'?'.daily-english':'.daily-meaning');cell.innerHTML=dailyMode==='en'?english(w,i):`<div class="pos">${esc(w.pos)}</div><div class="meaning">${esc(w.meaning)}</div>`;if(motionOK())cell.animate([{opacity:.2,transform:'translateY(4px)'},{opacity:1,transform:'translateY(0)'}],{duration:250,easing:'ease-out'});
 };
 document.querySelectorAll('[data-daily-date]').forEach(b=>b.onclick=()=>loadDailyEntries(b.dataset.dailyDate,{updateURL:true}));
}
function speakDailyWord(word,button){pronunciation.play(word,button)}
function initDailyBrowser(){
 document.getElementById('daily-date').onchange=e=>{if(e.target.value)loadDailyEntries(e.target.value,{updateURL:true})};
 document.querySelectorAll('[data-daily-mode]').forEach(b=>b.onclick=()=>{dailyMode=b.dataset.dailyMode;localStorage.setItem('word-journal-daily-mode',dailyMode);dailyRevealed.clear();renderDailyEntries()});
 document.getElementById('daily-today').onclick=()=>loadDailyEntries(localDate(),{updateURL:true});document.getElementById('daily-yesterday').onclick=()=>loadDailyEntries(yesterdayDate(),{updateURL:true});
 document.addEventListener('click',e=>{const a=e.target.closest('a[data-route-page]');if(!a||e.button!==0||e.metaKey||e.ctrlKey||e.altKey||e.shiftKey)return;e.preventDefault();page(a.dataset.routePage).catch(err=>toast(err.message))});
}
