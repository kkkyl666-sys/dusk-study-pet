const {chromium}=require('../../方案预览/.tools/node_modules/playwright');
const assert=require('node:assert/strict'),http=require('node:http'),path=require('node:path');
const {buildRelease}=require('../build-release.cjs');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {for(const edition of ['personal','share']){
  const files=buildRelease(edition),server=http.createServer((req,res)=>{
   const file=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';
   if(!files[file])return res.writeHead(404).end();
   res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream');res.end(files[file]);
  });await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,serviceWorkers:'block',timezoneId:'Asia/Shanghai'});
  await context.route('https://**',r=>r.abort());
  await context.addInitScript(({edition,version})=>{
   const prefix=edition==='share'?'dusk-demo-v1:':'';if(localStorage.getItem(prefix+'return-test'))return;
   localStorage.setItem(prefix+'return-test','yes');
   localStorage.setItem(prefix+'dusk-study-pet-full-state-v1',JSON.stringify({selectedCourses:[{name:'Test',room:'A101',teacher:'Test',day:4,periods:[1,2],weeks:[[1,17]]}],days:Array.from({length:7},(_,i)=>({name:'Day'+i,line:'Test',tasks:[]})),checked:{},englishProgress:{remembered:{},forgotten:{}},englishStart:'2026-10-23',appointments:[],englishAdjustments:[],changedAt:1}));
   localStorage.setItem(prefix+'dusk-atelier-ui-v1',JSON.stringify({scene:'phone-window',motion:false}));
   if(edition==='personal')localStorage.setItem('dusk-study-pet-access-code-v1','synthetic');
   else localStorage.setItem(prefix+'guide-v1',JSON.stringify({welcomeDismissed:true,promptedVersion:version}));
  },{edition,version:require('../app-targets.cjs')[edition].version});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://youdao.com/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Dictionary mock</title><h1>Dictionary test</h1>'}));
  const ready=()=>page.waitForFunction(()=>window.DuskStudyUI&&!restoringResume);
  const state=()=>page.evaluate(()=>({id:DuskTraining.currentWord()?.id,marks:JSON.stringify({remembered:englishProgress.remembered,forgotten:englishProgress.forgotten}),options:JSON.stringify(englishProgress.trainingV1.options)}));
  try {
   await page.clock.setFixedTime(new Date('2026-10-23T09:33:00+08:00'));
   await page.goto('http://127.0.0.1:'+server.address().port);await ready();
   await page.evaluate(()=>activateView('englishView'));await page.locator('#studyOverview [data-study=start]').click();
   await page.waitForFunction(()=>document.querySelector('#atelierMobileScene').naturalWidth>500);
   assert(await page.locator('#studyPaintingBanner').isVisible());
   assert(await page.locator('#studyFocusBar').innerText().then(s=>s.includes('剩余 10')));
   assert.equal(await page.locator('.atelier-main-content').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');
   assert.equal(await page.locator('#englishView').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(252, 253, 251)');
   await page.locator('#studyPaintingBanner').click();await page.waitForFunction(()=>{const i=document.querySelector('#atelierPaintingDialog img');return i?.complete&&i.naturalWidth>500;});
   assert(await page.locator('#atelierPaintingDialog').isVisible());await page.locator('#atelierPaintingClose').click();await page.waitForFunction(()=>!history.state?.petDialog);
   const beforeCopy=await state();await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedTest=text;}}}));await page.locator('#studyFocusBar [data-study=tools]').click();await page.locator('#studyToolsBody [data-study=copy]').click();assert.equal(await page.evaluate(()=>window.copiedTest),await page.evaluate(()=>DuskTraining.currentWord().word));assert.deepEqual(await state(),beforeCopy);await page.locator('[data-study-close]').click();await page.waitForFunction(()=>!history.state?.petDialog);
   await page.locator('#studyFocusBar [data-study=tools]').click();await page.locator('#studyToolsBody [data-study=atelier]').click();await page.locator('#atelierSettingsDialog').waitFor();await page.locator('#atelierSettingsClose').click();await page.waitForFunction(()=>!history.state?.petDialog);
   for(const width of [320,390,430]){await page.setViewportSize({width,height:width===320?568:844});await page.evaluate(()=>renderEnglish());assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));await page.screenshot({path:path.resolve(__dirname,`../../方案预览/画室恢复-${edition}-${width}.png`)});}
   await page.setViewportSize({width:390,height:844});
   const before=await state();await page.locator('.study-term').click();assert.equal(await page.locator('#wordDetailBody a').getAttribute('target'),'_self');assert(!(await page.locator('#wordDetailBody').innerText()).includes(await page.evaluate(()=>DuskTraining.currentWord().meaning)));
   await page.locator('#wordReturnToStudy').click();await page.waitForFunction(()=>!history.state?.petDialog);assert.deepEqual(await state(),before);
   await page.locator('.study-term').click();await page.locator('#wordDetailBody a').click();await page.waitForURL('https://youdao.com/**');
   await page.goBack();await ready();await page.waitForFunction(()=>document.body.dataset.studyFocus==='true');assert.deepEqual(await state(),before);assert(!(await page.locator('#wordDetailDialog').isVisible()));
   // A fresh document restoration, rather than relying only on a warm Back navigation.
   await page.locator('.study-term').click();await page.locator('#wordDetailBody a').click();await page.waitForURL('https://youdao.com/**');
   await page.goto('http://127.0.0.1:'+server.address().port);await ready();await page.waitForFunction(()=>document.body.dataset.studyFocus==='true');assert.deepEqual(await state(),before);assert(await page.evaluate(()=>DuskStudyUI.autoPaused()));
   await page.evaluate(()=>DuskMedia.drawPraise=()=>false);let choice=await page.evaluate(()=>englishProgress.trainingV1.options.findIndex(o=>o.correct));await page.locator(`[data-training=answer][data-option="${choice}"]`).click();
   await page.locator('.study-term').click();const graded=await state();await page.locator('#wordDetailBody a').click();await page.waitForURL('https://youdao.com/**');await page.goBack();await ready();await page.waitForFunction(()=>document.body.dataset.studyFocus==='true');await page.waitForTimeout(1000);assert.deepEqual(await state(),graded);assert(await page.locator('.training-right').isVisible());
   await page.locator('.training-footer [data-training=continue]').click();assert.notEqual((await state()).id,graded.id);
   // Storage failure must not navigate away with an uncommitted return point.
   await page.locator('.study-term').click();await page.evaluate(()=>{window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key===wordReturnKey)throw new DOMException('test','QuotaExceededError');return originalSet.call(this,key,value);};});
   await page.locator('#wordDetailBody a').click();assert(page.url().startsWith('http://127.0.0.1:'));assert(await page.locator('#wordDetailDialog').isVisible());await page.evaluate(()=>Storage.prototype.setItem=window.originalSet);
   await page.locator('#wordReturnToStudy').click();await page.waitForFunction(()=>!history.state?.petDialog);
   await page.setViewportSize({width:1280,height:900});await page.locator('.study-term').click();assert.equal(await page.locator('#wordDetailBody a').getAttribute('target'),'_blank');
   await page.locator('#wordReturnToStudy').click();await page.waitForFunction(()=>!history.state?.petDialog);await page.setViewportSize({width:390,height:844});
   await page.evaluate(()=>localStorage.setItem(wordReturnKey,JSON.stringify({version:1,wordId:DuskTraining.currentWord().id,track:'new',key:`${englishStart}:${englishDayIndex()}`,at:Date.now()-3*60*60*1000})));await page.reload();await ready();assert.equal(await page.evaluate(()=>pendingWordReturn()),null);assert.equal(await page.evaluate(()=>document.body.dataset.studyFocus),'false');
   await page.clock.setFixedTime(new Date('2026-10-24T03:59:00+08:00'));await page.evaluate(()=>localStorage.setItem(wordReturnKey,JSON.stringify({version:1,wordId:'0-consistent',track:'new',key:`${englishStart}:${englishDayIndex()}`,at:Date.now()})));await page.clock.setFixedTime(new Date('2026-10-24T04:00:00+08:00'));await page.reload();await ready();assert.equal(await page.evaluate(()=>pendingWordReturn()),null);
   assert.deepEqual(errors,[]);console.log('PASS',edition,'wallpaper/painting/settings/progress, three mobile sizes, same-tab Back and fresh-document return, no grade/option change, held feedback, failed storage prevents navigation, desktop target.');
  } finally {await context.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
 }} finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
