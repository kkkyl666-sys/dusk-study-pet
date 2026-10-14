// Navigation is transient; queues and grades remain in the existing English snapshot.
(() => {
  if(!window.DuskTraining)return;
  const $=s=>document.querySelector(s),view=$('#englishView'),esc=escapeHtml,icon=n=>`<i data-lucide="${n}"></i>`;
  let stage='overview';
  const overview=document.createElement('section');overview.id='studyOverview';
  const bar=document.createElement('header');bar.id='studyFocusBar';
  view.prepend(bar);view.prepend(overview);
  document.body.insertAdjacentHTML('beforeend',`<dialog class="quick-dialog" id="studyToolsDialog"><header><h2>学习工具</h2><button type="button" data-study-close aria-label="关闭">${icon('x')}</button></header><div class="quick-form" id="studyToolsBody"></div></dialog>`);
  const practicing=()=>stage==='practice'&&currentViewId()==='englishView';
  window.DuskStudyUI={isPracticing:practicing,enter(track){stage='practice';if(track)DuskTraining.selectTrack(track);renderEnglish();},exit(){DuskTraining.pause();stage='overview';renderEnglish();}};
  const row=(action,label,value='',symbol='chevron-right')=>`<button type="button" data-study="${action}" class="study-tool-row">${icon(symbol)}<span>${label}</span><small>${esc(value)}</small></button>`;
  function tools(){DuskTraining.pause();const mode=view.dataset.training==='true'?'背词':view.dataset.wordLayout==='focus'?'一词':'列表';$('#studyToolsBody').innerHTML=`<p class="study-tool-label">随手记录</p>${row('add','记生词','','plus')}${row('notebook','生词本',dailyFlow.words.filter(w=>!w.deleted).length+'词','notebook-pen')}${row('extra','额外复习',$('#customDueCount').textContent+'词','book-open')}<p class="study-tool-label">学习安排</p>${row('quota','每日新词',StudyPlan.quota()+'词','list-ordered')}${row('modes','显示方式',mode,'panels-top-left')}${row('new','新词',lessonForToday().words.filter(w=>!wordHandled(w)).length+'词','book-open')}${row('review','复习',pendingReviewWords().length+'词','history')}${row('rewind',PET_APP.edition==='share'?'选择背词天数':'补学 / 回档','','calendar-days')}${row('settings','练习设置','','sliders-horizontal')}<p class="study-tool-label">资料</p>${row('export','导出今日单词','','download')}${row('backup','下载完整备份','','archive')}`;openQuickDialog('studyToolsDialog');refreshIcons();}
  function afterClose(fn){closeQuickDialog();if(history.state?.petDialog)window.addEventListener('popstate',fn,{once:true});else setTimeout(fn,0);}
  function reference(mode){stage='practice';view.querySelector(`[data-word-layout="${mode}"]`).click();renderEnglish();}
  function sync(){
    const focused=stage!=='overview'&&currentViewId()==='englishView';document.body.dataset.studyFocus=String(focused);view.dataset.studyStage=stage;
    if(!focused)DuskTraining.pause();
    const lesson=lessonForToday(),done=lesson.words.filter(wordHandled).length,review=pendingReviewWords().length;
    overview.innerHTML=`<div class="study-overview-head"><small>六级词汇 · 第${lesson.index+1}天</small><button type="button" data-study="tools">${icon('ellipsis')}学习工具</button></div><h2>一点一滴，也会成画。</h2><p class="study-overview-note">每日 ${StudyPlan.quota()} 词 · 凌晨4点换日</p><div class="study-overview-counts"><div><strong>${done} / ${lesson.words.length}</strong><small>今日新词已处理</small></div><div><strong>${review}</strong><small>待复习</small></div></div><button class="study-primary" type="button" data-study="start">${done<lesson.words.length?'继续学习':'看看今日复习'} ${icon('arrow-right')}</button><div class="study-overview-links">${row('review','今日复习',review+'词','history')}${row('notebook','生词本',dailyFlow.words.filter(w=>!w.deleted).length+'词','notebook-pen')}${row('add','记一个新词','','plus')}${row('quota','每日新词',StudyPlan.quota()+'词','list-ordered')}</div>`;
    const s=englishProgress.trainingV1;
    bar.innerHTML=`<button type="button" data-study="exit" aria-label="返回学习概览" title="返回学习概览">${icon('arrow-left')}</button><span>${stage==='notebook'?'生词本':view.dataset.training==='true'?`${s?.track==='review'?'复习':'新词'} · 已处理 ${s?.events?.filter(e=>e.track===s.track&&!e.retry).length||0}`:'词汇阅读'}</span><button type="button" data-study="tools">${icon('ellipsis')}工具</button>`;
    const heading=$('#wordTraining .training-word-row h3');
    if(heading&&!heading.querySelector('.study-term')){const button=document.createElement('button');button.type='button';button.className='study-term';button.textContent=heading.textContent;button.title='查看英文例句和词条';heading.replaceChildren(button);}
    fitWord();refreshIcons();
  }
  function fitWord(){const heading=$('#wordTraining .training-word-row h3');if(!heading)return;heading.style.fontSize='';const row=heading.parentElement,style=getComputedStyle(heading),ctx=document.createElement('canvas').getContext('2d');ctx.font=style.font;const available=row.clientWidth-row.querySelector('[data-pronounce-word]').offsetWidth-12,width=ctx.measureText(heading.textContent).width,base=parseFloat(style.fontSize);if(width>available&&available>0)heading.style.fontSize=Math.max(20,Math.floor(base*available/width))+'px';}
  new ResizeObserver(fitWord).observe(view);
  document.addEventListener('click',e=>{if(e.target.closest('[data-study-close]')){closeQuickDialog();return;}const action=e.target.closest('[data-study]')?.dataset.study;if(!action)return;
    if(action==='tools')return tools();if(action==='exit')return DuskStudyUI.exit();
    if(action==='start'){if(view.dataset.training!=='true')view.querySelector('[data-word-layout="training"]').click();return DuskStudyUI.enter(lessonForToday().words.every(wordHandled)?'review':undefined);}
    if(action==='modes'){$('#studyToolsBody').innerHTML=row('mode-training','背词','','book-open')+row('mode-focus','一屏一词','','rectangle-vertical')+row('mode-list','词汇列表','','list');refreshIcons();return;}
    afterClose(()=>{
      if(action.startsWith('mode-'))return reference(action.slice(5));
      if(action==='new'||action==='review'){if(view.dataset.training!=='true')view.querySelector('[data-word-layout="training"]').click();return DuskStudyUI.enter(action);}
      if(action==='notebook'){DuskTraining.pause();stage='notebook';renderEnglish();return;}
      const selectors={add:'[data-custom-add]',extra:'[data-custom-practice]',quota:'#studyQuotaOpen',rewind:PET_APP.edition==='share'?'#shareStudyDay':'#englishRewindBtn',settings:'[data-training="settings"]',export:'#exportWordsBtn',backup:'[data-custom-backup]'};
      const target=selectors[action]&&view.querySelector(selectors[action]);target?.click();
    });
  });
  $('#studyToolsDialog').addEventListener('cancel',e=>{e.preventDefault();closeQuickDialog();});
  const base=renderEnglish;renderEnglish=function(){base();sync();};
  new MutationObserver(()=>sync()).observe(document.body,{attributes:true,attributeFilter:['data-atelier-view']});
  renderEnglish();
})();
