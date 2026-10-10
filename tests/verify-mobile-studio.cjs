const assert=require('node:assert/strict');
const http=require('node:http'),path=require('node:path');
const {chromium}=require('../../方案预览/.tools/node_modules/playwright');
const {buildRelease}=require('../build-release.cjs');
const fixture={selectedCourses:[{name:'Test',day:0,periods:[1,2],weeks:[[1,17]],type:'major'}],days:Array.from({length:7},(_,i)=>({name:'Day '+i,tasks:[],line:'Test'})),checked:{},englishProgress:{},englishStart:'2026-10-10',appointments:[],englishAdjustments:[],changedAt:1};
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const watchdog=setTimeout(()=>browser.close(),90000);
 try{for(const edition of ['personal','share']){
  const files=buildRelease(edition),mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.woff2':'font/woff2'};
  const server=http.createServer((req,res)=>{const n=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';if(!files[n])return res.writeHead(404).end();res.setHeader('Content-Type',mime[path.extname(n)]||'application/json');res.end(files[n]);});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{
   const c=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Shanghai',serviceWorkers:'block'});
   await c.route('https://**',r=>r.abort());
   await c.addInitScript(({fixture,edition})=>{if(localStorage.getItem('studio-test'))return;localStorage.setItem('studio-test','1');const prefix=edition==='share'?'dusk-demo-v1:':'';localStorage.setItem(prefix+'dusk-study-pet-full-state-v1',JSON.stringify(fixture));if(edition==='personal')localStorage.setItem('dusk-study-pet-access-code-v1','test');},{fixture,edition});
   const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
   await p.clock.install({time:new Date('2026-10-10T12:00:00+08:00')});await p.clock.pauseAt(new Date('2026-10-10T12:00:01+08:00'));
   await p.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
   await p.waitForFunction(()=>days.length===7&&!restoringResume&&window.DuskMedia);
   await p.locator('button[data-atelier-view="homeView"]').click();
   for(const size of [{width:320,height:568},{width:390,height:844},{width:430,height:932}]){
    await p.setViewportSize(size);
    await p.locator('#atelierSettings').click();await p.locator('#atelierSceneSelect').selectOption('phone-window');await p.locator('#atelierSettingsClose').click();
    await p.waitForFunction(()=>document.querySelector('#atelierMobileScene').naturalWidth>0);
    const layout=await p.evaluate(()=>{const wall=document.querySelector('.mobile-scene').getBoundingClientRect(),hero=document.querySelector('#homeView aside').getBoundingClientRect();return {wall:[wall.width,wall.height],hero:hero.height,bg:getComputedStyle(document.querySelector('.home-body')).backgroundColor,overflow:document.documentElement.scrollWidth>innerWidth+1};});
    assert.deepEqual(layout.wall,[size.width,size.height]);assert(Math.abs(layout.hero-size.height*.48)<2);assert.equal(layout.bg,'rgb(252, 253, 251)');assert(!layout.overflow);
    await p.screenshot({path:path.resolve(__dirname,`../../方案预览/正式手机画室-${edition}-${size.width}.png`)});
    await p.locator('#atelierPainting').click();await p.locator('#atelierPaintingDialog').waitFor({state:'visible'});
    await p.waitForFunction(()=>document.querySelector('.painting-art img')?.naturalWidth>0);
    assert.equal(await p.locator('.painting-art img').evaluate(img=>getComputedStyle(img).objectFit),'contain');
    const dialog=await p.locator('#atelierPaintingDialog').boundingBox();assert.equal(dialog.height,size.height);
    assert(await p.locator('#atelierPaintingClose').isVisible());
    await p.screenshot({path:path.resolve(__dirname,`../../方案预览/正式完整画卷-${edition}-${size.width}.png`)});
    await p.locator('#atelierPaintingClose').click();assert(!await p.locator('#atelierPaintingDialog').isVisible());
   }
   // Settings and custom media remain local and use the existing per-edition store.
   await p.locator('#atelierSettings').click();
   await p.locator('#atelierWallpaperFile').setInputFiles({name:'custom.webp',mimeType:'image/webp',buffer:Buffer.from(files['assets/companion/anger-4.webp'])});
   await p.waitForFunction(()=>document.querySelector('#atelierMobileScene').src.startsWith('blob:'));
   await p.locator('#atelierSettingsClose').click();await p.locator('#atelierPainting').click();
   await p.waitForFunction(()=>document.querySelector('.painting-art img')?.src.startsWith('blob:')&&document.querySelector('.painting-art img').naturalWidth>0);
   await p.keyboard.press('Escape');assert(!await p.locator('#atelierPaintingDialog').isVisible());
   await p.reload();await p.waitForFunction(()=>days.length===7&&!restoringResume&&document.querySelector('#atelierMobileScene').src.startsWith('blob:'));
   await p.locator('button[data-atelier-view="englishView"]').click();
   assert.equal(await p.locator('.atelier-main-content').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(252, 253, 251)');
   await p.evaluate(()=>{DuskMedia.drawPraise=()=>false;englishProgress.trainingV1.auto=false;});
   const index=await p.evaluate(()=>englishProgress.trainingV1.options.findIndex(o=>o.correct));await p.locator(`[data-option="${index}"]`).click();
   assert.equal(await p.locator('.training-comparison button').count(),1);
   await p.screenshot({path:path.resolve(__dirname,`../../方案预览/正式紧凑答案-${edition}-mobile.png`)});
   const word=await p.locator('.training-word-row h3').textContent();await p.locator('.training-footer .training-continue').click();assert.notEqual(await p.locator('.training-word-row h3').textContent(),word);
   assert.deepEqual(errors,[]);await c.close();console.log('PASS',edition,'B viewport wallpaper, C contain gallery, three phone sizes, custom restore, compact answer and fixed continue; synthetic only');
  }finally{await new Promise(r=>server.close(r));}
 }}finally{clearTimeout(watchdog);await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
