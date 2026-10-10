const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(path.resolve(__dirname,'../../方案预览/.tools/node_modules/playwright'));
const {buildRelease}=require('../build-release.cjs');
const root=path.resolve(__dirname,'..'),shots=path.resolve(root,'../方案预览');
const fixture={selectedCourses:[{name:'测试课程',teacher:'测试教师',room:'T101',day:0,periods:[1,2],weeks:[[1,17]],type:'major'}],days:Array.from({length:7},(_,i)=>({name:'星期'+i,date:'',line:'测试',tasks:[]})),checked:{sentinel:true},englishProgress:{remembered:{},forgotten:{}},englishStart:'2026-10-01',appointments:[],englishAdjustments:[],changedAt:1,shareCalendar:'2026-09-07'};
(async()=>{
  const files=buildRelease('share'),personal=buildRelease('personal');
  assert(!personal['share-guide.js']);assert(!personal['index.html'].toString().includes('share-guide'));
  assert(files['sw.js'].toString().includes('./share-guide.js?v=1'));assert(files['sw.js'].toString().includes('./share-guide.css?v=1'));
  const server=http.createServer((req,res)=>{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1)||'index.html';const data=files[name];if(!data)return res.writeHead(404).end();res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2','.json':'application/json','.webmanifest':'application/manifest+json'})[path.extname(name)]||'text/plain');res.end(data);});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({channel:'msedge',headless:true});const errors=[],cloud=[];
  async function context(seed,width=390){
    const ctx=await browser.newContext({viewport:{width,height:width===320?568:844},isMobile:width<700,hasTouch:width<700,timezoneId:'Asia/Shanghai',serviceWorkers:'block'});
    await ctx.route('https://**',route=>{if(route.request().url().includes('/rpc/'))cloud.push(route.request().url());return route.abort();});
    if(seed)await ctx.addInitScript(data=>{if(!localStorage.getItem('test-seeded')){localStorage.setItem('test-seeded','yes');localStorage.setItem('dusk-demo-v1:dusk-study-pet-full-state-v1',JSON.stringify(data));}},seed);
    const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(url);await p.waitForFunction(()=>window.shareTools&&!restoringResume);return {ctx,p};
  }
  try{
    for(const width of [320,390,430,1280]){
      const {ctx,p}=await context(null,width);
      await p.locator('#shareGuideDialog').waitFor({state:'visible'});
      assert(await p.locator('#shareWelcomeGuide').isVisible());assert.equal(await p.locator('.share-guide-primary').innerText(),'先看看使用指南');
      await p.locator('.share-welcome-art img').evaluate(i=>i.decode());
      assert(await p.locator('#shareGuideDialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
      await p.screenshot({path:path.join(shots,`正式指南-欢迎-${width}.png`)});
      await p.locator('#shareWelcomeGuide').click();
      for(const tab of ['courses','words','backup','feedback','updates','start']){
        await p.locator(`[data-guide-tab="${tab}"]`).click();assert(await p.locator('#shareGuideBody').innerText());
        assert(await p.locator('#shareGuideDialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
      }
      await p.screenshot({path:path.join(shots,`正式指南-正文-${width}.png`)});
      await p.locator('#shareGuideReturn').click();await p.waitForFunction(()=>!history.state?.petDialog);
      assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),`page overflow at ${width}`);
      await p.reload();assert(await p.locator('#shareGuideDialog').isHidden());assert.equal(await p.locator('#shareUpdateNotice').count(),0);
      await p.locator('#atelierSettings').click();await p.locator('#shareGuideSettings').click();await p.locator('#shareGuideDialog').waitFor({state:'visible'});assert(await p.locator('#atelierSettingsDialog').isHidden());
      await p.locator('[data-guide-tab="courses"]').click();await p.locator('[data-guide-action="edit"]:visible').click();await p.waitForFunction(()=>currentViewId()==='editView'&&!history.state?.petDialog);
      await p.locator('#shareGuideEditor').click();await p.locator('#shareGuideDialog').waitFor({state:'visible'});
      // Android/browser Back closes the guide, without closing the page or trapping navigation.
      await p.goBack();await p.locator('#shareGuideDialog').waitFor({state:'hidden'});
      await ctx.close();
    }
    const {ctx,p}=await context(fixture);
    assert(await p.locator('#shareGuideDialog').isHidden());await p.locator('#shareUpdateNotice').waitFor();
    const before=await p.evaluate(()=>JSON.stringify({selectedCourses,days,checked,englishProgress,englishStart,appointments}));
    await p.locator('[data-share-update="dismiss"]').click();await p.reload();assert.equal(await p.locator('#shareUpdateNotice').count(),0);
    await p.locator('#shareGuideOpen').click();await p.locator('[data-guide-tab="updates"]').click();await p.locator('#shareGuideClose').click();await p.waitForFunction(()=>!history.state?.petDialog);
    assert.equal(await p.evaluate(()=>JSON.stringify({selectedCourses,days,checked,englishProgress,englishStart,appointments})),before);
    // A new release is not announced on the English page, and old versions are coalesced.
    await p.setViewportSize({width:1280,height:900});
    await p.locator('.atelier-nav [data-atelier-view="englishView"]').click();
    await p.evaluate(()=>localStorage.setItem('dusk-demo-v1:guide-v1',JSON.stringify({welcomeDismissed:true,promptedVersion:'old',readVersion:'old'})));
    await p.reload();await p.waitForFunction(()=>currentViewId()==='englishView'&&!restoringResume);
    assert.equal(await p.locator('#shareUpdateNotice').count(),0);assert.equal(await p.locator('#shareGuideDialog[open]').count(),0);
    await p.locator('.atelier-nav [data-atelier-view="homeView"]').click();await p.locator('#shareUpdateNotice').waitFor();
    await p.locator('[data-share-update="read"]').click();await p.locator('#shareGuideDialog').waitFor();
    assert.match(await p.locator('#shareGuideBody').innerText(),/2026.10.10.5/);
    await p.locator('#shareGuideClose').click();await p.waitForFunction(()=>!history.state?.petDialog);await p.reload();assert.equal(await p.locator('#shareUpdateNotice').count(),0);
    await ctx.close();
    const blocked=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
    await blocked.route('https://**',r=>r.abort());await blocked.route('**/share-guide.js*',r=>r.abort());
    const b=await blocked.newPage();await b.goto(url);await b.waitForFunction(()=>window.shareTools&&!restoringResume);await b.locator('.atelier-nav [data-atelier-view="editView"]').click();await b.locator('#shareAddCourse').click();assert(await b.locator('#shareCourseDialog').isVisible());await blocked.close();
    const quota=await context(fixture);
    await quota.p.evaluate(()=>{localStorage.removeItem('dusk-demo-v1:guide-v1');});
    await quota.ctx.addInitScript(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='dusk-demo-v1:guide-v1')throw Error('quota');return original.call(this,k,v);};});
    await quota.p.reload();await quota.p.locator('#shareUpdateNotice').waitFor();await quota.p.locator('[data-share-update="dismiss"]').click();await quota.p.locator('.atelier-nav [data-atelier-view="englishView"]').click();await quota.p.locator('.atelier-nav [data-atelier-view="homeView"]').click();assert.equal(await quota.p.locator('#shareUpdateNotice').count(),0);await quota.ctx.close();
    assert.deepEqual(cloud,[]);assert.deepEqual(errors,[]);
    console.log('PASS share guide: fresh/returning, 320/390/430/desktop, dismiss/read persistence, tabs, settings/editor, Back transitions, deferred/coalesced updates, unchanged learning records, missing module, quota degradation, isolated personal build and cache URLs.');
  }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
