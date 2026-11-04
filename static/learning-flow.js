/* Daily practice plan, count picker and wall-clock rest timer. */
const flowDialog=document.getElementById('learning-dialog');
let pickerWords=[],pickerCount=0,wheelFrame=0,dialogVersion=0,readyShown=null;
function readLocal(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
let restState=readLocal('word-journal-rest',null);
function storeRest(){localStorage.setItem('word-journal-rest',JSON.stringify(restState))}
function yesterdayDate(){const d=new Date();d.setDate(d.getDate()-1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function dailyPlan(){const all=readLocal('word-journal-plan',{});return {all,day:all[localDate()]||{sessions:[]}}}
function planCounts(){const {day}=dailyPlan();return {today:day.sessions.filter(s=>s.source===localDate()).length,yesterday:day.sessions.filter(s=>s.source===yesterdayDate()).length}}
function nextPlanDate(){const c=planCounts();return c.today<2?localDate():c.yesterday<1?yesterdayDate():localDate()}
function renderDailyPlan(){const c=planCounts();const el=document.getElementById('daily-plan');if(!el)return;el.innerHTML=`<div><strong>每日计划</strong><span>今日词汇 2 遍 · 昨日词汇 1 遍</span></div><div class="plan-actions"><button class="quiet" data-plan-date="${localDate()}">今日 <b>${Math.min(c.today,2)} / 2</b> ↗</button><button class="quiet" data-plan-date="${yesterdayDate()}">昨日 <b>${Math.min(c.yesterday,1)} / 1</b> ↗</button></div>`;el.querySelectorAll('[data-plan-date]').forEach(b=>b.onclick=()=>{document.getElementById('practice-date').value=b.dataset.planDate;startPractice()})}
async function closeLearningDialog(){const version=++dialogVersion;if(!flowDialog.open)return;if(motionOK())await flowDialog.animate([{opacity:1,transform:'translateY(0) scale(1)'},{opacity:0,transform:'translateY(12px) scale(.99)'}],{duration:160,easing:'ease-in'}).finished.catch(()=>{});if(version===dialogVersion)flowDialog.close()}
function openLearningDialog(html,kind){++dialogVersion;flowDialog.getAnimations().forEach(a=>a.cancel());flowDialog.dataset.kind=kind;flowDialog.innerHTML=`<button class="dialog-close" id="dialog-close" aria-label="关闭窗口">×</button>${html}`;if(!flowDialog.open)flowDialog.showModal();document.getElementById('dialog-close').onclick=()=>closeLearningDialog();if(motionOK())flowDialog.animate([{opacity:0,transform:'translateY(24px) scale(.975)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:420,easing:'cubic-bezier(.22,1,.36,1)'})}
async function openPracticePicker(){
 if(practice.busy)return;practice.busy=true;document.getElementById('practice-start').disabled=true;
 try{
 const selected=document.getElementById('practice-date').value;if(!selected)throw Error('请选择词汇日期');
 const state=await api('/api/state?today='+encodeURIComponent(selected));pickerWords=state.entries.map(id=>state.words.find(w=>w.word===id)).filter(Boolean);
 if(!pickerWords.length){document.getElementById('practice-notice').hidden=false;document.getElementById('practice-notice').innerHTML='<b>这一天没有记录词汇</b>';await page('practice');return}
 if(practice.mode==='audio'&&!('speechSynthesis'in window))throw Error('当前浏览器不支持听写朗读');
 document.getElementById('practice-notice').hidden=true;
 const preferred=Number(localStorage.getItem('word-journal-count'))||20;pickerCount=Math.max(1,Math.min(pickerWords.length,preferred));
 const c=planCounts();openLearningDialog(`<div class="dialog-kicker">本次练习</div><h2 id="dialog-title">选择默写词数</h2><p class="dialog-meta">${esc(selected)} · 可选 ${pickerWords.length} 词</p><div class="wheel-wrap"><div class="wheel-highlight"></div><div id="word-count-wheel" class="count-wheel" role="listbox" tabindex="0" aria-label="默写词汇数">${pickerWords.map((_,i)=>`<div class="wheel-option" id="count-${i+1}" role="option" aria-selected="false" data-count="${i+1}">${i+1}<small>词</small></div>`).join('')}</div></div><p class="wheel-caption">滑动选择 · ↑ ↓ 调整</p><div class="dialog-plan"><span>今日词汇 <b>${Math.min(c.today,2)} / 2 遍</b></span><span>昨日复习 <b>${Math.min(c.yesterday,1)} / 1 遍</b></span></div><button class="primary dialog-primary" id="confirm-practice">开始 ${pickerCount} 词 →</button>`, 'picker');
 const wheel=document.getElementById('word-count-wheel');wheel.scrollTop=(pickerCount-1)*40;
 const update=()=>{const n=Math.max(1,Math.min(pickerWords.length,Math.round(wheel.scrollTop/40)+1));wheel.querySelector('[aria-selected=true]')?.setAttribute('aria-selected','false');document.getElementById('count-'+n)?.setAttribute('aria-selected','true');wheel.setAttribute('aria-activedescendant','count-'+n);pickerCount=n;document.getElementById('confirm-practice').textContent=`开始 ${n} 词 →`};
 update();wheel.onscroll=()=>{cancelAnimationFrame(wheelFrame);wheelFrame=requestAnimationFrame(update)};
 wheel.onclick=e=>{const n=e.target.closest('[data-count]')?.dataset.count;if(n)wheel.scrollTo({top:(Number(n)-1)*40,behavior:motionOK()?'smooth':'instant'})};
 wheel.onkeydown=e=>{let n=pickerCount;if(e.key==='ArrowDown')n++;else if(e.key==='ArrowUp')n--;else if(e.key==='PageDown')n+=10;else if(e.key==='PageUp')n-=10;else if(e.key==='Home')n=1;else if(e.key==='End')n=pickerWords.length;else return;e.preventDefault();wheel.scrollTo({top:(Math.max(1,Math.min(pickerWords.length,n))-1)*40,behavior:'instant'});update()};
 document.getElementById('confirm-practice').onclick=async()=>{
 if(practice.busy)return;practice.busy=true;document.getElementById('confirm-practice').disabled=true;
 try{update();localStorage.setItem('word-journal-count',String(pickerCount));if(restState){restState.status='dismissed';storeRest();updateRestUI()}
 Object.assign(practice,newPracticeRun(practiceQueue(shuffled(pickerWords).slice(0,pickerCount),practice.mode)),{date:selected,sessionId:crypto.randomUUID(),completedAt:null});savePracticeSession();await closeLearningDialog();await page('practice-session');showPractice();
 }catch(e){toast(e.message);document.getElementById('confirm-practice')?.removeAttribute('disabled')}finally{practice.busy=false}
 };wheel.focus({preventScroll:true});
 }catch(e){toast(e.message)}finally{practice.busy=false;document.getElementById('practice-start').disabled=false}
}
function completePracticeFlow(){
 if(!practice.queue.length)return;
 if(!practice.sessionId)practice.sessionId=crypto.randomUUID();
 if(!practice.completedAt){practice.completedAt=Date.now();const {all,day}=dailyPlan();day.sessions=day.sessions.filter(s=>s.id!==practice.sessionId);day.sessions.push({id:practice.sessionId,source:practice.date,count:practice.originalCount});all[localDate()]=day;localStorage.setItem('word-journal-plan',JSON.stringify(all));restState={id:practice.sessionId,endsAt:Date.now()+5*60*1000,status:'resting'};readyShown=null;storeRest();savePracticeSession();renderDailyPlan();showRestDialog(true)}
 updateRestUI();
}
function undoCompletionFlow(){
 if(!practice.completedAt)return;const all=readLocal('word-journal-plan',{});Object.values(all).forEach(day=>day.sessions=day.sessions.filter(s=>s.id!==practice.sessionId));localStorage.setItem('word-journal-plan',JSON.stringify(all));practice.completedAt=null;
 if(restState?.id===practice.sessionId){restState.status='dismissed';storeRest();closeLearningDialog();updateRestUI()}renderDailyPlan();
}
function formatRest(ms){const seconds=Math.max(0,Math.ceil(ms/1000));return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`}
function showRestDialog(congrats=false){
 if(!restState||restState.status!=='resting')return;
 openLearningDialog(`<div class="completion-mark">✓</div><h2 id="dialog-title">${congrats?'恭喜记忆完成！':'休息时间'}</h2><p class="dialog-meta">休息 5 分钟，再继续下一遍。</p><div class="rest-dial"><svg viewBox="0 0 160 160" aria-hidden="true"><circle class="rest-track" cx="80" cy="80" r="71"/><circle class="rest-ring" cx="80" cy="80" r="71"/></svg><span id="rest-time" role="timer"></span></div><p class="dialog-meta">倒计时已开始，可关闭窗口。</p><div class="rest-actions"><button class="quiet" id="rest-home">返回首页</button><button class="primary" id="rest-later">休息一下</button></div><button class="text-btn rest-skip" id="rest-skip">跳过休息，继续学习 →</button>`, 'rest');
 document.getElementById('rest-home').onclick=async()=>{await closeLearningDialog();await page('study')};document.getElementById('rest-later').onclick=()=>closeLearningDialog();document.getElementById('rest-skip').onclick=continueLearning;updateRestUI();
}
async function continueLearning(){if(restState){restState.status='dismissed';storeRest()}updateRestUI();await closeLearningDialog();document.getElementById('practice-date').value=nextPlanDate();await page('practice');await openPracticePicker()}
function showRestReady(){
 if(!restState||restState.status!=='ready'||flowDialog.open)return;readyShown=restState.id;
 const c=planCounts(),next=nextPlanDate();openLearningDialog(`<div class="completion-mark">↗</div><h2 id="dialog-title">休息结束，继续学习？</h2><p class="dialog-meta">${next===yesterdayDate()?'接下来复习一遍昨天的词汇。':c.today===1?'再记一遍今天的词汇，完成今日目标。':'可以开始下一次练习了。'}</p><div class="dialog-plan"><span>今日 <b>${Math.min(c.today,2)} / 2 遍</b></span><span>昨日 <b>${Math.min(c.yesterday,1)} / 1 遍</b></span></div><button class="primary dialog-primary" id="rest-continue">继续学习 →</button><button class="text-btn rest-skip" id="rest-dismiss">稍后再学</button>`, 'ready');
 document.getElementById('rest-continue').onclick=continueLearning;document.getElementById('rest-dismiss').onclick=()=>closeLearningDialog();
}
function updateRestUI(){
 const chip=document.getElementById('rest-chip');if(!chip)return;
 if(!restState||restState.status==='dismissed'){chip.hidden=true;return}
 const remaining=restState.endsAt-Date.now();if(remaining<=0&&restState.status==='resting'){restState.status='ready';storeRest()}
 chip.hidden=false;chip.textContent=restState.status==='ready'?'休息结束 · 继续学习 ↗':`休息中 ${formatRest(remaining)}`;
 if(flowDialog.open&&flowDialog.dataset.kind==='rest'){
 const time=document.getElementById('rest-time');if(time)time.textContent=formatRest(remaining);
 const ring=flowDialog.querySelector('.rest-ring');if(ring)ring.style.strokeDashoffset=String(446*(1-Math.max(0,Math.min(1,remaining/300000))));
 if(restState.status==='ready'){flowDialog.close();showRestReady()}
 }else if(restState.status==='ready'&&readyShown!==restState.id&&!flowDialog.open)showRestReady();
}
function initPracticeFlow(){
 renderDailyPlan();document.getElementById('rest-chip').onclick=()=>{if(restState?.status==='ready'){readyShown=null;showRestReady()}else showRestDialog()};
 flowDialog.addEventListener('cancel',e=>{e.preventDefault();closeLearningDialog()});flowDialog.addEventListener('close',()=>setTimeout(updateRestUI,0));
 updateRestUI();setInterval(updateRestUI,500);document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateRestUI()});window.addEventListener('storage',e=>{if(e.key==='word-journal-rest'){restState=readLocal(e.key,null);updateRestUI()}if(e.key==='word-journal-plan')renderDailyPlan()});
}
