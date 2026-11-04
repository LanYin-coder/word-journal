const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function localDate(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
let today=localDate(),day=today,mode=localStorage.getItem('word-journal-mode')||'zh',scope='mine',data={words:[],dates:[],entries:[],reviews:[]},revealed=new Set(),order=[],previewText='',previewRows=[],searchId=0;
if(!['zh','en','none'].includes(mode))mode='zh';
async function api(url,body){let r=await fetch(url,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});let j=await r.json();if(!r.ok)throw Error(j.error||'请求失败');return j}
function toast(s){$('#toast').textContent=s;$('#toast').classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('visible'),4000)}
const motionOK=()=>!matchMedia('(prefers-reduced-motion: reduce)').matches;
function enterList(){if(!motionOK())return;document.querySelectorAll('#study-list .word-card, #study-list .empty').forEach((el,i)=>el.animate([{opacity:0,transform:'translateY(16px)'},{opacity:1,transform:'translateY(0)'}],{duration:500,delay:Math.min(i,9)*45,easing:'cubic-bezier(.22,1,.36,1)',fill:'backwards'}))}
const routes={study:'/',review:'/review',daily:'/daily',library:'/vocabulary',import:'/import',practice:'/practice','practice-session':'/practice/session'};
let navigationId=0;
async function page(name,{fromHistory=false,replace=false}={}){
 if(!routes[name])name='study';
 if(name==='practice-session'&&!practice.queue.length){name='practice';replace=true}
 if(location.pathname!==routes[name])history[replace||fromHistory?'replaceState':'pushState']({page:name},'',routes[name]);
 document.documentElement.dataset.focus=String(name==='practice-session');document.documentElement.dataset.current=name;
 document.querySelectorAll('.primary-nav a').forEach(a=>{const active=a.dataset.routePage===(name==='practice-session'?'practice':name);a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
 document.title=({study:'首页',review:'词汇背诵',daily:'每日记词',library:'词汇与词典',import:'导入新词',practice:'练习设置','practice-session':'专注练习'}[name])+' · 拾词';
 if(name!=='practice-session')window.speechSynthesis?.cancel();

 const token=++navigationId,current=document.querySelector('.page:not([hidden])'),next=$('#'+name);
 document.querySelectorAll('.nav').forEach(x=>{x.classList.toggle('active',x.dataset.page===name);x.setAttribute('aria-current',x.dataset.page===name?'page':'false')});
 if(name==='library')renderSearch().catch(e=>toast(e.message));
 if(name==='daily')loadDailyEntries();
 if(['study','review'].includes(name)&&practice.index)refresh().catch(e=>toast(e.message));
 if(current===next){next.getAnimations().forEach(a=>a.cancel());return}
 document.querySelectorAll('.page').forEach(el=>el.getAnimations().forEach(a=>a.cancel()));
 if(current&&motionOK()){await current.animate([{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(-5px)'}],{duration:110,easing:'ease-in'}).finished.catch(()=>{})}
 if(token!==navigationId)return;
 document.querySelectorAll('.page').forEach(x=>x.hidden=x!==next);
 if(name==='library')renderSearch().catch(e=>toast(e.message));
 window.scrollTo({top:0,behavior:'instant'});
 const heading=next.querySelector('h1');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true})}
 if(motionOK())next.animate([{opacity:0,transform:'translateY(9px)'},{opacity:1,transform:'translateY(0)'}],{duration:320,easing:'cubic-bezier(.22,1,.36,1)'});
}
function themeControls(){document.querySelectorAll('[data-theme-choice]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.themeChoice===document.documentElement.dataset.theme)))}
let themeTransition;
async function setTheme(theme){
 if(document.documentElement.dataset.theme===theme)return;
 const apply=()=>{document.documentElement.dataset.theme=theme;localStorage.setItem('word-journal-theme',theme);themeControls()};
 themeTransition?.skipTransition();
 if(document.startViewTransition&&motionOK()){themeTransition=document.startViewTransition(apply);await themeTransition.finished.catch(()=>{});}else apply();
}
themeControls();

function meta(w){return `<span class="badge">首次记录 ${esc(w.first_date)}</span><span class="badge">记录距今 ${w.age_days} 天</span><span class="badge">已学习 ${w.study_days} 天</span>${w.last_studied?`<span class="badge">上次学习 ${esc(w.last_studied)}</span>`:''}`}
async function refresh(){today=localDate();data=await api('/api/state?today='+today);if(day!==today){data.selectedEntries=(await api('/api/state?today='+day)).entries}order=[];render();if(!$('#library').hidden)renderSearch()}
function render(){
 $('#today-label').textContent=new Date(today+'T12:00:00').toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'long'});
 $('#dates').innerHTML=data.dates.map(d=>`<button class="date-link ${d.day===day?'active':''}" data-date="${d.day}"><span>${d.day===today?'今天 · ':''}${d.day}</span><small>${d.count}</small></button>`).join('')||'<p class="word-meta">新词会在这里留下足迹</p>';
 $('#date').value=day;$('#date').max=today;$('#import-date').max=today;
 $('#study-title').textContent=day===today?'今日词汇':`${day} 的词汇`;
 $('#home-count').textContent=`今日 ${data.entries.length} 词 · 累计 ${data.words.length} 词`;
 const ids=day===today?data.entries:(data.selectedEntries||[]);
 let list=ids.map(id=>data.words.find(w=>w.word===id)).filter(Boolean);
 if(order.length)list.sort((a,b)=>order.indexOf(a.word)-order.indexOf(b.word));
 const firstPaint=!$('#stats').children.length;
 const reviewed=new Set(data.reviews.filter(r=>ids.includes(r.word)&&r.direction===mode).map(r=>r.word));
 $('#stats').innerHTML=[['这一天记录',list.length,'个词汇'],['今天已复习',reviewed.size,'个词汇'],['累计收藏',data.words.length,'个词汇']].map(([l,n,u])=>`<div class="stat"><div class="stat-label">${l}</div><div class="stat-value">${n}<small>${u}</small></div></div>`).join('');
 document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('selected',b.dataset.mode===mode));
 $('#study-list').innerHTML=list.length?list.map((w,i)=>{
 const show=revealed.has(w.word),r=data.reviews.find(r=>r.word===w.word&&r.direction===mode);
 const mask=`<button class="mask" data-reveal="${esc(w.word)}" aria-label="显示${mode==='zh'?'中文':'英文'}答案">••• 点击查看${mode==='zh'?'释义':'英文'}</button>`;
 return `<article class="word-card"><span class="number">${String(i+1).padStart(2,'0')}</span><div>${mode==='en'&&!show?mask:`<div class="english">${esc(w.word)}</div>`}<div class="word-meta">已学习 ${w.study_days} 天 · 记录 ${w.age_days} 天</div></div><div>${mode==='zh'&&!show?mask:`<div class="pos">${esc(w.pos)}</div><div class="meaning">${esc(w.meaning)}</div>`}</div><div class="review-actions"><button class="again ${r?.result==='again'?'active':''}" data-review="${esc(w.word)}" data-result="again" ${mode!=='none'&&!show?'disabled':''}>再记一次</button><button class="known ${r?.result==='known'?'active':''}" data-review="${esc(w.word)}" data-result="known" ${mode!=='none'&&!show?'disabled':''}>✓ 记住了</button></div></article>`}).join(''):`<div class="empty"><span style="font:40px Georgia">Aa</span><b>这一天还没有词汇</b><p>导入词汇后开始背诵。</p><button class="primary" data-open-import>＋ 记录新词</button></div>`;
 $('#progress-label').textContent=`本轮进度 · ${reviewed.size} / ${list.length}`;$('#progress-fill').style.width=`${list.length?reviewed.size/list.length*100:0}%`;
 if(firstPaint)enterList();
 $('#dict-state').textContent=`● 本地词库就绪 · ${data.dictionary_count.toLocaleString()} 条释义 · 离线可查`;
}
async function selectDay(d){day=d;revealed.clear();order=[];if(d!==today){const s=await api('/api/state?today='+d);data.selectedEntries=s.entries}page('review');render()}
async function renderSearch(){const id=++searchId,q=$('#search').value.trim();document.querySelectorAll('[data-scope]').forEach(b=>b.classList.toggle('selected',b.dataset.scope===scope));
 if(scope==='mine'){const list=data.words.filter(w=>!q||w.word.toLowerCase().includes(q.toLowerCase())||w.meaning.includes(q));$('#search-caption').textContent=`我的词汇 · ${list.length} 个结果`;
 $('#search-results').innerHTML=list.map(w=>`<article class="result"><div class="result-content"><div class="english">${esc(w.word)}</div>${meta(w)}<div class="meaning">${esc(w.pos)} ${esc(w.meaning)}</div></div><div><button class="quiet" data-add="${esc(w.word)}" ${w.in_today?'disabled':''}>${w.in_today?'已在今日记录':'＋ 加入今日新记'}</button></div></article>`).join('')||`<div class="empty"><b>${q?'没有找到记录过的词':'还没有记录词汇'}</b><p>可切换到 ECDICT 本地词典查找新词。</p></div>`;return}
 $('#search-caption').textContent=`ECDICT 社区开源词库 · ${data.dictionary_count.toLocaleString()} 条 · 输入英文查词`;
 if(!q){$('#search-results').innerHTML='<div class="empty"><b>输入英文查词</b><p>输入英文单词或前缀，查询本地词典。</p></div>';return}
 $('#search-results').innerHTML='<p class="sub">正在查找…</p>';
 const list=await api('/api/search?q='+encodeURIComponent(q));if(id!==searchId)return;
 $('#search-results').innerHTML=list.map(w=>{const mine=data.words.find(x=>x.word===w.word);return `<article class="result"><div class="result-content"><div class="english">${esc(w.word)} <span class="word-meta">${esc(w.phonetic)}</span></div>${mine?meta(mine):'<span class="badge warn">尚未记录</span>'}<div class="meaning">${esc(w.meaning)}</div></div><div><button class="quiet" data-add="${esc(w.word)}" ${mine?.in_today?'disabled':''}>${mine?.in_today?'已在今日记录':'＋ 加入今日新记'}</button></div></article>`}).join('')||'<div class="empty"><b>词库暂未收录</b><p>在导入新词中填写英文和中文释义，即可自行记录。</p></div>';
}
async function preview(){previewText=$('#input').value;previewRows=await api('/api/preview',{text:previewText});$('#preview-area').hidden=false;const good=previewRows.filter(r=>!r.error);$('#preview-caption').textContent=`识别结果 · 可导入 ${good.length} 行${previewRows.length-good.length?` / 待修正 ${previewRows.length-good.length} 行`:''}`;$('#commit').disabled=!good.length;$('#commit').textContent='确认导入有效词汇';$('#preview-results').innerHTML=previewRows.map(r=>`<div class="result ${r.error?'preview-error':''}"><div class="result-content"><div class="english">${esc(r.word||r.raw)}</div><div class="meaning">${esc(r.pos)} ${esc(r.meaning)}</div>${r.error?`<p class="error-text">第 ${r.line} 行：${esc(r.error)}</p>`:`<span class="badge">${esc(r.source)}</span>`}</div></div>`).join('')||'<div class="empty">请先填写词汇。</div>'}
async function action(e){const b=e.target.closest('button');if(!b)return;
 if(b.dataset.themeChoice)return setTheme(b.dataset.themeChoice);
 if(b.dataset.page)return page(b.dataset.page);
 if(b.hasAttribute('data-open-import'))return page('import');
 if(b.dataset.date){document.querySelector('.history-picker')?.removeAttribute('open');return selectDay(b.dataset.date)}
 if(b.dataset.mode){mode=b.dataset.mode;localStorage.setItem('word-journal-mode',mode);revealed.clear();render();enterList();return}
 if(b.dataset.scope){scope=b.dataset.scope;return renderSearch()}
 if(b.dataset.reveal){
 const word=b.dataset.reveal,w=data.words.find(x=>x.word===word),card=b.closest('.word-card'),cell=b.parentElement;
 if(!w)return;revealed.add(word);const oldHeight=card.getBoundingClientRect().height;
 b.outerHTML=mode==='en'?`<div class="english">${esc(w.word)}</div>`:`<div class="pos">${esc(w.pos)}</div><div class="meaning">${esc(w.meaning)}</div>`;
 card.querySelectorAll('[data-review]').forEach(button=>button.disabled=false);
 const target=cell.querySelector(mode==='en'?'.english':'.meaning');
 if(motionOK()){
  target.animate([{opacity:0,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:300,easing:'cubic-bezier(.22,1,.36,1)'});
  const height=card.getBoundingClientRect().height;if(Math.abs(height-oldHeight)>1)card.animate([{height:oldHeight+'px'},{height:height+'px'}],{duration:300,easing:'cubic-bezier(.22,1,.36,1)'});
 }
 card.querySelector('[data-result=known]').focus({preventScroll:true});return;
 }
 if(b.dataset.review){
 const word=b.dataset.review,result=b.dataset.result,card=b.closest('.word-card');b.disabled=true;
 try{
 await api('/api/review',{day:today,word,direction:mode,result});
 const fresh=await api('/api/state?today='+today);Object.assign(data,{words:fresh.words,reviews:fresh.reviews});
 card.querySelectorAll('[data-review]').forEach(el=>{el.classList.toggle('active',el.dataset.result===result);el.disabled=false});
 const w=data.words.find(w=>w.word===word);card.querySelector('.word-meta').textContent=`已学习 ${w.study_days} 天 · 记录 ${w.age_days} 天`;
 const ids=day===today?data.entries:(data.selectedEntries||[]),count=new Set(data.reviews.filter(r=>ids.includes(r.word)&&r.direction===mode).map(r=>r.word)).size;
 $('#stats').children[1].querySelector('.stat-value').innerHTML=`${count}<small>个词汇</small>`;
 $('#progress-label').textContent=`本轮进度 · ${count} / ${ids.length}`;$('#progress-fill').style.width=`${ids.length?count/ids.length*100:0}%`;
 if(motionOK())card.animate([{boxShadow:'0 0 0 1px #8abb9b88'},{boxShadow:'0 0 0 1px #8abb9b00'}],{duration:600});
 }finally{b.disabled=false}return;
 }
 if(b.dataset.add){b.disabled=true;try{const w=data.words.find(w=>w.word===b.dataset.add);await api('/api/import',{day:today,text:w?`${w.word}\t${w.pos||''} ${w.meaning.replaceAll('\n','；')}`:b.dataset.add});await refresh();toast('已加入今日新记')}finally{b.disabled=false}return}
}
document.addEventListener('click',e=>action(e).catch(err=>toast(err.message)));
$('#go-import').onclick=()=>page('import');$('#date').onchange=()=>selectDay($('#date').value).catch(e=>toast(e.message));
$('#shuffle').onclick=()=>{order=[...$('#study-list').querySelectorAll('[data-reveal],[data-review]')].map(b=>b.dataset.reveal||b.dataset.review).filter((v,i,a)=>a.indexOf(v)===i);for(let i=order.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]]}render();enterList()};
let timer;$('#search').oninput=()=>{++searchId;clearTimeout(timer);timer=setTimeout(()=>renderSearch().catch(e=>toast(e.message)),200)};
$('#preview').onclick=()=>preview().catch(e=>toast(e.message));$('#input').oninput=()=>{$('#preview-area').hidden=true};
$('#commit').onclick=async()=>{const b=$('#commit');b.disabled=true;try{if(previewText!==$('#input').value)throw Error('内容已修改，请重新预览');const d=$('#import-date').value;const result=await api('/api/import',{text:previewText,day:d});await refresh();await selectDay(d);toast(`已记录 ${result.count} 个词汇${result.skipped?`，${result.skipped} 行未导入，请修正`:''}`);$('#input').value=previewRows.filter(r=>r.error).map(r=>r.raw).join('\n');$('#preview-area').hidden=true}catch(e){toast(e.message)}finally{b.disabled=false}};
$('#file').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>5e6)throw Error('请导入 5MB 以内的文件');$('#input').value=await f.text();await preview()}catch(e){toast(e.message)}finally{e.target.value=''}};
$('#export').onclick=async()=>{try{const backup=await api('/api/export');const url=URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`拾词备份-${today}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}catch(e){toast(e.message)}};
$('#restore').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;await api('/api/restore',{data:JSON.parse(await f.text())});await refresh();toast('备份已合并恢复')}catch(e){toast('恢复失败：'+e.message)}finally{e.target.value=''}};
$('#import-date').value=today;refresh().catch(e=>toast('连接本地服务失败：'+e.message));
// Re-opened tabs and midnight rollover use the browser's local calendar date.
document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(today!==localDate()){day=localDate();$('#import-date').value=day;revealed.clear()}refresh().catch(e=>toast(e.message))}});

setInterval(()=>{if(today!==localDate()){day=localDate();revealed.clear();$('#import-date').value=day;refresh().catch(e=>toast(e.message))}},60000);

// Small tactile feedback on controls; respect the system's motion preference.
document.addEventListener('pointerdown',e=>{const b=e.target.closest('button');if(!b||b.disabled||!motionOK())return;const r=b.getBoundingClientRect(),dot=document.createElement('span');dot.className='ripple';dot.style.left=`${e.clientX-r.left}px`;dot.style.top=`${e.clientY-r.top}px`;b.append(dot);dot.addEventListener('animationend',()=>dot.remove(),{once:true})});

// Practice sessions: one prompt per word, balanced directions in mixed mode.
const practice={mode:'mixed',...newPracticeRun([]),checked:false,busy:false,date:today};
$('#practice-date').value=today;$('#practice-date').max=today;
function shuffled(items){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function practiceQueue(words,type){const count=Math.floor(words.length/2)+(words.length%2?Math.round(Math.random()):0);return shuffled(words).map((w,i)=>({w,type:type==='mixed'?(i<count?'en':'zh'):type}))}
function practiceAnimate(){if(motionOK())$('#practice-stage').animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:320,easing:'cubic-bezier(.22,1,.36,1)'})}
function speakPractice(){
 const item=practice.queue[practice.index];if(!item)return;
 if(!('speechSynthesis' in window)){toast('当前浏览器不支持朗读，请使用 Chrome 或 Safari，或切换到默写模式');return}
 speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(item.w.word);utterance.lang='en-US';utterance.rate=.85;
 const voice=speechSynthesis.getVoices().find(v=>v.lang==='en-US')||speechSynthesis.getVoices().find(v=>v.lang.startsWith('en'));
 if(voice)utterance.voice=voice;
 utterance.onerror=e=>{if(!['canceled','interrupted'].includes(e.error))toast('发音暂不可用，请检查系统英文语音，或切换到默写模式')};
 speechSynthesis.speak(utterance);
}
function showPractice(){
 const item=practice.queue[practice.index];practice.checked=false;
 $('#session-source').textContent=practice.date;
 if(!item){$('#practice-stage').innerHTML=`<div class="empty practice-done"><b>全部完成</b><p>掌握 ${practice.known} 词 · 错词补练 ${practice.again} 次</p><button class="quiet" id="practice-prev">← 上一词 <kbd>Tab</kbd></button> <button class="primary" id="practice-restart">重新开始</button></div>`;$('#practice-restart').onclick=startPractice;$('#practice-prev').disabled=!practice.attempts.length;$('#practice-prev').onclick=previousPractice;practiceAnimate();completePracticeFlow();return}
 const {w,type}=item,zh=type==='en',audio=type==='audio',immediate=practice.retryIndex===practice.index;
 $('#practice-stage').innerHTML=`<div class="session-progress"><span>第 ${practice.turn} 轮 · 成功 ${practice.turnSuccess} / 10 · 总掌握 ${practice.known} / ${practice.originalCount}</span><div class="progress-track"><i style="width:${practice.turnSuccess/10*100}%"></i></div></div><article class="practice-card panel"><div class="practice-question-label"><span>${audio?'英文听写':zh?'看英文 · 写中文':'看中文 · 写英文'}</span><span>${practice.deferred.length?`下轮补练 ${practice.deferred.length} 词`:``}</span></div>${audio?'<button class="audio-play" id="practice-speak" aria-label="播放英文发音">▷ <span>点击播放 · 可重复听</span></button>':`<div class="practice-prompt ${zh?'english':'meaning'}">${esc(zh?w.word:w.meaning)}</div>`}${immediate?`<div class="immediate-retry-note">立即重记 · 不计本轮成功，下一轮再考</div><details class="immediate-reference" open><summary>参考答案（点击收起）</summary><div class="english">${esc(w.word)}</div><div class="meaning">${esc(w.meaning)}</div></details>`:''}<form id="practice-form"><label for="practice-answer" class="word-meta">${zh?'输入你记得的中文释义':'输入英文单词或短语'}</label><input id="practice-answer" class="practice-answer" placeholder="${zh?'写下中文释义…':'Type your answer…'}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" ${zh?'':'lang="en"'}><div class="practice-submit"><span class="word-meta">Enter 提交 / 下一词</span><button type="submit" class="primary">提交 / 查看答案 <kbd>Enter</kbd></button></div></form><div id="practice-feedback" aria-live="polite" hidden></div><div class="practice-navigation"><button class="quiet" id="practice-prev" ${practice.attempts.length?'':'disabled'}>← 上一词 <kbd>Tab</kbd></button><button class="quiet" id="practice-skip" title="${immediate?'本次只结束立即重记，不计成功；下轮仍会再考':'直接记为已掌握，计入本轮成功数，不加入错词补练'}">${immediate?'结束重记（不计成功）':'跳过（计为已掌握）'} <kbd>Shift+Enter</kbd></button></div></article>`;
 $('#practice-prev').onclick=previousPractice;$('#practice-skip').onclick=()=>gradePractice('known',true);
 $('#practice-form').onsubmit=e=>{e.preventDefault();checkPractice()};if(audio)$('#practice-speak').onclick=speakPractice;
 practiceAnimate();$('#practice-answer').focus({preventScroll:true});
}
function normalizeSpelling(s){return s.normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'").trim().replace(/\s+/g,' ')}
function checkPractice(){
 if(practice.checked||practice.busy)return;practice.checked=true;
 const {w,type}=practice.queue[practice.index],answer=$('#practice-answer').value.trim(),needsChinese=type==='en',correct=!needsChinese&&normalizeSpelling(answer)===normalizeSpelling(w.word);
 $('#practice-answer').readOnly=true;$('#practice-form button[type=submit]').hidden=true;
 const feedback=$('#practice-feedback');feedback.hidden=false;
 feedback.innerHTML=`<div class="practice-verdict ${correct?'correct':''}">${needsChinese?'对照参考释义，自评是否掌握':correct?'✓ 拼写正确':answer?'再对照一下英文拼写':'先看看答案，再巩固一次'}</div><div class="practice-reference"><div class="english">${esc(w.word)}</div><div class="pos">${esc(w.pos)}</div><div class="meaning">${esc(w.meaning)}</div></div><div class="practice-grades"><button class="quiet" data-practice-grade="again">再记一次 <kbd>～${!needsChinese&&!correct?' / Enter':''}</kbd></button><button class="primary" data-practice-grade="known">${practice.retryIndex===practice.index?'重记完成，下一词':correct?'记住了，下一题':'我已掌握，下一题'} ${needsChinese||correct?'<kbd>Enter</kbd>':''}</button></div>`;
 feedback.querySelectorAll('[data-practice-grade]').forEach(b=>b.onclick=()=>gradePractice(b.dataset.practiceGrade));
 if(motionOK())feedback.animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:300,easing:'ease-out'});
 feedback.querySelector(`[data-practice-grade="${correct?'known':'again'}"]`).focus({preventScroll:true});
}
async function gradePractice(result,skipped=false){
 if(practice.busy||(!practice.checked&&!skipped))return;practice.busy=true;
 const item=practice.queue[practice.index];const buttons=$('#practice-stage').querySelectorAll('button');buttons.forEach(b=>b.disabled=true);
 try{
  await api('/api/review',{word:item.w.word,day:localDate(),direction:item.type==='audio'?'listening':item.type==='en'?'dictation_zh':'dictation_en',result:practice.retryIndex===practice.index?'again':result});
  const outcome=settlePractice(practice,result,{answer:$('#practice-answer').value,skipped});savePracticeSession();window.speechSynthesis?.cancel();showPractice();if(outcome.celebrate)celebrateTurn(outcome.completedTurn);
 }catch(e){toast('学习记录保存失败：'+e.message);buttons.forEach(b=>b.disabled=false)}finally{practice.busy=false}
}
function previousPractice(){
 if(practice.busy)return;undoCompletionFlow();const attempt=rewindPractice(practice);if(!attempt)return;
 window.speechSynthesis?.cancel();document.querySelector('.celebration')?.remove();savePracticeSession();showPractice();$('#practice-answer').value=attempt.answer||'';
}
function celebrateTurn(turn){
 document.querySelector('.celebration')?.remove();const layer=document.createElement('div');layer.className='celebration';layer.setAttribute('role','status');layer.innerHTML=`<div class="celebration-label">第 ${turn} 轮完成 <strong>10 词已掌握</strong></div>`;document.body.append(layer);
 if(motionOK()){
  const colors=['#b9f3ce','#e7c887','#a5c8f5','#ecaeb8'];
  for(let i=0;i<70;i++){const piece=document.createElement('i');piece.className='confetti';piece.style.background=colors[i%colors.length];piece.style.left=(i%2?'82%':'18%');layer.append(piece);const sign=i%2?-1:1;piece.animate([{transform:'translate(0,0) rotate(0deg)',opacity:0},{offset:.1,opacity:1},{transform:`translate(${sign*(Math.random()*400+60)}px,${-Math.random()*250-180}px) rotate(${Math.random()*700}deg)`,offset:.55,opacity:1},{transform:`translate(${sign*(Math.random()*500+80)}px,${Math.random()*200+250}px) rotate(${Math.random()*1200}deg)`,opacity:0}],{duration:1600+Math.random()*600,delay:Math.random()*180,easing:'cubic-bezier(.2,.6,.6,1)'})}
 }
 setTimeout(()=>layer.remove(),2600);
}
async function startPractice(){return openPracticePicker()}
$('#practice-start').onclick=startPractice;
document.querySelectorAll('[data-practice-mode]').forEach(b=>b.onclick=()=>{practice.mode=b.dataset.practiceMode;document.querySelectorAll('[data-practice-mode]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)))});

function savePracticeSession(){try{sessionStorage.setItem('word-journal-session',JSON.stringify({queue:practice.queue,index:practice.index,known:practice.known,again:practice.again,date:practice.date,mode:practice.mode,turn:practice.turn,turnSuccess:practice.turnSuccess,deferred:practice.deferred,attempts:practice.attempts,celebratedTurns:practice.celebratedTurns,originalCount:practice.originalCount,retryIndex:practice.retryIndex,sessionId:practice.sessionId,completedAt:practice.completedAt}))}catch(e){/* Learning results are still saved in SQLite. */}}
try{
 const saved=JSON.parse(sessionStorage.getItem('word-journal-session')||'null');
 if(saved&&Array.isArray(saved.queue)&&saved.queue.length&&Number.isInteger(saved.index)&&saved.index>=0&&saved.index<=saved.queue.length&&saved.queue.every(x=>x.w&&typeof x.w.word==='string'&&typeof x.w.meaning==='string'&&['en','zh','audio'].includes(x.type))){
 Object.assign(practice,newPracticeRun(saved.queue),saved,{checked:false,busy:false});if(!saved.attempts){practice.attempts=[];practice.turn=Math.floor(practice.known/10)+1;practice.turnSuccess=practice.known%10;practice.originalCount=saved.queue.length}$('#practice-date').value=practice.date;
 document.querySelectorAll('[data-practice-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.practiceMode===practice.mode)));
 showPractice();
 }
}catch(e){sessionStorage.removeItem('word-journal-session')}
function routeFromLocation(){return Object.keys(routes).find(name=>routes[name]===location.pathname)||'study'}
window.addEventListener('popstate',()=>page(routeFromLocation(),{fromHistory:true}).catch(e=>toast(e.message)));
page(routeFromLocation(),{fromHistory:true}).finally(()=>delete document.documentElement.dataset.booting);

initPracticeFlow();

// Practice shortcuts run before form submission and focused-button activation.
let practiceComposing=false;
document.addEventListener('compositionstart',()=>practiceComposing=true);
document.addEventListener('compositionend',()=>practiceComposing=false);
document.addEventListener('keydown',e=>{
 if(document.documentElement.dataset.current!=='practice-session'||document.querySelector('dialog[open]')||e.isComposing||practiceComposing||e.keyCode===229||e.ctrlKey||e.metaKey||e.altKey)return;
 const previous=e.key==='Tab'&&!e.shiftKey;
 const again=e.key==='~'||e.key==='～'||e.code==='Backquote';
 const skip=e.key==='Enter'&&e.shiftKey;
 const next=e.key==='Enter'&&!e.shiftKey;
 if(!previous&&!again&&!next&&!skip)return;
 // Navigation and theme controls retain their normal Enter behavior.
 if(next&&e.target.closest('button')&&!e.target.closest('#practice-stage'))return;
 if(!practice.queue[practice.index]&&!previous)return;
 e.preventDefault();e.stopImmediatePropagation();
 if(e.repeat||practice.busy)return;
 if(previous){previousPractice();return}
 if(skip){gradePractice('known',true);return}
 if(again){if(!practice.checked)checkPractice();gradePractice('again');return}
 if(!practice.checked){checkPractice();return}
 const item=practice.queue[practice.index];
 const correct=item.type==='en'||normalizeSpelling($('#practice-answer').value)===normalizeSpelling(item.w.word);
 gradePractice(correct?'known':'again');
},true);

initDailyBrowser();
