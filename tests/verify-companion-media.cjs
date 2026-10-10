const assert=require('node:assert/strict'),http=require('node:http'),path=require('node:path');
const {chromium}=require('../../方案预览/.tools/node_modules/playwright');
const {buildRelease}=require('../build-release.cjs');
const fixture={selectedCourses:[{name:'Test',day:0,periods:[1,2],weeks:[[1,17]],type:'major'}],days:Array.from({length:7},(_,i)=>({name:'Test'+i,tasks:[],line:'Test'})),checked:{},englishProgress:{},englishStart:'2026-10-10',appointments:[],englishAdjustments:[],changedAt:1};
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{for(const edition of ['personal','share']){
  const files=buildRelease(edition),mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2'};
  const server=http.createServer((req,res)=>{const n=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';res.setHeader('Content-Type',mime[path.extname(n)]||'application/json');res.end(files[n]);});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{
   const c=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Asia/Shanghai',serviceWorkers:'block'});
   await c.route('https://**',r=>r.abort());
   let release;const gate=new Promise(r=>release=r);
   await c.route('**/assets/companion/*.webp',async r=>{await gate;try{const n=new URL(r.request().url()).pathname.slice(1);await r.fulfill({body:files[n],contentType:'image/webp'});}catch{}});
   await c.addInitScript(({fixture,edition})=>{if(localStorage.getItem('media-test'))return;localStorage.setItem('media-test','1');const prefix=edition==='share'?'dusk-demo-v1:':'';localStorage.setItem(prefix+'dusk-study-pet-full-state-v1',JSON.stringify(fixture));if(edition==='personal')localStorage.setItem('dusk-study-pet-access-code-v1','test');},{fixture,edition});
   const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
   await p.clock.install({time:new Date('2026-10-10T12:00:00+08:00')});await p.clock.pauseAt(new Date('2026-10-10T12:00:01+08:00'));
   await p.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>days.length===7&&!restoringResume&&window.DuskMedia&&document.querySelector('#wordTraining'));console.log(edition,'ready');
   const savedDraw=await p.evaluate(()=>{window.testDraw=DuskMedia.drawPraise;DuskMedia.drawPraise=()=>false;return true;});assert(savedDraw);
   const next=()=>p.locator('.training-footer [data-training="continue"]').click();
   const answer=async correct=>{const i=await p.evaluate(v=>englishProgress.trainingV1.options.findIndex(x=>x.correct===v),correct);await p.locator(`[data-option="${i}"]`).click();};
   await p.locator('button[data-atelier-view="englishView"]').click();
   await answer(false);await p.clock.runFor(2000);assert.equal(await p.locator('.training-scene').count(),0);
   assert(await p.locator('.training-wrong').isVisible());release();
   await p.locator('.training-scene').waitFor({state:'visible'});
   assert(await p.locator('.training-scene img').evaluate(x=>x.complete&&x.naturalWidth>0));
   await p.clock.runFor(999);assert.equal(await p.locator('.training-scene').count(),1);await p.clock.runFor(1);await next();console.log(edition,'first decoded scene');
   // Every original option slot remains a same-position continue target in both layouts.
   for(const width of [390,1440]){
    await p.setViewportSize({width,height:1000});await p.locator('button[data-atelier-view="englishView"]').click();
    for(let slot=0;slot<4;slot++){
     await p.evaluate(slot=>{const s=englishProgress.trainingV1;const i=s.options.findIndex(x=>!x.correct);[s.options[slot],s.options[i]]=[s.options[i],s.options[slot]];renderEnglish();},slot);
     const choice=p.locator(`[data-option="${slot}"]`);await choice.scrollIntoViewIfNeeded();const before=await choice.boundingBox();
     await choice.click();await p.locator('.training-scene').waitFor({state:'visible'});await p.clock.runFor(1000);
     const target=p.locator('.training-options [data-training="continue"]'),after=await target.boundingBox();
     assert(Math.abs(before.x-after.x)<2&&Math.abs(before.y-after.y)<2,`slot ${slot} stays put at ${width}: ${JSON.stringify({before,after})}`);
     const word=await p.locator('.training-word-row h3').textContent();
     await p.mouse.click(before.x+before.width/2,before.y+before.height/2);
     assert.notEqual(await p.locator('.training-word-row h3').textContent(),word);
    }
   }
   console.log(edition,'same-position slots');
   // Pure probability boundary, hard pity and per-device inherited chance.
   assert.deepEqual(await p.evaluate(()=>[DuskMedia.nextPraise(15,.149),DuskMedia.nextPraise(15,.15),DuskMedia.nextPraise(95,.99),DuskMedia.nextPraise(100,.999)]),[{hit:true,chance:15},{hit:false,chance:25},{hit:false,chance:100},{hit:true,chance:15}]);
   await p.evaluate(()=>{localStorage.setItem(appStorageKey('dusk-praise-chance-v1'),'45');});
   await answer(false);await p.locator('.training-scene').waitFor({state:'visible'});await p.clock.runFor(1000);
   assert.equal(await p.evaluate(()=>localStorage.getItem(appStorageKey('dusk-praise-chance-v1'))),'45','wrong preserves chance');await next();
   await p.evaluate(()=>{const old=Math.random;Math.random=()=>.99;window.testDraw();Math.random=old;});
   assert.equal(await p.evaluate(()=>localStorage.getItem(appStorageKey('dusk-praise-chance-v1'))),'55');
   await p.reload();await p.waitForFunction(()=>days.length===7&&!restoringResume&&window.DuskMedia);await p.locator('button[data-atelier-view="englishView"]').click();
   assert.equal(await p.evaluate(()=>localStorage.getItem(appStorageKey('dusk-praise-chance-v1'))),'55','reload preserves chance');
   await p.evaluate(()=>{const draw=DuskMedia.drawPraise;DuskMedia.drawPraise=()=>{const old=Math.random;Math.random=()=>0;try{return draw();}finally{Math.random=old;}};});
   await answer(true);await p.locator('.training-scene[data-kind="praise"]').waitFor({state:'visible'});
   assert.equal(await p.evaluate(()=>localStorage.getItem(appStorageKey('dusk-praise-chance-v1'))),'15','hit resets to base');
   assert(await p.locator('.training-scene img').evaluate(x=>x.complete&&x.naturalWidth>0),'first praise decoded');
   const id=await p.evaluate(()=>englishProgress.trainingV1.feedback.id);await p.clock.runFor(1999);assert.equal(await p.locator('.training-scene').count(),1);assert.equal(await p.locator('.training-scene').evaluate(n=>getComputedStyle(n).animationDuration),'2s');assert.equal(await p.evaluate(()=>englishProgress.trainingV1.feedback.id),id,'no auto behind praise');
   await p.clock.runFor(1);await p.clock.runFor(799);assert.equal(await p.evaluate(()=>englishProgress.trainingV1.feedback.id),id);await p.clock.runFor(1);assert.equal(await p.evaluate(()=>englishProgress.trainingV1.feedback),null);
   // Every media resource can be decoded; random functions visit different members, never adjacent duplicates.
   const stats=await p.evaluate(async()=>{
    const all=[...DuskMedia.art.anger,...DuskMedia.art.praise,...DuskMedia.art.wallpapers.flatMap(x=>[x.file,x.preview])];
    const loaded=[];for(const src of all){const image=await DuskMedia.prepare(src);loaded.push(!!image?.naturalWidth);}
    const images=[],lines=[];for(let i=0;i<80;i++){images.push(DuskMedia.pickRandom(DuskMedia.art.anger,'test-random'));lines.push(DuskMedia.line('anger'));}
    return {loaded,images,lines};
   });assert(stats.loaded.every(Boolean));assert.equal(new Set(stats.lines).size,8);assert(new Set(stats.images).size>5);assert(stats.images.every((x,i)=>!i||x!==stats.images[i-1]));
   // A bad selected resource falls back to another decoded image rather than a blank scene.
   await p.evaluate(()=>{DuskMedia.art.anger.unshift('assets/companion/missing.webp');const old=DuskMedia.pickRandom;});
   await c.route('**/missing.webp',r=>r.abort());
   const fallback=await p.evaluate(async()=>{const old=Math.random;Math.random=()=>0;try{const img=await DuskMedia.scene('anger');return !!img?.naturalWidth;}finally{Math.random=old;}});assert(fallback);
   for(const size of [{width:390,height:844},{width:1440,height:1000}]){
    await p.setViewportSize(size);await p.locator('#atelierSettings').click();
    await p.locator('#atelierSceneSelect').selectOption(size.width===390?'phone-ink':'desk-study');await p.locator('#atelierSettingsClose').click();
    await p.waitForFunction(()=>{const image=document.querySelector(innerWidth<=760?'#atelierMobileScene':'#atelierScene');return image.complete&&image.naturalWidth>0&&image.dataset.quality==='full';});
    await p.locator('button[data-atelier-view="homeView"]').click();await p.screenshot({path:path.resolve(__dirname,`../../方案预览/随机陪伴-${edition}-${size.width}.png`)});
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   }
   assert.deepEqual(errors,[]);await c.close();
   // Truly cold first-correct scene: all praise requests are stalled before any decode.
   const cold=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Shanghai',serviceWorkers:'block'});
   await cold.route('https://**',r=>r.abort());let unblock;const praiseGate=new Promise(r=>unblock=r);
   await cold.route('**/assets/companion/praise-*.webp',async r=>{await praiseGate;try{await r.fulfill({body:files[new URL(r.request().url()).pathname.slice(1)],contentType:'image/webp'});}catch{}});
   await cold.addInitScript(({fixture,edition})=>{const prefix=edition==='share'?'dusk-demo-v1:':'';localStorage.setItem(prefix+'dusk-study-pet-full-state-v1',JSON.stringify(fixture));if(edition==='personal')localStorage.setItem('dusk-study-pet-access-code-v1','test');},{fixture,edition});
   try{
    const q=await cold.newPage();await q.clock.install({time:new Date('2026-10-10T12:00:00+08:00')});await q.clock.pauseAt(new Date('2026-10-10T12:00:01+08:00'));
    await q.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});await q.waitForFunction(()=>days.length===7&&!restoringResume&&window.DuskMedia);
    await q.evaluate(()=>{DuskMedia.drawPraise=()=>true;});await q.locator('button[data-atelier-view="englishView"]').click();
    const i=await q.evaluate(()=>englishProgress.trainingV1.options.findIndex(o=>o.correct));await q.locator(`[data-option="${i}"]`).click();
    await q.clock.runFor(2000);assert.equal(await q.locator('.training-scene').count(),0);assert(await q.locator('.training-right').isVisible());
    unblock();await q.locator('.training-scene[data-kind="praise"]').waitFor({state:'visible'});
    assert(await q.locator('.training-scene img').evaluate(x=>x.complete&&x.naturalWidth>0));await q.clock.runFor(1999);assert.equal(await q.locator('.training-scene').count(),1);await q.clock.runFor(1);assert.equal(await q.locator('.training-scene').count(),0);
   }finally{unblock();await cold.close();}
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
  console.log('PASS '+edition+': cold wrong/praise decode, four same-position slots, 800ms, persisted pity, random 8 lines and pools, fallback, wallpapers; synthetic only');
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
