(() => {
  if (!isDemo) return;
  const $ = s => document.querySelector(s);
  const icon = name => `<i data-lucide="${name}"></i>`;
  const backupKey = appStorageKey('restore-safety-v1');
  const backupDateKey = appStorageKey('last-backup-v1');
  const dayNames = ['星期一','星期二','星期三','星期四','星期五','星期六','星期日'];
  let courseIndex = null, pendingImport = null, stagedBackup = null;
  function download(data, name, type = 'application/json') {
    const url = URL.createObjectURL(new Blob([data], {type}));
    const a = document.createElement('a'); a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  function dateValid(value) {
    const d = new Date(value + 'T00:00:00');
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(d) && dateISO(d) === value && d.getFullYear() >= 2000 && d.getFullYear() <= 2100;
  }
  function numbers(text, max) {
    if (typeof text !== 'string' || text.length > 200) throw Error('周次或节次过长');
    const values = new Set();
    for (const part of text.replace(/[，、]/g, ',').split(',')) {
      const match = part.trim().match(/^(\d{1,2})(?:\s*-\s*(\d{1,2}))?$/);
      if (!match) throw Error('周次、节次请填写数字或范围，例如 1-8,10-17');
      const a = Number(match[1]), b = Number(match[2] || match[1]);
      if (a < 1 || b < a || b > max) throw Error(`范围应在 1-${max} 内`);
      for (let n = a; n <= b; n++) values.add(n);
    }
    return [...values].sort((a,b) => a-b);
  }
  function toRanges(list) {
    const ranges = [];
    list.forEach(n => { const last = ranges.at(-1); if (last && last[1] === n-1) last[1] = n; else ranges.push([n,n]); });
    return ranges;
  }
  function makeCourse(row) {
    const name = String(row.name || '').trim(), day = Number(row.day);
    if (!name || name.length > 120 || !Number.isInteger(day) || day < 0 || day > 6) throw Error('请填写课程名称和星期');
    return {code:'自定义', name, teacher:String(row.teacher || '').trim().slice(0,120), room:String(row.room || '').trim().slice(0,160),
      type:row.type === 'public' ? 'public' : 'major', day, weeks:toRanges(numbers(row.weeks,20)), periods:numbers(row.periods,11)};
  }
  const signature = c => JSON.stringify([c.name,c.teacher,c.room,c.day,c.weeks,c.periods]);
  const overlap = (a,b) => a.day === b.day && rangesOverlap(a.weeks,b.weeks) && periodsOverlap(a.periods,b.periods);
  function readyToEdit() {
    if (!editorDirty) return true;
    showActionToast('请先保存或撤销已有草稿'); return false;
  }
  const baseCommit = commitQuickChange;
  commitQuickChange = function(message, undo) {
    const latest = readStored(localSnapshotKey);
    if (Number(latest?.changedAt) > stateUpdatedAt) { showActionToast('另一个页面已更新存档，请重新打开后再保存'); return false; }
    const ok = baseCommit(message, undo);
    if (ok) { $('#shareSaveState').textContent = '已自动保存到这台设备'; renderLibrary(); }
    return ok;
  };
  $('#editView .editor-toolbar').insertAdjacentHTML('afterend', `<section class="share-workbench"><div class="share-command-row"><button type="button" class="speak utility-button" id="shareAddCourse">${icon('plus')}添加课程</button><button type="button" class="mode utility-button" id="shareAddTask">${icon('calendar-plus')}添加日程</button><button type="button" class="mode utility-button" id="shareBackup">${icon('download')}下载备份</button><button type="button" class="mode utility-button" id="shareRestore">${icon('upload')}恢复备份</button><button type="button" class="mode utility-button" id="shareFeedback">${icon('message-square')}反馈</button></div><p id="shareSaveState" class="tip" role="status">保存到这台设备 · 未下载备份</p><div class="share-calendar-row"><label>第 1 周的周一<input id="shareTermStart" type="date" required></label><button type="button" class="mode utility-button" id="shareSetTerm">${icon('check')}保存日期</button></div><h3>我的课程</h3><div id="shareCourseLibrary"></div><div class="share-command-row"><button type="button" class="mode utility-button" id="shareImportCSV">${icon('file-up')}导入课程 CSV</button><button type="button" class="mode utility-button" id="shareCSVTemplate">${icon('file-down')}下载填写模板</button></div><input id="shareBackupFile" type="file" accept=".json,application/json" hidden><input id="shareCSVFile" type="file" accept=".csv,text/csv" hidden></section>`);
  document.body.insertAdjacentHTML('beforeend', `<dialog class="quick-dialog" id="shareCourseDialog"><header><h2 id="shareCourseTitle">添加课程</h2><button type="button" class="atelier-icon" data-quick-close aria-label="关闭">${icon('x')}</button></header><form class="quick-form" id="shareCourseForm"><label>课程名称<input id="shareCourseName" required maxlength="120" autocomplete="off"></label><div class="field-pair"><label>教师<input id="shareCourseTeacher" maxlength="120"></label><label>教室<input id="shareCourseRoom" maxlength="160"></label><label>星期<select id="shareCourseDay">${dayNames.map((d,i) => `<option value="${i}">${d}</option>`).join('')}</select></label><label>类别<select id="shareCourseType"><option value="major">专业课</option><option value="public">公共课</option></select></label><label>节次<input id="shareCoursePeriods" required placeholder="1-2" maxlength="200"></label><label>周次<input id="shareCourseWeeks" required placeholder="1-17" maxlength="200"></label></div><label class="share-check"><input id="shareAllowConflict" type="checkbox">允许与其他课程时间重叠</label><p class="form-error" id="shareCourseError" role="status"></p><div class="form-footer"><button type="button" id="shareCourseDelete" class="danger" hidden>删除课程</button><button type="button" data-quick-close>取消</button><button type="submit" class="speak utility-button">${icon('check')}保存</button></div></form></dialog><dialog class="quick-dialog" id="shareRestoreDialog"><header><h2>恢复备份</h2><button type="button" class="atelier-icon" data-quick-close aria-label="关闭">${icon('x')}</button></header><div class="quick-form"><p id="shareRestoreSummary"></p><p class="tip">将替换本机课表、计划和背词进度。恢复前会保留一份原存档，可撤销。</p><p class="form-error" id="shareRestoreError" role="status"></p><div class="form-footer"><button type="button" data-quick-close>取消</button><button type="button" class="speak" id="shareRestoreConfirm">确认恢复</button></div></div></dialog><dialog class="quick-dialog" id="shareCSVDialog"><header><h2>课程导入</h2><button type="button" class="atelier-icon" data-quick-close aria-label="关闭">${icon('x')}</button></header><div class="quick-form"><p id="shareCSVSummary"></p><label class="share-check"><input id="shareCSVAllowConflict" type="checkbox">允许时间重叠</label><p class="form-error" id="shareCSVError" role="status"></p><div class="form-footer"><button type="button" data-quick-close>取消</button><button class="speak" type="button" id="shareCSVConfirm">添加到我的课程</button></div></div></dialog>`);
  for (const id of ['shareCourseDialog','shareRestoreDialog','shareCSVDialog']) {
    const dialog = $('#' + id);
    dialog.querySelectorAll('[data-quick-close]').forEach(b => b.onclick = closeQuickDialog);
    dialog.addEventListener('cancel', e => {e.preventDefault();closeQuickDialog();});
  }
  $('#shareRestore').insertAdjacentHTML('afterend', `<button type="button" class="mode utility-button" id="shareSafetyRestore" hidden title="恢复上次导入前保留的原存档">${icon('history')}恢复前存档</button>`);
  $('#shareSafetyRestore').onclick = () => {
    if(!readyToEdit())return;
    try{
      stagedBackup=validateBackup({format:'dusk-share-backup',schema:1,data:readStored(backupKey)});
      $('#shareRestoreSummary').textContent=`恢复上次导入前的存档：${stagedBackup.selectedCourses.length} 段课程 · ${stagedBackup.appointments.length} 条日程 · 含背词进度`;
      $('#shareRestoreError').textContent='';openQuickDialog('shareRestoreDialog');
    }catch(err){showActionToast(err.message);}
  };
  function renderLibrary() {
    $('#shareSafetyRestore').hidden=!validSnapshot(readStored(backupKey));
    $('#shareTermStart').value = dateISO(semesterStart);
    $('#shareCourseLibrary').innerHTML = selectedCourses.map((c,i) => `<button type="button" class="share-course-row" data-share-course="${i}"><span><strong>${escapeHtml(c.name)}</strong><small>${escapeHtml(dayNames[c.day])} · ${escapeHtml(compactPeriods(c.periods))}节 · ${escapeHtml(compactWeeks(c.weeks))}周</small><small>${escapeHtml([c.teacher,c.room].filter(Boolean).join(' · '))}</small></span>${icon('pencil')}</button>`).join('') || '<p class="tip">还没有课程</p>';
    $('#shareCourseLibrary').querySelectorAll('[data-share-course]').forEach(b => b.onclick = () => openCourse(Number(b.dataset.shareCourse)));
    refreshIcons();
  }
  function openCourse(index = null) {
    if (!readyToEdit()) return;
    courseIndex = index;
    const c = index === null ? {name:'',teacher:'',room:'',day:todayIndex,type:'major',periods:[1,2],weeks:[[1,17]]} : selectedCourses[index];
    if (!c) return;
    for (const field of ['Name','Teacher','Room','Day','Type']) $('#shareCourse' + field).value = c[field.toLowerCase()];
    $('#shareCourseWeeks').value = compactWeeks(c.weeks); $('#shareCoursePeriods').value = compactPeriods(c.periods);
    $('#shareAllowConflict').checked = false; $('#shareCourseError').textContent = '';
    $('#shareCourseDelete').hidden = index === null; $('#shareCourseTitle').textContent = index === null ? '添加课程' : '修改课程';
    openQuickDialog('shareCourseDialog');
  }
  $('#shareAddCourse').onclick = () => openCourse();
  // Capture the legacy add button before its placeholder-producing handler.
  $('#addCourseBtn').addEventListener('click', e => {e.stopImmediatePropagation();openCourse();}, true);
  $('#shareAddTask').onclick = () => openTaskEditor();
  document.addEventListener('click', e => {
    const block = e.target.closest('[data-course-index]');
    if (!block || currentViewId() !== 'scheduleView') return;
    e.preventDefault();e.stopImmediatePropagation();openCourse(Number(block.dataset.courseIndex));
  }, true);
  document.addEventListener('keydown', e => {
    const block = e.target.closest('[data-course-index]');
    if (block && ['Enter',' '].includes(e.key)) {e.preventDefault();e.stopImmediatePropagation();openCourse(Number(block.dataset.courseIndex));}
  }, true);
  $('#shareCourseForm').onsubmit = e => {
    e.preventDefault();
    try {
      const c = makeCourse(Object.fromEntries(['Name','Teacher','Room','Day','Type','Weeks','Periods'].map(f => [f.toLowerCase(), $('#shareCourse'+f).value])));
      const others = selectedCourses.filter((_,i) => i !== courseIndex);
      if (others.some(o => signature(o) === signature(c))) throw Error('这段课程已存在');
      if (others.some(o => overlap(o,c)) && !$('#shareAllowConflict').checked) throw Error('时间与其他课程重叠，请核对或勾选允许重叠');
      const previous = structuredClone(selectedCourses);
      if (courseIndex === null && selectedCourses.length >= 200) throw Error('最多保存 200 段课程');
      if (courseIndex === null) selectedCourses.push(c); else selectedCourses[courseIndex] = c;
      if (!commitQuickChange('课程已保存', () => {selectedCourses = previous;})) {selectedCourses = previous;throw Error('未保存，请保留表单后重试');}
      closeQuickDialog();
    } catch (err) {$('#shareCourseError').textContent = err.message;}
  };
  $('#shareCourseDelete').onclick = () => {
    const previous = structuredClone(selectedCourses); selectedCourses.splice(courseIndex,1);
    if (!commitQuickChange('课程已删除', () => {selectedCourses = previous;})) {selectedCourses = previous;return;}
    closeQuickDialog();
  };
  $('#shareSetTerm').onclick = () => {
    if (!readyToEdit()) return;
    const value = $('#shareTermStart').value, date = new Date(value + 'T00:00:00');
    if (!dateValid(value) || date.getDay() !== 1) {showActionToast('请选择第 1 周的星期一');return;}
    const old = semesterStart.getTime(); semesterStart.setTime(date.getTime());
    if (!commitQuickChange('开学日期已保存', () => {semesterStart.setTime(old);refreshCalendarNavigation(true);})){semesterStart.setTime(old);return;}
    refreshCalendarNavigation(true);
  };
  $('#shareBackup').onclick = async () => {
    if (!readyToEdit()) return;
    const data = {format:'dusk-share-backup',schema:1,exportedAt:new Date().toISOString(),data:snapshot()};
    const text=JSON.stringify(data,null,2),name=`夕的手账-完整备份-${dateISO(new Date())}.json`;
    const file=new File([text],name,{type:'application/json'});
    if(matchMedia('(max-width:760px)').matches && navigator.canShare?.({files:[file]})){
      try{await navigator.share({files:[file],title:'夕的手账完整备份'});}
      catch(err){if(err.name==='AbortError'){$('#shareSaveState').textContent='已取消备份，存档未改变';return;}download(text,name);}
    }else download(text,name);
    try {localStorage.setItem(backupDateKey, data.exportedAt);} catch {}
    $('#shareSaveState').textContent = '已请求下载备份，请确认文件已保存';
  };
  function validateBackup(file) {
    if (file?.format !== 'dusk-share-backup' || file.schema !== 1 || !validSnapshot(file.data)) throw Error('不是可用的分享版备份，原存档未改变');
    const d = file.data;
    if (d.selectedCourses.length > 200 || d.days.some(day => day.tasks.length > 300)) throw Error('备份内容超出容量');
    const courses = d.selectedCourses.map(c => {
      if (c.weeks.some(r=>!Array.isArray(r)||r.length!==2||r.some(n=>!Number.isInteger(n)||n<1||n>20)||r[0]>r[1]) || c.periods.some(n=>!Number.isInteger(n)||n<1||n>11)) throw Error('课程周次、节次不正确');
      const safe=makeCourse({...c,weeks:compactWeeks(c.weeks),periods:compactPeriods(c.periods)});
      if(typeof c.code==='string' && c.code.length<=120)safe.code=c.code;
      if(['major','public','lab'].includes(c.type))safe.type=c.type;
      return safe;
    });
    for (const day of d.days) for (const task of day.tasks) {
      if (!Array.isArray(task) || task.length < 3 || task.length > 5 || task.slice(0,3).some(v=>typeof v!=='string'||v.length>2000) || (task[4]!=null && typeof task[4]!=='string')) throw Error('计划内容格式不正确');
      if(task[3]!=null && (!Array.isArray(task[3]) || task[3].length>20 || task[3].some(r=>!Array.isArray(r)||r.length!==2||r.some(n=>!Number.isInteger(n)||n<1||n>20)||r[0]>r[1])))throw Error('计划周次格式不正确');
    }
    const items = d.appointments || [];
    if (!Array.isArray(items) || items.length > 1000) throw Error('日程内容格式不正确');
    const appts = items.map(t => {
      if (!t || typeof t.id !== 'string' || typeof t.title !== 'string' || t.title.length > 120 || !dateValid(t.date) || !['once','weekly'].includes(t.repeat) || !['start','end'].every(k => typeof t[k] === 'string' && (!t[k] || /^([01]\d|2[0-3]):[0-5]\d$/.test(t[k]))) || (t.end && (!t.start || t.end <= t.start)) || typeof t.note !== 'string' || t.note.length > 500) throw Error('日程内容格式不正确');
      return {id:t.id,title:t.title,date:t.date,start:t.start,end:t.end,note:t.note,repeat:t.repeat};
    });
    if (d.shareCalendar && (!dateValid(d.shareCalendar) || new Date(d.shareCalendar+'T00:00:00').getDay() !== 1)) throw Error('开学日期不正确');
    if (!dateValid(d.englishStart) || !d.englishProgress || typeof d.englishProgress !== 'object' || Array.isArray(d.englishProgress) || !d.checked || typeof d.checked !== 'object' || Array.isArray(d.checked) || !Array.isArray(d.englishAdjustments || [])) throw Error('背词进度格式不正确');
    for (const map of ['remembered','forgotten']) {
      const values=d.englishProgress[map];
      if(values && (typeof values!=='object'||Array.isArray(values)||Object.values(values).some(v=>!Number.isInteger(v)||v<0||v>100000)))throw Error('背词记录不正确');
    }
    if (d.days.some(day=>typeof day.name!=='string'||typeof day.line!=='string'||day.name.length>120||day.line.length>2000))throw Error('周计划格式不正确');
    const learner={};
    for (const name of ['remembered','forgotten']) if (d.englishProgress[name]) learner[name]=structuredClone(d.englishProgress[name]);
    if (d.englishProgress.trainingV1) {
      if (!window.validateWordTrainingState?.(d.englishProgress.trainingV1)) throw Error('背词练习记录格式不正确，原存档保留');
      learner.trainingV1=structuredClone(d.englishProgress.trainingV1);
    }
    if(Object.values(d.checked).some(value=>typeof value!=='boolean'))throw Error('打勾记录不正确');
    // Only study fields are imported; credentials and arbitrary browser keys never are.
    return {selectedCourses:courses,days:d.days.map(day=>({name:day.name,date:typeof day.date==='string'?day.date:'',line:day.line,tasks:structuredClone(day.tasks)})),appointments:appts,checked:structuredClone(d.checked),englishProgress:learner,englishStart:d.englishStart,englishAdjustments:structuredClone(d.englishAdjustments || []),shareCalendar:d.shareCalendar || '2026-09-07',mode:'full',changedAt:Date.now()};
  }
  $('#shareRestore').onclick = () => {if(readyToEdit()) $('#shareBackupFile').click();};
  $('#shareBackupFile').onchange = async e => {
    const file = e.target.files[0]; e.target.value = ''; if (!file) return;
    try {
      if (file.size > 2*1024*1024) throw Error('备份应小于 2MB');
      stagedBackup = validateBackup(JSON.parse(await file.text()));
      $('#shareRestoreSummary').textContent = `${stagedBackup.selectedCourses.length} 段课程 · ${stagedBackup.appointments.length} 条日程 · 含背词进度`;
      $('#shareRestoreError').textContent = '';openQuickDialog('shareRestoreDialog');
    } catch(err) {stagedBackup = null;showActionToast(err.message);}
  };
  function restoreSnapshot(data) {
    // Commit one authoritative record before updating secondary legacy keys.
    data.changedAt = Math.max(Date.now(),stateUpdatedAt+1);
    localStorage.setItem(localSnapshotKey, JSON.stringify(data));
    selectedCourses=structuredClone(data.selectedCourses);days=structuredClone(data.days);
    appointments=structuredClone(data.appointments || []);checked=structuredClone(data.checked);
    englishProgress=structuredClone(data.englishProgress);englishStart=data.englishStart;
    englishAdjustments=structuredClone(data.englishAdjustments || []);
    semesterStart.setTime(new Date(data.shareCalendar+'T00:00:00').getTime());stateUpdatedAt=data.changedAt;
    ensureTaskIds();committedState=structuredClone(snapshot());
    // Secondary keys are compatibility caches, never the source of recovery truth.
    for(const [key,value] of [[englishStateKey,JSON.stringify(englishProgress)],[englishStartKey,englishStart],[stateKey,JSON.stringify(checked)],[stateUpdatedAtKey,String(stateUpdatedAt)]]){try{localStorage.setItem(key,value);}catch{}}
    refreshCalendarNavigation(true);renderEnglish();renderEditor();renderLibrary();
  }
  $('#shareRestoreConfirm').onclick = () => {
    if (!stagedBackup) return;
    const previous = snapshot();
    try {
      if (Number(readStored(localSnapshotKey)?.changedAt) > stateUpdatedAt) throw Error('另一个页面已更新，请重新打开后再恢复');
      localStorage.setItem(backupKey, JSON.stringify(previous));
      restoreSnapshot(stagedBackup); clearEditorDraft(); editorDirty = false;
      closeQuickDialog();showActionToast('备份已恢复', () => {try{restoreSnapshot(previous);showActionToast('已撤销恢复');}catch{showActionToast('恢复失败，安全存档仍保留');}});
    } catch(err) {$('#shareRestoreError').textContent = '恢复未完成：'+err.message+'；安全存档已保留。';}
  };
  $('#shareCSVTemplate').onclick = () => download('\uFEFF课程名称,教师,教室,星期,节次,周次\n学术英语,张老师,东C101,3,1-2,"1-8,10-17"\n', '课程填写模板.csv','text/csv;charset=utf-8');
  $('#shareImportCSV').onclick = () => {if(readyToEdit()) $('#shareCSVFile').click();};
  $('#shareCSVFile').onchange = async e => {
    const file = e.target.files[0];e.target.value = '';if(!file)return;
    try {
      if(file.size > 256*1024)throw Error('CSV 应小于 256KB');
      const parsed = Papa.parse(await file.text(),{header:true,skipEmptyLines:'greedy',transformHeader:h=>h.replace(/^\uFEFF/,'').trim()});
      if(parsed.errors.length || parsed.data.length > 200 || !['课程名称','星期','节次','周次'].every(k=>parsed.meta.fields.includes(k)))throw Error('请使用课程填写模板，核对表头、引号和行数');
      const records = parsed.data.map((r,i) => {try{return makeCourse({name:r['课程名称'],teacher:r['教师'],room:r['教室'],day:Number(r['星期'])-1,weeks:r['周次'],periods:r['节次']});}catch(err){throw Error(`第 ${i+2} 行：${err.message}`);}});
      const seen = new Set(selectedCourses.map(signature));
      pendingImport = records.filter(c => {const key=signature(c);if(seen.has(key))return false;seen.add(key);return true;});
      $('#shareCSVSummary').textContent = `新增 ${pendingImport.length} 段课程，跳过 ${records.length-pendingImport.length} 段重复记录。现有课程不替换。`;
      $('#shareCSVAllowConflict').checked=false;$('#shareCSVError').textContent='';openQuickDialog('shareCSVDialog');
    }catch(err){pendingImport=null;showActionToast(err.message);}
  };
  $('#shareCSVConfirm').onclick = () => {
    if(!pendingImport?.length){$('#shareCSVError').textContent='没有新增课程';return;}
    const all = [...selectedCourses,...pendingImport];
    if(all.length>200){$('#shareCSVError').textContent='最多保存 200 段课程';return;}
    if(!$('#shareCSVAllowConflict').checked && pendingImport.some((c,i)=>[...selectedCourses,...pendingImport.slice(0,i)].some(o=>overlap(o,c)))){$('#shareCSVError').textContent='存在重叠时间，请核对或允许重叠';return;}
    const previous=structuredClone(selectedCourses);selectedCourses=all;
    if(!commitQuickChange('课程已导入',()=>{selectedCourses=previous;})){selectedCourses=previous;return;}
    closeQuickDialog();
  };
  $('#shareFeedback').onclick = () => window.openPetFeedback();
  $('#atelierSettingsDialog .atelier-settings').insertAdjacentHTML('beforeend', '<button type="button" class="mode utility-button" id="shareMenuButton"><i data-lucide="share-2"></i>分享与示例</button><button type="button" class="mode utility-button" id="feedbackMenuButton"><i data-lucide="message-square"></i>留张反馈便签</button>');
  $('#shareMenuButton').onclick = () => {closeQuickDialog();$('#demoOptions').click();};
  $('#feedbackMenuButton').onclick = () => {closeQuickDialog();window.openPetFeedback();};
  const baseRender = renderEditor;
  renderEditor = function(){baseRender();renderLibrary();$('#editView').dataset.shareDraft=String(editorDirty);editorState.textContent=editorDirty?'草稿已存本机 · 待保存':'课表与计划已存本机';};
  // Existing advanced fields remain available, with draft autosave and explicit commit.
  $('#editView').classList.add('share-edit');
  const lastBackup=localStorage.getItem(backupDateKey);
  if(lastBackup)$('#shareSaveState').textContent='已存本机 · 上次请求备份 '+lastBackup.slice(0,10);
  $('#shareCourseLibrary').setAttribute('aria-live','polite');renderEditor();
  window.addEventListener('storage',e=>{
    if(e.key !== localSnapshotKey || !e.newValue)return;
    if(editorDirty || document.querySelector('dialog[open]')){showActionToast('另一页面有新记录，请结束编辑后重新打开');return;}
    try{const data=JSON.parse(e.newValue);if(validSnapshot(data)&&Number(data.changedAt)>stateUpdatedAt){applySnapshot(data);refreshCalendarNavigation(true);renderLibrary();showActionToast('已读取另一页面的新记录');}}catch{}
  });
  window.shareTools = {validateBackup};
})();
