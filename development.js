(() => {
  const $=selector=>document.querySelector(selector);
  let log, chapter='all', order='latest', expanded=false;
  const params=new URLSearchParams(location.search);
  if(params.get('from')==='demo')$('#backToApp').href='share.html';
  function element(tag,text,className){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;}
  function paragraph(parent,title,text,className){parent.append(element('h3',title),element('p',text,className));}
  function render(){
    const query=$('#bookSearch').value.trim().toLocaleLowerCase();
    const rows=log.entries.map((entry,index)=>({...entry,number:index+1})).filter(entry=>(chapter==='all'||entry.chapter===chapter)&&JSON.stringify(entry).toLocaleLowerCase().includes(query));
    if(order==='latest')rows.reverse();
    $('#levels').replaceChildren();$('#bookResults').textContent=`${rows.length} / ${log.entries.length} 关`;
    if(!rows.length)$('#levels').append(element('p','没有匹配的关卡。','empty'));
    for(const entry of rows){
      const details=element('details',undefined,'level');details.id=`level-${entry.id}`;details.dataset.chapter=entry.chapter;details.open=expanded||entry.id===log.entries.at(-1).id;
      const summary=element('summary'),info=element('div'),meta=element('div',undefined,'level-meta');
      meta.append(element('span',entry.date),element('span',log.chapters.find(c=>c.id===entry.chapter).title),element('span',entry.status));
      info.append(element('h2',entry.title),meta);const arrow=element('i');arrow.dataset.lucide='chevron-right';
      summary.append(element('span',String(entry.number).padStart(2,'0'),'level-number'),info,arrow);
      const body=element('div',undefined,'level-content');paragraph(body,'当时的问题',entry.problem);
      body.append(element('h3','这一步改变了什么'));const changes=element('ul');entry.changes.forEach(change=>changes.append(element('li',change)));body.append(changes);
      paragraph(body,'带走的经验',entry.lesson,'level-lesson');
      paragraph(body,'验证与证据',entry.verification||'依据对应Git提交和项目记忆回顾；本册没有重新运行每个历史版本，也不把曾经发布当作今天全部真机验证。');
      if(entry.next)paragraph(body,'边界或后续',entry.next);
      if(entry.commit){const link=element('a',`核对提交 ${entry.commit}`);link.href=`https://github.com/kkkyl666-sys/dusk-study-pet/commit/${entry.commit}`;link.target='_blank';link.rel='noopener noreferrer';body.append(link);}
      details.append(summary,body);$('#levels').append(details);
    }
    window.lucide?.createIcons();
  }
  async function load(){
    $('#bookError').hidden=true;$('#bookRetry').hidden=true;
    try{
      const response=await fetch('development-log.json');if(!response.ok)throw new Error('记录文件暂不可用');
      const data=await response.json();
      if(data.schemaVersion!==1||!Array.isArray(data.entries)||!data.entries.length||!Array.isArray(data.chapters)||!Array.isArray(data.branches))throw new Error('记录格式异常');
      log=data;$('#bookCount').textContent=`${log.entries.length} 关 · ${log.entries.filter(e=>e.commit).length} 次有提交记录的改进`;
      $('#bookDate').textContent=`更新于 ${log.updated}`;$('#chapters').replaceChildren();
      for(const item of [{id:'all',title:'全部'},...log.chapters]){
        const button=element('button',item.title);button.type='button';button.dataset.chapter=item.id;button.setAttribute('aria-pressed',String(chapter===item.id));
        button.onclick=()=>{chapter=item.id;$('#chapters').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.chapter===chapter)));render();};$('#chapters').append(button);
      }
      $('#branches').replaceChildren();for(const branch of log.branches){const row=element('article',undefined,'branch'),heading=element('h3');heading.append(element('span',branch.status),document.createTextNode(branch.title));row.append(heading,element('p',branch.note));$('#branches').append(row);}
      render();
    }catch(error){$('#bookError').textContent=`暂时无法读取关卡册：${error.message}`;$('#bookError').hidden=false;$('#bookRetry').hidden=false;$('#bookCount').textContent='记录尚未加载';}
  }
  $('#bookSearch').oninput=()=>{if(log)render();};
  document.querySelectorAll('[data-order]').forEach(button=>button.onclick=()=>{order=button.dataset.order;document.querySelectorAll('[data-order]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));if(log)render();});
  $('#expandEntries').onclick=()=>{expanded=!expanded;const text=expanded?'收起全部关卡':'展开全部关卡';$('#expandEntries').title=text;$('#expandEntries').setAttribute('aria-label',text);$('#expandEntries').setAttribute('aria-pressed',String(expanded));$('#levels').querySelectorAll('details').forEach(d=>d.open=expanded);};
  $('#bookRetry').onclick=load;window.lucide?.createIcons();load();
})();
