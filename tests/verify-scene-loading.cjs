const assert=require('node:assert/strict');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require(path.resolve(__dirname,'../../方案预览/.tools/node_modules/playwright'));
const {buildRelease}=require('../build-release.cjs');
const fixture={selectedCourses:[{name:'Test',teacher:'Test',room:'T1',day:0,periods:[1,2],weeks:[[1,17]],type:'major'}],days:Array.from({length:7},(_,i)=>({name:'Day '+i,tasks:[],line:'Test'})),checked:{},englishProgress:{},englishStart:'2026-10-08',appointments:[],englishAdjustments:[],changedAt:1};
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{for(const edition of ['personal','share']){
  const files=buildRelease(edition),mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2'};
  const server=http.createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';if(!files[name])return res.writeHead(404).end();res.setHeader('Content-Type',mime[path.extname(name)]||'application/json');res.end(files[name]);});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{for(const mode of ['slow','cancel','failure','timeout']){
   const c=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Asia/Shanghai',serviceWorkers:'block'});
   await c.route('https://**',r=>r.abort());
   let release;const gate=new Promise(r=>release=r);
   await c.route('**/assets/dusk-sword.webp',async r=>{if(mode==='failure')return r.abort();await gate;try{await r.fulfill({body:files['assets/dusk-sword.webp'],contentType:'image/webp'});}catch{}});
   await c.addInitScript(({fixture,edition})=>{const prefix=edition==='share'?'dusk-demo-v1:':'';localStorage.setItem(prefix+'dusk-study-pet-full-state-v1',JSON.stringify(fixture));if(edition==='personal')localStorage.setItem('dusk-study-pet-access-code-v1','test-only');},{fixture,edition});
   const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
   await p.clock.install({time:new Date('2026-10-09T12:00:00+08:00')});await p.clock.pauseAt(new Date('2026-10-09T12:00:01+08:00'));
   await p.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>days.length===7&&!restoringResume&&document.querySelector('#wordTraining'));
   // This regression isolates the original fallback resource. Random-pool loading has its own tests.
   await p.evaluate(()=>{DuskMedia.scene=()=>DuskMedia.prepare('assets/dusk-sword.webp');DuskMedia.drawPraise=()=>false;});
   await p.locator('button[data-atelier-view="englishView"]').click();
   const index=await p.evaluate(()=>englishProgress.trainingV1.options.findIndex(o=>!o.correct));
   await p.locator(`#wordTraining [data-option="${index}"]`).click();
   assert.equal(await p.locator('.training-word-row').isVisible(),true,'answers stay visible while loading');
   assert.equal(await p.locator('.training-scene').count(),0);
   if(mode==='slow'){
    await p.clock.runFor(2000);assert.equal(await p.locator('.training-scene').count(),0,'loading does not consume scene duration');
    release();await p.locator('.training-scene').waitFor({state:'visible'});
    assert.equal(await p.locator('.training-scene img').evaluate(img=>img.complete&&img.naturalWidth>0),true,'image decoded before hiding answers');
    await p.clock.runFor(999);assert.equal(await p.locator('.training-scene').count(),1);
    await p.clock.runFor(1);assert.equal(await p.locator('.training-scene').count(),0);
    for(const size of [{width:1440,height:1000},{width:900,height:650},{width:390,height:844},{width:320,height:568}]){
     await p.setViewportSize(size);
     await p.locator('button[data-atelier-view="englishView"]').click();
     await p.locator('[data-training="undo"]').click();
     const choice=await p.evaluate(()=>englishProgress.trainingV1.options.findIndex(o=>!o.correct));
     await p.locator(`#wordTraining [data-option="${choice}"]`).click();
     await p.locator('.training-scene').waitFor({state:'visible'});
     await p.locator('.training-scene').evaluate(el=>el.getAnimations({subtree:true}).forEach(a=>{a.pause();a.currentTime=400;}));
     await p.waitForFunction(()=>{
      const s=document.querySelector('.training-scene').getBoundingClientRect(),mobile=innerWidth<=760;
      const expected=mobile?{left:0,right:innerWidth,top:document.querySelector('.atelier-bar').getBoundingClientRect().bottom,bottom:document.querySelector('.atelier-nav').getBoundingClientRect().top}:document.querySelector('.atelier-main-content').getBoundingClientRect();
      return ['left','right','top','bottom'].every(key=>Math.abs(s[key]-expected[key])<2);
     });
     assert.equal(await p.evaluate(()=>{const s=document.querySelector('.training-scene').getBoundingClientRect(),text=document.querySelector('.training-scene-line').getBoundingClientRect();return text.left>=s.left&&text.right<=s.right&&text.bottom<=s.bottom&&s.width<=innerWidth;}),true);
     await p.screenshot({path:path.resolve(__dirname,`../../方案预览/整画夹反馈-${edition}-${size.width}.png`)});
     if(size.width===1440){
      const oldStyle=await p.evaluate(()=>{const main=document.querySelector('.app main'),old=main.getAttribute('style');Object.assign(main.style,{left:'40px',top:'60px',width:'460px',height:'270px'});return old;});
      await p.waitForFunction(()=>{const a=document.querySelector('.training-scene').getBoundingClientRect(),b=document.querySelector('.atelier-main-content').getBoundingClientRect();return Math.abs(a.width-b.width)<2&&Math.abs(a.height-b.height)<2;});
      assert.equal(await p.evaluate(()=>{const s=document.querySelector('.training-scene').getBoundingClientRect(),t=document.querySelector('.training-scene-line').getBoundingClientRect();return t.bottom<=s.bottom&&t.left>=s.left&&t.right<=s.right;}),true,'small resized pane keeps subtitle visible');
      await p.screenshot({path:path.resolve(__dirname,`../../方案预览/整画夹反馈-${edition}-compact.png`)});
      await p.evaluate(old=>{const main=document.querySelector('.app main');if(old===null)main.removeAttribute('style');else main.setAttribute('style',old);},oldStyle);
     }
     await p.locator('.training-scene-skip').click();
    }
   }else if(mode==='cancel'){
    await p.locator('.training-footer [data-training="continue"]').click();release();await p.waitForTimeout(100);
    assert.equal(await p.locator('.training-scene').count(),0,'late image must not interrupt next word');
   }else{
    await p.clock.runFor(5100);release();await p.waitForTimeout(100);
    assert.equal(await p.locator('.training-scene').count(),0,'failed/late image never hides answer');
    assert.equal(await p.locator('.training-wrong').isVisible(),true);
    assert.equal(await p.locator('.training-footer [data-training="continue"]').isEnabled(),true);
   }
   assert.equal(await p.locator('.atelier-main-content').evaluate(el=>el.inert),false);
   assert.deepEqual(errors,[]);await c.close();
  }}finally{await new Promise(r=>server.close(r));}
  console.log('PASS '+edition+': delayed decode, full-pane coverage and resize, 1s after ready, cancel, failure, timeout; synthetic only');
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
