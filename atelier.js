// Presentation-only preferences never enter the shared study snapshot.
(() => {
  const UI_KEY = appStorageKey('dusk-atelier-ui-v1');
  const mobile = matchMedia('(max-width: 760px)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const ui = readStored(UI_KEY) || {};
  let sceneOnly = false, focusGroup = 'new', focusIndex = 0, scheduleMode = 'day';
  let focusDate = dateISO(englishStudyDate()), petControl, petTimer, lastPetTap = 0;
  let mediaURL = null, wallpaperDB = null, focusInitialized = false;
  const wordUndo = new Map();
  const app = document.querySelector('.app'), pet = app.querySelector('aside'), main = app.querySelector('main');
  pet.classList.add('atelier-window'); main.classList.add('atelier-window');
  const home = document.querySelector('#homeView');
  const mainContent = document.createElement('div'); mainContent.className = 'atelier-main-content';
  while (main.firstChild) mainContent.append(main.firstChild);
  main.append(mainContent);
  const icon = (name) => `<i data-lucide="${name}"></i>`;
  const tool = (id, name, label, extra = '') => `<button type="button" class="atelier-icon${extra.includes('desktop-only')?' desktop-only':''}" id="${id}" title="${label}" aria-label="${label}">${icon(name)}</button>`;
  document.body.insertAdjacentHTML('afterbegin', `
    <div class="atelier-wallpaper" aria-hidden="true"><img id="atelierScene" src="assets/wallpapers/dusk-studio-concept.png" alt=""><video id="atelierVideo" muted loop playsinline hidden></video><div class="rain" id="atelierRain" hidden>${Array.from({length:20},(_,i)=>`<i style="left:${i*5}%;animation-delay:-${i*.14}s"></i>`).join('')}</div></div>
    <header class="atelier-bar"><span class="atelier-brand">夕的手账</span><div class="atelier-tools"><span class="atelier-date" id="atelierDate"></span>${tool('atelierSceneMode','image','看画室','class="desktop-only"')}${tool('atelierMotion','pause','暂停背景')}${tool('atelierSettings','sliders-horizontal','画室设置')}</div></header>`);
  const planner = document.createElement('section'); planner.className = 'atelier-window atelier-planner desktop-only';
  planner.innerHTML = '<div class="planner-body" id="atelierPlannerBody"></div>'; document.body.append(planner);
  const panels = {study:main,pet,planner};
  function titlebar(panel, title, id) {
    const bar = document.createElement('header'); bar.className = 'atelier-titlebar';
    bar.innerHTML = `<span>${title}</span><div><button type="button" class="atelier-icon" title="收起" aria-label="收起${title}" data-window-min="${id}">${icon('minus')}</button>${id === 'study' ? `<button type="button" class="atelier-icon" title="放大 / 还原" aria-label="放大或还原学习画夹" data-window-max>${icon('maximize-2')}</button>` : ''}</div>`;
    panel.prepend(bar);
    bar.querySelector('[data-window-min]').onclick = () => panel.classList.add('minimized');
    bar.querySelector('[data-window-max]')?.addEventListener('click', () => panel.classList.toggle('maximized'));
    let drag;
    bar.addEventListener('pointerdown', event => {
      if(mobile.matches || event.target.closest('button') || panel.classList.contains('maximized')) return;
      const rect = panel.getBoundingClientRect(); drag = {x:event.clientX,y:event.clientY,left:rect.left,top:rect.top};
      focusPanel(panel); bar.setPointerCapture(event.pointerId);
    });
    bar.addEventListener('pointermove', event => {
      if(!drag) return;
      panel.style.left = Math.max(0,Math.min(innerWidth-panel.offsetWidth,event.clientX-drag.x+drag.left))+'px';
      panel.style.top = Math.max(50,Math.min(innerHeight-120,event.clientY-drag.y+drag.top))+'px';
    });
    bar.addEventListener('pointerup', () => {if(drag){drag=null;saveWindows();}});
    bar.addEventListener('pointercancel', () => {drag=null;});
    panel.addEventListener('pointerdown',()=>focusPanel(panel));
    panel.addEventListener('pointerup',()=>{if(!mobile.matches)saveWindows();});
  }
  titlebar(main,'今日画夹','study'); titlebar(pet,'夕 · 片刻闲暇','pet'); titlebar(planner,'今日便笺','planner');
  pet.insertAdjacentHTML('afterbegin',`<div class="mobile-scene mobile-only" aria-hidden="true"><img id="atelierMobileScene" src="assets/wallpapers/dusk-studio-concept.png" alt=""><video id="atelierMobileVideo" muted loop playsinline hidden></video><div class="rain" id="atelierMobileRain" hidden>${Array.from({length:12},(_,i)=>`<i style="left:${i*8}%;animation-delay:-${i*.14}s"></i>`).join('')}</div></div>`);
  pet.insertAdjacentHTML('beforeend','<span class="atelier-portrait-label">夕</span>');
  pet.querySelector('.pet-actions').insertAdjacentHTML('beforeend',tool('petQuiet','sparkles','夕的轻动作'));
  pet.querySelector('#modeBtn').innerHTML = icon('picture-in-picture-2'); pet.querySelector('#modeBtn').title = '只留夕 / 展开画夹';
  pet.querySelector('#syncBtn').innerHTML = icon('cloud'); pet.querySelector('#syncBtn').title = '云同步';
  pet.querySelector('#modeBtn').addEventListener('click',()=>{
    if(mobile.matches) return;
    main.classList.toggle('minimized',document.body.classList.contains('pet-mode'));
    planner.classList.toggle('minimized',document.body.classList.contains('pet-mode'));
  });
  document.body.insertAdjacentHTML('beforeend', `
    <nav class="atelier-nav" aria-label="主导航"><button type="button" data-atelier-view="homeView">${icon('sun')}<span>今天</span></button><button type="button" data-atelier-view="englishView">${icon('book-open')}<span>单词</span></button><button type="button" data-atelier-view="scheduleView">${icon('calendar-days')}<span>课表</span></button><button type="button" data-atelier-view="tasksView" class="desktop-only">${icon('list-checks')}<span>计划</span></button><button type="button" id="atelierPetRestore" class="desktop-only">${icon('sparkles')}<span>夕</span></button><button type="button" data-atelier-view="editView">${icon('pencil')}<span>编辑</span></button></nav>
    <dialog class="quick-dialog" id="atelierSettingsDialog"><header><h2>画室设置</h2><button type="button" class="atelier-icon" id="atelierSettingsClose" aria-label="关闭设置">${icon('x')}</button></header><div class="atelier-settings"><label>场景<select id="atelierSceneSelect"><option value="studio">案台画室</option><option value="realm">画中天地</option><option value="rain">案台 · 雨天</option><option value="custom">自己的壁纸</option></select></label><label>字体<select id="atelierFontSelect"><option value="mixed">清晰正文 · 文楷便笺</option><option value="wenkai">文楷正文</option><option value="clear">清晰字体</option></select></label><label class="setting-toggle"><input type="checkbox" id="atelierQuietInput">夕的无声轻动作</label><label class="setting-toggle"><input type="checkbox" id="atelierMotionInput">背景慢动</label><label>自己的图片 / 静音视频<input type="file" id="atelierWallpaperFile" accept="image/*,video/*"></label><button type="button" class="mode utility-button" id="atelierCloudSettings">${icon('cloud')}云同步</button><button type="button" class="mode utility-button desktop-only" id="atelierLayoutReset">${icon('layout-dashboard')}恢复窗口位置</button><small>场景为依据夕的设定制作的二创概念图，非官方原图。桌面与手机共用学习记录。</small></div></dialog>`);
  const settings = document.querySelector('#atelierSettingsDialog');
  settings.querySelector('.atelier-settings').insertAdjacentHTML('beforeend',`<small>${document.querySelector('#appRevision').textContent}</small>`);
  settings.querySelector('.atelier-settings').insertAdjacentHTML('beforeend',`<button type="button" class="mode utility-button" id="atelierDevelopmentLink">${icon('milestone')}开发关卡册</button>`);
  document.querySelector('#atelierDevelopmentLink').onclick=()=>window.open('development.html'+(isDemo?'?from=demo':''),'_blank','noopener');
  if(!isDemo){
    settings.querySelector('.atelier-settings').insertAdjacentHTML('beforeend',`<button type="button" class="mode utility-button" id="atelierDemoLink">${icon('share-2')}分享给朋友</button><button type="button" class="mode utility-button" id="atelierInboxLink">${icon('inbox')}反馈收件箱</button>`);
    document.querySelector('#atelierDemoLink').onclick=async()=>{
      const url=window.PET_APP.shareURL;
      try {
        if(navigator.share) await navigator.share({title:'夕的手账 · 分享版',url});
        else {await navigator.clipboard.writeText(url);showActionToast('分享网址已复制');}
      } catch(error) {
        if(error.name!=='AbortError') window.prompt('复制分享网址',url);
      }
    };
    document.querySelector('#atelierInboxLink').onclick=()=>window.open('feedback-admin.html','_blank','noopener');
  }
  const sceneSelect = document.querySelector('#atelierSceneSelect');
  function saveUI() {try{localStorage.setItem(UI_KEY,JSON.stringify(ui));}catch{showActionToast('外观设置未保存，本机空间不足');}}
  function focusPanel(panel) {Object.values(panels).forEach(p=>p.classList.toggle('focused',p===panel));}
  function saveWindows() {
    if(mobile.matches) return;
    ui.windows ||= {};
    Object.entries(panels).forEach(([id,panel])=>{
      if(panel.classList.contains('maximized') || panel.classList.contains('minimized'))return;
      const r=panel.getBoundingClientRect(); ui.windows[id]={left:r.left,top:r.top,width:r.width,height:r.height};
    });saveUI();
  }
  function restoreWindows() {
    if(mobile.matches) return;
    Object.entries(panels).forEach(([id,panel])=>{
      const rect=ui.windows?.[id];if(!rect)return;
      const width=Math.min(innerWidth-24,Math.max(id==='study'?540:210,Number(rect.width)||300));
      const height=Math.min(innerHeight-130,Math.max(200,Number(rect.height)||350));
      Object.assign(panel.style,{width:width+'px',height:height+'px',left:Math.max(8,Math.min(innerWidth-width-8,Number(rect.left)||8))+'px',top:Math.max(55,Math.min(innerHeight-height-75,Number(rect.top)||55))+'px'});
    });
  }
  function sceneInspect(on) {sceneOnly=on;document.body.classList.toggle('scene-only',on);main.inert=on;pet.inert=on;planner.inert=on;}
  document.querySelector('#atelierSceneMode').onclick=()=>sceneInspect(!sceneOnly);
  document.addEventListener('keydown',event=>{if(event.key==='Escape')sceneInspect(false);});
  document.querySelector('#atelierPetRestore').onclick=()=>{sceneInspect(false);pet.classList.remove('minimized');planner.classList.remove('minimized');focusPanel(pet);};
  document.querySelector('#atelierLayoutReset').onclick=()=>{ui.windows={};Object.values(panels).forEach(p=>{p.removeAttribute('style');p.classList.remove('maximized','minimized');});saveUI();};
  document.querySelector('#atelierSettings').onclick=()=>openQuickDialog('atelierSettingsDialog');
  document.querySelector('#atelierSettingsClose').onclick=closeQuickDialog;
  settings.addEventListener('cancel',event=>{event.preventDefault();closeQuickDialog();});
  document.querySelector('#atelierCloudSettings').onclick=()=>{closeQuickDialog();setTimeout(()=>document.querySelector('#syncBtn').click(),180);};
  function applyUI() {
    document.documentElement.dataset.font=ui.font||'mixed';
    document.documentElement.dataset.motion=ui.motion===false?'off':'on';
    sceneSelect.value=ui.scene||'studio';
    document.querySelector('#atelierFontSelect').value=ui.font||'mixed';
    document.querySelector('#atelierQuietInput').checked=ui.pet!==false;
    document.querySelector('#atelierMotionInput').checked=ui.motion!==false;
    document.querySelector('#petQuiet').setAttribute('aria-pressed',String(ui.pet!==false));
    document.querySelector('#atelierMotion').setAttribute('aria-pressed',String(ui.motion!==false));
    document.querySelector('#atelierMotion').innerHTML=icon(ui.motion===false?'play':'pause');
    document.querySelector('#atelierMotion').title=ui.motion===false?'恢复背景慢动':'暂停背景慢动';
    document.querySelector('#atelierMotion').setAttribute('aria-label',document.querySelector('#atelierMotion').title);
    document.querySelector('#petQuiet').innerHTML=icon(ui.pet===false?'moon':'sparkles');
    document.querySelector('#atelierRain').hidden=ui.scene!=='rain';
    document.querySelector('#atelierMobileRain').hidden=ui.scene!=='rain';
    if(ui.scene!=='custom') {
      const source='assets/wallpapers/dusk-'+(ui.scene==='realm'?'realm':'studio')+'-concept.png';
      for(const id of ['atelierScene','atelierMobileScene']){document.querySelector('#'+id).src=source;document.querySelector('#'+id).hidden=false;}
      for(const id of ['atelierVideo','atelierMobileVideo']){document.querySelector('#'+id).pause();document.querySelector('#'+id).hidden=true;}
    }
    refreshIcons();
  }
  sceneSelect.onchange=()=>{ui.scene=sceneSelect.value;saveUI();applyUI();if(ui.scene==='custom')restoreCustomWallpaper();};
  document.querySelector('#atelierFontSelect').onchange=event=>{ui.font=event.target.value;saveUI();applyUI();};
  document.querySelector('#atelierQuietInput').onchange=event=>{ui.pet=event.target.checked;saveUI();applyUI();};
  document.querySelector('#atelierMotionInput').onchange=event=>{ui.motion=event.target.checked;saveUI();applyUI();};
  document.querySelector('#petQuiet').onclick=()=>{ui.pet=ui.pet===false;saveUI();applyUI();};
  document.querySelector('#atelierMotion').onclick=()=>{ui.motion=ui.motion===false;saveUI();applyUI();};
  async function wallpaperStore() {
    if(wallpaperDB)return wallpaperDB;
    wallpaperDB=await new Promise((resolve,reject)=>{const request=indexedDB.open(appStorageKey('dusk-atelier-media-v1'),1);request.onupgradeneeded=()=>request.result.createObjectStore('wallpaper');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});return wallpaperDB;
  }
  function showWallpaper(blob) {
    if(mediaURL)URL.revokeObjectURL(mediaURL);mediaURL=URL.createObjectURL(blob);
    for(const [videoId,imageId] of [['atelierVideo','atelierScene'],['atelierMobileVideo','atelierMobileScene']]){
      const video=document.querySelector('#'+videoId),image=document.querySelector('#'+imageId);
      if(blob.type.startsWith('video/')){video.src=mediaURL;video.muted=true;video.hidden=false;image.hidden=true;}
      else{video.pause();video.hidden=true;image.hidden=false;image.src=mediaURL;}
    }
    backgroundActivity();
  }
  async function restoreCustomWallpaper() {try{const db=await wallpaperStore();const blob=await new Promise((resolve,reject)=>{const r=db.transaction('wallpaper').objectStore('wallpaper').get('current');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});if(blob)showWallpaper(blob);else showActionToast('还没有自选壁纸，请先上传');}catch{showActionToast('自选壁纸不可用，已保留案台背景');}}
  document.querySelector('#atelierWallpaperFile').onchange=async event=>{
    const file=event.target.files[0];if(!file)return;
    if(!/^(image|video)\//.test(file.type)||file.size>50*1024*1024){showActionToast('请选择不超过 50MB 的图片或视频');return;}
    try{const db=await wallpaperStore();await new Promise((resolve,reject)=>{const tx=db.transaction('wallpaper','readwrite');tx.objectStore('wallpaper').put(file,'current');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});ui.scene='custom';saveUI();applyUI();showWallpaper(file);showActionToast('壁纸已存本机');}catch{showActionToast('壁纸未保存，本机空间不足或存储不可用');}
  };
  function backgroundActivity() {
    const paused=document.hidden||reduced.matches||ui.motion===false;
    document.documentElement.toggleAttribute('data-background-paused',paused);
    for(const [id,isMobile] of [['atelierVideo',false],['atelierMobileVideo',true]]){
      const video=document.querySelector('#'+id);if(paused||isMobile!==mobile.matches)video.pause();else if(!video.hidden)video.play().catch(()=>{});
    }
    if(paused){petControl?.stop();pet.querySelector('.pet-img').style.transform='';}
  }
  const savedApplyUI=applyUI;applyUI=function(){savedApplyUI();backgroundActivity();};
  reduced.addEventListener('change',backgroundActivity);document.addEventListener('visibilitychange',backgroundActivity);

  function todayContext(fn) {
    if(!days.length)return '';
    const day=activeDay,week=weekInput.value;activeDay=todayIndex;weekInput.value=currentWeek;
    try{return fn();}finally{activeDay=day;weekInput.value=week;}
  }
  function todaysTasks() {return todayContext(()=>{const d=days[activeDay];return [...visibleTasks(d),...englishTaskItems()].map(t=>({task:t,id:checkId(activeDay,t,d.tasks.indexOf(t))}));})||[];}
  function agendaHTML() {return todaysTasks().map(({task,id})=>`<div class="home-task ${checked[id]?'done':''}"><label><input type="checkbox" data-home-check="${escapeHtml(id)}" ${checked[id]?'checked':''}><span>${escapeHtml(task[0])}</span></label>${String(task[4]).startsWith('english-')?'':`<button type="button" class="atelier-icon" data-home-edit="${escapeHtml(task[4])}" aria-label="修改日程">${icon('pencil')}</button>`}</div>`).join('');}
  function nextCourseHTML() {
    const list=selectedCourses.filter(c=>c.day===todayIndex&&c.weeks.some(([a,b])=>currentWeek>=a&&currentWeek<=b)).sort((a,b)=>a.periods[0]-b.periods[0]);
    const c=list.find(c=>Number(periods.find(p=>p[0]===c.periods.at(-1))?.[1].slice(-5).replace(':',''))>=new Date().getHours()*100+new Date().getMinutes());
    return c?`<small>接下来 · ${periodText(c.periods)}</small><strong>${escapeHtml(c.name)}</strong><small>${escapeHtml(c.teacher)} · ${escapeHtml(c.room)}</small>`:`<small>${list.length?'今天的课程已结束':'今天没有课程'}</small><strong>留一点时间给自己。</strong>`;
  }
  function renderHome() {
    if(!days.length)return;
    const lesson=lessonForToday(),done=lesson.words.filter(wordHandled).length;
    const summary=`${courseDate(todayIndex,currentWeek)} · ${dayNames[todayIndex]} · 第${currentWeek}周`;
    document.querySelector('#atelierDate').textContent=summary;
    home.querySelector('.home-body')?.remove();
    const body=document.createElement('div');body.className='home-body';body.innerHTML=`<h1 class="home-quote">今天，也慢慢来。</h1><div class="home-summary"><span>${summary}</span><span>${done}/10 新词</span></div><div class="home-next">${nextCourseHTML()}</div><button class="home-start" type="button" data-home-continue><span><strong>${done===10?'看看今日复习':'继续背词'}</strong><small>第${lesson.index+1}天 · ${escapeHtml(lesson.title)} · 复习 ${reviewWords().length} 词</small></span>${icon('arrow-right')}</button><div class="agenda-heading"><h2>今天安排</h2>${tool('homeAddTask','plus','添加日程')}</div><div class="home-agenda">${agendaHTML()}</div><div class="home-extra"><button class="mode utility-button" type="button" data-home-plan>${icon('list-checks')}全部计划</button><button class="mode utility-button" type="button" data-home-sync>${icon('cloud')}云同步</button></div><p class="sync-note" id="homeSyncNote"></p>`;
    home.append(body);
    document.querySelector('#atelierPlannerBody').innerHTML=`<div class="home-summary">${summary}</div><div class="agenda-heading"><h2>今天安排</h2><button type="button" class="atelier-icon" data-planner-add aria-label="添加日程">${icon('plus')}</button></div><div class="home-agenda">${agendaHTML()}</div>`;
    document.querySelector('#homeSyncNote').textContent=syncStatus.textContent;
    refreshIcons();
  }
  [home,planner].forEach(el=>{
    el.addEventListener('change',event=>{const input=event.target.closest('[data-home-check]');if(!input)return;checked[input.dataset.homeCheck]=input.checked;save();renderTasks();renderHome();});
    el.addEventListener('click',event=>{
      const edit=event.target.closest('[data-home-edit]');if(edit){openTaskEditor(edit.dataset.homeEdit);return;}
      if(event.target.closest('#homeAddTask,[data-planner-add]')){refreshCalendarNavigation(true);openTaskEditor();}
      if(event.target.closest('[data-home-continue]')){focusInitialized=false;activateView('englishView');mainContent.scrollTop=0;window.scrollTo(0,0);}
      if(event.target.closest('[data-home-plan]')){refreshCalendarNavigation(true);activateView('tasksView');mainContent.scrollTop=0;window.scrollTo(0,0);}
      if(event.target.closest('[data-home-sync]'))document.querySelector('#syncBtn').click();
    });
  });
  new MutationObserver(()=>{const note=document.querySelector('#homeSyncNote');if(note)note.textContent=syncStatus.textContent;}).observe(syncStatus,{childList:true,characterData:true,subtree:true});
  const oldTasks=renderTasks;renderTasks=function(){oldTasks();decorateView();};

  const english=document.querySelector('#englishView');
  setSoundButton=function(button,text,disabled=false){
    button.disabled=disabled;button.innerHTML=icon(disabled?'audio-lines':'volume-2');
    button.title=disabled?'正在播放英式发音':'播放英式发音';refreshIcons();
  };
  const englishTools=document.createElement('div');englishTools.className='english-tools';
  englishTools.append(document.querySelector('#exportWordsBtn'),document.querySelector('#englishRewindBtn'));
  english.querySelector('.english-head').append(englishTools);
  document.querySelector('#exportWordsBtn').innerHTML=icon('download');document.querySelector('#exportWordsBtn').title='导出今日单词';document.querySelector('#exportWordsBtn').setAttribute('aria-label','导出今日单词');
  document.querySelector('#englishRewindBtn').innerHTML=icon('history');document.querySelector('#englishRewindBtn').title='补学 / 回档';document.querySelector('#englishRewindBtn').setAttribute('aria-label','补学或回档');
  english.querySelector('.review-guide').insertAdjacentHTML('afterend',`<div class="word-layout-toolbar"><span>显示</span><div class="word-layout-switch" role="group" aria-label="单词显示方式"><button type="button" data-word-layout="focus" title="一屏一词" aria-pressed="false">${icon('rectangle-vertical')}一词</button><button type="button" data-word-layout="list" title="多词列表" aria-pressed="false">${icon('layout-list')}列表</button></div></div><div class="focus-pager"><div class="focus-group"><button type="button" data-focus-group="new">新词</button><button type="button" data-focus-group="review">复习</button></div><span id="focusPosition"></span><div>${tool('focusPrev','chevron-left','上一个单词')}${tool('focusNext','chevron-right','下一个单词')}</div></div>`);
  function wordLayout() {
    const stored=ui.wordLayouts?.[mobile.matches?'mobile':'desktop'];
    return ['focus','list'].includes(stored)?stored:mobile.matches?'focus':'list';
  }
  function focusOnCard(card) {
    if(!card)return;
    focusGroup=card.closest('#reviewWords')?'review':'new';
    focusIndex=[...card.parentElement.querySelectorAll('.word-card')].indexOf(card);
  }
  function applyFocus() {
    if(!days.length)return;
    const single=wordLayout()==='focus';
    english.dataset.wordLayout=single?'focus':'list';
    english.querySelector('.focus-pager').hidden=!single;
    english.querySelectorAll(':scope > h3').forEach(heading=>heading.hidden=single);
    english.querySelectorAll('[data-word-layout]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.wordLayout===wordLayout())));
    const cards=[...document.querySelectorAll(focusGroup==='new'?'#newWords .word-card':'#reviewWords .word-card')];
    focusIndex=Math.max(0,Math.min(focusIndex,cards.length-1));
    document.querySelector('#newWords').classList.toggle('focus-hidden',focusGroup!=='new'&&single);
    document.querySelector('#reviewWords').classList.toggle('focus-hidden',focusGroup!=='review'&&single);
    document.querySelectorAll('.word-card').forEach(c=>c.classList.toggle('focus-hidden',single));
    if(single)cards[focusIndex]?.classList.remove('focus-hidden');
    document.querySelector('#focusPosition').textContent=cards.length?`${focusIndex+1} / ${cards.length}`:'暂无复习';
    english.querySelectorAll('[data-focus-group]').forEach(b=>b.classList.toggle('active',b.dataset.focusGroup===focusGroup));
    document.querySelector('#focusPrev').disabled=focusIndex===0;document.querySelector('#focusNext').disabled=focusIndex>=cards.length-1;
    document.querySelectorAll('.word-detail-button').forEach(b=>b.closest('.word-card').classList.toggle('long-word',b.textContent.length>=16));
    const card=cards[focusIndex];if(single&&currentViewId()==='englishView'&&card)saveResumePoint(card.dataset.wordCard);
  }
  english.querySelectorAll('[data-word-layout]').forEach(button=>button.onclick=()=>{
    const next=button.dataset.wordLayout;if(next===wordLayout())return;
    if(next==='focus'){
      const top=Math.max(english.querySelector('.word-layout-toolbar').getBoundingClientRect().bottom,mobile.matches?document.querySelector('.atelier-bar').getBoundingClientRect().bottom:mainContent.getBoundingClientRect().top);
      const bottom=mobile.matches?document.querySelector('.atelier-nav').getBoundingClientRect().top:mainContent.getBoundingClientRect().bottom;
      const card=[...english.querySelectorAll('.word-card')].find(card=>{const r=card.getBoundingClientRect();return r.height>0&&r.bottom>top+30&&r.top<bottom;});
      focusOnCard(card);
    }
    const previous=ui.wordLayouts;ui.wordLayouts={...ui.wordLayouts,[mobile.matches?'mobile':'desktop']:next};
    try{localStorage.setItem(UI_KEY,JSON.stringify(ui));}
    catch{ui.wordLayouts=previous;showActionToast('显示方式未保存，本机空间不足');return;}
    applyFocus();
    mainContent.scrollTop=0;window.scrollTo(0,0);
    if(next==='list'&&focusIndex>0){
      const card=english.querySelectorAll(focusGroup==='new'?'#newWords .word-card':'#reviewWords .word-card')[focusIndex];
      card?.scrollIntoView({block:'start',behavior:'instant'});
    }
  });
  english.addEventListener('click',event=>{
    const card=event.target.closest('[data-word-card]');if(!card)return;
    focusOnCard(card);saveResumePoint(card.dataset.wordCard);
  },true);
  english.querySelectorAll('[data-focus-group]').forEach(b=>b.onclick=()=>{focusGroup=b.dataset.focusGroup;focusIndex=0;applyFocus();});
  document.querySelector('#focusPrev').onclick=()=>{focusIndex--;applyFocus();};
  document.querySelector('#focusNext').onclick=()=>{focusIndex++;applyFocus();};
  const oldWordAction=wordActionHtml;
  wordActionHtml=function(word){let html=oldWordAction(word);if(wordHandled(word)&&wordUndo.has(word.id))html=html.replace('</p>',`<button type="button" class="word-undo" data-word-undo="${escapeHtml(word.id)}">撤销</button></p>`);return html;};
  const oldEnglish=renderEnglish;
  renderEnglish=function(){
    oldEnglish();
    if(focusDate!==dateISO(englishStudyDate())){focusDate=dateISO(englishStudyDate());focusIndex=0;focusGroup='new';focusInitialized=false;wordUndo.clear();}
    document.querySelector('#englishTheme').textContent=lessonForToday().title;
    if(!focusInitialized){
      const list=lessonForToday().words,resume=readStored(resumeKey);focusGroup='new';
      let index=resume?.studyDate===focusDate?list.findIndex(w=>w.id===resume.wordId):-1;
      if(index<0&&resume?.studyDate===focusDate){const reviewIndex=reviewWords().findIndex(w=>w.id===resume.wordId);if(reviewIndex>=0){focusGroup='review';index=reviewIndex;}}
      if(index<0)index=list.findIndex(w=>!wordHandled(w));focusIndex=Math.max(0,index);focusInitialized=true;
    }
    document.querySelectorAll('[data-pronounce-word]').forEach(b=>{b.innerHTML=icon('volume-2');b.setAttribute('aria-label','播放 '+b.dataset.pronounceWord+' 英式发音');});
    applyFocus();renderHome();refreshIcons();
  };
  function undoWord(id) {
    const previous=wordUndo.get(id);if(!previous)return;
    for(const key of ['remembered','forgotten']){englishProgress[key]||={};if(previous[key]===undefined)delete englishProgress[key][id];else englishProgress[key][id]=previous[key];}
    wordUndo.delete(id);saveEnglish();renderEnglish();renderTasks();showActionToast('已撤销词汇标记');
  }
  english.addEventListener('click',event=>{
    const mark=event.target.closest('[data-remember-word],[data-forgot-word]');if(!mark)return;
    const id=mark.dataset.rememberWord||mark.dataset.forgotWord;wordUndo.set(id,{remembered:englishProgress.remembered?.[id],forgotten:englishProgress.forgotten?.[id]});
  },true);
  english.addEventListener('click',event=>{
    const undo=event.target.closest('[data-word-undo]');if(undo){undoWord(undo.dataset.wordUndo);return;}
    const mark=event.target.closest('[data-remember-word],[data-forgot-word]');if(!mark)return;
    const id=mark.dataset.rememberWord||mark.dataset.forgotWord,card=[...document.querySelectorAll('[data-word-card]')].find(c=>c.dataset.wordCard===id);
    card?.classList.add('mark-flash');if(mark.dataset.forgotWord)card?.classList.add('forgot-flash');
    showActionToast(mark.dataset.forgotWord?'已标记：明天加练':'已完成',()=>undoWord(id));
    if(lessonForToday().words.every(wordHandled))petReact('这十个词，收好了。',true);
    renderHome();
  });

  const schedule=document.querySelector('#scheduleView');
  schedule.querySelector('.schedule-toolbar').insertAdjacentHTML('beforeend','<div class="schedule-mode"><button type="button" data-schedule-mode="day" class="active">按日</button><button type="button" data-schedule-mode="week">整周</button></div>');
  schedule.insertAdjacentHTML('beforeend',`<div class="daily-schedule"><div class="mobile-date-nav">${tool('schedulePrevDay','chevron-left','前一天')}<strong id="scheduleDayLabel"></strong>${tool('scheduleNextDay','chevron-right','后一天')}</div><div id="dailyCourses"></div></div>`);
  function renderDailySchedule() {
    if(!days.length)return;
    document.querySelector('#scheduleDayLabel').textContent=`${courseDate(activeDay)} · ${dayNames[activeDay]}`;
    const courses=selectedCourses.filter(c=>c.day===activeDay&&inWeekRange(c.weeks)).sort((a,b)=>a.periods[0]-b.periods[0]);
    document.querySelector('#dailyCourses').innerHTML=courses.map(c=>{
      const first=periods.find(p=>p[0]===c.periods[0])?.[1].slice(0,5)||'',end=periods.find(p=>p[0]===c.periods.at(-1))?.[1].slice(-5)||'';
      return `<article class="daily-course"><div class="daily-course-time">${first}<small>${end}</small></div><div class="course-block ${escapeHtml(c.type)}" data-course-index="${selectedCourses.indexOf(c)}"><strong>${escapeHtml(c.name)}</strong><small>${escapeHtml(c.teacher)} · ${escapeHtml(c.room)}</small><small>${weekText(c.weeks)} · ${periodText(c.periods)}</small></div></article>`;
    }).join('')||'<p class="tip">这一天没有课程。</p>';
  }
  const baseSchedule=renderSchedule;
  renderSchedule=function(){
    baseSchedule();renderDailySchedule();
    document.querySelectorAll('#dailyCourses .course-block').forEach(block=>{
      const source=document.querySelector(`#scheduleGrid [data-course-index="${block.dataset.courseIndex}"]`);
      if(!source)return;
      block.dataset.courseEdit='true';block.tabIndex=0;block.setAttribute('role','button');block.title='修改这段课程';
      block.onclick=source.onclick;block.onkeydown=source.onkeydown;
    });
  };
  document.querySelectorAll('[data-schedule-mode]').forEach(b=>b.onclick=()=>{scheduleMode=b.dataset.scheduleMode;schedule.classList.toggle('scheduleView-week',scheduleMode==='week');schedule.querySelectorAll('[data-schedule-mode]').forEach(x=>x.classList.toggle('active',x===b));});
  function shiftDay(delta) {
    let day=activeDay+delta,week=activeWeek();if(day<0){day=6;week--;}if(day>6){day=0;week++;}
    if(week<1||week>20)return;activeDay=day;weekInput.value=week;renderSchedule();renderTasks();renderWeek();decorateView();saveResumePoint();
  }
  document.querySelector('#schedulePrevDay').onclick=()=>shiftDay(-1);document.querySelector('#scheduleNextDay').onclick=()=>shiftDay(1);

  function decorateView() {
    const view=currentViewId();document.body.dataset.atelierView=view;
    document.querySelectorAll('[data-atelier-view]').forEach(b=>b.classList.toggle('active',b.dataset.atelierView===view));
    if(view==='homeView'){mainHeading.textContent='今天';mainSub.textContent='';renderHome();}
    else if(view==='tasksView'){mainHeading.textContent=`${courseDate(activeDay)} · ${dayNames[activeDay]}`;}
    else{mainHeading.textContent=({englishView:'英语手帖',scheduleView:'课程安排',editView:'编辑课表与计划',selectView:'学习策略'})[view]||'今日画夹';}
    applyFocus();refreshIcons();
  }
  document.querySelectorAll('.tab-button').forEach(b=>b.addEventListener('click',decorateView));
  document.querySelectorAll('[data-atelier-view]').forEach(b=>b.onclick=()=>{
    sceneInspect(false);main.classList.remove('minimized');focusPanel(main);
    if(b.dataset.atelierView==='homeView')refreshCalendarNavigation(true);
    if(b.dataset.atelierView==='englishView'&&currentViewId()!=='englishView')focusInitialized=false;
    const changed=currentViewId()!==b.dataset.atelierView;activateView(b.dataset.atelierView);
    if(changed){mainContent.scrollTop=0;window.scrollTo(0,0);}
  });
  const baseStart=startApp;startApp=function(view=currentViewId()){baseStart(view);decorateView();};
  const baseCalendar=refreshCalendarNavigation;refreshCalendarNavigation=function(force=false){baseCalendar(force);decorateView();};
  const baseMode=syncModeButton;syncModeButton=function(){baseMode();document.querySelector('#modeBtn').innerHTML=icon('picture-in-picture-2');};
  function placePet() {
    if(mobile.matches){home.prepend(pet);Object.values(panels).forEach(p=>{p.classList.remove('minimized','maximized');p.removeAttribute('style');});sceneInspect(false);}
    else{app.prepend(pet);restoreWindows();}
    applyFocus();refreshIcons();backgroundActivity();
  }
  mobile.addEventListener('change',()=>{placePet();if(days.length)activateView(mobile.matches?'homeView':currentViewId());});
  window.addEventListener('resize',()=>{if(!mobile.matches)restoreWindows();});
  function petReact(line,celebrate=false) {
    if(ui.pet===false)return;
    petLine.textContent=line;clearTimeout(petTimer);petTimer=setTimeout(()=>{if(days[todayIndex])petLine.textContent=days[todayIndex].line;},5000);
    if(reduced.matches||document.hidden)return;
    const image=pet.querySelector('.pet-img');petControl?.stop();
    petControl=window.Motion?.animate(image,{y:celebrate?[0,-16,0,-8,0]:[0,-9,0],rotate:[0,-4,5,0]},{duration:celebrate ? .8 : .5,ease:'easeOut'});
  }
  let petDrag;
  const portrait=pet.querySelector('.pet-frame');portrait.tabIndex=0;portrait.setAttribute('role','button');portrait.setAttribute('aria-label','和夕打个招呼');
  portrait.addEventListener('click',()=>{const now=Date.now();petReact(now-lastPetTap<750?'可别把我的墨碰洒了。':'我在。你继续。');lastPetTap=now;});
  portrait.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();petReact('我在。你继续。');}});
  portrait.addEventListener('pointerdown',event=>{if(mobile.matches||ui.pet===false||reduced.matches)return;petDrag={x:event.clientX,y:event.clientY};portrait.setPointerCapture(event.pointerId);});
  portrait.addEventListener('pointermove',event=>{if(!petDrag)return;petControl?.stop();const x=Math.max(-18,Math.min(18,event.clientX-petDrag.x)),y=Math.max(-12,Math.min(12,event.clientY-petDrag.y));pet.querySelector('.pet-img').style.transform=`translate(${x}px,${y}px)`;});
  function releasePet(){if(!petDrag)return;petDrag=null;const image=pet.querySelector('.pet-img');petControl=window.Motion?.animate(image,{transform:'translate(0px,0px)'},{duration:.6,type:'spring',bounce:.45});petLine.textContent='放回去。墨汁要洒了。';}
  portrait.addEventListener('pointerup',releasePet);portrait.addEventListener('pointercancel',releasePet);
  let lastActivity=Date.now();document.addEventListener('pointerdown',()=>{lastActivity=Date.now();});
  setInterval(()=>{if(!document.hidden&&Date.now()-lastActivity>60000&&!document.querySelector('dialog[open]')){petReact('画完这一笔，就歇一歇。');lastActivity=Date.now();}},20000);
  let toastRemaining=7000,toastStarted=0,toastPaused=false;
  const toast=document.querySelector('#actionToast'),baseToast=showActionToast;
  showActionToast=function(message,undo){baseToast(message,undo);toastRemaining=7000;toastStarted=Date.now();toastPaused=false;if(document.hidden)pauseToast();};
  function pauseToast(){if(toast.hidden||toastPaused)return;toastRemaining=Math.max(0,toastRemaining-(Date.now()-toastStarted));clearTimeout(toastTimer);toastPaused=true;}
  function resumeToast(){if(!toastPaused||toast.hidden||document.hidden||toast.matches(':hover')||toast.contains(document.activeElement))return;toastPaused=false;toastStarted=Date.now();toastTimer=setTimeout(()=>{toast.hidden=true;},toastRemaining);}
  toast.addEventListener('pointerenter',pauseToast);toast.addEventListener('pointerleave',resumeToast);toast.addEventListener('focusin',pauseToast);toast.addEventListener('focusout',()=>setTimeout(resumeToast,0));document.addEventListener('visibilitychange',()=>document.hidden?pauseToast():resumeToast());
  applyUI();placePet();focusPanel(main);
  if(ui.scene==='custom')restoreCustomWallpaper();
  if(days.length){renderEnglish();renderSchedule();if(mobile.matches&&!editorDirty)activateView('homeView');else decorateView();}
  window.atelierVersion='2026.10.03';
})();
