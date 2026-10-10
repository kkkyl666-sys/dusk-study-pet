const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const modules=process.env.TEST_MODULES||path.resolve(__dirname,'../../方案预览/.tools/node_modules');
const {chromium}=require(path.join(modules,'playwright'));
const {PGlite}=require(path.join(modules,'@electric-sql/pglite'));
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
const privateFixture={selectedCourses:[{code:'TEST',name:'仅自用课程',teacher:'测试',room:'P101',day:0,periods:[1,2],weeks:[[1,17]],type:'major'}],days:Array.from({length:7},(_,i)=>({name:['星期一','星期二','星期三','星期四','星期五','星期六','星期日'][i],date:'',line:'今日安排',tasks:[]})),checked:{},englishProgress:{},englishStart:'2026-10-04',changedAt:1};
(async()=>{
  const db=new PGlite(),key=crypto.randomBytes(32).toString('base64url'),hash=crypto.createHash('sha256').update(key).digest('hex');
  await db.exec('create role anon; create role authenticated;');
  await db.exec(fs.readFileSync(path.join(root,'feedback-schema.sql'),'utf8').replace('-- ADMIN_SETUP',`insert into public.dusk_feedback_settings values(1,'${hash}');`));
  async function rpc(name,p){
    const defs={
      dusk_feedback_submit:['uuid,uuid,text,text,text,jsonb,text',['request_id','device_id','category','body','contact','environment','app_version']],
      dusk_feedback_list:['text,timestamptz',['owner_key','before_date']],
      dusk_feedback_update:['text,uuid,text,text',['owner_key','feedback_id','new_status','note']]
    };
    const [types,keys]=defs[name];
    const sql=`select public.${name}(${types.split(',').map((type,i)=>`$${i+1}::${type}`).join(',')}) as result`;
    return (await db.query(sql,keys.map(k=>k==='environment'?JSON.stringify(p[k]||{}):p[k]??null))).rows[0].result;
  }
  await assert.rejects(()=>rpc('dusk_feedback_list',{owner_key:'wrong'}),/access denied/);
  await db.exec('set role anon;');
  await assert.rejects(()=>db.query('select * from public.dusk_feedback'),/permission denied/);
  await assert.rejects(()=>db.query('select * from public.dusk_feedback_settings'),/permission denied/);
  await assert.rejects(()=>db.query("select public.dusk_feedback_owner_check('no')"),/permission denied/);
  const p={request_id:crypto.randomUUID(),device_id:crypto.randomUUID(),category:'idea',body:'测试反馈内容',contact:'',environment:{},app_version:'test'};
  await rpc('dusk_feedback_submit',p);await rpc('dusk_feedback_submit',p);
  await db.exec('reset role;');
  assert.equal((await db.query('select count(*)::int as n from public.dusk_feedback')).rows[0].n,1);
  await assert.rejects(()=>rpc('dusk_feedback_submit',{...p,request_id:crypto.randomUUID(),environment:{snapshot:'private'}}),/Invalid feedback/);
  await assert.rejects(()=>rpc('dusk_feedback_submit',{...p,request_id:crypto.randomUUID(),category:'hack'}),/Invalid feedback/);
  for(let i=0;i<2;i++)await rpc('dusk_feedback_submit',{...p,request_id:crypto.randomUUID()});
  await assert.rejects(()=>rpc('dusk_feedback_submit',{...p,request_id:crypto.randomUUID()}),/rate limited/);
  await rpc('dusk_feedback_update',{owner_key:key,feedback_id:p.request_id,new_status:'done',note:'test'});
  assert.equal((await rpc('dusk_feedback_list',{owner_key:key}))[2].status,'done');
  await db.exec('truncate public.dusk_feedback;');
  const server=http.createServer((req,res)=>{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
    try{res.setHeader('Content-Type',mime[path.extname(file)]||'application/json');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base=process.argv[2]?.replace(/\/$/,'') || `http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const errors=[],requests=[];let failNetwork=false;
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Shanghai',serviceWorkers:'block'});
    await ctx.addInitScript(fixture=>{
      if(!localStorage.getItem('test-seeded')){
        localStorage.setItem('test-seeded','yes');localStorage.setItem('dusk-study-pet-access-code-v1','personal-sentinel');
        localStorage.setItem('dusk-study-pet-full-state-v1',JSON.stringify(fixture));
        sessionStorage.setItem('personalBefore',JSON.stringify(Object.fromEntries(Object.entries(localStorage))));
      }
    },privateFixture);
    await ctx.route('**/rest/v1/rpc/*',async route=>{
      const name=route.request().url().split('/').pop();requests.push({name,payload:route.request().postDataJSON()});
      if(!name.startsWith('dusk_feedback_'))return route.fulfill({status:500,json:{message:'Private sync must not be called'}});
      if(failNetwork)return route.abort();
      try{await route.fulfill({json:await rpc(name,route.request().postDataJSON())});}catch(err){await route.fulfill({status:400,json:{message:err.message}});}
    });
    const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.clock.setFixedTime(new Date('2026-10-04T12:00:00+08:00'));
    page.on('dialog',d=>d.accept());
    await page.goto(base+'/share.html');await page.waitForFunction(()=>window.shareTools&&!restoringResume);
    if(await page.locator('#shareWelcomeSkip').isVisible()){
      await page.locator('#shareWelcomeSkip').click();await page.waitForFunction(()=>!history.state?.petDialog);
    }
    assert.equal(await page.title(),'夕的手账 · 分享版');
    assert.equal(await page.locator('.atelier-brand').innerText(),'夕的手账 · 分享版');
    assert.equal(await page.locator('meta[name="apple-mobile-web-app-title"]').getAttribute('content'),'夕的手账分享版');
    for(const [file,start,name] of [['manifest.webmanifest','./','夕的手账'],['manifest-demo.webmanifest','./share.html','夕的手账 · 分享版']]){
      const manifest=JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
      assert.equal(manifest.name,name);assert.equal(manifest.start_url,start);assert.equal(manifest.scope,'./');
    }
    assert.equal(await page.evaluate(()=>selectedCourses.length),0);assert.equal(await page.evaluate(()=>syncReady),false);
    assert.equal(await page.evaluate(()=>document.body.classList.contains('private-wait')),false);
    await page.locator('.atelier-nav [data-atelier-view=editView]').click();
    await page.locator('#shareAddCourse').click();await page.locator('#shareCourseName').fill('朋友自己的课程');
    await page.locator('#shareCourseDay').selectOption('2');await page.locator('#shareCourseWeeks').fill('1-8,10-17');
    await page.locator('#shareCourseForm button[type=submit]').click();
    assert.equal(await page.evaluate(()=>selectedCourses.length),1);
    await page.locator('#shareAddTask').click();await page.locator('#quickTaskTitle').fill('朋友的安排');await page.locator('#quickTaskNote').fill('只在这台手机');await page.locator('#taskQuickForm button[type=submit]').click();
    assert.equal(await page.evaluate(()=>appointments.length),1);
    await page.locator('#shareTermStart').fill('2026-09-14');await page.locator('#shareSetTerm').click();
    assert.equal(await page.evaluate(()=>selectedDateISO(0)),'2026-09-28');
    await page.locator('.atelier-nav [data-atelier-view=englishView]').click();
    await page.locator('[data-word-layout=list]').click();
    await page.locator('#newWords .word-card:visible [data-remember-word]').first().click();
    await page.locator('.atelier-nav [data-atelier-view=editView]').click();
    await page.evaluate(()=>{days[0].tasks.push(['19:00 周计划','学习','旧分享版本中的周次限制',[[1,8],[10,17]],'legacy-weekly-test']);commitQuickChange('测试旧周计划');});
    const [dl]=await Promise.all([page.waitForEvent('download'),page.locator('#shareBackup').click()]);
    const backup=JSON.parse(fs.readFileSync(await dl.path(),'utf8'));
    assert.equal(backup.format,'dusk-share-backup');assert.equal(backup.data.selectedCourses[0].name,'朋友自己的课程');
    assert.ok(!JSON.stringify(backup).includes('personal-sentinel'));
    await page.evaluate(()=>{Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{window.nativeBackup=JSON.parse(await data.files[0].text());}});});
    await page.locator('#shareBackup').click();await page.waitForFunction(()=>window.nativeBackup);assert.equal(await page.evaluate(()=>window.nativeBackup.format),'dusk-share-backup');
    await page.evaluate(()=>Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{throw new DOMException('cancel','AbortError');}}));
    await page.locator('#shareBackup').click();await page.waitForFunction(()=>document.querySelector('#shareSaveState').textContent.includes('已取消'));
    await page.evaluate(()=>{delete navigator.canShare;delete navigator.share;});
    await page.reload();await page.waitForFunction(()=>window.shareTools&&!restoringResume);
    assert.equal(await page.evaluate(()=>selectedCourses[0].name),'朋友自己的课程');
    assert.equal(await page.evaluate(()=>appointments.length),1);
    assert.equal(await page.evaluate(()=>snapshot().shareCalendar),'2026-09-14');
    await page.locator('.atelier-nav [data-atelier-view=editView]').click();
    await page.locator('#shareCourseLibrary button').first().click();await page.locator('#shareCourseDelete').click();
    assert.equal(await page.evaluate(()=>selectedCourses.length),0);
    await page.locator('#shareBackupFile').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
    await page.locator('#shareRestoreConfirm').click();assert.equal(await page.evaluate(()=>selectedCourses.length),1);
    assert.deepEqual(await page.evaluate(()=>englishProgress),backup.data.englishProgress);
    const beforeInvalid=await page.evaluate(()=>JSON.stringify(snapshot()));
    await page.locator('#shareBackupFile').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"schema":99}')});
    assert.equal(await page.evaluate(()=>JSON.stringify(snapshot())),beforeInvalid);
    await page.locator('#shareCSVFile').setInputFiles({name:'courses.csv',mimeType:'text/csv',buffer:Buffer.from('课程名称,教师,教室,星期,节次,周次\n阅读与表达,张老师,A101,5,5-6,"1-8,10-17"\n')});
    await page.locator('#shareCSVConfirm').click();assert.equal(await page.evaluate(()=>selectedCourses.length),2);
    await page.locator('#shareFeedback').click();await page.locator('#feedbackBody').fill('手机上保存后希望有更明确的提示');
    failNetwork=true;await page.locator('#feedbackSend').click();await page.waitForFunction(()=>!document.querySelector('#feedbackSend').disabled);
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('dusk-demo-v1:feedback-draft-v1')).body),'手机上保存后希望有更明确的提示');
    const retryId=requests.at(-1).payload.request_id;
    failNetwork=false;await page.locator('#feedbackSend').click();await page.waitForFunction(()=>document.querySelector('#feedbackResult').textContent.includes('已送达'));
    assert.equal(requests.at(-1).payload.request_id,retryId);
    assert.deepEqual(requests.at(-1).payload.environment,{});
    assert.ok(!JSON.stringify(requests).includes('朋友自己的课程')&&!JSON.stringify(requests).includes('personal-sentinel'));
    await page.locator('#feedbackClose').click();
    await page.screenshot({path:path.resolve(__dirname,'../../方案预览/F2-分享版-手机.png'),fullPage:true});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
    const admin=await ctx.newPage();admin.on('pageerror',e=>errors.push(e.message));await admin.goto(base+'/feedback-admin.html');
    await admin.locator('#inboxKey').fill('wrong');await admin.locator('#inboxLoginForm button').click();await admin.waitForFunction(()=>document.querySelector('#inboxStatus').textContent.includes('不正确'));
    await admin.locator('#inboxKey').fill(key);await admin.locator('#inboxLoginForm button').click();await admin.locator('.inbox-item').waitFor();
    await admin.locator('.inbox-item select').selectOption('working');await admin.locator('.inbox-item textarea').fill('收到，待处理');await admin.locator('.inbox-item button').click();await admin.waitForFunction(()=>document.querySelector('.inbox-item form span').textContent==='已保存');
    assert.equal((await rpc('dusk_feedback_list',{owner_key:key}))[0].status,'working');
    await admin.setViewportSize({width:1440,height:900});await admin.screenshot({path:path.resolve(__dirname,'../../方案预览/F2-收件箱-电脑.png'),fullPage:true});
    await admin.locator('#inboxLogout').click();assert.equal(await admin.locator('#inboxView').isVisible(),false);
    const privateBefore=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('personalBefore')));
    const privateAfter=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>!k.startsWith('dusk-demo-v1:'))));
    assert.deepEqual(privateAfter,privateBefore);
    assert.ok(requests.every(r=>r.name.startsWith('dusk_feedback_')));
    // Preserve old share records, including intentionally empty timetables.
    await page.evaluate(()=>{const d=snapshot();d.selectedCourses=[];d.changedAt=Math.max(Date.now(),stateUpdatedAt)+1;localStorage.setItem(localSnapshotKey,JSON.stringify(d));});
    await page.reload();await page.waitForFunction(()=>window.shareTools&&!restoringResume);assert.equal(await page.evaluate(()=>selectedCourses.length),0);
    for(const width of [320,390,760,1440]){
      await page.setViewportSize({width,height:900});await page.locator('.atelier-nav [data-atelier-view=englishView]').click();
      if(!(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2))){
        await page.screenshot({path:path.resolve(__dirname,'../../方案预览/F2-overflow.png'),fullPage:true});
        process.stdout.write(JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.right>innerWidth+2;}).slice(0,15).map(el=>({tag:el.tagName,id:el.id,class:el.className,width:el.getBoundingClientRect().width,text:el.textContent.slice(0,60)}))))+'\n');
      }
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),`overflow at ${width}`);
    }
    await page.screenshot({path:path.resolve(__dirname,'../../方案预览/B-词性分色-电脑.png'),fullPage:true});
    const colors=await page.evaluate(()=>{
      const sample=['n.','v.','adj.','adv.'].map(pos=>{const el=document.createElement('article');el.className='word-card';el.dataset.wordPos=pos;el.innerHTML='<button class="word-detail-button">test</button>';document.querySelector('#englishView').append(el);const color=getComputedStyle(el.firstChild).color;el.remove();return color;});return sample;
    });assert.equal(new Set(colors).size,4);
    // Download failure does not wipe the live store; invalid course ranges preserve draft.
    await page.setViewportSize({width:390,height:844});await page.locator('.atelier-nav [data-atelier-view=editView]').click();
    await page.locator('#shareAddCourse').click();await page.locator('#shareCourseName').fill('无效范围');await page.locator('#shareCourseWeeks').fill('1-99');await page.locator('#shareCourseForm button[type=submit]').click();assert.equal(await page.evaluate(()=>selectedCourses.length),0);assert.ok(await page.locator('#shareCourseError').textContent());
    await page.locator('#shareCourseWeeks').fill('1-17');
    await page.evaluate(()=>{window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===localSnapshotKey)throw Error('quota');return window.originalSet.call(this,k,v);};});
    await page.locator('#shareCourseForm button[type=submit]').click();assert.equal(await page.evaluate(()=>selectedCourses.length),0);assert.match(await page.locator('#shareCourseError').textContent(),/未保存/);
    assert.deepEqual(errors,[]);
    process.stdout.write(JSON.stringify({passed:true,sql:'actual PostgreSQL functions via PGlite',colors,requests:requests.length,viewports:[320,390,760,1440]})+'\n');
  }finally{await browser.close();await new Promise(r=>server.close(r));await db.close();}
})().catch(err=>{process.stderr.write(err.stack+'\n');process.exitCode=1;});
