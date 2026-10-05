(() => {
  const shareURL = window.PET_APP.shareURL;
  const icon = name => `<i data-lucide="${name}"></i>`;
  document.body.classList.add("share-demo");
  document.querySelector(".atelier-brand").textContent = "夕的手账 · 分享版";
  document.querySelector("#saveCloudBtn").textContent = "保存到本机";
  document.querySelector("#atelierSettingsDialog small").textContent = "分享版 · 记录只存这台设备的当前浏览器，请定期下载备份。场景为二创概念图，非官方原图。";
  document.querySelector(".atelier-tools").insertAdjacentHTML("afterbegin",`<button type="button" class="atelier-icon" id="demoOptions" title="演示与分享" aria-label="演示与分享">${icon("share-2")}</button>`);
  document.body.insertAdjacentHTML("beforeend",`<dialog class="quick-dialog" id="demoDialog"><header><h2>演示与分享</h2><button type="button" class="atelier-icon" data-quick-close aria-label="关闭">${icon("x")}</button></header><div class="quick-form"><label>演示数据<select id="demoDataMode"><option value="sample">随机示例</option><option value="blank">空白课表与计划</option></select></label><button type="button" class="mode utility-button" id="demoGenerate">${icon("dices")}生成课表与计划</button><p class="tip">替换本机演示课表与计划，可撤销。单词和背词记录不变。</p><div class="form-footer"><button type="button" class="mode utility-button" id="demoCopy">${icon("copy")}复制链接</button><button type="button" class="mode utility-button" id="demoShare">${icon("share-2")}分享</button></div><label>演示网址<input id="demoURL" readonly></label><p class="form-error" id="demoError" role="status"></p><small>朋友打开的是自己的演示存档，不会带走你的记录。无需解锁码；不会连接个人云端。</small></div></dialog>`);
  const dialog=document.querySelector("#demoDialog"), error=document.querySelector("#demoError"), urlInput=document.querySelector("#demoURL");
  urlInput.value=shareURL;
  document.querySelector("#demoOptions").onclick=()=>{error.textContent="";openQuickDialog("demoDialog");};
  dialog.querySelector("[data-quick-close]").onclick=closeQuickDialog;
  dialog.addEventListener("cancel",event=>{event.preventDefault();closeQuickDialog();});
  document.querySelector("#demoGenerate").onclick=()=>{
    if (!confirm("将替换这台设备的课表与计划。背词记录不变。继续？")) return;
    const previous=structuredClone({selectedCourses,days,appointments,checked});
    const restore=()=>{selectedCourses=previous.selectedCourses;days=previous.days;appointments=previous.appointments;checked=previous.checked;};
    const generated=window.createDemoData(document.querySelector("#demoDataMode").value);
    selectedCourses=generated.selectedCourses;days=generated.days;appointments=[];
    checked=Object.fromEntries(Object.entries(checked).filter(([key])=>key.startsWith("english-")));
    if(!commitQuickChange("演示课表与计划已替换",restore)){restore();error.textContent="未保存，原演示记录已保留。";return;}
    editorDirty=false;clearEditorDraft();closeQuickDialog();startApp();
  };
  async function copyLink() {
    try { await navigator.clipboard.writeText(shareURL); error.textContent="演示链接已复制。"; }
    catch { urlInput.focus();urlInput.select();error.textContent="请长按或复制已选中的网址。"; }
  }
  document.querySelector("#demoCopy").onclick=copyLink;
  document.querySelector("#demoShare").onclick=async()=>{
    if(!navigator.share){await copyLink();return;}
    try {await navigator.share({title:"夕的手账 · 分享版",text:"课表、计划和每日英语，打开即可体验。",url:shareURL});error.textContent="";}
    catch(errorValue){if(errorValue.name!=="AbortError")await copyLink();}
  };
  updateSyncStatus("分享版 · 已存本机");refreshIcons();
})();
