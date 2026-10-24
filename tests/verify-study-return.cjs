const {chromium,devices}=require('../../方案预览/.tools/node_modules/playwright');
const assert=require('node:assert/strict'),http=require('node:http'),path=require('node:path');
const {buildRelease}=require('../build-release.cjs'),targets=require('../app-targets.cjs');
const live=process.argv.includes('--live');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{for(const edition of ['personal','share']){
  const files=buildRelease(edition),server=http.createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';if(!files[name])return res.writeHead(404).end();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2'})[path.extname(name)]||'application/octet-stream');res.end(files[name]);});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const context=await browser.newContext({...devices['Pixel 7'],viewport:{width:390,height:844},serviceWorkers:'block',timezoneId:'Asia/Shanghai'});
  await context.route('**/*',route=>{
   const request=route.request(),host=new URL(request.url()).hostname;
   if(new URL(request.url()).protocol!=='https:')return route.continue();
   if(live&&/(^|\.)(youdao\.com|ydstatic\.com)$/.test(host))return route.continue();
   if(!live&&host==='youdao.com'&&request.isNavigationRequest())return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Dictionary fixture, not real Youdao</title><h1>Dictionary fixture</h1><label>Search<input value="fixture"></label><button id="escape" onclick="try{top.location.href=\'https://youdao.com/escape\'}catch(e){document.body.dataset.blocked=\'yes\'}">Top navigation test</button><a id="popup" target="_blank" href="https://youdao.com/escape">Popup test</a>'});
   return route.abort();
  });
  await context.addInitScript(({edition,version})=>{
   if(location.hostname!=='127.0.0.1')return;
   const prefix=edition==='share'?'dusk-demo-v1:':'';if(localStorage.getItem(prefix+'frame-test'))return;localStorage.setItem(prefix+'frame-test','yes');
   localStorage.setItem(prefix+'dusk-study-pet-full-state-v1',JSON.stringify({selectedCourses:[{name:'Test',teacher:'Test',room:'A101',day:4,periods:[1,2],weeks:[[1,17]]}],days:Array.from({length:7},(_,i)=>({name:'Day'+i,line:'Test',tasks:[]})),checked:{},englishProgress:{remembered:{},forgotten:{}},englishStart:'2026-10-23',appointments:[],englishAdjustments:[],changedAt:1}));
   localStorage.setItem(prefix+'dusk-atelier-ui-v1',JSON.stringify({scene:'phone-window',motion:false}));
   if(edition==='personal')localStorage.setItem('dusk-study-pet-access-code-v1','synthetic');else localStorage.setItem(prefix+'guide-v1',JSON.stringify({welcomeDismissed:true,promptedVersion:version}));
  },{edition,version:targets[edition].version});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>{if(!live||!/youdao|ydstatic/i.test(e.stack||''))errors.push(e.message);});
  const state=()=>page.evaluate(()=>JSON.stringify({progress:englishProgress,id:DuskTraining.currentWord()?.id}));
  const open=async()=>{await page.locator('.study-term').click();await page.locator('#wordDetailBody a').click();await page.locator('#wordDetailDialog iframe').waitFor();};
  try{
   await page.clock.setFixedTime(new Date('2026-10-23T15:26:00Z'));
   await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.DuskStudyUI&&!restoringResume);await page.evaluate(()=>activateView('englishView'));await page.locator('#studyOverview [data-study=start]').click();
   await page.waitForFunction(()=>document.querySelector('#atelierMobileScene').naturalWidth>500);
   const url=page.url(),before=await state();await open();assert.equal(page.url(),url);assert.equal(context.pages().length,1);
   const frame=page.frameLocator('#wordDetailDialog iframe');
   if(live){const word=await page.evaluate(()=>DuskTraining.currentWord().word);await frame.locator('body').waitFor();await frame.getByText(/网易有道词典/).first().waitFor({timeout:25000});assert((await frame.locator('body').innerText()).toLowerCase().includes(word.toLowerCase()));}
   else {await frame.getByText('Dictionary fixture',{exact:true}).waitFor();await frame.locator('input').fill('prolonged');assert(await page.locator('#wordDetailDialog').isVisible());assert.equal(await frame.locator('#escape').count(),1,await frame.locator('body').innerText());await frame.locator('#escape').click();assert.equal(page.url(),url);assert.equal(await frame.locator('body').getAttribute('data-blocked'),'yes');await frame.locator('#popup').click();await page.waitForTimeout(150);assert.equal(context.pages().length,1);}
   assert.deepEqual(await state(),before);
   assert(!(await page.locator('#wordDetailDialog iframe').getAttribute('sandbox')).includes('top-navigation'));
   for(const width of [320,390,430,1280]){
    await page.setViewportSize({width,height:width===320?568:844});await page.waitForTimeout(100);
    const bounds=await page.locator('#wordDetailDialog').boundingBox();assert(bounds.x>=0&&bounds.x+bounds.width<=width+2);assert(bounds.y>=12&&bounds.y+bounds.height<=846);
    if(width<=760)assert(bounds.y>=60,'wallpaper remains exposed above the panel');
    assert(await page.locator('#wordDictionaryClose').isVisible());assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
    if(live&&width===390)await page.screenshot({path:path.resolve(__dirname,`../../方案预览/有道内嵌真实-${edition}-390.png`)});
   }
   await page.setViewportSize({width:390,height:844});await page.waitForTimeout(100);await page.touchscreen.tap(30,25);
   await page.waitForFunction(()=>!document.querySelector('#wordDetailDialog').open);assert.equal(await page.locator('#wordDetailDialog iframe').count(),0);assert.deepEqual(await state(),before);assert(!(await page.locator('#atelierPaintingDialog').isVisible()));assert.equal(page.url(),url);
   await open();await page.locator('#wordDictionaryReload').click();assert(await page.locator('#wordDetailDialog').isVisible());await page.locator('#wordDictionaryClose').click();await page.waitForFunction(()=>!history.state?.petDialog);assert.deepEqual(await state(),before);
   // Correct-answer feedback must not auto-advance while reading, or after dismissing.
   await page.evaluate(()=>{englishProgress.trainingV1.auto=false;DuskMedia.drawPraise=()=>false;});const correct=await page.evaluate(()=>englishProgress.trainingV1.options.findIndex(o=>o.correct));await page.locator(`[data-option="${correct}"]`).click();const answeredId=await page.evaluate(()=>DuskTraining.currentWord().id);await open();await page.evaluate(()=>englishProgress.trainingV1.auto=true);await page.touchscreen.tap(30,25);await page.waitForFunction(()=>!document.querySelector('#wordDetailDialog').open);await page.waitForTimeout(950);assert.equal(await page.evaluate(()=>DuskTraining.currentWord().id),answeredId);assert(await page.locator('.training-right').isVisible());await page.locator('.training-footer [data-training=continue]').click();assert.notEqual(await page.evaluate(()=>DuskTraining.currentWord().id),answeredId);
   if(!live){await open();await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#wordDetailDialog').open);assert.equal(page.url(),url);
    await context.route('https://youdao.com/**',route=>route.abort());
    const beforeFailure=await state();await open();await page.waitForTimeout(200);
    await page.locator('#wordDictionaryReload').click();await page.touchscreen.tap(30,25);
    await page.waitForFunction(()=>!document.querySelector('#wordDetailDialog').open);
    assert.deepEqual(await state(),beforeFailure);assert.equal(page.url(),url);
   }
   assert.deepEqual(errors,[]);console.log('PASS',edition,live?'REAL Youdao embedded content':'controlled frame, sandbox containment','panel bounds, background/header close, unchanged grade and options, no top-level navigation or popup, stopped feedback timer.');
  }finally{await context.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
