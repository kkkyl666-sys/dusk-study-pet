(() => {
  const $=s=>document.querySelector(s),escape=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const types={bug:'使用问题',idea:'改进建议',words:'单词内容',other:'其他'};
  let ownerKey='',items=[],busy=false;
  const icons=()=>lucide.createIcons();
  function render(){
    const status=$('#inboxFilter').value,list=items.filter(item=>status==='all'||item.status===status);
    $('#inboxCount').textContent=`已读取 ${items.length} 张 · 当前显示 ${list.length} 张`;
    $('#inboxList').innerHTML=list.map(item=>`<article class="inbox-item"><header><strong>${escape(types[item.category])}</strong><time>${escape(new Date(item.created_at).toLocaleString('zh-CN'))}</time></header><p class="inbox-body">${escape(item.body)}</p>${item.contact?`<p>联系：${escape(item.contact)}</p>`:''}<small>${escape(Object.entries(item.environment||{}).map(([k,v])=>`${k}: ${v}`).join(' · '))} · ${escape(item.version)}</small><form data-feedback-id="${escape(item.id)}"><label>处理状态<select name="status"><option value="new" ${item.status==='new'?'selected':''}>待查看</option><option value="working" ${item.status==='working'?'selected':''}>处理中</option><option value="done" ${item.status==='done'?'selected':''}>已处理</option></select></label><label>内部备注<textarea name="note" rows="2" maxlength="2000">${escape(item.owner_note)}</textarea></label><button type="submit"><i data-lucide="check"></i>保存处理记录</button><span role="status"></span></form></article>`).join('')||'<p>这里还没有便签。</p>';
    $('#inboxList').querySelectorAll('form').forEach(form=>form.onsubmit=async e=>{
      e.preventDefault();const button=form.querySelector('button'),message=form.querySelector('span');if(button.disabled)return;button.disabled=true;
      try{await petFeedbackRPC('dusk_feedback_update',{owner_key:ownerKey,feedback_id:form.dataset.feedbackId,new_status:form.elements.status.value,note:form.elements.note.value});const item=items.find(i=>i.id===form.dataset.feedbackId);item.status=form.elements.status.value;item.owner_note=form.elements.note.value;message.textContent='已保存';}
      catch(err){message.textContent=err.message;}finally{button.disabled=false;}
    });icons();
  }
  async function load(more=false){
    if(busy)return;busy=true;$('#inboxStatus').textContent='正在读取…';$('#inboxRefresh').disabled=true;
    try{const rows=await petFeedbackRPC('dusk_feedback_list',{owner_key:ownerKey,before_date:more?items.at(-1)?.created_at:null});if(!Array.isArray(rows))throw Error('返回格式不正确');items=more?[...items,...rows]:rows;$('#inboxLogin').hidden=true;$('#inboxView').hidden=false;$('#inboxLogout').hidden=false;$('#inboxMore').hidden=rows.length<100;$('#inboxKey').value='';render();$('#inboxStatus').textContent='';}
    catch(err){$('#inboxStatus').textContent=err.message;}finally{busy=false;$('#inboxRefresh').disabled=false;}
  }
  $('#inboxLoginForm').onsubmit=e=>{e.preventDefault();ownerKey=$('#inboxKey').value.trim();load();};
  $('#inboxRefresh').onclick=()=>load();$('#inboxMore').onclick=()=>load(true);$('#inboxFilter').onchange=render;
  $('#inboxLogout').onclick=()=>{ownerKey='';items=[];$('#inboxList').replaceChildren();$('#inboxView').hidden=true;$('#inboxLogin').hidden=false;$('#inboxLogout').hidden=true;$('#inboxStatus').textContent='已锁定';};
  icons();
})();
