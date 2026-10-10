(() => {
  'use strict';
  if (window.PET_APP?.edition !== 'share') return;
  const $ = selector => document.querySelector(selector);
  const key = 'dusk-demo-v1:guide-v1';
  const version = window.PET_APP.version;
  const icon = name => `<i data-lucide="${name}"></i>`;
  let record = {};
  try { const saved=JSON.parse(localStorage.getItem(key)||'{}'); if(saved && typeof saved==='object' && !Array.isArray(saved))record=saved; } catch {}
  const newUser = !window.PET_SHARE_EXISTING && !record.welcomeDismissed;
  let updatePending = !newUser && record.promptedVersion!==version && record.readVersion!==version && record.dismissedVersion!==version;
  let updateVisible = false;
  let welcomeMode = false;
  let queued = false;
  function remember(patch) {
    Object.assign(record,patch);
    try { localStorage.setItem(key,JSON.stringify(record)); } catch { /* Session state still prevents repeat prompts. */ }
  }
  remember({observedVersion:version,...(!newUser?{welcomeDismissed:true}:{})});

  $('.atelier-tools').insertAdjacentHTML('beforeend',`<button type="button" class="atelier-icon" id="shareGuideOpen" title="使用指南与更新" aria-label="使用指南与更新">${icon('circle-help')}<span class="share-guide-dot" hidden></span></button>`);
  $('#atelierSettingsDialog .atelier-settings').insertAdjacentHTML('beforeend',`<button type="button" class="mode utility-button" id="shareGuideSettings">${icon('book-open')}使用指南与更新</button>`);
  $('.share-command-row').insertAdjacentHTML('beforeend',`<button type="button" class="mode utility-button" id="shareGuideEditor">${icon('book-open')}使用指南</button>`);
  document.body.insertAdjacentHTML('beforeend',`<dialog class="quick-dialog share-guide-dialog" id="shareGuideDialog" aria-labelledby="shareGuideTitle"><header><div><span class="share-guide-eyebrow" id="shareGuideEyebrow">随时回来翻一翻</span><h2 id="shareGuideTitle">手账说明</h2></div><button type="button" class="atelier-icon" id="shareGuideClose" title="关闭指南" aria-label="关闭指南">${icon('x')}</button></header><div id="shareWelcome" hidden><div class="share-welcome-art"><img src="assets/wallpapers/phone-window.webp" alt="夕在窗边" decoding="async"><p>留一页，给今天。</p></div><div class="share-welcome-copy"><h3>来了？这里还有一页空白，留给你。</h3><p>课程、日常，还有每天的单词，都可以写在这里。不必一下填满。</p><p class="share-guide-note">记录保存在这台设备的当前浏览器里。<br><strong>录入完成后，记得下载备份。</strong></p><button type="button" class="speak utility-button share-guide-primary" id="shareWelcomeGuide">先看看使用指南 ${icon('arrow-right')}</button><div class="share-welcome-links"><button type="button" class="mode" data-guide-action="edit">设置课表</button><button type="button" class="mode" data-guide-action="words">先背单词</button><button type="button" class="mode" id="shareWelcomeSkip">稍后再说</button></div></div></div><div id="shareGuideBook"><nav class="share-guide-tabs" role="tablist" aria-label="指南章节"><button type="button" role="tab" data-guide-tab="start">开始</button><button type="button" role="tab" data-guide-tab="courses">课表计划</button><button type="button" role="tab" data-guide-tab="words">背词</button><button type="button" role="tab" data-guide-tab="backup">备份</button><button type="button" role="tab" data-guide-tab="feedback">反馈</button><button type="button" role="tab" data-guide-tab="updates">更新</button></nav><article id="shareGuideBody" role="tabpanel" tabindex="0"></article><footer><span>关闭后仍可从帮助入口回看。</span><button type="button" class="mode" id="shareGuideReturn">知道了，回手账</button></footer></div></dialog>`);
  const dialog=$('#shareGuideDialog');
  const sections = {
    start:['从你需要的地方开始','这里可以安排课程、记录计划、背诵单词，不需要注册或个人解锁码。','<p>不必一下填满。你可以从任意一项开始，指南随时能关闭。</p><ol><li>在编辑页设置本学期第1周的周一。</li><li>添加自己的课程和日程，或先背几个单词。</li><li>录入完成后下载备份，确认文件已保存。</li></ol><button type="button" class="speak utility-button" data-guide-action="edit">设置我的课表</button>'],
    courses:['课表与计划','把要紧的事记下，余下的时间，也不必都填满。','<ol><li>编辑 → 设置本学期“第1周的周一” → 保存日期。</li><li>添加课程，填写课程名、星期、教室、节次和周次，然后保存。</li><li>节次例如 <code>1-2</code>；周次例如 <code>1-8,10-17</code>。</li></ol><p>课表直接显示课程名和教室。点课程查看教师、时间等详情，再按需修改。预设节次时间请与学校作息核对。</p><p>课程较多时，可下载填写模板，再导入课程 CSV；导入是追加课程，不是整份替换。</p><p>临时安排使用“添加日程”，填写日期、时间、内容后保存。高级编辑出现草稿提示时，请点“保存到本机”。</p><button type="button" class="speak utility-button" data-guide-action="edit">去编辑课表与计划</button>'],
    words:['每日背词','一日十词，倒也不必贪多。记得牢些就好。','<p>35天主题词库，每天10个新词，是六级备考辅助，并非完整官方六级词表。</p><p>在“背词”模式选择释义；答错后对照正确答案，再继续。电脑可点正确答案继续，手机使用底部大按钮。也可切换“一词”或“列表”。</p><p><strong>学习日在凌晨4点切换。</strong>忘记的词次日加练，不占10个新词额度。复习按1、3、7、14、30天间隔安排。</p><p>漏学时可点“选择背词天数”调整起点，已完成记录不会因此清空。发音播放受浏览器、设备和网络影响。</p><button type="button" class="speak utility-button" data-guide-action="words">翻开今日词页</button>'],
    backup:['保存与备份','这一页写得不错，记得留个底。','<p><strong>记录保存在你自己的设备、当前浏览器里，不会自动跨设备同步，也不是保存在制作者的电脑上。</strong></p><ol><li>编辑 → 下载备份。</li><li>在下载目录或“文件”中，确认已保存 JSON 文件。</li><li>换设备时，用“恢复备份”选择文件并核对预览。</li></ol><p><strong>恢复会替换当前课表、计划和背词进度，不是合并。</strong>当前有新内容时，先下载当前备份。</p><p>正常更新通常保留记录；清理网站数据、无痕浏览、换浏览器或设备、设备回收存储等可能造成记录丢失或看起来不一致。请固定使用同一入口，换用前先备份。</p><p>不要假定自选壁纸也包含在记录备份中。备份内有私人安排，不必随反馈发送。</p><button type="button" class="speak utility-button" data-guide-action="backup">下载我的备份</button>'],
    feedback:['留张反馈便签','哪里用得不顺，留张便签给我。','<p>编辑 → 反馈 → 选择类型 → 写下情况 → 发送便签。</p><p>告诉我：点了什么、出现了什么、原本希望怎样。设备、浏览器和操作步骤有助于排查，截图请遮住私人信息。</p><p>只有看到“便签已送达”才表示成功；失败时请保留文字，稍后重试或联系邀请你的人。</p><p>反馈不会自动附带课表、计划、背词记录或解锁码，联系方式可不填。</p><p>网站目前托管于 GitHub Pages，不保证所有国内网络都能直连。打不开时请反馈网络和错误画面，不必为公测购买 VPN。首次使用需要网络，不保证所有图片或音频均可离线。</p><p>若颜色异常，检查浏览器是否强制网页深色；记录不见时，先核对网址与浏览器，不要急着清数据。</p><button type="button" class="speak utility-button" data-guide-action="feedback">留张便签</button>'],
    updates:['又添了几笔','趁你不在，又添了几笔。有空看看。',`<p class="share-guide-version">分享版 ${version} · 2026年10月10日</p><ul><li>首次打开可以先看使用指南，也可以直接开始或跳过。</li><li>帮助入口常驻，课表、背词、备份和反馈说明随时可查。</li><li>更新仅在首页简短提示，关闭后不再主动提醒，不打断背词。</li></ul><p>本次不修改你的课程、计划和学习进度。最近几轮也已加入可收起阅读抽屉、紧凑周课表与完整画卷。</p><p>这是个人制作的非商业体验版，不代表角色相关作品官方产品。</p><button type="button" class="mode utility-button" data-guide-action="journal">查看开发关卡册 ${icon('arrow-up-right')}</button>`]
  };
  function showChapter(tab='start') {
    if(!sections[tab])tab='start';
    welcomeMode=false;remember({welcomeDismissed:true});
    $('#shareWelcome').hidden=true;$('#shareGuideBook').hidden=false;
    $('#shareGuideTitle').textContent='手账说明';$('#shareGuideEyebrow').textContent='随时回来翻一翻';
    for(const b of dialog.querySelectorAll('[data-guide-tab]')){
      b.id='share-guide-tab-'+b.dataset.guideTab;b.setAttribute('aria-controls','shareGuideBody');
      b.setAttribute('aria-selected',String(b.dataset.guideTab===tab));b.tabIndex=b.dataset.guideTab===tab?0:-1;
    }
    const [title,line,body]=sections[tab];
    $('#shareGuideBody').innerHTML=`<h3>${title}</h3><p class="share-guide-line">${line}</p>${body}`;
    $('#shareGuideBody').setAttribute('aria-labelledby','share-guide-tab-'+tab);$('#shareGuideBody').scrollTop=0;
    if(tab==='updates'){updatePending=false;updateVisible=false;remember({readVersion:version});queueBanner();}
    refreshIcons();
  }
  // Respect the existing Android/back-button history when switching between dialogs.
  function afterClose(action) {
    if(!dialog.open && !document.querySelector('dialog[open]')){action();return;}
    const back=!!history.state?.petDialog;
    if(back)window.addEventListener('popstate',action,{once:true});
    closeQuickDialog();if(!back)action();
  }
  function openGuide(tab='start') {afterClose(()=>{showChapter(tab);openQuickDialog(dialog.id);});}
  function closeGuide(){if(welcomeMode)remember({welcomeDismissed:true});closeQuickDialog();}
  function queueBanner(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;renderBanner();});}
  function renderBanner() {
    const home=$('#homeView');
    const isHome=currentViewId()==='homeView';
    if(updatePending && isHome && !document.querySelector('dialog[open]')){
      updatePending=false;updateVisible=true;remember({promptedVersion:version});
    }
    if(updateVisible && isHome){
      if(!$('#shareUpdateNotice')){
        home.insertAdjacentHTML('afterbegin',`<aside id="shareUpdateNotice" class="share-update-notice" aria-label="本次更新"><div><strong>手账又添了几笔</strong><p>使用指南常驻了。课表、背词和备份，不清楚时随时翻看。</p><button type="button" class="share-guide-link" data-share-update="read">看看这次更新</button></div><button type="button" class="atelier-icon" data-share-update="dismiss" title="关闭更新提示" aria-label="关闭更新提示">${icon('x')}</button></aside>`);refreshIcons();
      }
    }else $('#shareUpdateNotice')?.remove();
    $('.share-guide-dot').hidden=record.readVersion===version || record.dismissedVersion===version || newUser;
  }
  $('#shareGuideOpen').onclick=()=>openGuide();
  $('#shareGuideSettings').onclick=()=>openGuide();
  $('#shareGuideEditor').onclick=()=>openGuide();
  $('#shareGuideClose').onclick=closeGuide;$('#shareGuideReturn').onclick=closeGuide;$('#shareWelcomeSkip').onclick=closeGuide;
  $('#shareWelcomeGuide').onclick=()=>showChapter('start');
  dialog.addEventListener('cancel',event=>{event.preventDefault();closeGuide();});
  dialog.addEventListener('close',()=>{if(welcomeMode)remember({welcomeDismissed:true});queueBanner();});
  dialog.addEventListener('click',event=>{
    const tab=event.target.closest('[data-guide-tab]');if(tab){showChapter(tab.dataset.guideTab);return;}
    const action=event.target.closest('[data-guide-action]')?.dataset.guideAction;if(!action)return;
    if(action==='journal'){window.open('development.html','_blank','noopener,noreferrer');return;}
    afterClose(()=>{
      if(action==='words'||action==='edit'){
        const view=action==='words'?'englishView':'editView';
        const nav=document.querySelector(`.atelier-nav [data-atelier-view="${view}"]`);nav?.click();
      }else if(action==='backup')$('#shareBackup')?.click();
      else if(action==='feedback')$('#shareFeedback')?.click();
    });
  });
  dialog.querySelector('.share-guide-tabs').addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();
    const tabs=[...dialog.querySelectorAll('[data-guide-tab]')];let i=tabs.indexOf(document.activeElement);
    i=event.key==='Home'?0:event.key==='End'?tabs.length-1:(i+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
    showChapter(tabs[i].dataset.guideTab);tabs[i].focus();
  });
  $('#homeView').addEventListener('click',event=>{
    const action=event.target.closest('[data-share-update]')?.dataset.shareUpdate;
    if(action==='read')openGuide('updates');
    if(action==='dismiss'){updateVisible=false;updatePending=false;remember({dismissedVersion:version});queueBanner();}
  });
  new MutationObserver(queueBanner).observe($('#homeView'),{childList:true});
  new MutationObserver(queueBanner).observe(document.body,{attributes:true,attributeFilter:['data-atelier-view']});
  window.addEventListener('storage',event=>{
    if(event.key!==key || !event.newValue)return;
    try{const value=JSON.parse(event.newValue);if(value && typeof value==='object'&&!Array.isArray(value)){record=value;if(value.readVersion===version||value.dismissedVersion===version||value.promptedVersion===version){updatePending=false;updateVisible=false;}queueBanner();}}catch{}
  });
  if(newUser){
    welcomeMode=true;$('#shareWelcome').hidden=false;$('#shareGuideBook').hidden=true;
    $('#shareGuideTitle').textContent='初次见面';$('#shareGuideEyebrow').textContent='夕的手账 · 分享版';
    openQuickDialog(dialog.id);
  }
  renderBanner();refreshIcons();
})();
