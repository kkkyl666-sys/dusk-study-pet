const fs=require('node:fs'),path=require('node:path');
const log=JSON.parse(fs.readFileSync(path.join(__dirname,'development-log.json'),'utf8'));
const ids=new Set(),chapters=new Set(log.chapters.map(item=>item.id));
for(const entry of log.entries){
  if(!entry.id||ids.has(entry.id)||!chapters.has(entry.chapter)||!entry.date||!entry.title||!entry.problem||!entry.lesson||!Array.isArray(entry.changes)||!entry.changes.length)throw new Error(`Invalid development entry: ${entry.id}`);
  if(!['历史回顾','已发布','已实现'].includes(entry.status))throw new Error(`Unknown status: ${entry.id}`);
  if(entry.commit&&!/^[a-f0-9]{7,40}$/.test(entry.commit))throw new Error(`Invalid commit: ${entry.id}`);
  if(entry.status==='已发布'&&!entry.commit)throw new Error(`Published entry needs evidence: ${entry.id}`);
  ids.add(entry.id);
}
const lines=['# 夕的开发关卡册','',`更新：${log.updated} · ${log.entries.length}关`,'','网页：https://kkkyl666-sys.github.io/dusk-study-pet/development.html','',
  '记录目的：保留真实问题、方案变化、失败修正、验证证据和下一步，不只列功能清单。关卡编号是改进顺序，不是学习积分。早期记录来自项目记忆回顾；Git提交从2026-09-16起可追溯。没有重跑所有历史版本，过去发布不等于当前全部真机确认。','',
  '维护约定：有用户可见的改进或重要修复时续写一关；同一改进的测试、缓存和发布补记可更新原关。只讨论的方案放支线，不能写成完成。更新development-log.json后运行node build-development.cjs；维护共用源码shared/app.html，按personal或share目标独立构建与发布，不能直接修改生成页面。公开记录不含个人课表、日程、邮箱、解锁码、密钥或云端快照。',''];
log.entries.forEach((entry,index)=>{
  lines.push(`## 第${String(index+1).padStart(2,'0')}关 · ${entry.title}`,'',`${entry.date} · ${log.chapters.find(item=>item.id===entry.chapter).title} · ${entry.status}`,'',`**当时的问题**：${entry.problem}`,'','**这一步改变了什么**：',...entry.changes.map(change=>`- ${change}`),'',`**带走的经验**：${entry.lesson}`,'',`**验证与证据**：${entry.verification||'依据对应Git提交和项目记忆回顾；未重新运行每个历史版本，不把过去发布当作当前全部真机验证。'}`,'');
  if(entry.commit)lines.push(`[提交 ${entry.commit}](https://github.com/kkkyl666-sys/dusk-study-pet/commit/${entry.commit})`,'');
  if(entry.next)lines.push(`**边界或后续**：${entry.next}`,'');
});
lines.push('## 还没走完的支线','');log.branches.forEach(branch=>lines.push(`### ${branch.title} · ${branch.status}`,'',branch.note,''));
fs.writeFileSync(path.join(__dirname,'DEVELOPMENT.md'),lines.join('\n'));
