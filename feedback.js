(() => {
  const config=window.PET_FEEDBACK_CONFIG;
  async function rpc(name, payload) {
    if(!config?.url || !config?.key) throw Error('反馈服务尚未配置，草稿仍保留');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
    try {
      const res=await fetch(config.url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:config.key,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal});
      const result=await res.json().catch(()=>null);
      if(!res.ok){
        if(result?.message?.includes('rate limited'))throw Error('提交较频繁，请稍后重试，草稿仍保留');
        if(result?.message?.includes('Owner access denied'))throw Error('管理凭证不正确');
        if(res.status===404 || result?.message?.includes('not configured'))throw Error('反馈后台尚未启用，草稿已保留，尚未送达');
        throw Error('未完成提交，请稍后重试；草稿仍保留');
      }
      return result;
    } catch(err){if(err.name==='AbortError')throw Error('连接超时，尚未确认送达；重试不会重复创建');if(err instanceof TypeError)throw Error('网络暂不可用，草稿仍保留');throw err;}
    finally{clearTimeout(timer);}
  }
  window.petFeedbackRPC=rpc;
  if(!window.PET_DEMO)return;
  const $=s=>document.querySelector(s),prefix='dusk-demo-v1:feedback-',draftKey=prefix+'draft-v1',receiptsKey=prefix+'receipts-v1';
  const read=key=>{try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}};
  let requestId=crypto.randomUUID(),busy=false,deviceId=localStorage.getItem(prefix+'device-v1')||crypto.randomUUID();
  try{localStorage.setItem(prefix+'device-v1',deviceId);}catch{}
  document.querySelector('.atelier-tools').insertAdjacentHTML('afterbegin','<button type="button" id="feedbackOpen" class="atelier-icon" title="反馈" aria-label="反馈"><i data-lucide="message-square"></i></button>');
  document.body.insertAdjacentHTML('beforeend',`<dialog class="quick-dialog" id="feedbackDialog"><header><h2>给手账留张便签</h2><button type="button" class="atelier-icon" id="feedbackClose" aria-label="关闭"><i data-lucide="x"></i></button></header><form class="quick-form" id="feedbackForm"><label>关于什么<select id="feedbackCategory"><option value="bug">使用问题</option><option value="idea">改进建议</option><option value="words">单词内容</option><option value="other">其他</option></select></label><label>你的反馈<textarea id="feedbackBody" required minlength="5" maxlength="5000" rows="5" placeholder="发生了什么？你希望怎样？"></textarea></label><label>联系方式（可不填）<input id="feedbackContact" maxlength="200" autocomplete="off" placeholder="如果希望进一步联系"></label><label class="share-check"><input id="feedbackEnvironment" type="checkbox">附上设备类型、语言和屏幕尺寸</label><p class="tip">只发送此表单，不附带课表、计划、单词记录或解锁码。</p><p id="feedbackResult" class="form-error" role="status" aria-live="polite"></p><div class="form-footer"><button type="button" id="feedbackDiscard">清除草稿</button><button type="submit" class="speak utility-button" id="feedbackSend"><i data-lucide="send"></i>发送便签</button></div><div id="feedbackReceipts" class="feedback-receipts"></div></form></dialog>`);
  function contents(){return {requestId,category:$('#feedbackCategory').value,body:$('#feedbackBody').value,contact:$('#feedbackContact').value,consent:$('#feedbackEnvironment').checked};}
  function saveDraft(){try{localStorage.setItem(draftKey,JSON.stringify(contents()));}catch{$('#feedbackResult').textContent='草稿未能保存，请保留页面或复制文字';}}
  function receipts(){const list=read(receiptsKey)||[];$('#feedbackReceipts').textContent=list.length ? '最近送达：'+list.slice(-3).reverse().map(r=>r.date.slice(0,10)+' · '+r.id.slice(0,8)).join(' / ') : '';}
  function loadDraft(){const d=read(draftKey);if(d){requestId=d.requestId||crypto.randomUUID();$('#feedbackCategory').value=d.category;$('#feedbackBody').value=d.body||'';$('#feedbackContact').value=d.contact||'';$('#feedbackEnvironment').checked=d.consent===true;}receipts();}
  window.openPetFeedback=()=>{loadDraft();$('#feedbackResult').textContent='';$('#feedbackResult').dataset.success='false';openQuickDialog('feedbackDialog');refreshIcons();};
  $('#feedbackOpen').onclick=window.openPetFeedback;
  $('#feedbackClose').onclick=()=>{if(!busy)closeQuickDialog();};
  $('#feedbackDialog').addEventListener('cancel',e=>{e.preventDefault();if(!busy)closeQuickDialog();});
  $('#feedbackForm').addEventListener('input',()=>{if(!busy){requestId=crypto.randomUUID();saveDraft();}});
  $('#feedbackDiscard').onclick=()=>{requestId=crypto.randomUUID();$('#feedbackForm').reset();try{localStorage.removeItem(draftKey);}catch{}$('#feedbackResult').textContent='草稿已清除';};
  $('#feedbackForm').onsubmit=async e=>{
    e.preventDefault();if(busy)return;
    if($('#feedbackBody').value.trim().length<5){$('#feedbackResult').textContent='请至少填写 5 个字';return;}
    const d=contents();saveDraft();busy=true;
    $('#feedbackForm').querySelectorAll('input,textarea,select,button').forEach(el=>el.disabled=true);
    $('#feedbackResult').textContent='正在送达…';$('#feedbackResult').dataset.success='false';
    const environment=d.consent ? {platform:navigator.userAgentData?.platform||navigator.platform||'unknown',language:navigator.language||'unknown',viewport:`${innerWidth}x${innerHeight}`} : {};
    try{
      const result=await rpc('dusk_feedback_submit',{request_id:d.requestId,device_id:deviceId,category:d.category,body:d.body.trim(),contact:d.contact.trim(),environment,app_version:'2026.10.04-f2'});
      if(result?.delivered!==true || result.receipt!==d.requestId)throw Error('尚未确认送达，请保留草稿后重试');
      try{const list=read(receiptsKey)||[];localStorage.setItem(receiptsKey,JSON.stringify([...list.filter(r=>r.id!==d.requestId),{id:d.requestId,date:new Date().toISOString()}].slice(-20)));localStorage.removeItem(draftKey);}catch{}
      $('#feedbackForm').reset();requestId=crypto.randomUUID();$('#feedbackResult').textContent='便签已送达，谢谢你。';$('#feedbackResult').dataset.success='true';receipts();
    }catch(err){$('#feedbackResult').textContent=err.message||'网络不可用，草稿仍保留';}
    finally{busy=false;$('#feedbackForm').querySelectorAll('input,textarea,select,button').forEach(el=>el.disabled=false);}
  };
  refreshIcons();
})();
