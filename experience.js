// Local recovery and focused editing share the existing course/English model.
const localSnapshotKey = appStorageKey("dusk-study-pet-full-state-v1");
const resumeKey = appStorageKey("dusk-study-pet-resume-v1");
const editorDraftKey = appStorageKey("dusk-study-pet-draft-v1");
let appointments = [];
let englishAdjustments = [];
let dailyFlow = {version:1,presetsCleared:false,words:[]};
const cloudBaseKey=appStorageKey('dusk-cloud-base-v1');
const dailyRecoveryKey=appStorageKey('dusk-daily-recovery-v1');
const presetRecoveryKey=appStorageKey('dusk-preset-recovery-v1');
function validateDailyAppointments(items) {
  if(items==null)return [];
  if(!Array.isArray(items)||items.length>2000)throw new Error('日程格式不正确，本机存档保留');
  const ids=new Set();return items.map(t=>{if(!t||typeof t.id!=='string'||t.id.length>160||ids.has(t.id)||typeof t.title!=='string'||t.title.length>120||!/^\d{4}-\d{2}-\d{2}$/.test(t.date)||!['once','weekly'].includes(t.repeat)||typeof t.note!=='string'||t.note.length>500||!['start','end'].every(k=>typeof t[k]==='string'&&(!t[k]||/^([01]\d|2[0-3]):[0-5]\d$/.test(t[k])))||(t.end&&(!t.start||t.end<=t.start)))throw new Error('日程内容格式不正确，本机存档保留');ids.add(t.id);return structuredClone(t);});
}
function validateDailyFlow(value) {
  if(value==null)return {version:1,presetsCleared:false,words:[]};
  if(value.version!==1||!Array.isArray(value.words)||value.words.length>1000)throw new Error('生词本格式不正确，原存档保留');
  const ids=new Set();
  const words=value.words.map(w=>{
    if(!w||typeof w.id!=='string'||w.id.length>100||ids.has(w.id)||typeof w.term!=='string'||w.term.length>80||typeof w.meaning!=='string'||w.meaning.length>300||typeof w.example!=='string'||w.example.length>500||!['n.','v.','adj.','adv.','phrase'].includes(w.pos)||typeof w.enroll!=='boolean'||!Number.isInteger(w.stage)||w.stage<0||w.stage>5||!/^\d{4}-\d{2}-\d{2}$/.test(w.due)||!Number.isFinite(w.updatedAt)||w.updatedAt<0)throw new Error('生词内容格式不正确，原存档保留');
    ids.add(w.id);return {id:w.id,term:w.term,meaning:w.meaning,example:w.example,pos:w.pos,enroll:w.enroll,stage:w.stage,due:w.due,updatedAt:w.updatedAt,deleted:w.deleted===true,conflict:w.conflict===true};
  });
  return {version:1,presetsCleared:value.presetsCleared===true,words};
}
function rememberRecovery(data,reason) {
  const list=readStored(dailyRecoveryKey)||[];
  list.push({at:new Date().toISOString(),reason,data:structuredClone(data)});
  if(reason.includes('周计划')&&!localStorage.getItem(presetRecoveryKey))localStorage.setItem(presetRecoveryKey,JSON.stringify(list.at(-1)));
  localStorage.setItem(dailyRecoveryKey,JSON.stringify(list.slice(-3)));
}
function mergeDailyRecords(base,local,remote) {
  const map=new Map(remote.map(x=>[x.id,structuredClone(x)])),before=new Map((base||[]).map(x=>[x.id,x]));
  for(const item of local){
    const old=before.get(item.id),other=map.get(item.id),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
    if(!other){map.set(item.id,structuredClone(item));continue;}
    if(same(item,other)||same(item,old))continue;
    if(same(other,old)){map.set(item.id,structuredClone(item));continue;}
    // Keep both edits for explicit review; never silently replace a competing item.
    const main=item.deleted?item:other.deleted?other:item,copy=main===item?other:item;
    map.set(item.id,structuredClone(main));
    const id='conflict-'+item.id.slice(0,50)+'-'+String(copy.updatedAt||0)+'-'+Array.from(JSON.stringify(copy)).reduce((a,c)=>(a*31+c.charCodeAt(0))>>>0,0);
    if(!map.has(id))map.set(id,{...structuredClone(copy),id,conflict:true});
  }
  return [...map.values()];
}
function reconcileDailySnapshot(remote) {
  const base=readStored(cloudBaseKey),local=snapshot(),flow=validateDailyFlow(remote.dailyFlow);
  const preferLocal=selectedCourses.length&&stateUpdatedAt>Number(remote.changedAt||0);
  if(!preferLocal&&base&&stateUpdatedAt>Number(base.changedAt||0))rememberRecovery(local,'应用较新云档前保留本机修改');
  const result={...(preferLocal?local:remote),appointments:mergeDailyRecords(base?.appointments,appointments,validateDailyAppointments(remote.appointments)),dailyFlow:{...flow,presetsCleared:flow.presetsCleared||dailyFlow.presetsCleared,words:mergeDailyRecords(base?.dailyFlow?.words,dailyFlow.words,flow.words)}};
  if(!isDemo&&!preferLocal&&result.dailyFlow.presetsCleared&&!remote.dailyFlow?.presetsCleared){
    if(result.days.some(d=>d.tasks.some(t=>!t[4]||String(t[4]).startsWith('weekly-'))))rememberRecovery(result,'移除旧云档中的预排周计划前');
    result.days=result.days.map(d=>({...d,tasks:d.tasks.filter(t=>t[4]&&!String(t[4]).startsWith('weekly-'))}));
  }
  if(JSON.stringify(result.appointments)!==JSON.stringify(remote.appointments||[])||JSON.stringify(result.dailyFlow)!==JSON.stringify(remote.dailyFlow||{})||JSON.stringify(result.days)!==JSON.stringify(remote.days))result.changedAt=Math.max(Date.now(),stateUpdatedAt+1,Number(remote.changedAt||0)+1);
  return result;
}
function confirmCloudBaseline(data){try{localStorage.setItem(cloudBaseKey,JSON.stringify(data));}catch{updateSyncStatus('已同步，但本机恢复空间不足，请导出备份');}}
let committedState = null;
let activeDialog = null;
let editedItem = null;
let toastTimer = null;
let undoAction = null;
let syncJob = Promise.resolve();
let restoringResume = true;
let resumeRestored = false;
const readStored = key => { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; } };
function dateISO(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`; }
function selectedDateISO(dayIndex = activeDay) { const date = new Date(semesterStart); date.setDate(date.getDate() + (activeWeek()-1)*7 + dayIndex); return dateISO(date); }
function validSnapshot(data) { return !!data && Array.isArray(data.selectedCourses) && (isDemo || data.selectedCourses.length > 0) && data.selectedCourses.every(c => c && typeof c.name === "string" && Array.isArray(c.weeks) && Array.isArray(c.periods)) && Array.isArray(data.days) && data.days.length === 7 && data.days.every(d => d && Array.isArray(d.tasks)); }
const originalSnapshot = snapshot;
snapshot = function() { return { ...originalSnapshot(), appointments, englishAdjustments, dailyFlow, ...(isDemo ? {shareCalendar:dateISO(semesterStart)} : {}) }; };
function ensureTaskIds() {
  days.forEach((day, dayIndex) => day.tasks.forEach((task,index) => {
    if (task[4]) return;
    task[4] = `weekly-${dayIndex}-${index}-${Array.from(String(task[0])).reduce((h,c) => ((h*31+c.charCodeAt(0))>>>0),0)}`;
    const legacy = taskId(dayIndex,index);
    if (Object.hasOwn(checked,legacy) && !Object.hasOwn(checked,task[4])) checked[task[4]] = checked[legacy];
  }));
}
function persistLocalState() {
  if (!validSnapshot(snapshot())) return;
  if (isDemo && Number(readStored(localSnapshotKey)?.changedAt) > stateUpdatedAt) return;
  const data = snapshot();
  if (editorDirty && committedState) { data.selectedCourses = committedState.selectedCourses; data.days = committedState.days; }
  try { localStorage.setItem(localSnapshotKey,JSON.stringify(data)); }
  catch { updateSyncStatus("本机空间不足，请联网同步后导出备份"); }
}
function cacheCommittedState() { ensureTaskIds(); committedState = structuredClone(snapshot()); persistLocalState(); }
function persistEditorDraft() {
  document.querySelector("#discardDraftBtn").hidden = false;
  try { localStorage.setItem(editorDraftKey,JSON.stringify({selectedCourses,days})); }
  catch { editorState.textContent = "草稿未保存，请保留页面；本机空间不足"; }
}
function clearEditorDraft() { localStorage.removeItem(editorDraftKey); document.querySelector("#discardDraftBtn").hidden = true; }
function saveResumePoint(wordId) {
  if (restoringResume) return;
  const previous = readStored(resumeKey) || {};
  const data = { view:currentViewId(),scroll:window.scrollY,date:dateISO(new Date()),studyDate:dateISO(englishStudyDate()),wordId:wordId || previous.wordId };
  try { localStorage.setItem(resumeKey,JSON.stringify(data)); } catch { /* The full snapshot remains the recovery source. */ }
}
function restoreResumePoint() {
  if (resumeRestored) return;
  resumeRestored = true;
  if (matchMedia("(max-width: 760px)").matches) { startApp("homeView"); return; }
  const resume = readStored(resumeKey);
  if (!resume) return;
  startApp(resume.view || "scheduleView");
  requestAnimationFrame(() => {
    const card = [...document.querySelectorAll("[data-word-card]")].find(c => c.dataset.wordCard === resume.wordId);
    if (currentViewId() === "englishView" && resume.studyDate === dateISO(englishStudyDate()) && card) card.scrollIntoView({block:"center"});
    else if (currentViewId() === "englishView" && resume.studyDate === dateISO(englishStudyDate())) window.scrollTo(0,Number(resume.scroll)||0);
    else window.scrollTo(0,0);
  });
}
let calendarDate = dateISO(today);
let vocabularyDate = dateISO(englishStudyDate());
function refreshCalendarNavigation(force = false) {
  const now = new Date();
  const nextDate = dateISO(now), nextVocabularyDate = dateISO(englishStudyDate(now));
  const calendarChanged = nextDate !== calendarDate, vocabularyChanged = nextVocabularyDate !== vocabularyDate;
  today = now;
  currentWeek = teachingWeek(now);
  todayIndex = (now.getDay() + 6) % 7;
  calendarDate = nextDate;
  vocabularyDate = nextVocabularyDate;
  if (force || calendarChanged) { activeDay = todayIndex; weekInput.value = currentWeek; }
  if (!(force || calendarChanged || vocabularyChanged) || days.length !== 7) return;
  const view = currentViewId(), heading = mainHeading.textContent, sub = mainSub.textContent, scroll = window.scrollY;
  renderWeek(); renderTasks(); renderSchedule();
  if (view !== "tasksView") { mainHeading.textContent = heading; mainSub.textContent = sub; }
  if (vocabularyChanged) renderEnglish();
  window.scrollTo(0,scroll);
  saveResumePoint();
}
const oldApplySnapshot = applySnapshot;
applySnapshot = function(data) {
  if (!validSnapshot(data)) throw new Error("云端课表格式异常，本机记录保留");
  const safeAppointments=validateDailyAppointments(data.appointments),safeFlow=validateDailyFlow(data.dailyFlow);
  if (!selectedCourses.length && stateUpdatedAt > Number(data.changedAt || 0)) {
    data = { ...data, changedAt:stateUpdatedAt, checked:{...data.checked,...checked}, englishProgress:{...data.englishProgress,...englishProgress,
      remembered:{...data.englishProgress?.remembered,...englishProgress.remembered}, forgotten:{...data.englishProgress?.forgotten,...englishProgress.forgotten}} };
  }
  appointments = safeAppointments;
  dailyFlow=safeFlow;
  englishAdjustments = Array.isArray(data.englishAdjustments) ? data.englishAdjustments : [];
  if (isDemo && /^\d{4}-\d{2}-\d{2}$/.test(data.shareCalendar || "")) {
    const start = new Date(data.shareCalendar + "T00:00:00");
    if (!isNaN(start) && start.getDay() === 1 && dateISO(start) === data.shareCalendar) semesterStart.setTime(start.getTime());
  }
  const scroll = window.scrollY;
  oldApplySnapshot(data);
  ensureTaskIds();
  if(!isDemo&&!dailyFlow.presetsCleared&&selectedCourses.length&&days.some(d=>d.tasks.some(t=>String(t[4]).startsWith('weekly-')))){
    rememberRecovery(snapshot(),'清理旧预排周计划前');
    days.forEach(d=>d.tasks=d.tasks.filter(t=>!String(t[4]).startsWith('weekly-')));
    dailyFlow.presetsCleared=true;stateUpdatedAt=Math.max(Date.now(),stateUpdatedAt+1);persistLocalState();startApp();
  }else if(!isDemo&&selectedCourses.length&&!dailyFlow.presetsCleared){dailyFlow.presetsCleared=true;persistLocalState();}
  window.scrollTo(0,scroll);
};
const oldPullOrPush = pullOrPushCloudState;
pullOrPushCloudState = function(forcePush=false) {
  const run = () => oldPullOrPush(forcePush);
  syncJob = syncJob.catch(() => {}).then(run);
  return syncJob;
};
function handleSyncFailure(error) {
  const message = error.name === "AbortError" ? "连接超时" : error.message;
  updateSyncStatus(`${selectedCourses.length ? "本机可用，待同步" : "暂未连接"}：${message}`);
  if (!selectedCourses.length) {
    document.querySelector("#privateGateText").textContent = "暂时无法连接云端。请重新连接；这不表示课表已被删除。";
    document.querySelector("#retryCloudBtn").hidden = false;
  }
}

document.body.insertAdjacentHTML("beforeend",`
  <div class="action-toast" id="actionToast" hidden role="status" aria-live="polite"><span id="actionToastText"></span><button type="button" id="actionUndo" hidden>撤销</button></div>
  <dialog class="quick-dialog" id="wordDetailDialog"><header><h2>词汇详情</h2><button class="utility-button" type="button" data-quick-close aria-label="回到单词"><i data-lucide="x"></i></button></header><div class="quick-form" id="wordDetailBody"></div></dialog>
  <dialog class="quick-dialog" id="taskQuickDialog"><header><h2 id="taskQuickTitle">添加日程</h2><button class="utility-button" type="button" data-quick-close aria-label="关闭"><i data-lucide="x"></i></button></header><form class="quick-form" id="taskQuickForm"><label>任务<input id="quickTaskTitle" required maxlength="120"></label><div class="field-pair"><label>日期<input id="quickTaskDate" type="date" required></label><label>重复<select id="quickTaskRepeat"><option value="once">仅此日期</option><option value="weekly">每周这一天</option></select></label><label>开始<input id="quickTaskStart" type="time"></label><label>结束<input id="quickTaskEnd" type="time"></label></div><label>说明<input id="quickTaskNote" maxlength="500"></label><p class="form-error" id="quickTaskError"></p><div class="form-footer"><button type="button" id="quickTaskDelete" hidden>删除</button><button type="button" data-quick-close>取消</button><button class="speak utility-button" type="submit"><i data-lucide="check"></i>保存</button></div></form></dialog>
  <dialog class="quick-dialog" id="rewindQuickDialog"><header><h2>补学 / 回档</h2><button class="utility-button" type="button" data-quick-close aria-label="关闭"><i data-lucide="x"></i></button></header><form class="quick-form" id="rewindQuickForm"><label>今天补学第几天<input id="rewindTarget" type="number" min="1" max="35" required></label><p id="rewindPreview"></p><p class="tip">保留完成记录和词序。仍在凌晨 4 点换日。</p><div class="form-footer"><button type="button" data-quick-close>取消</button><button class="speak" type="submit">确认回档</button></div></form></dialog>
  <dialog class="quick-dialog" id="courseQuickDialog"><header><h2>修改这段课程</h2><button class="utility-button" type="button" data-quick-close aria-label="关闭"><i data-lucide="x"></i></button></header><form class="quick-form" id="courseQuickForm"><label>课程名称<input id="quickCourseName" required></label><div class="field-pair"><label>教师<input id="quickCourseTeacher"></label><label>教室<input id="quickCourseRoom"></label><label>周次<input id="quickCourseWeeks" required placeholder="1-8,10-17"></label><label>节次<input id="quickCoursePeriods" required placeholder="1-2"></label></div><p class="form-error" id="quickCourseError"></p><div class="form-footer"><button type="button" data-quick-close>取消</button><button class="speak" type="submit">保存这段课程</button></div></form></dialog>`);
function refreshIcons() { window.lucide?.createIcons(); }
function showActionToast(text,undo) {
  document.querySelector("#actionToastText").textContent=text;
  undoAction=undo;
  document.querySelector("#actionUndo").hidden=!undo;
  document.querySelector("#actionToast").hidden=false;
  clearTimeout(toastTimer);
  toastTimer=setTimeout(() => {document.querySelector("#actionToast").hidden=true;},7000);
}
document.querySelector("#actionUndo").onclick=() => { undoAction?.(); document.querySelector("#actionToast").hidden=true; };
function openQuickDialog(id) {
  if (document.querySelector("dialog[open]")) return;
  activeDialog=document.querySelector(`#${id}`); activeDialog.showModal();
  history.pushState({petDialog:id},""); refreshIcons();
}
function closeQuickDialog() {
  if (!activeDialog) return;
  activeDialog.close(); activeDialog=null;
  if (history.state?.petDialog) history.back();
}
document.querySelectorAll("[data-quick-close]").forEach(b => b.onclick=closeQuickDialog);
document.querySelectorAll(".quick-dialog").forEach(d => d.addEventListener("cancel",e => {e.preventDefault();closeQuickDialog();}));
window.addEventListener("popstate",() => { if(activeDialog){activeDialog.close();activeDialog=null;} });
document.querySelector("#englishView").addEventListener("click",event => {
  const button=event.target.closest("[data-word-detail]"); if(!button)return;
  const word=[...lessonForToday().words,...reviewWords()].find(w=>w.id===button.dataset.wordDetail); if(!word)return;
  saveResumePoint(word.id);
  const term=encodeURIComponent(word.word);
  document.querySelector("#wordDetailBody").innerHTML=`<p class="dictionary-term">${escapeHtml(word.word)}</p><p>${escapeHtml(word.phonetic)} · ${escapeHtml(word.pos)}</p><p>${escapeHtml(word.meaning)}</p><p>${escapeHtml(exampleForWord(word))}</p><div class="dictionary-links"><a href="https://youdao.com/result?lang=en&word=${term}" target="_blank" rel="noopener noreferrer">有道详细释义</a><a href="https://dictionary.cambridge.org/dictionary/english-chinese-simplified/${term}" target="_blank" rel="noopener noreferrer">剑桥词典</a><a href="https://www.merriam-webster.com/dictionary/${term}" target="_blank" rel="noopener noreferrer">韦氏词典</a><button type="button" class="utility-button" id="copyDetailWord"><i data-lucide="copy"></i>复制</button></div><button type="button" class="mode utility-button" id="returnToStudy"><i data-lucide="arrow-left"></i>继续背词</button>`;
  document.querySelector("#returnToStudy").onclick=closeQuickDialog;
  document.querySelector("#copyDetailWord").onclick=()=>{if(navigator.clipboard?.writeText)navigator.clipboard.writeText(word.word).then(()=>showActionToast("已复制 "+word.word)).catch(()=>window.prompt("复制单词",word.word));else window.prompt("复制单词",word.word);};
  document.querySelectorAll("#wordDetailBody a").forEach(a=>a.onclick=()=>{saveResumePoint(word.id);persistLocalState();});
  openQuickDialog("wordDetailDialog");
});

const oldVisibleTasks=visibleTasks;
const oldCheckId=checkId;
checkId=function(dayIndex,task,taskIndex){
  const id=oldCheckId(dayIndex,task,taskIndex);
  const entry=appointments.find(t=>t.id===task[4]);
  // One-off appointments already identify one date; recurring plans need an occurrence key.
  if(entry?.repeat!=="weekly" && entry)return id;
  const date=String(id).startsWith("english-")?dateISO(englishStudyDate()):selectedDateISO(dayIndex);
  // Undated legacy checks remain archived, never guessed to belong to today's occurrence.
  return `${id}@${date}`;
};
visibleTasks=function(day) {
  const date=selectedDateISO();
  const added=appointments.filter(t=>!t.deleted&&(t.repeat==="weekly" ? date>=t.date && new Date(t.date+"T12:00:00").getDay()===new Date(date+"T12:00:00").getDay() : t.date===date))
    .map(t=>[`${t.start ? t.start+(t.end?"-"+t.end:"")+" " : ""}${t.title}`,"规划",t.note||"",null,t.id]);
  return [...oldVisibleTasks(day),...added];
};
const oldRenderTasks=renderTasks;
renderTasks=function() {
  ensureTaskIds(); oldRenderTasks();
  const list=[...visibleTasks(days[activeDay]),...englishTaskItems()];
  document.querySelectorAll("#tasks .task").forEach((row,index) => {
    const task=list[index]; if(!task || String(task[4]).startsWith("english-"))return;
    const button=document.createElement("button");button.type="button";button.className="task-edit-button utility-button";button.title="修改这项任务";button.setAttribute("aria-label","修改这项任务");button.innerHTML='<i data-lucide="pencil"></i>';
    button.dataset.dailyTask=task[4];button.onclick=e=>{e.preventDefault();e.stopPropagation();openTaskEditor(task[4]);};row.classList.add("task-editable");row.append(button);
  });refreshIcons();
};
function renderAppointments() {
  document.querySelector("#appointmentEditor").innerHTML=appointments.filter(t=>!t.deleted).map(t=>`<button type="button" class="mode" data-appointment-edit="${escapeHtml(t.id)}">${escapeHtml(t.date)} · ${escapeHtml(t.title)}${t.repeat==="weekly"?" · 每周重复":""}${t.conflict?' · 两端修改待核对':''}</button>`).join("")||'<p class="tip">暂无日期日程</p>';
  document.querySelectorAll("[data-appointment-edit]").forEach(b=>b.onclick=()=>openTaskEditor(b.dataset.appointmentEdit));
}
const oldRenderEditor=renderEditor;
renderEditor=function() {oldRenderEditor();renderAppointments();refreshIcons();};
function findWeeklyTask(id) {
  for(let d=0;d<days.length;d++){const i=days[d].tasks.findIndex(t=>t[4]===id);if(i>=0)return {day:d,index:i,task:days[d].tasks[i]};}
  return null;
}
function openTaskEditor(id=null) {
  if(editorDirty){showActionToast("请先保存或撤销编辑草稿，再修改日程");activateView("editView");return;}
  editedItem=id;
  const appointment=appointments.find(t=>t.id===id),weekly=id?findWeeklyTask(id):null;
  const task=appointment||{title:weekly?.task[0]||"",date:selectedDateISO(),start:"",end:"",repeat:weekly?"weekly":"once",note:weekly?.task[2]||""};
  const match=task.title.match(/^(\d{2}:\d{2})(?:-(\d{2}:\d{2}))?\s+(.*)$/);
  document.querySelector("#taskQuickTitle").textContent=id?"修改日程":"添加日程";
  document.querySelector("#quickTaskTitle").value=match?match[3]:task.title;
  document.querySelector("#quickTaskDate").value=task.date;
  document.querySelector("#quickTaskRepeat").value=task.repeat;
  document.querySelector("#quickTaskDate").disabled=!!weekly;
  document.querySelector("#quickTaskRepeat").disabled=!!weekly;
  document.querySelector("#quickTaskStart").value=task.start||(match?.[1]||"");
  document.querySelector("#quickTaskEnd").value=task.end||(match?.[2]||"");
  document.querySelector("#quickTaskNote").value=task.note;
  document.querySelector("#quickTaskError").textContent="";
  document.querySelector("#quickTaskDelete").hidden=!id;
  openQuickDialog("taskQuickDialog");
}
document.querySelector("#quickAddTask").onclick=()=>openTaskEditor();
document.querySelector("#editorAddTask").onclick=()=>openTaskEditor();
function commitQuickChange(message,undo) {
  ensureTaskIds();
  const data = snapshot(); data.changedAt = Math.max(Date.now(),stateUpdatedAt+1);
  try { localStorage.setItem(localSnapshotKey,JSON.stringify(data)); }
  catch { showActionToast("未保存，本机空间不足；请保留草稿后重试"); return false; }
  stateUpdatedAt = data.changedAt;
  try { localStorage.setItem(stateUpdatedAtKey,String(stateUpdatedAt)); } catch { /* changedAt is also in the full snapshot. */ }
  committedState=structuredClone(data);scheduleCloudSync();renderTasks();renderSchedule();renderEditor();
  showActionToast(message+" · 已存本机",undo?()=>{undo();commitQuickChange("已撤销");}:null);
  return true;
}
document.querySelector("#taskQuickForm").onsubmit=e=>{
  e.preventDefault();const title=document.querySelector("#quickTaskTitle").value.trim(),date=document.querySelector("#quickTaskDate").value,start=document.querySelector("#quickTaskStart").value,end=document.querySelector("#quickTaskEnd").value,note=document.querySelector("#quickTaskNote").value.trim();
  if(!title || (end&&!start) || (end&&end<=start)){document.querySelector("#quickTaskError").textContent="请填写任务；结束时间应晚于开始时间。";return;}
  const before={appointments:structuredClone(appointments),days:structuredClone(days)},weekly=editedItem?findWeeklyTask(editedItem):null;
  if(weekly){weekly.task[0]=`${start?start+(end?"-"+end:"")+" ":""}${title}`;weekly.task[2]=note;}
  else{const task={id:editedItem||crypto.randomUUID(),title,date,start,end,note,repeat:document.querySelector("#quickTaskRepeat").value,updatedAt:Date.now(),deleted:false};const i=appointments.findIndex(t=>t.id===editedItem);if(i>=0)appointments[i]=task;else appointments.push(task);}
  if (!commitQuickChange("日程已保存"+(date!==selectedDateISO()?" · "+date:""),()=>{appointments=before.appointments;days=before.days;})) {
    appointments=before.appointments;days=before.days;document.querySelector("#quickTaskError").textContent="未保存，请保留当前草稿，释放本机空间后重试。";return;
  }
  closeQuickDialog();
};
document.querySelector("#quickTaskDelete").onclick=()=>{
  const before={appointments:structuredClone(appointments),days:structuredClone(days)},weekly=findWeeklyTask(editedItem);
  if(weekly)days[weekly.day].tasks.splice(weekly.index,1);else appointments=appointments.map(t=>t.id===editedItem?{...t,deleted:true,updatedAt:Date.now()}:t);
  if (!commitQuickChange("已删除日程",()=>{appointments=before.appointments;days=before.days;})) { appointments=before.appointments;days=before.days;return; }
  closeQuickDialog();
};

function rewindPreview() {
  const input=document.querySelector("#rewindTarget"),target=Number(input.value);
  document.querySelector("#rewindPreview").textContent=`现在第 ${lessonForToday().index+1} 天 → 今天第 ${target} 天；下个学习日接续第 ${Math.min(35,target+1)} 天。`;
}
document.querySelector("#englishRewindBtn").onclick=()=>{
  if(editorDirty){showActionToast("请先保存或撤销编辑草稿");return;}
  const target=document.querySelector("#rewindTarget");target.max=lessonForToday().index+1;target.value=Math.max(1,lessonForToday().index);rewindPreview();openQuickDialog("rewindQuickDialog");
};
document.querySelector("#rewindTarget").oninput=rewindPreview;
document.querySelector("#rewindQuickForm").onsubmit=e=>{
  e.preventDefault();const target=Number(document.querySelector("#rewindTarget").value),oldIndex=englishDayIndex();if(target<1||target>lessonForToday().index+1)return;
  const previous=englishStart,log=structuredClone(englishAdjustments),date=englishStudyDate();date.setDate(date.getDate()-(target-1));englishStart=dateISO(date);
  englishAdjustments.push({date:dateISO(new Date()),from:oldIndex+1,to:target,previousStart:previous});localStorage.setItem(englishStartKey,englishStart);
  closeQuickDialog();markStateChanged();renderEnglish();renderTasks();showActionToast(`已回到第 ${target} 天 · 已存本机`,()=>{englishStart=previous;englishAdjustments=log;localStorage.setItem(englishStartKey,englishStart);markStateChanged();renderEnglish();renderTasks();});
};
const oldRenderSchedule=renderSchedule;
renderSchedule=function(){oldRenderSchedule();document.querySelectorAll(".course-block").forEach(block=>{
  block.dataset.courseEdit="true";block.tabIndex=0;block.setAttribute("role","button");block.title="修改这段课程";
  const open=()=>{if(editorDirty){showActionToast("请先保存或撤销编辑草稿");return;}
    const index=Number(block.dataset.courseIndex);
    if(index<0)return;editedItem=index;const c=selectedCourses[index];document.querySelector("#quickCourseName").value=c.name;document.querySelector("#quickCourseTeacher").value=c.teacher;document.querySelector("#quickCourseRoom").value=c.room;document.querySelector("#quickCourseWeeks").value=compactWeeks(c.weeks);document.querySelector("#quickCoursePeriods").value=compactPeriods(c.periods);document.querySelector("#quickCourseError").textContent="";openQuickDialog("courseQuickDialog");};
  block.onclick=open;block.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();open();}};
});};
document.querySelector("#courseQuickForm").onsubmit=e=>{
  e.preventDefault();const weeks=parseWeeks(document.querySelector("#quickCourseWeeks").value),periods=parsePeriods(document.querySelector("#quickCoursePeriods").value),name=document.querySelector("#quickCourseName").value.trim();
  if(!weeks.length||!periods.length||!name){document.querySelector("#quickCourseError").textContent="课程名称、周次和节次不能为空。";return;}
  const index=editedItem,c=selectedCourses[index],previous=structuredClone(c);Object.assign(c,{name,weeks,periods,teacher:document.querySelector("#quickCourseTeacher").value.trim(),room:document.querySelector("#quickCourseRoom").value.trim()});
  if (!commitQuickChange("课程已保存",()=>{selectedCourses[index]=structuredClone(previous);})) { selectedCourses[index]=previous;document.querySelector("#quickCourseError").textContent="未保存，请保留草稿后重试。";return; }
  closeQuickDialog();
};
document.querySelector("#discardDraftBtn").onclick=()=>{
  if(!committedState)return;selectedCourses=structuredClone(committedState.selectedCourses);days=structuredClone(committedState.days);editorDirty=false;clearEditorDraft();renderEditor();renderTasks();renderSchedule();persistLocalState();scheduleCloudSync();showActionToast("已撤销未保存修改");
};
document.querySelector("#editView").addEventListener("input",event=>{
  if(event.target.matches("input,select"))event.target.dispatchEvent(new Event("change",{bubbles:true}));
});
document.querySelectorAll(".tab-button").forEach(b=>b.addEventListener("click",()=>{saveResumePoint();refreshIcons();}));
document.querySelector("#retryCloudBtn").onclick=()=>setupCloudSync().then(restoreResumePoint).catch(handleSyncFailure);
document.querySelectorAll("#planTodayBtn,#scheduleTodayBtn").forEach(button => button.onclick=()=>refreshCalendarNavigation(true));
window.addEventListener("pagehide",()=>{saveResumePoint();persistLocalState();if(editorDirty)persistEditorDraft();});
document.addEventListener("visibilitychange",()=>{if(document.hidden){saveResumePoint();persistLocalState();}else{refreshCalendarNavigation(true);if(accessCode)pullOrPushCloudState().catch(handleSyncFailure);}});
window.addEventListener("pageshow",event=>{if(event.persisted)refreshCalendarNavigation(true);});
window.setInterval(()=>{if(!document.hidden)refreshCalendarNavigation();},30000);
window.addEventListener("online",()=>{if(accessCode)pullOrPushCloudState().catch(handleSyncFailure);});
window.addEventListener("offline",()=>updateSyncStatus("离线使用，联网后补传"));

const cached=readStored(localSnapshotKey),draft=readStored(editorDraftKey);
if((isDemo||accessCode)&&validSnapshot(cached)){applySnapshot(cached);cacheCommittedState();restoreResumePoint();restoringResume=false;updateSyncStatus(isDemo?"分享演示 · 仅存本机":"本机存档已打开，正在核对云端");}
if(validSnapshot(draft)&&committedState){selectedCourses=draft.selectedCourses;days=draft.days;editorDirty=true;document.querySelector("#discardDraftBtn").hidden=false;startApp(readStored(resumeKey)?.view);editorState.textContent="已恢复编辑草稿 · 待保存到云端";}
if(accessCode)document.querySelector("#retryCloudBtn").hidden=false;
refreshIcons();
setupCloudSync().then(()=>{if(validSnapshot(snapshot())){if(!committedState)cacheCommittedState();restoreResumePoint();}}).catch(handleSyncFailure).finally(()=>{restoringResume=false;});
