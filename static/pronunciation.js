// Dictionary recordings first; system speech remains available for missing/offline entries.
const pronunciation=(()=>{
 const cache=new Map();let generation=0,player=null,cleanup=()=>{};
 function stop(){generation++;if(player){player.pause();player.removeAttribute('src');player.load();player=null}window.speechSynthesis?.cancel();cleanup();cleanup=()=>{}}
 async function lookup(word){
  if(cache.has(word))return cache.get(word);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
  try{
   const response=await fetch('/api/pronunciation?word='+encodeURIComponent(word),{signal:controller.signal});
   if(!response.ok)return [];
   const clips=(await response.json()).filter(p=>(p.audio||'').startsWith('/api/pronunciation/audio?'));
   clips.sort((a,b)=>Number(/-us[.]/.test(b.audio))-Number(/-us[.]/.test(a.audio)));cache.set(word,clips);return clips;
  }catch{return []}finally{clearTimeout(timer)}
 }
 function source(button,clip){
  const host=button?.closest('.daily-english,.review-pronunciation,.practice-reference,.immediate-reference,.practice-card');if(!host)return;
  host.querySelector('.pronunciation-source')?.remove();const label=document.createElement('div');label.className='pronunciation-source';
  const safeLink=(text,url)=>{if(!/^https:\/\//.test(url||''))return;const a=document.createElement('a');a.textContent=text;a.href=url;a.target='_blank';a.rel='noopener noreferrer';label.append(a)};
  if(clip){safeLink('词典录音',clip.sourceUrl||'https://dictionaryapi.dev/');if(clip.license){label.append(' · ');safeLink(clip.license.name,clip.license.url)}}else label.textContent='系统朗读';host.append(label);
 }
 async function play(word,button){
  stop();const token=generation;const original=button?.getAttribute('aria-label');
  cleanup=()=>{button?.classList.remove('is-speaking','is-loading');if(button)button.setAttribute('aria-label',original||'播放英文发音')};
  const status=text=>{if(button)button.setAttribute('aria-label',text)};
  button?.classList.add('is-loading');status('正在加载词典发音');
  // Create the media element during the user gesture for mobile browsers.
  const audio=new Audio();audio.preload='auto';player=audio;
  const clips=await lookup(word);if(token!==generation)return;
  button?.classList.remove('is-loading');button?.classList.add('is-speaking');status('正在播放，点击重播');
  for(const clip of clips){
   if(token!==generation)return;audio.src=clip.audio;source(button,clip);
   try{
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Audio timeout')),7000);audio.onplaying=()=>clearTimeout(timer);audio.onended=()=>{clearTimeout(timer);resolve()};audio.onerror=()=>{clearTimeout(timer);reject(new Error('Audio unavailable'))};audio.play().catch(e=>{clearTimeout(timer);reject(e)})});
    if(token===generation)cleanup();return;
   }catch(e){audio.pause();if(e.name==='NotAllowedError'){if(token===generation){cleanup();toast('录音已就绪，请再点一次播放')}return}}
  }
  if(token!==generation)return;
  source(button,null);
  if(!('speechSynthesis' in window)||!('SpeechSynthesisUtterance' in window)){cleanup();toast('词典录音暂不可用，请稍后重试');return}
  const u=new SpeechSynthesisUtterance(word);u.lang='en-US';u.rate=.85;const voices=speechSynthesis.getVoices(),voice=voices.find(v=>v.lang==='en-US')||voices.find(v=>v.lang.startsWith('en'));if(voice)u.voice=voice;
  u.onend=()=>{if(token===generation)cleanup()};u.onerror=e=>{if(token!==generation)return;cleanup();if(!['canceled','interrupted'].includes(e.error))toast('发音暂不可用，请检查网络或系统英文语音')};speechSynthesis.speak(u);
 }
 return {play,stop};
})();
