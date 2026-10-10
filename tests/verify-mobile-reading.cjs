const assert=require('node:assert/strict'),http=require('node:http'),path=require('node:path');
const {chromium}=require('../../方案预览/.tools/node_modules/playwright');
const {buildRelease}=require('../build-release.cjs');
const fixture={selectedCourses:[
 {name:'数字电路与逻辑设计',room:'C101/C301',teacher:'示例教师',day:0,periods:[1,2],weeks:[[1,17]],type:'major'},
 {name:'周末实验',room:'T505',teacher:'周末教师',day:5,periods:[3,4],weeks:[[1,17]],type:'lab'},
 {name:'晚间课程',room:'T606',teacher:'晚间教师',day:6,periods:[11],weeks:[[1,17]],type:'public'},
 {name:'另一周课程',room:'T707',teacher:'另一周教师',day:1,periods:[5,6],weeks:[[6,6]],type:'major'}
],days:Array.from({length:7},(_,i)=>({name:'Day '+i,tasks:[['09:00 示例学习','学习','可编辑',false,'test-'+i]],line:'示例'})),checked:{},englishProgress:{},englishStart:'2026-10-10',appointments:[],englishAdjustments:[],changedAt:1};
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{for(const edition of ['personal','share']){
  const files=buildRelease(edition),mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.woff2':'font/woff2'};
  const server=http.createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';if(!files[name])return res.writeHead(404).end();res.setHeader('Content-Type',mime[path.extname(name)]||'application/json');res.end(files[name]);});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{
   const ctx=await browser.newContext({hasTouch:true,viewport:{width:390,height:844},timezoneId:'Asia/Shanghai',serviceWorkers:'block'});
   await ctx.route('https://**',r=>r.abort());
   await ctx.addInitScript(({fixture,edition})=>{if(localStorage.getItem('reading-seeded'))return;localStorage.setItem('reading-seeded','1');const prefix=edition==='share'?'dusk-demo-v1:':'';localStorage.setItem(prefix+'dusk-study-pet-full-state-v1',JSON.stringify(fixture));localStorage.setItem(prefix+'dusk-atelier-ui-v1',JSON.stringify({scene:'phone-window'}));if(edition==='personal')localStorage.setItem('dusk-study-pet-access-code-v1','synthetic');},{fixture,edition});
   const p=await ctx.newPage(),errors=[];p.setDefaultTimeout(7000);p.on('pageerror',e=>errors.push(e.message));
   await p.clock.install({time:new Date('2026-10-10T12:00:00+08:00')});await p.clock.pauseAt(new Date('2026-10-10T12:00:01+08:00'));
   await p.goto('http://127.0.0.1:'+server.address().port+'/');await p.waitForFunction(()=>days.length===7&&!restoringResume&&window.DuskMedia);
   for(const width of [320,390,430]){
    console.log('CHECK',edition,width);
    await p.setViewportSize({width,height:width===320?568:width===390?844:932});
    for(const petMode of [false,true]){
     await p.evaluate(on=>document.body.classList.toggle('pet-mode',on),petMode);
     for(const view of ['homeView','englishView','scheduleView','editView']){
      await p.locator(`button[data-atelier-view="${view}"]`).click();
      assert.equal(await p.locator('.atelier-main-content').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(252, 253, 251)');
      const overflow=await p.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,items:[...document.querySelectorAll('body *')].filter(n=>{const r=n.getBoundingClientRect();return r.width&&r.right>innerWidth+1&&getComputedStyle(n).position!=='fixed';}).slice(0,14).map(n=>[n.tagName,n.className,n.getBoundingClientRect().width])}));
      assert(overflow.scroll<=overflow.width+1,view+width+JSON.stringify(overflow));
      if(width===390&&!petMode&&['homeView','englishView'].includes(view))await p.screenshot({path:path.resolve(__dirname,`../../方案预览/正式S2-${edition}-${view}.png`),fullPage:true});
      await p.locator('#atelierDrawer').click();assert(await p.locator('.atelier-main-content').isHidden());
      await p.locator('#atelierDrawer').click();assert(await p.locator('.atelier-main-content').isVisible());
     }
    }
    await p.locator('button[data-atelier-view="scheduleView"]').click();
    await p.locator('[data-schedule-mode="week"]').click();
    assert(await p.locator('.mobile-compact-week').isVisible());assert(await p.locator('.schedule-scroll').isHidden());
    assert.equal(await p.locator('[data-compact-course]').count(),3);
    assert.match(await p.locator('[data-compact-course="0"]').innerText(),/C101\/C301/);
    assert.match(await p.locator('.compact-weekends').innerText(),/周末实验/);
    assert.match(await p.locator('.compact-weekends').innerText(),/晚间课程/);
    assert(await p.locator('.compact-course').evaluateAll(nodes=>nodes.every(n=>n.scrollWidth<=n.clientWidth+1)));
    await p.locator('[data-compact-course="0"]').click();await p.locator('#atelierCourseDetails').waitFor({state:'visible'});
    assert.match(await p.locator('.mobile-course-details').innerText(),/示例教师/);
    assert.match(await p.locator('.mobile-course-details').innerText(),/08:00–09:40/);
    const editDialog=edition==='share'?'#shareCourseDialog':'#courseQuickDialog',roomInput=edition==='share'?'#shareCourseRoom':'#quickCourseRoom';
    await p.locator('#atelierCourseEdit').click();await p.locator(editDialog).waitFor({state:'visible'});
    assert.equal(await p.locator(roomInput).inputValue(),'C101/C301');await p.locator(editDialog+' [data-quick-close]').first().click();
    await p.evaluate(()=>scrollTo(0,0));await p.waitForFunction(()=>document.querySelector('#atelierMobileScene').naturalWidth>0);
    await p.mouse.click(width/2,100);await p.locator('#atelierPaintingDialog').waitFor({state:'visible'});
    await p.locator('.painting-art img').click();assert(await p.locator('#atelierPaintingDialog').isHidden());
    if(width===390)await p.screenshot({path:path.resolve(__dirname,`../../方案预览/正式S2-A-${edition}.png`),fullPage:true});
   }
   assert.deepEqual(await p.evaluate(()=>selectedCourses),fixture.selectedCourses);
   await p.locator('button[data-atelier-view="englishView"]').click();
   await p.evaluate(()=>{DuskMedia.drawPraise=()=>false;englishProgress.trainingV1.auto=true;});
   const correct=await p.evaluate(()=>englishProgress.trainingV1.options.findIndex(o=>o.correct));
   await p.locator(`[data-option="${correct}"]`).click();
   const word=await p.locator('.training-word-row h3').textContent();
   await p.locator('#atelierDrawer').click();await p.clock.runFor(2000);
   assert.equal(await p.locator('.training-word-row h3').textContent(),word,'collapsed drawer advanced word');
   await p.locator('#atelierDrawer').click();await p.clock.runFor(801);
   assert.notEqual(await p.locator('.training-word-row h3').textContent(),word);
   assert.equal(await p.locator(`[data-option="${correct}"]`).evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(255, 255, 255)');
   await p.setViewportSize({width:1440,height:1000});await p.locator('button[data-atelier-view="scheduleView"]').click();
   assert(await p.locator('#atelierDrawer').isHidden());assert(await p.locator('.schedule-scroll').isVisible());assert(await p.locator('.mobile-compact-week').isHidden());
   await p.locator('#weekInput').fill('6');
   assert.match(await p.locator('.mobile-compact-week').innerText(),/另一周课程/);
   assert.deepEqual(errors,[]);await ctx.close();console.log('PASS',edition,'S2 x modes x sizes, A rooms/details/edit/weekend/period11, painting toggle, drawer pauses grading, touch reset, desktop retained');
  }catch(error){console.error('EDITION FAILED',edition,error);throw error;}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
