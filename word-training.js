// Training state travels with the existing, edition-isolated English snapshot.
(() => {
  const view = document.querySelector('#englishView');
  const root = document.createElement('section');
  root.id = 'wordTraining';
  root.setAttribute('aria-label', '背词练习');
  view.append(root);
  const preference = appStorageKey('dusk-word-training-layout-v1');
  let enabled = localStorage.getItem(preference) !== 'reference';
  let timer, browsing = null, revealed = false, gradedAt=0;
  let sceneTimer, sceneKey, sceneRequest=0, sceneElement;
  const scenePane=view.closest('.atelier-main-content');
  let paneWasInert=false;
  DuskMedia.prepare('assets/dusk-sword.webp');
  function layoutScene() {
    if(!sceneElement)return;
    const mobile=matchMedia('(max-width:760px)').matches;
    const rect=scenePane.getBoundingClientRect();
    const top=mobile?document.querySelector('.atelier-bar').getBoundingClientRect().bottom:Math.max(0,rect.top);
    const bottom=mobile?document.querySelector('.atelier-nav').getBoundingClientRect().top:Math.min(innerHeight,rect.bottom);
    const left=mobile?0:Math.max(0,rect.left),right=mobile?innerWidth:Math.min(innerWidth,rect.right);
    const width=Math.max(0,right-left),height=Math.max(0,bottom-top),compact=height<320;
    Object.assign(sceneElement.style,{left:left+'px',top:top+'px',width:width+'px',height:height+'px'});
    sceneElement.style.setProperty('--scene-art-size',Math.max(0,Math.min(width-24,height-(compact?100:150)))+'px');
    sceneElement.classList.toggle('training-scene-compact',compact);
  }
  function endScene() {
    clearTimeout(sceneTimer);sceneRequest++;
    sceneKey=null;
    if(sceneElement){sceneElement.remove();sceneElement=null;scenePane.classList.remove('training-pane-hidden');scenePane.inert=paneWasInert;}
  }
  async function startScene(serial,kind='anger') {
    if (document.hidden || currentViewId()!=='englishView') return;
    clearTimeout(timer);
    const request=++sceneRequest;
    sceneKey=`${englishStart}:${englishDayIndex()}:${serial}:${englishProgress.trainingV1.feedback.id}`;
    const image=await DuskMedia.scene(kind);
    if(request!==sceneRequest)return;
    if(!image||document.hidden||currentViewId()!=='englishView'||document.querySelector('dialog[open]')){endScene();resumeTimer();return;}
    sceneElement=document.createElement('section');sceneElement.className='training-scene';sceneElement.setAttribute('aria-label','夕的错答提醒');
    sceneElement.dataset.kind=kind;sceneElement.setAttribute('aria-label',kind==='anger'?'夕的错答提醒':'夕的夸奖');
    sceneElement.innerHTML=`<button type="button" class="training-scene-skip" title="跳过动作，查看答案" aria-label="跳过动作，查看答案">${icon('skip-forward')}</button><div class="training-scene-art"></div><p class="training-scene-name">夕</p><p class="training-scene-line" role="status">${DuskMedia.line(kind)}</p>`;
    image.alt=kind==='anger'?'夕的错答提醒':'夕的夸奖';sceneElement.querySelector('.training-scene-art').append(image);
    document.body.append(sceneElement);layoutScene();
    paneWasInert=scenePane.inert;scenePane.inert=true;scenePane.classList.add('training-pane-hidden');
    const skip=sceneElement.querySelector('.training-scene-skip');
    const finish=()=>{endScene();if(!document.querySelector('dialog[open]'))root.querySelector('[data-training="continue"]')?.focus({preventScroll:true});resumeTimer();};
    skip.onclick=finish;skip.focus({preventScroll:true});refreshIcons();
    sceneTimer=setTimeout(finish,kind==='praise'?2000:1000);
  }
  new ResizeObserver(layoutScene).observe(scenePane);
  window.addEventListener('resize',layoutScene);
  window.addEventListener('scroll',layoutScene,true);
  window.addEventListener('pointermove',layoutScene,{passive:true});
  const esc = escapeHtml;
  const icon = name => `<i data-lucide="${name}"></i>`;
  const button = (action, name, label, disabled = false) => `<button type="button" data-training="${action}" title="${label}" aria-label="${label}" ${disabled ? 'disabled' : ''}>${icon(name)}</button>`;
  const clone = value => structuredClone(value);
  function lookup(id) {
    const day = Number(String(id).split('-')[0]);
    return englishLessons[day] && wordsFromLesson(englishLessons[day], day).find(w => w.id === id);
  }
  function valid(s, nested=false) {
    const options=a=>Array.isArray(a)&&a.length<=4&&a.every(o=>o&&typeof o.meaning==='string'&&o.meaning.length<=300&&typeof o.correct==='boolean'&&lookup(o.forId));
    const items=a=>Array.isArray(a)&&a.length<=800&&a.every(x=>x&&typeof x.id==='string'&&lookup(x.id)&&(x.selectedMeaning===undefined||(typeof x.selectedMeaning==='string'&&x.selectedMeaning.length<=300))&&(x.answerOptions===undefined||options(x.answerOptions)));
    return !!s && s.version===1 && typeof s.key==='string' && s.key.length<100 && ['new','review'].includes(s.track)
      && ['choice','recall'].includes(s.mode) && typeof s.auto==='boolean' && Number.isInteger(s.serial) && s.serial>=0 && s.serial<=10000
      && items(s.queues?.new) && items(s.queues?.review) && items(s.events) && items(s.retries)
      && s.retries.every(x=>Number.isInteger(x.after)&&['new','review'].includes(x.track))
      && (!s.feedback || (items([s.feedback])&&['new','review'].includes(s.feedback.track)&&typeof s.feedback.success==='boolean'))
      && options(s.options)
      && Array.isArray(s.undo) && s.undo.length<=(nested?0:5) && s.undo.every(u=>u&&lookup(u.id)&&u.marks&&valid(u.previous,true));
  }
  window.validateWordTrainingState=valid;
  function state() {
    const key = `${englishStart}:${englishDayIndex()}`;
    let s = englishProgress.trainingV1;
    if (!valid(s) || s.key !== key) {
      // Old completion marks stay completion marks, not manufactured quiz results.
      s = englishProgress.trainingV1 = {version:1, key, track:'new', mode:s?.mode || 'choice', auto:s?.auto !== false,
        queues:{new:lessonForToday().words.filter(w => !wordHandled(w)).map(w => ({id:w.id})),
          review:pendingReviewWords().map(w => ({id:w.id}))}, events:[], retries:[], serial:0, feedback:null, hint:false, options:[], undo:[]};
      browsing = null; revealed = false;
    }
    for (const track of ['new','review']) {
      // Skip marks made in list mode or another device, but retain this answer's feedback.
      s.queues[track] = s.queues[track].filter(item => lookup(item.id) && (item.retry || !wordHandled(lookup(item.id)) || s.feedback?.id === item.id));
    }
    return s;
  }
  function history(s) { return s.events.filter(e => e.track === s.track); }
  function current(s) { return browsing !== null ? history(s)[browsing] : s.feedback || s.queues[s.track][0]; }
  function shuffle(items) {
    for (let i=items.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [items[i],items[j]]=[items[j],items[i]]; }
    return items;
  }
  function choices(s,w) {
    if (s.options[0]?.forId === w.id) return s.options;
    const pool = englishLessons.flatMap((lesson,day) => wordsFromLesson(lesson,day));
    const meanings = new Set([w.meaning]);
    const candidates = shuffle(pool.filter(x => x.word !== w.word && x.pos === w.pos));
    const options = [{meaning:w.meaning,correct:true,forId:w.id}];
    for (const x of candidates) {
      if (meanings.has(x.meaning)) continue;
      meanings.add(x.meaning); options.push({meaning:x.meaning,correct:false,forId:w.id});
      if (options.length===4) break;
    }
    s.options = shuffle(options); saveEnglish();
    return s.options;
  }
  function refresh() { renderEnglish(); renderTasks(); }
  function advance() {
    clearTimeout(timer);
    const s=state();
    if (!s.feedback || browsing !== null) return;
    s.queues[s.track].shift(); s.feedback=null; s.hint=false; s.options=[]; revealed=false;
    const due=s.retries.find(r => r.track===s.track && !r.queued && s.serial>=r.after);
    if (due) { s.queues[s.track].unshift({id:due.id,retry:true}); due.queued=true; }
    saveEnglish(); refresh();
  }
  function resumeTimer() {
    clearTimeout(timer);
    if (!enabled || sceneKey || currentViewId()!=='englishView') return;
    const s=state();
    if (enabled && browsing===null && s.feedback?.success && s.auto && !document.hidden && !document.querySelector('dialog[open]') && currentViewId()==='englishView') {
      const key=s.key, id=s.feedback.id;
      timer=setTimeout(() => {
        const live=state();
        if (enabled && live.key===key && live.feedback?.id===id && browsing===null && !document.hidden && !document.querySelector('dialog[open]') && currentViewId()==='englishView') advance();
      },800);
    }
  }
  function grade(raw, selectedMeaning) {
    const s=state(), item=s.queues[s.track][0];
    if (!item || s.feedback || browsing!==null) return;
    const previous = clone({...s,undo:[]});
    const marks = {remembered:englishProgress.remembered?.[item.id], forgotten:englishProgress.forgotten?.[item.id]};
    const success=raw && !s.hint;
    s.serial++;
    if (!item.retry) {
      englishProgress.remembered ||= {}; englishProgress.forgotten ||= {};
      if (success) { englishProgress.remembered[item.id]=englishDayIndex(); delete englishProgress.forgotten[item.id]; }
      else { englishProgress.forgotten[item.id]=englishDayIndex(); delete englishProgress.remembered[item.id]; }
    }
    if (!success && !item.retry && !s.retries.some(r => r.id===item.id)) s.retries.push({id:item.id,track:s.track,after:s.serial+3,queued:false});
    s.feedback={...item,raw,success,help:s.hint,track:s.track};
    if (typeof selectedMeaning==='string') {s.feedback.selectedMeaning=selectedMeaning;s.feedback.answerOptions=clone(s.options);}
    s.events.push(clone(s.feedback));
    s.undo.push({previous,marks,id:item.id}); s.undo=s.undo.slice(-5);
    // A successful in-session retry intentionally leaves tomorrow's forgotten mark intact.
    try { saveEnglish(); }
    catch (error) {
      englishProgress.trainingV1=previous;
      for (const k of ['remembered','forgotten']) { englishProgress[k] ||= {}; if (marks[k]===undefined) delete englishProgress[k][item.id]; else englishProgress[k][item.id]=marks[k]; }
      showActionToast('未能保存，请保留页面并导出备份'); render(); return;
    }
    gradedAt=performance.now();revealed=true; refresh();
    if (raw===false && typeof selectedMeaning==='string') startScene(s.serial);
    else if(success&&typeof selectedMeaning==='string'&&DuskMedia.drawPraise())startScene(s.serial,'praise');
  }
  function render() {
    // A queued view observer may render again after grading; keep this one-shot scene alive.
    if (sceneKey && enabled && currentViewId()==='englishView' && sceneKey===`${englishStart}:${englishDayIndex()}:${englishProgress.trainingV1?.serial}:${englishProgress.trainingV1?.feedback?.id}`) return;
    endScene();
    clearTimeout(timer);
    view.dataset.training=String(enabled); root.hidden=!enabled;
    view.querySelector('[data-word-layout="training"]').setAttribute('aria-pressed',String(enabled));
    if (!enabled || !days.length || currentViewId()!=='englishView') return;
    view.querySelectorAll('[data-word-layout="focus"],[data-word-layout="list"]').forEach(b => b.setAttribute('aria-pressed','false'));
    const s=state(), item=current(s), w=item && lookup(item.id), historical=browsing!==null;
    const feedback=historical ? item : s.feedback;
    const remaining=s.queues[s.track].filter(x=>!x.retry && x.id!==s.feedback?.id).length;
    const done=s.events.filter(e=>e.track===s.track&&!e.retry).length;
    const heading=`<header class="training-head"><div class="training-tabs"><button type="button" data-training="new" aria-pressed="${s.track==='new'}">新词</button><button type="button" data-training="review" aria-pressed="${s.track==='review'}">复习 <small>${pendingReviewWords().length}</small></button></div><span>${historical?'已答记录':item?.retry?'错词再练':`已处理 ${done} · 剩余 ${remaining}`}</span>${button('settings','sliders-horizontal','练习设置')}</header>`;
    if (!w) {
      root.innerHTML=heading+`<div class="training-complete"><i data-lucide="circle-check"></i><h3>${s.track==='new'?'今日新词已完成':'今日复习已完成'}</h3><p>${s.retries.some(r=>!r.queued)?'错词已安排明天加练，不占新词额度。':'今天的努力，已经收进手账。'}</p>${s.track==='new'?completionQuoteHtml(lessonForToday()):''}<button type="button" data-training="${s.track==='new'?'review':'new'}">${s.track==='new'?'去复习':'看新词'}</button>${button('previous','chevron-left','上一个单词',!history(s).length)}${button('undo','undo-2','撤销上一次作答',!s.undo.length)}</div>`;
      refreshIcons(); return;
    }
    const explanation=feedback || revealed || (s.mode==='recall' && s.hint);
    let answers='';
    if (!feedback) {
      if (s.mode==='choice') answers=`<div class="training-options">${choices(s,w).map((o,i)=>`<button type="button" data-training="answer" data-option="${i}"><small>${'ABCD'[i]}</small><span>${esc(o.meaning)}</span></button>`).join('')}</div><button type="button" class="training-unknown" data-training="unknown">不认识，看看解释</button>`;
      else answers=explanation?'<div class="training-self"><button type="button" data-training="unknown">没想起 / 不确定</button><button type="button" data-training="recalled">刚才想起来了</button></div>':'<button type="button" data-training="reveal">看看答案</button>';
    }
    const compare=feedback && typeof feedback.selectedMeaning==='string';
    if (compare) {
      const wrong=feedback.selectedMeaning!==w.meaning;
      const saved=feedback.answerOptions||(!historical&&s.options[0]?.forId===w.id?s.options:null);
      const options=Array.isArray(saved)&&saved.length<=4&&saved.every(o=>o&&typeof o.meaning==='string'&&o.meaning.length<=300&&typeof o.correct==='boolean')?saved:[{meaning:w.meaning,correct:true},...(wrong?[{meaning:feedback.selectedMeaning,correct:false}]:[])];
      answers=`<div class="training-options training-comparison">${options.map((o,i)=>{
        const selected=o.meaning===feedback.selectedMeaning,visible=selected||o.correct;
        return `<button type="button" class="${visible?o.correct?'training-right':'training-wrong':'training-slot-hidden'}" ${selected&&!historical?'data-training="continue" title="看懂了，继续"':'disabled'} ${visible?'':'aria-hidden="true"'}><small>${'ABCD'[i]}</small><span>${esc(o.meaning)}</span><small class="training-result">${visible?icon(o.correct?'check':'x')+(o.correct?'正确':'你选的'):''}</small>${selected&&!historical?`<span class="training-inline-continue">继续 ${icon('arrow-right')}</span>`:''}</button>`;
      }).join('')}</div>`;
    }
    const status=feedback ? historical ? '已答记录 · 浏览不改进度' : feedback.success ? item.retry?'再练答对 · 明天仍会复习':'答对了' : feedback.help?'已看提示 · 明天加练':'没关系，明天加练' : '选出正确释义';
    root.innerHTML=heading+`<article class="training-card" data-pos="${esc(w.pos)}"><div class="training-word-row"><h3>${esc(w.word)}</h3><button type="button" data-pronounce-word="${esc(w.word)}" title="播放英式发音" aria-label="播放英式发音">${icon('volume-2')}</button></div><p class="training-ipa">${esc(w.phonetic||'')}</p><div class="training-prompt" role="status">${status}</div>${compare?answers:''}${explanation?`<div class="training-explanation">${compare?'':`<p><small>${esc(w.pos)}</small> ${esc(w.meaning)}</p>`}<p lang="en">${esc(exampleForWord(w))}</p></div>`:''}${compare?'':answers}</article><footer class="training-footer"><div>${button('previous','chevron-left','上一个单词',historical?browsing===0:!history(s).length)}${button('next','chevron-right',feedback?'下一个单词':'请先作答，再看下一个',!feedback)}<button type="button" data-training="details">词条 ${icon('book-open')}</button>${button('undo','undo-2','撤销上一次作答',!s.undo.length)}</div>${feedback&&!historical?`<button type="button" class="training-continue" data-training="continue">${feedback.success&&s.auto?'0.8 秒后继续':'看懂了，继续'} ${icon('arrow-right')}</button>`:historical?'<button type="button" data-training="return">回到当前单词</button>':''}</footer>`;
    refreshIcons(); resumeTimer();
  }
  function showDetails(s,w) {
    if (browsing===null && !s.feedback) { s.hint=true; saveEnglish(); }
    clearTimeout(timer);
    const term=encodeURIComponent(w.word);
    document.querySelector('#wordDetailBody').innerHTML=`<p class="dictionary-term">${esc(w.word)}</p><p>${esc(w.phonetic||'')} · ${esc(w.pos)}</p><p>${esc(w.meaning)}</p><p>${esc(exampleForWord(w))}</p><div class="dictionary-links"><a href="https://youdao.com/result?lang=en&word=${term}" target="_blank" rel="noopener noreferrer">有道详细释义</a><a href="https://dictionary.cambridge.org/dictionary/english/${term}" target="_blank" rel="noopener noreferrer">剑桥词典</a></div><button type="button" id="trainingReturn">回到背词</button>`;
    document.querySelector('#trainingReturn').onclick=closeQuickDialog;
    openQuickDialog('wordDetailDialog');
  }
  root.addEventListener('click',event => {
    const b=event.target.closest('[data-training]'); if (!b || b.disabled) return;
    const s=state(), action=b.dataset.training, item=current(s), w=item&&lookup(item.id);
    if(action==='continue'&&b.closest('.training-options')&&(event.detail>1||performance.now()-gradedAt<250))return;
    clearTimeout(timer);
    if (action==='answer') {const option=s.options[Number(b.dataset.option)];if(option)return grade(option.correct===true,option.meaning);return;}
    if (action==='unknown') return grade(false);
    if (action==='recalled') return grade(true);
    if (action==='reveal') { revealed=true; render(); return; }
    if (action==='continue') return advance();
    if (action==='details' && w) return showDetails(s,w);
    if (action==='new'||action==='review') { s.track=action; s.options=[]; s.hint=false; browsing=null; revealed=false;
      // Feedback belongs to its original track; finish moving its queue before switching.
      if (s.feedback && s.feedback.track!==action) { s.queues[s.feedback.track].shift(); s.feedback=null; }
      saveEnglish(); }
    if (action==='previous') { const list=history(s); browsing=browsing===null?Math.max(0,list.length-(s.feedback?2:1)):Math.max(0,browsing-1); }
    if (action==='next') { if(browsing!==null){browsing++;if(browsing>=history(s).length-(s.feedback?1:0))browsing=null;}else return advance(); }
    if (action==='return') browsing=null;
    if (action==='undo') {
      const entry=s.undo.pop(); if(!entry)return;
      const rest=s.undo; englishProgress.trainingV1={...entry.previous,undo:rest};
      for(const k of ['remembered','forgotten']) { englishProgress[k] ||= {}; if(entry.marks[k]===undefined)delete englishProgress[k][entry.id]; else englishProgress[k][entry.id]=entry.marks[k]; }
      browsing=null; revealed=false; saveEnglish(); refresh(); return;
    }
    if (action==='settings') {
      document.querySelector('#trainingMode').value=s.mode; document.querySelector('#trainingAuto').checked=s.auto;
      openQuickDialog('trainingSettings'); return;
    }
    render();
  });
  document.body.insertAdjacentHTML('beforeend',`<dialog class="quick-dialog" id="trainingSettings"><header><h2>练习设置</h2><button type="button" id="trainingSettingsClose" aria-label="关闭">${icon('x')}</button></header><form class="quick-form" id="trainingSettingsForm"><label>练习方式<select id="trainingMode"><option value="choice">选义练习</option><option value="recall">回想自评</option></select></label><label><input type="checkbox" id="trainingAuto">答对后 0.8 秒自动继续</label><button type="submit">保存</button></form></dialog>`);
  document.querySelector('#trainingSettingsClose').onclick=closeQuickDialog;
  document.querySelector('#trainingSettings').addEventListener('cancel',e=>{e.preventDefault();closeQuickDialog();});
  document.querySelector('#trainingSettingsForm').onsubmit=e=>{e.preventDefault();const s=state();s.mode=document.querySelector('#trainingMode').value;s.auto=document.querySelector('#trainingAuto').checked;saveEnglish();closeQuickDialog();render();};
  const toggle=document.createElement('button'); toggle.type='button';toggle.dataset.wordLayout='training';toggle.title='选义背词';toggle.innerHTML=icon('book-open-check')+'背词';
  view.querySelector('.word-layout-switch').prepend(toggle);
  view.querySelectorAll('[data-word-layout]').forEach(b=>b.addEventListener('click',()=>{enabled=b.dataset.wordLayout==='training';browsing=null;localStorage.setItem(preference,enabled?'training':'reference');render();}));
  const base=renderEnglish; renderEnglish=function(){base();render();};
  document.addEventListener('visibilitychange',()=>{if(document.hidden)endScene();resumeTimer();});
  new MutationObserver(records=>{
    if(document.querySelector('dialog[open]'))endScene();
    if(records.some(r=>r.attributeName==='data-atelier-view'))render();
    else resumeTimer();
  }).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open','data-atelier-view']});
  render();
})();
